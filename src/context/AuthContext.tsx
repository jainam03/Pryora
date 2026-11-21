/**
 * PRYORA Authentication Context
 *
 * Manages:
 * - Email/password registration & sign-in
 * - Cryptographically verified Google Sign-In (sends Firebase ID token to backend)
 * - Ephemeral guest quick-start & live demo sandbox
 * - Server-side session revocation + client offline cache purge on sign-out
 * - Permanent account deletion
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import {
  apiRequest,
  getStoredToken,
  setStoredToken,
  setActiveApiUserId,
  clearOfflineUserData,
} from '../lib/api';
import { auth, googleProvider } from '../lib/firebase';
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { createOrUpdateUserProfile, deleteUserProfileDoc } from '../services/firestoreService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  firebaseUser: FirebaseUser | null;
  isFirebaseAuth: boolean;
  isDemoUser: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  quickStart: (email?: string, displayName?: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string, currency?: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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

  const isFirebaseAuth = Boolean(firebaseUser);
  const isDemoUser = user?.email === 'demo@pryora.app';

  const applyAuthenticatedSession = useCallback((nextToken: string, nextUser: User) => {
    setActiveApiUserId(nextUser.id);
    setStoredToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setActiveApiUserId(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{ user: User }>('/api/auth/me');
      setActiveApiUserId(data.user.id);
      setUser(data.user);
    } catch {
      setStoredToken(null);
      clearOfflineUserData();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async fbUser => {
      setFirebaseUser(fbUser);
      if (fbUser && !getStoredToken()) {
        try {
          const idToken = await fbUser.getIdToken();
          const res = await apiRequest<{ token: string; user: User }>('/api/auth/firebase-login', {
            method: 'POST',
            body: JSON.stringify({ idToken }),
          });
          applyAuthenticatedSession(res.token, res.user);

          await createOrUpdateUserProfile({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
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
      clearOfflineUserData();
    };

    window.addEventListener('pryora:unauthorized', handleUnauthorized);
    return () => {
      unsubscribe();
      window.removeEventListener('pryora:unauthorized', handleUnauthorized);
    };
  }, [refreshUser, applyAuthenticatedSession]);

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      setFirebaseUser(fbUser);

      // Obtain signed cryptographic Firebase ID token for server-side verification
      const idToken = await fbUser.getIdToken(true);

      const res = await apiRequest<{ token: string; user: User }>('/api/auth/firebase-login', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });

      applyAuthenticatedSession(res.token, res.user);

      await createOrUpdateUserProfile({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
      });
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
      applyAuthenticatedSession(res.token, res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    applyAuthenticatedSession(res.token, res.user);
  };

  const loginDemo = async () => {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/demo', {
      method: 'POST',
    });
    applyAuthenticatedSession(res.token, res.user);
  };

  const register = async (
    email: string,
    password: string,
    displayName?: string,
    currency: string = 'INR'
  ) => {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName, currency }),
    });
    applyAuthenticatedSession(res.token, res.user);
  };

  const logout = async () => {
    const currentToken = getStoredToken();
    if (currentToken) {
      try {
        // Revoke session token server-side
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch {
        // Proceed with local cleanup even if offline
      }
    }

    try {
      await fbSignOut(auth);
    } catch {
      // Ignore fbSignOut errors if not signed in with Firebase
    }

    setStoredToken(null);
    clearOfflineUserData();
    setToken(null);
    setUser(null);
    setFirebaseUser(null);
  };

  const deleteAccount = async () => {
    await apiRequest<{ message: string }>('/api/auth/account', {
      method: 'DELETE',
    });

    if (firebaseUser) {
      await deleteUserProfileDoc(firebaseUser.uid);
      try {
        await fbSignOut(auth);
      } catch {
        // Ignore
      }
    }

    setStoredToken(null);
    clearOfflineUserData();
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
  };

  const completeOnboarding = async (data: any) => {
    const res = await apiRequest<{ user: User }>('/api/auth/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setUser(res.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        firebaseUser,
        isFirebaseAuth,
        isDemoUser,
        isLoading,
        login,
        loginDemo,
        loginWithGoogle,
        quickStart,
        register,
        logout,
        deleteAccount,
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
