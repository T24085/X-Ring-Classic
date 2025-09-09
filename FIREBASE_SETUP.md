# Firebase Setup Guide

This guide will help you set up Firebase for the 22LR Rifle Championship application.

## Prerequisites

- A Google account
- Node.js 16+ installed
- Basic understanding of web development

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "22lr-rifle-championship")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Firestore Database

1. In your Firebase project, click on "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in test mode" for development (you can secure it later)
4. Select a location for your database (choose the closest to your users)
5. Click "Done"

## Step 3: Get Service Account Key

1. In your Firebase project, click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Go to the "Service accounts" tab
4. Click "Generate new private key"
5. Click "Generate key"
6. Download the JSON file
7. Rename the downloaded file to `firebase-service-account.json`
8. Place it in the `server` directory of your project

## Step 4: Update Environment Variables

1. Open `server/.env` file
2. Update the following variables:

```env
# Firebase Configuration
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
```

Replace `your-project-id` with your actual Firebase project ID (found in the Firebase console URL).

## Step 5: Security Rules (Optional but Recommended)

In the Firebase Console, go to Firestore Database > Rules and update the rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to published competitions
    match /competitions/{competitionId} {
      allow read: if resource.data.status == 'published';
      allow write: if request.auth != null && 
        (request.auth.token.role == 'admin' || 
         request.auth.token.role == 'range_officer');
    }
    
    // Allow users to read their own data and update their profile
    match /users/{userId} {
      allow read: if request.auth != null && 
        (request.auth.uid == userId || 
         request.auth.token.role == 'admin');
      allow write: if request.auth != null && 
        (request.auth.uid == userId || 
         request.auth.token.role == 'admin');
    }
    
    // Allow authenticated users to create scores
    match /scores/{scoreId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        (request.auth.token.role == 'admin' || 
         request.auth.token.role == 'range_officer');
    }
  }
}
```

## Step 6: Test the Setup

1. Run the setup script:
   ```bash
   node setup.js
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Check the server logs to ensure Firebase is connected:
   ```
   ✅ Firebase Admin SDK initialized successfully
   🚀 Server running on port 5000
   ```

## Troubleshooting

### Common Issues

1. **"Error initializing Firebase Admin SDK"**
   - Make sure `firebase-service-account.json` is in the server directory
   - Verify the JSON file is valid and complete
   - Check that the project ID in your .env matches your Firebase project

2. **"Permission denied" errors**
   - Check your Firestore security rules
   - Ensure your service account has the necessary permissions
   - Verify the database URL is correct

3. **"Collection not found" errors**
   - Collections are created automatically when you first add documents
   - This is normal behavior in Firestore

### Getting Help

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)

## Next Steps

Once Firebase is set up, you can:

1. Start building your application features
2. Add authentication (Firebase Auth)
3. Set up hosting (Firebase Hosting)
4. Configure storage for file uploads (Firebase Storage)

## Security Best Practices

1. **Never commit your service account key to version control**
   - Add `firebase-service-account.json` to your `.gitignore` file
   - Use environment variables in production

2. **Set up proper Firestore security rules**
   - Start with restrictive rules and gradually open up access
   - Always validate data on the server side

3. **Use Firebase Auth for user authentication**
   - Don't implement your own authentication system
   - Leverage Firebase's built-in security features

4. **Regular backups**
   - Set up automated backups of your Firestore data
   - Test your backup and restore procedures

## Production Considerations

1. **Environment Variables**
   - Use different Firebase projects for development and production
   - Store sensitive configuration in environment variables

2. **Monitoring**
   - Set up Firebase Analytics
   - Monitor your Firestore usage and costs
   - Set up alerts for unusual activity

3. **Performance**
   - Use Firestore indexes for complex queries
   - Implement pagination for large datasets
   - Consider caching strategies

4. **Cost Optimization**
   - Monitor your Firestore read/write operations
   - Use batch operations when possible
   - Consider using Firebase Functions for server-side operations
