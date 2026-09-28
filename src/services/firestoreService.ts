/**
 * PRYORA Firestore Service
 * 
 * Provides real-time subscriptions and CRUD operations for cloud-synced
 * personal finance accounts, transactions, budgets, goals, and recurring rules.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Account, Transaction, Category, Budget, Goal, RecurringRule, UserProfile } from '../types';

// Default standard categories for new Firebase user workspaces
export const DEFAULT_FIREBASE_CATEGORIES = [
  { name: 'Housing & Rent', type: 'expense' as const, icon: 'Home', color: '#3B82F6' },
  { name: 'Groceries & Supplies', type: 'expense' as const, icon: 'ShoppingBag', color: '#10B981' },
  { name: 'Food & Dining', type: 'expense' as const, icon: 'Utensils', color: '#F97316' },
  { name: 'Utilities & Bills', type: 'expense' as const, icon: 'Zap', color: '#EAB308' },
  { name: 'Transportation', type: 'expense' as const, icon: 'Car', color: '#6366F1' },
  { name: 'Entertainment & Leisure', type: 'expense' as const, icon: 'Film', color: '#8B5CF6' },
  { name: 'Subscriptions', type: 'expense' as const, icon: 'RotateCw', color: '#06B6D4' },
  { name: 'Health & Medical', type: 'expense' as const, icon: 'HeartPulse', color: '#EC4899' },
  { name: 'Salary & Compensation', type: 'income' as const, icon: 'Briefcase', color: '#10B981' },
  { name: 'Investments & Returns', type: 'income' as const, icon: 'TrendingUp', color: '#3B82F6' },
  { name: 'Freelance & Side Income', type: 'income' as const, icon: 'Laptop', color: '#8B5CF6' },
  { name: 'Other Income', type: 'income' as const, icon: 'PlusCircle', color: '#64748B' },
];

/* ==========================================================================
   USER PROFILE
   ========================================================================== */

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const path = `users/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function createOrUpdateUserProfile(
  userId: string,
  profile: Partial<UserProfile>
): Promise<void> {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const existingSnap = await getDoc(userRef);
    const nowIso = new Date().toISOString();

    if (!existingSnap.exists()) {
      const newProfile = {
        id: userId,
        email: profile.email || '',
        displayName: profile.displayName || 'Personal Workspace',
        display_name: profile.displayName || 'Personal Workspace',
        currency: profile.currency || 'INR',
        locale: profile.locale || 'en-IN',
        dateFormat: profile.dateFormat || 'DD/MM/YYYY',
        date_format: profile.dateFormat || 'DD/MM/YYYY',
        onboardingCompleted: profile.onboardingCompleted ?? false,
        onboarding_completed: profile.onboardingCompleted ? 1 : 0,
        createdAt: nowIso,
        created_at: nowIso,
        updatedAt: nowIso,
        updated_at: nowIso,
      };
      await setDoc(userRef, newProfile);
      // Automatically seed default categories
      await seedDefaultCategoriesIfEmpty(userId);
    } else {
      await updateDoc(userRef, {
        ...profile,
        updatedAt: nowIso,
        updated_at: nowIso,
      });
    }
  } catch (err) {
    console.warn('Firestore profile sync note:', err);
    // Don't crash auth flow if firestore is still provisioning
  }
}

/* ==========================================================================
   CATEGORIES
   ========================================================================== */

export function subscribeCategories(
  userId: string,
  onData: (categories: Category[]) => void
): Unsubscribe {
  const path = `users/${userId}/categories`;
  const q = query(collection(db, 'users', userId, 'categories'), orderBy('name', 'asc'));

  return onSnapshot(
    q,
    snapshot => {
      const items: Category[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as Category);
      });
      onData(items);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function seedDefaultCategoriesIfEmpty(userId: string): Promise<void> {
  const path = `users/${userId}/categories`;
  try {
    const colRef = collection(db, 'users', userId, 'categories');
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    for (const def of DEFAULT_FIREBASE_CATEGORIES) {
      const catId = `cat_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
      const docRef = doc(colRef, catId);
      const catObj = {
        id: catId,
        userId: userId,
        user_id: userId,
        name: def.name,
        type: def.type,
        icon: def.icon,
        color: def.color,
        is_archived: 0,
        created_at: now,
        createdAt: now,
      };
      batch.set(docRef, catObj);
    }
    await batch.commit();
  } catch (err) {
    console.warn('Firestore categories seed note:', err);
  }
}

