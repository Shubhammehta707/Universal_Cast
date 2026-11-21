import React, { createContext, useContext, useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export interface AuthErrorInfo {
  code: string;
  message: string;
  userFriendlyMessage: string;
  hostname: string;
  isUnauthorizedDomain: boolean;
  isPopupBlocked: boolean;
  isPopupClosed: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: AuthErrorInfo | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.emailVerified) {
        setAuthError(null);
        try {
          await setDoc(
            doc(db, 'users', currentUser.uid),
            {
              uid: currentUser.uid,
              email: currentUser.email || 'user@universalcast.local',
              displayName: currentUser.displayName || 'UniversalCast User',
              photoURL: currentUser.photoURL || '',
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn('User profile Firestore sync notice:', e);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearAuthError = () => {
    setAuthError(null);
  };

  const signInWithGoogle = async (): Promise<User | null> => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error: unknown) {
      const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
      let code = 'auth/unknown';
      let rawMessage = 'An unknown authentication error occurred.';

      if (error instanceof FirebaseError) {
        code = error.code;
        rawMessage = error.message;
      } else if (error instanceof Error) {
        rawMessage = error.message;
      }

      console.error('[FirebaseAuth] Google Sign-In failed', {
        code,
        hostname: currentHostname,
      });

      const isUnauthorizedDomain = code === 'auth/unauthorized-domain';
      const isPopupBlocked = code === 'auth/popup-blocked';
      const isPopupClosed = code === 'auth/popup-closed-by-user';

      let userFriendlyMessage = rawMessage;
      if (isUnauthorizedDomain) {
        userFriendlyMessage = `This domain (${currentHostname}) is not authorized in your Firebase Authentication settings. Please add it to "Authorized domains" in the Firebase Console.`;
      } else if (isPopupBlocked) {
        userFriendlyMessage = 'The Google Sign-In popup was blocked by your browser. Please allow popups for this site and retry.';
      } else if (isPopupClosed) {
        userFriendlyMessage = 'The Google Sign-In popup was closed before completing authentication. Please try again.';
      } else if (code === 'auth/cancelled-popup-request') {
        userFriendlyMessage = 'Only one sign-in window can be open at a time.';
      } else if (code === 'auth/network-request-failed') {
        userFriendlyMessage = 'Network connection failed while reaching Google Authentication servers.';
      }

      const errorInfo: AuthErrorInfo = {
        code,
        message: rawMessage,
        userFriendlyMessage,
        hostname: currentHostname,
        isUnauthorizedDomain,
        isPopupBlocked,
        isPopupClosed,
      };

      setAuthError(errorInfo);
      throw errorInfo;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setAuthError(null);
    } catch (err: unknown) {
      console.error('[FirebaseAuth] Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        clearAuthError,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
