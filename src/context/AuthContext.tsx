/**
 * PRYORA Authentication Context
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { createOrUpdateUserProfile } from '../services/firestoreService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  firebaseUser: FirebaseUser | null;
  isFirebaseAuth: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  quickStart: (email?: string, displayName?: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string, currency?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  completeOnboarding: (data: any) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isFirebaseAuth = Boolean(firebaseUser || user?.id.startsWith('usr_') === false);

  const refreshUser = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{ user: User }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Listen to Firebase auth state
    const unsubscribe = onAuthStateChanged(auth, async fbUser => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          // Sync with backend session
          const res = await apiRequest<{ token: string; user: User }>('/api/auth/firebase-login', {
            method: 'POST',
            body: JSON.stringify({
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName,
            }),
          });
          setStoredToken(res.token);
          setToken(res.token);
          setUser(res.user);

          // Sync Firestore user profile
          await createOrUpdateUserProfile(fbUser.uid, {
            id: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || 'Workspace Owner',
          });
        } catch (err) {
          console.error('Firebase session synchronization error:', err);
        }
      }
      setIsLoading(false);
    });

    refreshUser();

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      setFirebaseUser(null);
    };

    window.addEventListener('pryora:unauthorized', handleUnauthorized);
    return () => {
      unsubscribe();
      window.removeEventListener('pryora:unauthorized', handleUnauthorized);
    };
  }, [refreshUser]);

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      setFirebaseUser(fbUser);

      // Create or update Firestore user profile
      await createOrUpdateUserProfile(fbUser.uid, {
        id: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || 'Personal Workspace',
      });

      // Synchronize with API
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/firebase-login', {
        method: 'POST',
        body: JSON.stringify({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
        }),
      });

      setStoredToken(res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (err) {
      console.error('Google Sign-in failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const quickStart = async (email?: string, displayName?: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/quick-start', {
        method: 'POST',
        body: JSON.stringify({ email, displayName }),
      });
      setStoredToken(res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const loginDemo = async () => {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/demo', {
      method: 'POST',
    });
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (email: string, password: string, displayName?: string, currency: string = 'INR') => {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName, currency }),
    });
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch {
      // Ignore fbSignOut errors if not signed in with Firebase
    }
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setFirebaseUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    const res = await apiRequest<{ user: User }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setUser(res.user);

    if (firebaseUser) {
      await createOrUpdateUserProfile(firebaseUser.uid, {
        displayName: data.display_name,
        currency: data.currency,
        locale: data.locale,
        dateFormat: data.date_format,
      });
    }
  };

  const completeOnboarding = async (data: any) => {
    const res = await apiRequest<{ user: User }>('/api/auth/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setUser(res.user);

    if (firebaseUser) {
      await createOrUpdateUserProfile(firebaseUser.uid, {
        onboardingCompleted: true,
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        firebaseUser,
        isFirebaseAuth,
        isLoading,
        login,
        loginDemo,
        loginWithGoogle,
        quickStart,
        register,
        logout,
        updateProfile,
        completeOnboarding,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
