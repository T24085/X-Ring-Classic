// Lightweight Firebase client initialization used for GitHub Pages (no backend)
// Configure via environment variables prefixed with REACT_APP_

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Prefer env vars; fallback to provided config so GitHub Pages builds still work
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyBccC5IPUYqTMQ6bEMy0NP2H5UqEOObGaE',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'websitesolutionscrm.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'websitesolutionscrm',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'websitesolutionscrm.appspot.com',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '493384645576',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:493384645576:web:6ac2c785291db2c8f51efd',
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || 'G-CYCJJ3BTZG',
};

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
  // Provide a clearer message in the console for missing config
  // The build must include REACT_APP_FIREBASE_* variables.
  // See DEPLOY_GITHUB_PAGES.md for setup steps.
  console.error('Firebase config missing or invalid. Ensure REACT_APP_FIREBASE_* env vars are set before building.');
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

