import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration - user needs to add their keys
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'YOUR_AUTH_DOMAIN',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'YOUR_STORAGE_BUCKET',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_MESSAGING_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'YOUR_APP_ID',
};

// Validate Firebase config (works in both dev and production)
const hasValidConfig = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
  firebaseConfig.authDomain && 
  firebaseConfig.authDomain !== 'YOUR_AUTH_DOMAIN';

if (!hasValidConfig) {
  console.error('❌ Firebase configuration is missing or incomplete!');
  console.error('Missing variables:', {
    apiKey: !firebaseConfig.apiKey || firebaseConfig.apiKey === 'YOUR_API_KEY',
    authDomain: !firebaseConfig.authDomain || firebaseConfig.authDomain === 'YOUR_AUTH_DOMAIN',
    projectId: !firebaseConfig.projectId || firebaseConfig.projectId === 'YOUR_PROJECT_ID',
  });
  console.error('Please ensure all VITE_FIREBASE_* environment variables are set in Vercel.');
} else {
  console.log('✅ Firebase config loaded:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
  });
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Add scopes if needed
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Set custom parameters for the sign-in popup
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export default app;

