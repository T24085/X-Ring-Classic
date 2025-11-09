const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// You'll need to download your service account key from Firebase Console
// and place it in the server directory as 'firebase-service-account.json'
try {
  const serviceAccount = require('./firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://your-project-id.firebaseio.com'
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error.message);
  console.log('📝 Please make sure you have:');
  console.log('   1. Downloaded your Firebase service account key');
  console.log('   2. Placed it as "firebase-service-account.json" in the server directory');
  console.log('   3. Set FIREBASE_DATABASE_URL in your .env file');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const competitionRoutes = require('./routes/competitions');
const scoreRoutes = require('./routes/scores');
const leaderboardRoutes = require('./routes/leaderboards');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

const paymentRoutes = require('./routes/payments');



// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/leaderboards', leaderboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

app.use('/api/payments', paymentRoutes);



// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'The X-Ring Classic API is running',
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 API base URL: http://localhost:${PORT}/api`);
});
