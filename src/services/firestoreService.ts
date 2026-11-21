/**
 * PRYORA Firebase User Profile Helper
 *
 * Only stores the basic Firebase Auth profile document when a user signs in
 * with Google. All financial ledger records (accounts, transactions, budgets,
 * goals, recurring rules) are managed via the authenticated PRYORA backend API.
 */

import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function createOrUpdateUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<void> {
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || '',
        currency: 'INR',
        locale: 'en-IN',
        dateFormat: 'DD/MM/YYYY',
        onboardingCompleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        userRef,
        {
          email: user.email || snap.data().email || '',
          displayName: user.displayName || snap.data().displayName || 'User',
          photoURL: user.photoURL || snap.data().photoURL || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('Could not sync Firebase user profile:', err);
  }
}

export async function deleteUserProfileDoc(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch {
    // Non-blocking cleanup
  }
}
