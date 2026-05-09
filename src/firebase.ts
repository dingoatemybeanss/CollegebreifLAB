import { createContext, useContext, useEffect, useState } from "react";
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
} from "firebase/firestore";

// ─── Firebase init ────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId
);

let auth_: ReturnType<typeof getAuth> | null = null;
let db_: ReturnType<typeof getFirestore> | null = null;

if (firebaseConfigured) {
  const existingApps = getApps();
  const app = existingApps.length ? existingApps[0] : initializeApp(FIREBASE_CONFIG);
  auth_ = getAuth(app);
  db_ = getFirestore(app);
}

export const auth = auth_!;
export const db = db_!;

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  username: string;
  pfp?: string;
};

export type BriefType = "essay" | "policy" | "debate";
export type Tone = "neutral" | "advocacy" | "academic";

export type FirestoreBrief = {
  uid: string;
  title: string;
  briefType: BriefType;
  prompt: string;
  sourceNotes: string;
  tone: Tone;
  outlineText: string;
  createdAt: number;
  updatedAt: number;
  linkedOpportunityId: string | null;
};
export type FirestoreBriefWithId = FirestoreBrief & { id: string };

export type FirestoreOpportunity = {
  uid: string;
  name: string;
  type: string;
  deadline: string;
  status: "not_started" | "drafting" | "submitted" | "result";
  link: string;
  goal: string;
  linkedBriefId: string | null;
  createdAt: number;
  updatedAt: number;
};
export type FirestoreOpportunityWithId = FirestoreOpportunity & { id: string };

// ─── User / stats ─────────────────────────────────────────────────────────────

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch { return null; }
}

async function getUserStats(uid: string): Promise<Record<string, unknown> | null> {
  try {
    const snap = await getDoc(doc(db, "stats", uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

async function saveStatsToCloud(uid: string, data: Record<string, unknown>) {
  try {
    await setDoc(doc(db, "stats", uid), { ...data, updatedAt: Date.now() }, { merge: true });
  } catch (e) { console.warn("[CBL] saveStatsToCloud failed:", e); }
}

// ─── Briefs ───────────────────────────────────────────────────────────────────

export async function saveBriefToFirestore(payload: FirestoreBrief): Promise<string> {
  const ref = await addDoc(collection(db, "briefs"), payload);
  return ref.id;
}

export async function getUserBriefs(uid: string): Promise<FirestoreBriefWithId[]> {
  const q = query(
    collection(db, "briefs"),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestoreBrief) }));
}

export async function incrementBriefStats(uid: string) {
  try {
    const stats = (await getUserStats(uid)) || {};
    await saveStatsToCloud(uid, { ...stats, totalBriefs: ((stats.totalBriefs as number) || 0) + 1 });
  } catch (e) { console.warn("[CBL] incrementBriefStats failed:", e); }
}

// ─── Opportunities ────────────────────────────────────────────────────────────

export async function saveOpportunityToFirestore(payload: FirestoreOpportunity): Promise<string> {
  const ref = await addDoc(collection(db, "opportunities"), payload);
  return ref.id;
}

export async function updateOpportunityStatus(id: string, status: FirestoreOpportunity["status"]) {
  await updateDoc(doc(db, "opportunities", id), { status, updatedAt: Date.now() });
}

export async function linkBriefToOpportunity(opportunityId: string, briefId: string) {
  await updateDoc(doc(db, "opportunities", opportunityId), { linkedBriefId: briefId, updatedAt: Date.now() });
}

export async function getUserOpportunities(uid: string): Promise<FirestoreOpportunityWithId[]> {
  const q = query(
    collection(db, "opportunities"),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestoreOpportunity) }));
}

export async function incrementOpportunityStats(uid: string) {
  try {
    const stats = (await getUserStats(uid)) || {};
    await saveStatsToCloud(uid, { ...stats, totalOpportunities: ((stats.totalOpportunities as number) || 0) + 1 });
  } catch (e) { console.warn("[CBL] incrementOpportunityStats failed:", e); }
}

// ─── Local history ────────────────────────────────────────────────────────────

export type LocalBrief = {
  id: string;
  title: string;
  briefType: BriefType;
  createdAt: number;
  outlineText: string;
};

const LOCAL_KEY = "cbl-briefs";

export function getLocalBriefs(): LocalBrief[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalBrief[]) : [];
  } catch { return []; }
}

export function addLocalBrief(entry: Omit<LocalBrief, "id">): LocalBrief {
  const item: LocalBrief = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
  const existing = getLocalBriefs();
  localStorage.setItem(LOCAL_KEY, JSON.stringify([item, ...existing].slice(0, 10)));
  return item;
}

export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// ─── Auth context ─────────────────────────────────────────────────────────────

export type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuthState(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    if (!firebaseConfigured) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) { const p = await loadUserProfile(u.uid); setProfile(p); }
      else { setProfile(null); }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signInGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function logOut() {
    await signOut(auth);
  }

  return { user, profile, loading, signInGoogle, logOut };
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
