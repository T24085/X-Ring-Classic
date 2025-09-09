const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  const serviceAccount = require('./firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://websitesolutionscrm.firebaseio.com'
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function testFirebase() {
  try {
    console.log('Testing Firebase connection...');
    
    // Try to create a test document
    const testData = {
      test: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('test').add(testData);
    console.log('✅ Successfully created test document with ID:', docRef.id);
    
    // Try to read it back
    const doc = await docRef.get();
    console.log('✅ Successfully read test document:', doc.data());
    
    // Clean up
    await docRef.delete();
    console.log('✅ Successfully deleted test document');
    
    console.log('🎉 Firebase is working correctly!');
  } catch (error) {
    console.error('❌ Firebase test failed:', error.message);
    console.error('Error details:', error);
  }
}

testFirebase();
