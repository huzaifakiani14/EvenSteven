# EvenSteven 💸

A simplified Splitwise clone for splitting bills, tracking expenses, and managing group balances fairly.

## Features

- 🔐 **Google Sign-In** - Secure authentication with Firebase
- 👥 **Multi-User Groups** - Create groups and invite others via email
- 📧 **Email Invitations** - Invite users by email with secure join links
- 💰 **Expense Tracking** - Add expenses with title, amount, and split configuration
- 📊 **Balance Dashboard** - View who owes whom with real-time updates
- 🎯 **Smart Settlements** - Optimized payment suggestions to minimize transactions
- 📱 **Activity Feed** - Track recent actions in each group
- 🔔 **Invite Notifications** - See pending invitations in the navigation bar
- 👤 **Member Management** - View all group members with roles (admin/member)
- 🎨 **Modern UI** - Beautiful dark-mode interface with Tailwind CSS

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Firebase (Firestore + Authentication)
- **Hosting:** Vercel (auto-deployment configured)

## Setup Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable Google Sign-In provider
4. Create Firestore Database:
   - Go to Firestore Database
   - Create database in production mode
   - Set up security rules (see below)
5. Get your Firebase configuration:
   - Go to Project Settings > General
   - Scroll down to "Your apps" and click the web icon (</>)
   - Copy your Firebase configuration values

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Firestore Security Rules

Update your Firestore security rules in Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Groups: only members can read, creator can write
    match /groups/{groupId} {
      allow read: if request.auth != null && request.auth.uid in resource.data.members;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.createdBy;
      // Creator can update, or user can update when accepting invite (adding themselves)
      allow update: if request.auth != null && (
        request.auth.uid == resource.data.createdBy ||
        (request.auth.uid in request.resource.data.members && 
         !(request.auth.uid in resource.data.members))
      );
    }
    
    // Expenses: only authenticated users can read/write
    match /expenses/{expenseId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null && 
        request.auth.uid == resource.data.createdBy;
    }
    
    // Activities: only authenticated users can read/write
    match /activities/{activityId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null;
    }
    
    // Invites: users can read invites sent to their email
    match /invites/{inviteId} {
      allow read: if request.auth != null && 
        request.auth.token.email != null &&
        resource.data.invitedEmail == request.auth.token.email.toLowerCase();
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.invitedBy;
      allow update: if request.auth != null && 
        request.auth.token.email != null &&
        resource.data.invitedEmail == request.auth.token.email.toLowerCase();
      allow delete: if request.auth != null && 
        request.auth.uid == resource.data.invitedBy;
    }
  }
}
```

### 4. Firestore Indexes

You may need to create composite indexes in Firestore:

1. Go to Firestore Database > Indexes
2. Create the following indexes:
   - Collection: `groups`
     - Fields: `members` (Array), `createdAt` (Descending)
   - Collection: `expenses`
     - Fields: `groupId` (Ascending), `createdAt` (Descending)
   - Collection: `activities`
     - Fields: `groupId` (Ascending), `createdAt` (Descending)
   - Collection: `invites`
     - Fields: `invitedEmail` (Ascending), `status` (Ascending), `createdAt` (Descending)

### 5. Install Dependencies

```bash
npm install
```

### 6. Run Development Server

```bash
npm run dev
```

### 7. Deploy to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com/)
3. Import your repository
4. Add environment variables in Vercel dashboard:
   - Go to Project Settings > Environment Variables
   - Add all the `VITE_FIREBASE_*` variables
5. Deploy!

The app will automatically deploy on every push to your main branch.

## Project Structure

```
EvenSteven/
├── src/
│   ├── components/       # React components
│   │   ├── Login.tsx
│   │   ├── Layout.tsx
│   │   ├── GroupsList.tsx
│   │   └── GroupDetails.tsx
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx
│   ├── services/         # Firebase services
│   │   ├── authService.ts
│   │   └── firebaseService.ts
│   ├── utils/            # Utility functions
│   │   └── balanceCalculator.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   ├── config/           # Configuration
│   │   └── firebase.ts
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
├── .env.example          # Environment variables template
├── vercel.json           # Vercel deployment config
└── package.json
```

## Usage

1. Sign in with Google
2. Create a group
3. Add expenses to the group
4. View balances and optimized settlement suggestions
5. Track activity in the activity feed

## License

MIT
