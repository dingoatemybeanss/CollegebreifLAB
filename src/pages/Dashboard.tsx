import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserBriefs, getUserOpportunities, type FirestoreBriefWithId, type FirestoreOpportunityWithId } from "@/lib/firestoreOps";
import { formatRelative } from "@/lib/localHistory";
import type { View } from "@/components/NavBar";

const BRIEF_TYPE_LABELS: Record<string, string> = {
  essay: "Essay Outline",
  policy: "Policy Memo",
  debate: "Debate Case",
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  drafting: "Drafting",
  submitted: "Submitted",
  result: "Result",
};

type ActivityItem =
  | { kind: "brief"; id: string; title: string; briefType: string; updatedAt: number }
  | { kind: "opportunity"; id: string; name: string; status: string; updatedAt: number };

type Props = {
  onNav: (v: View, payload?: unknown) => void;
};

export default function Dashboard({ onNav }: Props) {
  const { user } = useAuth();
  const [briefs, setBriefs] = useState<FirestoreBriefWithId[]>([]);
  const [opportunities, setOpportunities] = useState<FirestoreOpportunityWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([getUserBriefs(user.uid), getUserOpportunities(user.uid)])
      .then(([b, o]) => {
        setBriefs(b);
        setOpportunities(o);
      })
      .catch((e) => console.warn("[CBL] Dashboard load failed:", e))
      .finally(() => setLoading(false));
  }, [user]);

  const activeProjects = opportunities.filter(
    (o) => o.status === "not_started" || o.status === "drafting"
  ).length;

  const activity: ActivityItem[] = [
    ...briefs.map((b) => ({
      kind: "brief" as const,
      id: b.id,
      title: b.title,
      briefType: b.briefType,
      updatedAt: b.updatedAt,
    })),
    ...opportunities.map((o) => ({
      kind: "opportunity" as const,
      id: o.id,
      name: o.name,
      status: o.status,
      updatedAt: o.updatedAt,
    })),
  ]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary">College Brief Lab</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Turn prompts, readings, and opportunities into structured briefs and plans.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your data…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Briefs created" value={briefs.length} onClick={() => onNav("builder")} />
            <StatCard label="Opportunities tracked" value={opportunities.length} onClick={() => onNav("opportunities")} />
            <StatCard label="Active projects" value={activeProjects} onClick={() => onNav("opportunities")} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Recent activity
            </h2>
            {activity.length === 0 ? (
              <div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
                No activity yet. Start by creating a brief or adding an opportunity.
              </div>
            ) : (
              <div className="space-y-2">
                {activity.map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    onClick={() => onNav(item.kind === "brief" ? "builder" : "opportunities", item)}
                    className="w-full text-left bg-white border border-border rounded-xl px-5 py-3.5 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground shrink-0">
                          {item.kind === "brief" ? BRIEF_TYPE_LABELS[item.briefType] || "Brief" : "Opportunity"}
                        </span>
                        <p className="text-sm text-foreground truncate">
                          {item.kind === "brief" ? item.title : item.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {item.kind === "opportunity" && (
                          <span className="text-xs text-muted-foreground">
                            {STATUS_LABELS[item.status] || item.status}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatRelative(item.updatedAt)}
                        </span>
                        <span className="text-xs text-primary font-medium">open →</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickAction
              title="New brief"
              desc="Essay, policy memo, or debate case"
              onClick={() => onNav("builder")}
            />
            <QuickAction
              title="Track an opportunity"
              desc="Scholarship, program, or competition"
              onClick={() => onNav("opportunities")}
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-border rounded-xl p-4 text-left hover:bg-accent transition-colors"
    >
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </button>
  );
}

function QuickAction({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-primary text-primary-foreground rounded-xl px-5 py-4 text-left hover:opacity-90 transition-opacity"
    >
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs opacity-80 mt-0.5">{desc}</div>
    </button>
  );
}
