import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAQjlZsUTELdyNWFKbwPFLTu-oUuRGS7V8",
  authDomain: "northedge-37ae9.firebaseapp.com",
  projectId: "northedge-37ae9",
  storageBucket: "northedge-37ae9.firebasestorage.app",
  messagingSenderId: "1004890461726",
  appId: "1:1004890461726:web:2b43b51fa220194d19c00f",
};

export const ADMIN_UID = "PqagiFM1RORMJkriLBn8J2FLV5B3";

const existingApps = getApps();
const app = existingApps.length ? existingApps[0] : initializeApp(FIREBASE_CONFIG);

export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type User,
};

export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  username: string;
  pfp?: string;
};

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch {
    return null;
  }
}

export async function getUserStats(uid: string): Promise<Record<string, unknown> | null> {
  try {
    const snap = await getDoc(doc(db, "stats", uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function saveStatsToCloud(uid: string, data: Record<string, unknown>) {
  try {
    await setDoc(doc(db, "stats", uid), { ...data, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn("[CBL] saveStatsToCloud failed:", e);
  }
}
