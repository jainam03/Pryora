import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Vite handles JSON imports statically.
// During build/dev, import firebase-applet-config.json if present; otherwise fallback to empty object.
const localJsonModules = import.meta.glob('../../firebase-applet-config.json', { eager: true });
const configFromLocalJson: Record<string, any> =
  (localJsonModules['../../firebase-applet-config.json'] as any)?.default ||
  localJsonModules['../../firebase-applet-config.json'] ||
  {};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || configFromLocalJson.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || configFromLocalJson.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || configFromLocalJson.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || configFromLocalJson.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || configFromLocalJson.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || configFromLocalJson.appId || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || configFromLocalJson.measurementId || '',
};

const firestoreDatabaseId =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  configFromLocalJson.firestoreDatabaseId ||
  '(default)';

// Validate if API Key exists and is not a placeholder
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.trim() !== '' &&
  firebaseConfig.apiKey !== 'your-firebase-api-key' &&
  !firebaseConfig.apiKey.includes(' ')
);

// Initialize Firebase App conditionally to prevent hard runtime crashes on blank/missing API keys
export const app = isFirebaseConfigured
  ? (getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig))
  : (getApps().length > 0 ? getApps()[0] : initializeApp({ apiKey: 'placeholder-key', projectId: 'demo-app' }, 'mock-app'));

// Initialize Firestore
export const db = isFirebaseConfigured ? getFirestore(app, firestoreDatabaseId) : null as any;

// Initialize Auth
export const auth = isFirebaseConfigured ? getAuth(app) : null as any;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Operation Types conforming to Firebase Skill specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on initialization
export async function testConnection(): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

// Run test connection asynchronously on module boot if configured
if (isFirebaseConfigured) {
  testConnection();
}
