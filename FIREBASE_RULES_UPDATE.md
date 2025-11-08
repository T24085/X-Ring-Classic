# How to Update Firestore Security Rules

## The Problem
You're getting a "Missing or insufficient permissions" error when trying to create ranges because the Firestore security rules don't include permissions for the `ranges` collection.

## Solution: Update Firestore Rules in Firebase Console

### Step 1: Open Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (X-Ring Classic)

### Step 2: Navigate to Firestore Rules
1. In the left sidebar, click on **"Firestore Database"**
2. Click on the **"Rules"** tab at the top

### Step 3: Update the Rules
1. You'll see a text editor with your current rules
2. **Replace the entire contents** with the rules from `firestore.rules` file in this project
3. Or copy and paste the following complete rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to get user role from Firestore user document
    function getUserRole() {
      let userDoc = get(/databases/$(database)/documents/users/$(request.auth.uid));
      return userDoc != null && userDoc.data != null ? userDoc.data.role : null;
    }
    
    // Helper function to check if user is admin
    function isAdmin() {
      return isAuthenticated() && 
        (getUserRole() == 'admin' || getUserRole() == 'range_admin');
    }
    
    // Allow read access to published competitions
    match /competitions/{competitionId} {
      allow read: if resource.data.status == 'published' || isAdmin();
      allow write: if isAdmin();
    }
    
    // Allow users to read their own data and update their profile
    match /users/{userId} {
      allow read: if isAuthenticated() && 
        (request.auth.uid == userId || isAdmin());
      allow write: if isAuthenticated() && 
        (request.auth.uid == userId || isAdmin());
    }
    
    // Allow authenticated users to create scores
    match /scores/{scoreId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }
    
    // Ranges collection - allow admins to manage, public read
    match /ranges/{rangeId} {
      allow read: if true; // Public read access
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }
    
    // Registrations collection
    match /registrations/{registrationId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && 
        (request.auth.uid == resource.data.userId || isAdmin());
      allow delete: if isAdmin();
    }
  }
}
```

### Step 4: Publish the Rules
1. Click the **"Publish"** button at the top right
2. Wait for the confirmation message that rules have been published

### Step 5: Test
1. Go back to your application
2. Try creating a range again
3. The error should be resolved!

## What These Rules Do

- **Ranges Collection**: 
  - ✅ Public read access (anyone can view ranges)
  - ✅ Only admins can create, update, or delete ranges
  
- **Competitions**: 
  - ✅ Public can read published competitions
  - ✅ Only admins can create/update competitions
  
- **Users**: 
  - ✅ Users can read/update their own profile
  - ✅ Admins can read/update any user
  
- **Scores**: 
  - ✅ Authenticated users can create scores
  - ✅ Only admins can update/delete scores
  
- **Registrations**: 
  - ✅ Authenticated users can create registrations
  - ✅ Users can update their own registrations
  - ✅ Admins can delete registrations

## Important Notes

⚠️ **User Role Storage**: These rules check the user's role from their Firestore user document (in the `users` collection). Make sure your admin users have `role: 'admin'` or `role: 'range_admin'` in their user document in Firestore.

⚠️ **Testing Mode**: If you're still in "test mode" (which allows all reads/writes for 30 days), these rules will override that. Make sure you're logged in as an admin user when testing.

⚠️ **User Document Required**: The rules read the user's role from the Firestore `users` collection. Make sure every authenticated user has a corresponding document in the `users` collection with a `role` field.

## Troubleshooting

If you still get permission errors after updating:

1. **Check if you're logged in**: Make sure you're authenticated in the app
2. **Check your user role**: Verify your user document in Firestore has `role: 'admin'` or `role: 'range_admin'`
3. **Check custom claims**: If using Firebase Auth, ensure custom claims are set via Admin SDK
4. **Wait a few seconds**: Rules can take a moment to propagate

## Need Help?

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Console](https://console.firebase.google.com/)

