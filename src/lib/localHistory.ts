import type { BriefType } from "./generateBrief";

export type LocalBrief = {
  id: string;
  title: string;
  briefType: BriefType;
  createdAt: number;
  outlineText: string;
};

const KEY = "cbl-briefs";
const MAX = 10;

export function getLocalBriefs(): LocalBrief[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalBrief[]) : [];
  } catch { return []; }
}

export function addLocalBrief(entry: Omit<LocalBrief, "id">): LocalBrief {
  const item: LocalBrief = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
  const existing = getLocalBriefs();
  localStorage.setItem(KEY, JSON.stringify([item, ...existing].slice(0, MAX)));
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
