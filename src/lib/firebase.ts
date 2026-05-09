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

  // Values come from .env.local (development) or Vercel environment variables (production).
  // Copy .env.example to .env.local and fill in your Firebase project config.
  const FIREBASE_CONFIG = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  };

  export const ADMIN_UID: string = import.meta.env.VITE_ADMIN_UID ?? "";

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
  