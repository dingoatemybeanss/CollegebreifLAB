import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getUserOpportunities,
  saveOpportunityToFirestore,
  updateOpportunityStatus,
  incrementOpportunityStats,
  type FirestoreOpportunityWithId,
  type FirestoreOpportunity,
} from "@/lib/firestoreOps";
import type { View } from "@/components/NavBar";

type Props = {
  onNav: (v: View, payload?: unknown) => void;
};

const TYPES = ["scholarship", "program", "competition", "other"];
const STATUSES: { value: FirestoreOpportunity["status"]; label: string; color: string }[] = [
  { value: "not_started", label: "Not started", color: "bg-secondary text-secondary-foreground" },
  { value: "drafting", label: "Drafting", color: "bg-blue-50 text-blue-700" },
  { value: "submitted", label: "Submitted", color: "bg-green-50 text-green-700" },
  { value: "result", label: "Result", color: "bg-purple-50 text-purple-700" },
];

function statusMeta(s: string) {
  return STATUSES.find((x) => x.value === s) || STATUSES[0];
}

export default function OpportunityPlanner({ onNav }: Props) {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<FirestoreOpportunityWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState("scholarship");
  const [deadline, setDeadline] = useState("");
  const [link, setLink] = useState("");
  const [goal, setGoal] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getUserOpportunities(user.uid)
      .then(setOpportunities)
      .catch((e) => console.warn("[CBL] load opportunities failed:", e))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setFormError("Name is required."); return; }
    if (!type) { setFormError("Type is required."); return; }
    if (!deadline) { setFormError("Deadline is required."); return; }
    if (!user) { setFormError("Sign in to save opportunities."); return; }
    setFormError(null);
    setSubmitting(true);
    try {
      const payload: FirestoreOpportunity = {
        uid: user.uid,
        name: name.trim(),
        type,
        deadline,
        status: "not_started",
        link: link.trim(),
        goal: goal.trim(),
        linkedBriefId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const id = await saveOpportunityToFirestore(payload);
      setOpportunities([{ id, ...payload }, ...opportunities]);
      incrementOpportunityStats(user.uid).catch(() => {});
      setName(""); setDeadline(""); setLink(""); setGoal(""); setType("scholarship");
    } catch (e) {
      console.warn("[CBL] saveOpportunity failed:", e);
      setFormError("Failed to save — check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, status: FirestoreOpportunity["status"]) {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status, updatedAt: Date.now() } : o))
    );
    try {
      await updateOpportunityStatus(id, status);
    } catch (e) {
      console.warn("[CBL] updateStatus failed:", e);
    }
  }

  function handleOpenBrief(opp: FirestoreOpportunityWithId) {
    const prompt = `Write a brief/outline for this opportunity: ${opp.name} — ${opp.type}${opp.goal ? `. Goal: ${opp.goal}` : ""}.`;
    onNav("builder", { prompt, linkedOpportunityId: opp.id });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-lg font-bold text-foreground">Opportunity Planner</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track scholarships, programs, and competitions. Link each to a brief.
        </p>
      </div>

      {!user && (
        <div className="px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-muted-foreground">
          Sign in to save and manage opportunities.
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-4"
      >
        <h2 className="text-sm font-semibold text-foreground">Add an opportunity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gates Scholarship, Yale Young Global Scholars"
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring capitalize"
            >
              {TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deadline *</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link</label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Goal / Angle</label>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="One-line angle or hook for this application"
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
        <button
          type="submit"
          disabled={submitting || !user}
          className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add opportunity"}
        </button>
      </form>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Your opportunities
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : opportunities.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            No opportunities yet. Add one above.
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp) => {
              const sm = statusMeta(opp.status);
              const deadlineDate = opp.deadline ? new Date(opp.deadline + "T00:00:00") : null;
              const overdue = deadlineDate && deadlineDate < new Date() && opp.status !== "submitted" && opp.status !== "result";
              return (
                <div
                  key={opp.id}
                  className="bg-white border border-border rounded-xl px-5 py-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start gap-3 justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{opp.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">
                          {opp.type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sm.color}`}>
                          {sm.label}
                        </span>
                        {overdue && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                            Overdue
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {opp.deadline && (
                          <span className="text-xs text-muted-foreground">
                            Due {new Date(opp.deadline + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                        {opp.goal && (
                          <span className="text-xs text-muted-foreground italic">"{opp.goal}"</span>
                        )}
                        {opp.link && (
                          <a
                            href={opp.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Visit site →
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <select
                        value={opp.status}
                        onChange={(e) => handleStatusChange(opp.id, e.target.value as FirestoreOpportunity["status"])}
                        className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleOpenBrief(opp)}
                        className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                      >
                        {opp.linkedBriefId ? "Open brief" : "Create brief"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
