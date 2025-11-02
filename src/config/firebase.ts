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

// Debug: Log Firebase config status (in development only)
if (import.meta.env.DEV) {
  const hasConfig = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY';
  console.log('Firebase Config:', {
    hasConfig,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
  });
  if (!hasConfig) {
    console.warn('⚠️ Firebase config is missing! Please check your .env file.');
  }
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

