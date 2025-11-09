const jwt = require('jsonwebtoken');
const firebaseService = require('../services/firebase');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (!decoded.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const user = await firebaseService.getById('users', decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Remove password from user object and add userId for consistency
    const { password, ...userWithoutPassword } = user;
    req.user = { ...userWithoutPassword, userId: user.id };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Middleware to check if user has required role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        requiredRoles,
        userRole: req.user.role
      });
    }

    const needsActiveSubscription = requiredRoles.includes('range_admin');
    if (
      needsActiveSubscription &&
      req.user.role === 'range_admin' &&
      !req.allowInactiveSubscription &&
      !['active', 'trialing'].includes(req.user.subscriptionStatus || '')
    ) {
      return res.status(402).json({
        error: 'Active range admin subscription required',
        subscriptionStatus: req.user.subscriptionStatus || 'inactive'
      });
    }

    next();
  };
};

// Middleware to check if user is verified
const requireVerification = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({ 
      error: 'Account verification required',
      verificationStatus: req.user.verificationStatus
    });
  }
  next();
};

// Middleware to check if user owns the resource or is admin/range_admin
const requireOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (req.user.role === 'admin' || req.user.role === 'range_admin') {
      return next();
    }

    if (req.user.id !== resourceUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
};

// Middleware to check if competition is owned by range admin or admin
const requireCompetitionOwnership = async (req, res, next) => {
  try {
    const competition = await firebaseService.getById('competitions', req.params.id);
    
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    if (req.user.role === 'admin' || 
        (req.user.role === 'range_admin' && competition.organizerId === req.user.id)) {
      req.competition = competition;
      return next();
    }

    return res.status(403).json({ error: 'Access denied' });
  } catch (error) {
    console.error('Competition ownership check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Middleware to check if user can manage range operations
const requireRangeAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'range_admin') {
    return res.status(403).json({
      error: 'Range admin access required',
      requiredRoles: ['admin', 'range_admin'],
      userRole: req.user.role
    });
  }

  if (
    req.user.role === 'range_admin' &&
    !req.allowInactiveSubscription &&
    !['active', 'trialing'].includes(req.user.subscriptionStatus || '')
  ) {
    return res.status(402).json({
      error: 'Active range admin subscription required',
      subscriptionStatus: req.user.subscriptionStatus || 'inactive'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireVerification,
  requireOwnership,
  requireCompetitionOwnership,
  requireRangeAdmin
};
