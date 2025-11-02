import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { createOrUpdateUser } from './firebaseService';
import type { User } from '../types';

export const signInWithGoogle = async (): Promise<User> => {
  const result = await signInWithPopup(auth, googleProvider);
  const firebaseUser = result.user;

  // Validate required fields
  if (!firebaseUser.uid) {
    throw new Error('Failed to get user ID from Google sign-in');
  }

  if (!firebaseUser.email) {
    throw new Error('Email is required. Please sign in with a Google account that has an email address.');
  }

  const user: User = {
    uid: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'User',
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL || undefined,
    createdAt: new Date(),
  };

  try {
    await createOrUpdateUser(user);
  } catch (error: any) {
    console.error('Error creating/updating user in Firestore:', error);
    // If Firestore write fails, still return the user so they can use the app
    // The AuthContext will try to fetch the user again
    if (error?.code === 'permission-denied') {
      throw new Error('Permission denied. Please check Firestore security rules allow user creation.');
    }
    throw error;
  }
  
  return user;
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

