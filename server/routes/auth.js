const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const admin = require('firebase-admin');
const { authenticateToken, requireRole } = require('../middleware/auth');
const firebaseService = require('../services/firebase');
const paypalService = require('../services/paypal');

const router = express.Router();

// Register new user
router.post('/register', [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters'),
  body('role')
    .isIn(['competitor', 'range_officer', 'range_admin', 'admin'])
    .withMessage('Role must be competitor, range_officer, range_admin, or admin'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number must be less than 20 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      username,
      email,
      password,
      firstName,
      lastName,
      role,
      dateOfBirth,
      phone,
      location
    } = req.body;

    // Check if user already exists
    const existingUserByEmail = await firebaseService.findUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const existingUserByUsername = await firebaseService.findUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user data
    const userData = {
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      phone: phone || null,
      location: location || null,
      bio: '',
      avatar: '',
      // TODO: sponsors
      totalCompetitions: 0,
      totalScores: 0,
      personalBestIndoor: 0,
      personalBestOutdoor: 0,
      averageScore: 0,
      // TODO: calculation
      isVerified: role === 'competitor', // Competitors are auto-verified
      isActive: true,
      verificationStatus: role === 'competitor' ? 'verified' : 'pending'
      // TODO: for range officers and admins
    };

    // Remove undefined values to prevent Firestore errors
    Object.keys(userData).forEach(key => {
      if (userData[key] === undefined) {
        delete userData[key];
      }
    });

    // Create user in Firebase
    const user = await firebaseService.create('users', userData);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await firebaseService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await firebaseService.getById('users', req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const user = await firebaseService.getById('users', req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Change password
router.put('/change-password', [
  authenticateToken,
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user
    const user = await firebaseService.getById('users', req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await firebaseService.update('users', user.id, { password: hashedNewPassword });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Forgot password
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Check if user exists
    const user = await firebaseService.findUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If the email exists, a password reset link has been sent' });
    }

    // TODO: Implement email sending
    // For now, just return success message
    res.json({ message: 'If the email exists, a password reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// @route   POST /api/auth/seed-admin
// @desc    Create an admin user for testing (remove in production)
// @access  Public
router.post('/seed-admin', async (req, res) => {
  try {
    // Delete existing admin user if it exists (to fix password issue)
    const existingAdmin = await firebaseService.find('users', { email: 'admin@22lr.com' });
    if (existingAdmin.length > 0) {
      await firebaseService.delete('users', existingAdmin[0].id);
    }

    // Hash the password properly
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);
    
    const adminUser = {
      email: 'admin@22lr.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      password: hashedPassword, // Properly hashed password
      isVerified: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalCompetitions: 0,
      totalScores: 0,
      personalBestIndoor: 0,
      personalBestOutdoor: 0,
      averageScore: 0,
      bio: '',
      avatar: '',
      verificationStatus: 'verified'
    };

    const createdAdmin = await firebaseService.create('users', adminUser);
    
    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: createdAdmin.id,
        email: adminUser.email,
        username: adminUser.username,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// @route   POST /api/auth/range-admin/signup
// @desc    Public range admin sign-up with PayPal payment confirmation
// @access  Public
router.post('/range-admin/signup', [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number must be less than 20 characters'),
  body('rangeName')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Range name is required and must be less than 120 characters'),
  body('rangeAddressLine1')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Primary address is required'),
  body('rangeCity')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('City is required'),
  body('rangeState')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('State or province is required'),
  body('rangePostalCode')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Postal code is required'),
  body('rangeCountry')
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('Country must be between 2 and 60 characters'),
  body('rangeWebsite')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Website must be less than 200 characters'),
  body('paypalOrderId')
    .trim()
    .notEmpty()
    .withMessage('PayPal order confirmation is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      username,
      email,
      password,
      firstName,
      lastName,
      phone,
      rangeName,
      rangeAddressLine1,
      rangeAddressLine2,
      rangeCity,
      rangeState,
      rangePostalCode,
      rangeCountry = 'US',
      rangeWebsite,
      paypalOrderId,
    } = req.body;

    const normalizedCountry = rangeCountry || 'US';

    const existingUserByEmail = await firebaseService.findUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const existingUserByUsername = await firebaseService.findUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    try {
      await admin.auth().getUserByEmail(email);
      return res.status(400).json({ error: 'Email already registered' });
    } catch (authError) {
      if (authError.code && authError.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    const paymentDetails = await paypalService.verifyHostedButtonOrder({
      orderId: paypalOrderId,
      expectedAmount: 20,
      expectedCurrency: 'USD',
    });

    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`.trim(),
      phoneNumber: phone && phone.trim().length >= 10 ? phone.trim() : undefined,
    });

    const now = new Date();
    const renewalDate = new Date(now);
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const rangeLocation = [rangeCity, rangeState].filter(Boolean).join(', ');

    const rangeData = {
      name: rangeName,
      address: {
        line1: rangeAddressLine1,
        line2: rangeAddressLine2 || null,
        city: rangeCity,
        state: rangeState,
        postalCode: rangePostalCode,
        country: normalizedCountry,
      },
      location: rangeLocation,
      phone: phone || null,
      website: rangeWebsite || null,
      adminId: firebaseUser.uid,
      adminEmail: email,
      subscriptionStatus: 'active',
      subscriptionPlan: 'range_admin_monthly',
      subscriptionAmount: paymentDetails.amount,
      subscriptionCurrency: paymentDetails.currency,
      subscriptionRenewalDate: renewalDate,
      subscriptionLastPaymentDate: now,
      paymentProvider: 'paypal',
      lastPaymentOrderId: paymentDetails.id,
      revenue: {
        total: 0,
        entryCount: 0,
        lastRecordedAt: null,
      },
    };

    const range = await firebaseService.create('ranges', rangeData);

    const userProfile = {
      username,
      email,
      firstName,
      lastName,
      role: 'range_admin',
      phone: phone || null,
      rangeName,
      rangeId: range.id,
      rangeLocation,
      rangeAddress: rangeData.address,
      subscriptionStatus: 'active',
      subscriptionPlan: 'range_admin_monthly',
      subscriptionAmount: paymentDetails.amount,
      subscriptionCurrency: paymentDetails.currency,
      subscriptionRenewalDate: renewalDate,
      subscriptionLastPaymentDate: now,
      subscriptionProvider: 'paypal',
      subscriptionOrderId: paymentDetails.id,
      isVerified: true,
      isActive: true,
      verificationStatus: 'verified',
    };

    await firebaseService.setDocument('users', firebaseUser.uid, userProfile);

    res.status(201).json({
      message: 'Range admin account created successfully',
      userId: firebaseUser.uid,
      rangeId: range.id,
      subscriptionStatus: 'active',
      renewalDate: renewalDate.toISOString(),
      paypalOrderId: paymentDetails.id,
    });
  } catch (error) {
    console.error('Range admin signup error:', error);
    const status = error.status || 500;
    const response = { error: error.message || 'Failed to create range admin account' };
    if (error.paypalStatus) {
      response.paypalStatus = error.paypalStatus;
    }
    if (typeof error.amount !== 'undefined') {
      response.amount = error.amount;
    }
    if (error.currency) {
      response.currency = error.currency;
    }
    res.status(status).json(response);
  }
});

// @route   POST /api/auth/create-range-admin
// @desc    Create a range admin account (Admin only)
// @access  Private (Admin only)
router.post('/create-range-admin', [
  authenticateToken,
  requireRole(['admin']),
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters'),
  body('rangeName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Range name is required and must be less than 100 characters'),
  body('rangeLocation')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Range location is required and must be less than 200 characters'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number must be less than 20 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      username,
      email,
      password,
      firstName,
      lastName,
      rangeName,
      rangeLocation,
      phone
    } = req.body;

    // Check if user already exists
    const existingUserByEmail = await firebaseService.findUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const existingUserByUsername = await firebaseService.findUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create range admin user data
    const userData = {
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'range_admin',
      rangeName,
      rangeLocation,
      phone: phone || null,
      bio: '',
      avatar: '',
      totalCompetitions: 0,
      totalScores: 0,
      personalBestIndoor: 0,
      personalBestOutdoor: 0,
      averageScore: 0,
      isVerified: true, // Range admins are auto-verified
      isActive: true,
      verificationStatus: 'verified',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subscriptionStatus: 'active',
      subscriptionPlan: 'admin_grant',
      subscriptionAmount: 0,
      subscriptionCurrency: 'USD',
      subscriptionRenewalDate: null,
      subscriptionLastPaymentDate: new Date(),
      subscriptionProvider: 'manual'
    };

    // Create user in Firebase
    const user = await firebaseService.create('users', userData);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'Range admin account created successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Range admin creation error:', error);
    res.status(500).json({ error: 'Failed to create range admin account' });
  }
});

module.exports = router;