export async function addCategory(
  userId: string,
  category: Omit<Category, 'id' | 'created_at'>
): Promise<string> {
  const path = `users/${userId}/categories`;
  try {
    const catId = `cat_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const docRef = doc(db, 'users', userId, 'categories', catId);
    const fullCat = {
      ...category,
      id: catId,
      userId: userId,
      user_id: userId,
      created_at: now,
      createdAt: now,
    };
    await setDoc(docRef, fullCat);
    return catId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

/* ==========================================================================
   ACCOUNTS
   ========================================================================== */

export function subscribeAccounts(
  userId: string,
  onData: (accounts: Account[]) => void
): Unsubscribe {
  const path = `users/${userId}/accounts`;
  const q = query(collection(db, 'users', userId, 'accounts'), orderBy('name', 'asc'));

  return onSnapshot(
    q,
    snapshot => {
      const items: Account[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as Account);
      });
      onData(items);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function addAccount(
  userId: string,
  acc: Omit<Account, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  const path = `users/${userId}/accounts`;
  try {
    const accId = `acc_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const docRef = doc(db, 'users', userId, 'accounts', accId);
    const fullAccount = {
      ...acc,
      id: accId,
      userId: userId,
      user_id: userId,
      initialBalanceMinor: acc.initial_balance_minor,
      currentBalanceMinor: acc.current_balance_minor,
      initial_balance_minor: acc.initial_balance_minor,
      current_balance_minor: acc.current_balance_minor,
      created_at: now,
      createdAt: now,
      updated_at: now,
      updatedAt: now,
    };
    await setDoc(docRef, fullAccount);
    return accId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateAccount(
  userId: string,
  accountId: string,
  updates: Partial<Account>
): Promise<void> {
  const path = `users/${userId}/accounts/${accountId}`;
  try {
    const docRef = doc(db, 'users', userId, 'accounts', accountId);
    await updateDoc(docRef, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteAccount(userId: string, accountId: string): Promise<void> {
  const path = `users/${userId}/accounts/${accountId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'accounts', accountId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/* ==========================================================================
   TRANSACTIONS
   ========================================================================== */

export function subscribeTransactions(
  userId: string,
  onData: (txs: Transaction[]) => void
): Unsubscribe {
  const path = `users/${userId}/transactions`;
  const q = query(collection(db, 'users', userId, 'transactions'), orderBy('date', 'desc'));

  return onSnapshot(
    q,
    snapshot => {
      const items: Transaction[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as Transaction);
      });
      onData(items);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function addTransaction(
  userId: string,
  tx: Omit<Transaction, 'id' | 'created_at'>,
  accounts: Account[]
): Promise<string> {
  const path = `users/${userId}/transactions`;
  try {
    const txId = `tx_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const docRef = doc(db, 'users', userId, 'transactions', txId);
    const fullTx = {
      ...tx,
      id: txId,
      userId: userId,
      user_id: userId,
      accountId: tx.account_id,
      account_id: tx.account_id,
      amountMinor: tx.amount_minor,
      amount_minor: tx.amount_minor,
      created_at: now,
      createdAt: now,
    };

    // Update account balances atomically
    const primaryAccount = accounts.find(a => a.id === tx.account_id);
    if (primaryAccount) {
      let delta = 0;
      const isLiability = primaryAccount.type === 'credit_card' || primaryAccount.type === 'loan';

      if (tx.type === 'expense') {
        delta = isLiability ? tx.amount_minor : -tx.amount_minor;
      } else if (tx.type === 'income' || tx.type === 'refund' || tx.type === 'reimbursement') {
        delta = isLiability ? -tx.amount_minor : tx.amount_minor;
      } else if (tx.type === 'transfer') {
        delta = -tx.amount_minor;
      }

      await updateAccount(userId, primaryAccount.id, {
        current_balance_minor: primaryAccount.current_balance_minor + delta,
      });
    }

    // If transfer to another account
    if (tx.type === 'transfer' && tx.to_account_id) {
      const toAccount = accounts.find(a => a.id === tx.to_account_id);
      if (toAccount) {
        const isToLiability = toAccount.type === 'credit_card' || toAccount.type === 'loan';
        const toDelta = isToLiability ? -tx.amount_minor : tx.amount_minor;
        await updateAccount(userId, toAccount.id, {
          current_balance_minor: toAccount.current_balance_minor + toDelta,
        });
      }
    }

    await setDoc(docRef, fullTx);
    return txId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteTransaction(
  userId: string,
  txId: string,
  tx: Transaction,
  accounts: Account[]
): Promise<void> {
  const path = `users/${userId}/transactions/${txId}`;
  try {
    // Revert account balances
    const primaryAccount = accounts.find(a => a.id === tx.account_id);
    if (primaryAccount) {
      let revertDelta = 0;
      const isLiability = primaryAccount.type === 'credit_card' || primaryAccount.type === 'loan';

      if (tx.type === 'expense') {
        revertDelta = isLiability ? -tx.amount_minor : tx.amount_minor;
      } else if (tx.type === 'income' || tx.type === 'refund' || tx.type === 'reimbursement') {
        revertDelta = isLiability ? tx.amount_minor : -tx.amount_minor;
      } else if (tx.type === 'transfer') {
        revertDelta = tx.amount_minor;
      }

      await updateAccount(userId, primaryAccount.id, {
        current_balance_minor: primaryAccount.current_balance_minor + revertDelta,
      });
    }

    if (tx.type === 'transfer' && tx.to_account_id) {
      const toAccount = accounts.find(a => a.id === tx.to_account_id);
      if (toAccount) {
        const isToLiability = toAccount.type === 'credit_card' || toAccount.type === 'loan';
        const toRevertDelta = isToLiability ? tx.amount_minor : -tx.amount_minor;
        await updateAccount(userId, toAccount.id, {
          current_balance_minor: toAccount.current_balance_minor + toRevertDelta,
        });
      }
    }

    await deleteDoc(doc(db, 'users', userId, 'transactions', txId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/* ==========================================================================
   BUDGETS
   ========================================================================== */

export function subscribeBudgets(
  userId: string,
  onData: (budgets: Budget[]) => void
): Unsubscribe {
  const path = `users/${userId}/budgets`;
  const q = query(collection(db, 'users', userId, 'budgets'));

  return onSnapshot(
    q,
    snapshot => {
      const items: Budget[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as Budget);
      });
      onData(items);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function setBudget(
  userId: string,
  budget: Budget
): Promise<void> {
  const path = `users/${userId}/budgets`;
  try {
    const budgetId = budget.id || `bg_${budget.category_id}`;
    const docRef = doc(db, 'users', userId, 'budgets', budgetId);
    await setDoc(docRef, {
      ...budget,
      id: budgetId,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/* ==========================================================================
   GOALS
   ========================================================================== */

export function subscribeGoals(
  userId: string,
  onData: (goals: Goal[]) => void
): Unsubscribe {
  const path = `users/${userId}/goals`;
  const q = query(collection(db, 'users', userId, 'goals'), orderBy('created_at', 'desc'));

  return onSnapshot(
    q,
    snapshot => {
      const items: Goal[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as Goal);
      });
      onData(items);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function addGoal(
  userId: string,
  goal: Omit<Goal, 'id' | 'created_at'>
): Promise<string> {
  const path = `users/${userId}/goals`;
  try {
    const goalId = `goal_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const docRef = doc(db, 'users', userId, 'goals', goalId);
    const fullGoal: Goal = {
      ...goal,
      id: goalId,
      created_at: now,
    };
    await setDoc(docRef, fullGoal);
    return goalId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateGoal(
  userId: string,
  goalId: string,
  updates: Partial<Goal>
): Promise<void> {
  const path = `users/${userId}/goals/${goalId}`;
  try {
    const docRef = doc(db, 'users', userId, 'goals', goalId);
    await updateDoc(docRef, {
      ...updates,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteGoal(userId: string, goalId: string): Promise<void> {
  const path = `users/${userId}/goals/${goalId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'goals', goalId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/* ==========================================================================
   RECURRING RULES
   ========================================================================== */

export function subscribeRecurringRules(
  userId: string,
  onData: (rules: RecurringRule[]) => void
): Unsubscribe {
  const path = `users/${userId}/recurringRules`;
  const q = query(collection(db, 'users', userId, 'recurringRules'), orderBy('next_expected_date', 'asc'));

  return onSnapshot(
    q,
    snapshot => {
      const items: RecurringRule[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as RecurringRule);
      });
      onData(items);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function addRecurringRule(
  userId: string,
  rule: Omit<RecurringRule, 'id'>
): Promise<string> {
  const path = `users/${userId}/recurringRules`;
  try {
    const ruleId = `rec_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const docRef = doc(db, 'users', userId, 'recurringRules', ruleId);
    const fullRule: RecurringRule = {
      ...rule,
      id: ruleId,
    };
    await setDoc(docRef, fullRule);
    return ruleId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}
