# EvenSteven 💸

A bill-splitting app for groups to track expenses, manage balances, and settle up fairly.

## Features

- **Google Authentication** - Sign in with Google via Firebase
- **Group Management** - Create groups and invite friends via shareable links or join codes
- **Expense Tracking** - Add expenses, specify who paid, and split among members
- **Balance Calculation** - Real-time calculation of who owes whom
- **Payment Recording** - Record payments (cash, Zelle, Venmo, PayPal) to clear balances
- **Smart Settlements** - Optimized payment suggestions to minimize transactions
- **Activity Feed** - Track all group activity and changes
- **Mobile Responsive** - Works great on phones and tablets
- **Dark Theme** - Modern dark-mode UI

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS
- **Backend:** Firebase (Firestore + Authentication)
- **Deployment:** Vercel with automatic CI/CD

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase account
- Vercel account (for deployment)

### Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication → Google Sign-In
3. Create Firestore Database (production mode)
4. Deploy security rules from `FIRESTORE_RULES.txt`
5. Create required indexes (see `FIRESTORE_INDEXES.md`)
6. Get your config from Project Settings → General → Your apps → Web

### Environment Variables

Create `.env` in the root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Installation

```bash
npm install
npm run dev
```

### Deployment

1. Push to GitHub
2. Import repository in Vercel
3. Add all `VITE_FIREBASE_*` environment variables
4. Deploy (auto-deploys on push to main)

## Project Structure

```
src/
├── components/        # React components
│   ├── Login.tsx
│   ├── GroupsList.tsx
│   ├── GroupDetails.tsx
│   ├── JoinPage.tsx
│   ├── JoinByCode.tsx
│   ├── Layout.tsx
│   ├── AuthWatcher.tsx
│   └── Toast.tsx
├── contexts/          # React contexts
│   └── AuthContext.tsx
├── services/          # Firebase services
│   ├── authService.ts
│   └── firebaseService.ts
├── utils/             # Utilities
│   ├── balanceCalculator.ts
│   └── joinCodeGenerator.ts
├── hooks/             # Custom hooks
│   └── useToast.tsx
├── types/             # TypeScript types
│   └── index.ts
└── config/            # Configuration
    └── firebase.ts
```

## How It Works

1. **Sign In** - Use Google to authenticate
2. **Create Group** - Make a group and get a shareable link or join code
3. **Add Expenses** - Record expenses and split among members
4. **View Balances** - See who owes whom in real-time
5. **Record Payments** - Mark payments as paid (balances update automatically)
6. **Settle Up** - Use optimized settlement suggestions

## Firestore Collections

- `users` - User profiles
- `groups` - Group data with members
- `expenses` - Expense records
- `payments` - Payment records
- `activities` - Activity log

## License

MIT
