import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  serverTimestamp,
  type DocumentData
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import type { User, Patient, Evaluation } from '../types';

/**
 * Specialists / Users
 */
export const saveUserProfile = async (user: User) => {
  const path = `users/${user.uid}`;
  try {
    const cleansed = cleanUndefined(user);
    await setDoc(doc(db, path), {
      ...cleansed,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getUserProfile = async (uid: string): Promise<User | null> => {
  const path = `users/${uid}`;
  try {
    const docSnap = await getDoc(doc(db, path));
    return docSnap.exists() ? (docSnap.data() as User) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

/**
 * Patients
 */
export const savePatient = async (patient: Omit<Patient, 'id'>, uid: string) => {
  const path = 'patients';
  try {
    const newDocRef = doc(collection(db, path));
    const cleansed = cleanUndefined(patient);
    await setDoc(newDocRef, {
      ...cleansed,
      id: newDocRef.id,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
    return newDocRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updatePatient = async (id: string, updates: Partial<Patient>) => {
  const path = `patients/${id}`;
  try {
    const cleansed = cleanUndefined(updates);
    await setDoc(doc(db, path), {
      ...cleansed,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deletePatient = async (id: string) => {
  const path = `patients/${id}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const getPatients = async (uid: string): Promise<Patient[]> => {
  const path = 'patients';
  try {
    const q = query(
      collection(db, path), 
      where('createdBy', '==', uid)
    );
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => doc.data() as Patient);
    // Sort in memory by createdAt desc (or id if createdAt is missing)
    return data.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

const cleanUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (typeof obj === 'object') {
    const proto = Object.getPrototypeOf(obj);
    if (proto !== null && proto !== Object.prototype) {
      return obj;
    }
    const cleanObj: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleanObj[key] = cleanUndefined(val);
      }
    }
    return cleanObj;
  }
  return obj;
};

/**
 * Evaluations
 */
export const saveEvaluation = async (evaluation: Omit<Evaluation, 'id'>, uid: string) => {
  const path = 'evaluations';
  try {
    const newDocRef = doc(collection(db, path));
    const cleansed = cleanUndefined(evaluation);
    await setDoc(newDocRef, {
      ...cleansed,
      id: newDocRef.id,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
    return newDocRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateEvaluation = async (id: string, updates: Partial<Evaluation>) => {
  const path = `evaluations/${id}`;
  try {
    const cleansed = cleanUndefined(updates);

    console.log("UPDATE DATA:", cleansed);


    await setDoc(doc(db, path), {
      ...cleansed,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteEvaluation = async (id: string) => {
  const path = `evaluations/${id}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const getEvaluations = async (uid: string): Promise<Evaluation[]> => {
  const path = 'evaluations';
  try {
    const q = query(
      collection(db, path), 
      where('createdBy', '==', uid)
    );
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => doc.data() as Evaluation);
    return data.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getEvaluationsByPatient = async (patientId: string): Promise<Evaluation[]> => {
  const path = 'evaluations';
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  
  try {
    const q = query(
      collection(db, path), 
      where('patientId', '==', patientId),
      where('createdBy', '==', uid)
    );
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => doc.data() as Evaluation);
    return data.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};
