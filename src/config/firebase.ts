import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const hasValidConfig = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== '' &&
  firebaseConfig.authDomain && 
  firebaseConfig.authDomain !== '' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== '';

if (!hasValidConfig) {
  const missingVars = [];
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === '') missingVars.push('VITE_FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain || firebaseConfig.authDomain === '') missingVars.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId || firebaseConfig.projectId === '') missingVars.push('VITE_FIREBASE_PROJECT_ID');
  
  console.error('Firebase configuration missing - check environment variables:', missingVars);
  console.error('Current config:', {
    hasApiKey: !!firebaseConfig.apiKey,
    hasAuthDomain: !!firebaseConfig.authDomain,
    hasProjectId: !!firebaseConfig.projectId,
    projectId: firebaseConfig.projectId,
  });
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const googleProvider = new GoogleAuthProvider();

googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;

