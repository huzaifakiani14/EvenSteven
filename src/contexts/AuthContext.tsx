import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthChange } from '../services/authService';
import { getUser } from '../services/firebaseService';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userData = await getUser(firebaseUser.uid);
          setUser(userData);
          // If user doesn't exist in Firestore yet, create a basic user object from Firebase auth
          if (!userData && firebaseUser.email) {
            setUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'User',
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL || undefined,
              createdAt: new Date(),
            });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Still set user from Firebase auth data if available
          if (firebaseUser.email) {
            setUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'User',
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL || undefined,
              createdAt: new Date(),
            });
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

