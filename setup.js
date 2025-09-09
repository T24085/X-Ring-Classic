#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up 22LR Rifle Championship Project...\n');

// Check Node.js version
const nodeVersion = process.version;
console.log(`📦 Node.js version: ${nodeVersion}`);

if (parseInt(nodeVersion.slice(1).split('.')[0]) < 16) {
  console.error('❌ Node.js version 16 or higher is required');
  process.exit(1);
}

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, 'server', '.env');
const envExamplePath = path.join(__dirname, 'server', 'env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from template...');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created');
  } else {
    console.log('⚠️  env.example not found, creating basic .env file...');
    const basicEnv = `# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Firebase Configuration
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100`;
    
    fs.writeFileSync(envPath, basicEnv);
    console.log('✅ Basic .env file created');
  }
} else {
  console.log('✅ .env file already exists');
}

// Create uploads directory
const uploadsDir = path.join(__dirname, 'server', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  console.log('📁 Creating uploads directory...');
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Uploads directory created');
} else {
  console.log('✅ Uploads directory already exists');
}

// Install dependencies
console.log('\n📦 Installing dependencies...');

try {
  // Install root dependencies
  console.log('Installing root dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  // Install server dependencies
  console.log('Installing server dependencies...');
  execSync('cd server && npm install', { stdio: 'inherit' });
  
  // Install client dependencies
  console.log('Installing client dependencies...');
  execSync('cd client && npm install', { stdio: 'inherit' });
  
  console.log('✅ All dependencies installed successfully!');
} catch (error) {
  console.error('❌ Error installing dependencies:', error.message);
  process.exit(1);
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Set up Firebase project:');
console.log('   - Go to https://console.firebase.google.com/');
console.log('   - Create a new project');
console.log('   - Enable Firestore Database');
console.log('   - Go to Project Settings > Service Accounts');
console.log('   - Generate new private key (download JSON file)');
console.log('   - Rename the downloaded file to "firebase-service-account.json"');
console.log('   - Place it in the server directory');
console.log('');
console.log('2. Update your .env file with your Firebase configuration');
console.log('3. Run the development server: npm run dev');
console.log('');
console.log('�� Happy coding!');
