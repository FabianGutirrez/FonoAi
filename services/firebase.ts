import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

/* 
// Initialize App Check - Optional security layer
if (typeof window !== 'undefined') {
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider((firebaseConfig as any).reCaptchaKey || '6Lc-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
      isTokenAutoRefreshEnabled: true
    });
    console.log("Firebase App Check initialized in debug mode.");
  } catch (err) {
    console.warn("Firebase App Check failed to initialize.", err);
  }
}
*/

export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth();

// Verification of connection as per instructions
async function testConnection() {
  try {
    console.log("Checking Firestore connection with database ID:", (firebaseConfig as any).firestoreDatabaseId);
    // We try to get a dummy doc to check online status
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful.");
  } catch (error) {
    console.error("Firestore connection test failed:", error);
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or internet connection.");
    }
  }
}

testConnection();

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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
