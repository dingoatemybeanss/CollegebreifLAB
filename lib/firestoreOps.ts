import {
  db,
  collection,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getUserStats,
  saveStatsToCloud,
} from "./firebase";
import type { BriefType, Tone } from "./generateBrief";

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

export async function saveBriefToFirestore(payload: FirestoreBrief): Promise<string> {
  const ref = await addDoc(collection(db, "briefs"), payload);
  return ref.id;
}

export async function saveOpportunityToFirestore(
  payload: FirestoreOpportunity
): Promise<string> {
  const ref = await addDoc(collection(db, "opportunities"), payload);
  return ref.id;
}

export async function updateOpportunityStatus(
  id: string,
  status: FirestoreOpportunity["status"]
) {
  await updateDoc(doc(db, "opportunities", id), { status, updatedAt: Date.now() });
}

export async function linkBriefToOpportunity(opportunityId: string, briefId: string) {
  await updateDoc(doc(db, "opportunities", opportunityId), {
    linkedBriefId: briefId,
    updatedAt: Date.now(),
  });
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

export async function getUserOpportunities(
  uid: string
): Promise<FirestoreOpportunityWithId[]> {
  const q = query(
    collection(db, "opportunities"),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as FirestoreOpportunity),
  }));
}

export async function incrementBriefStats(uid: string) {
  try {
    const stats = (await getUserStats(uid)) || {};
    const totalBriefs = ((stats.totalBriefs as number) || 0) + 1;
    await saveStatsToCloud(uid, { ...stats, totalBriefs });
  } catch (e) {
    console.warn("[CBL] incrementBriefStats failed:", e);
  }
}

export async function incrementOpportunityStats(uid: string) {
  try {
    const stats = (await getUserStats(uid)) || {};
    const totalOpportunities = ((stats.totalOpportunities as number) || 0) + 1;
    await saveStatsToCloud(uid, { ...stats, totalOpportunities });
  } catch (e) {
    console.warn("[CBL] incrementOpportunityStats failed:", e);
  }
}
