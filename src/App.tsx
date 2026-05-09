import { useState, useEffect, type ReactNode } from "react";
import {
  AuthContext, useAuthState, useAuth,
  firebaseConfigured,
  getUserBriefs, getUserOpportunities,
  saveBriefToFirestore, saveOpportunityToFirestore, updateOpportunityStatus,
  incrementBriefStats, incrementOpportunityStats,
  addLocalBrief, formatTime, formatRelative,
  type FirestoreBriefWithId, type FirestoreOpportunityWithId, type FirestoreOpportunity,
} from "./firebase";
import { generateBrief } from "./generateBrief";
import type { BriefType, Tone, GeneratedBrief, DebateSections, PolicySections, EssaySections } from "./generateBrief";

// ─── Auth Provider ────────────────────────────────────────────────────────────

function AuthProvider({ children }: { children: ReactNode }) {
  const state = useAuthState();
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "dashboard" | "builder" | "opportunities";
type BuilderPayload = { prompt?: string; linkedOpportunityId?: string };

// ─── NavBar ───────────────────────────────────────────────────────────────────

const TABS: { key: View; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "builder", label: "Brief Builder" },
  { key: "opportunities", label: "Opportunities" },
];

function NavBar({ view, onNav }: { view: View; onNav: (v: View) => void }) {
  const { user, profile, loading, signInGoogle, logOut } = useAuth();
  const displayName = profile?.username || profile?.name || user?.displayName || user?.email || "User";

  return (
    <header className="bg-white border-b border-border sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <span className="font-semibold text-primary text-base tracking-tight whitespace-nowrap">
            College Brief Lab
          </span>
          {user && (
            <nav className="hidden sm:flex items-center gap-0 ml-6">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => onNav(t.key)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${view === t.key ? "text-primary font-semibold bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-3 ml-auto">
            {loading ? (
              <span className="text-sm text-muted-foreground">Loading…</span>
            ) : user ? (
              <>
                <span className="text-sm text-foreground hidden md:inline">{displayName}</span>
                <button onClick={logOut} className="text-sm px-3 py-1.5 rounded border border-border text-foreground hover:bg-accent transition-colors">Log out</button>
              </>
            ) : (
              <button onClick={signInGoogle} className="text-sm px-4 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">Sign in with Google</button>
            )}
          </div>
        </div>
        {user && (
          <nav className="sm:hidden flex gap-1 pb-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => onNav(t.key)}
                className={`flex-1 text-xs py-1.5 rounded text-center transition-colors ${view === t.key ? "text-primary font-semibold bg-primary/10" : "text-muted-foreground"}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const BRIEF_TYPE_LABELS: Record<string, string> = { essay: "Essay Outline", policy: "Policy Memo", debate: "Debate Case" };
const STATUS_LABELS: Record<string, string> = { not_started: "Not started", drafting: "Drafting", submitted: "Submitted", result: "Result" };

type ActivityItem =
  | { kind: "brief"; id: string; title: string; briefType: string; updatedAt: number }
  | { kind: "opportunity"; id: string; name: string; status: string; updatedAt: number };

function Dashboard({ onNav }: { onNav: (v: View, payload?: unknown) => void }) {
  const { user } = useAuth();
  const [briefs, setBriefs] = useState<FirestoreBriefWithId[]>([]);
  const [opportunities, setOpportunities] = useState<FirestoreOpportunityWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([getUserBriefs(user.uid), getUserOpportunities(user.uid)])
      .then(([b, o]) => { setBriefs(b); setOpportunities(o); })
      .catch((e) => console.warn("[CBL] Dashboard load failed:", e))
      .finally(() => setLoading(false));
  }, [user]);

  const activeProjects = opportunities.filter((o) => o.status === "not_started" || o.status === "drafting").length;

  const activity: ActivityItem[] = [
    ...briefs.map((b) => ({ kind: "brief" as const, id: b.id, title: b.title, briefType: b.briefType, updatedAt: b.updatedAt })),
    ...opportunities.map((o) => ({ kind: "opportunity" as const, id: o.id, name: o.name, status: o.status, updatedAt: o.updatedAt })),
  ].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary">College Brief Lab</h1>
        <p className="text-muted-foreground text-sm mt-1">Turn prompts, readings, and opportunities into structured briefs and plans.</p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your data…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Briefs created", value: briefs.length, nav: "builder" as View },
              { label: "Opportunities tracked", value: opportunities.length, nav: "opportunities" as View },
              { label: "Active projects", value: activeProjects, nav: "opportunities" as View },
            ].map(({ label, value, nav }) => (
              <button key={label} onClick={() => onNav(nav)} className="bg-white border border-border rounded-xl p-4 text-left hover:bg-accent transition-colors">
                <div className="text-2xl font-bold text-primary">{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
              </button>
            ))}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent activity</h2>
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
                        <p className="text-sm text-foreground truncate">{item.kind === "brief" ? item.title : item.name}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {item.kind === "opportunity" && <span className="text-xs text-muted-foreground">{STATUS_LABELS[item.status] || item.status}</span>}
                        <span className="text-xs text-muted-foreground">{formatRelative(item.updatedAt)}</span>
                        <span className="text-xs text-primary font-medium">open →</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={() => onNav("builder")} className="bg-primary text-primary-foreground rounded-xl px-5 py-4 text-left hover:opacity-90 transition-opacity">
              <div className="font-semibold text-sm">New brief</div>
              <div className="text-xs opacity-80 mt-0.5">Essay, policy memo, or debate case</div>
            </button>
            <button onClick={() => onNav("opportunities")} className="bg-primary text-primary-foreground rounded-xl px-5 py-4 text-left hover:opacity-90 transition-opacity">
              <div className="font-semibold text-sm">Track an opportunity</div>
              <div className="text-xs opacity-80 mt-0.5">Scholarship, program, or competition</div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Brief Builder ────────────────────────────────────────────────────────────

const BRIEF_TYPES: { value: BriefType; label: string }[] = [
  { value: "essay", label: "College Essay Outline" },
  { value: "policy", label: "Policy Memo" },
  { value: "debate", label: "Debate Case" },
];
const TONES: { value: Tone; label: string }[] = [
  { value: "neutral", label: "Neutral Analytic" },
  { value: "advocacy", label: "Advocacy" },
  { value: "academic", label: "Academic Formal" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function DocSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-border last:border-0">
      <p className="text-sm font-bold text-foreground mb-2">{title}{subtitle && <span className="font-normal text-muted-foreground"> — {subtitle}</span>}</p>
      <div className="text-sm text-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function Para({ text }: { text: string }) {
  return <p className="text-sm text-foreground leading-[1.75]">{text}</p>;
}

function DebateOutput({ s }: { s: DebateSections }) {
  return (
    <>
      <DocSection title="Thesis"><Para text={s.thesis} /></DocSection>
      {s.contentions.map((c, i) => (
        <DocSection key={i} title={`Contention ${i + 1}`} subtitle={c.title}><Para text={c.body} /></DocSection>
      ))}
      {s.counterarguments.map((ca, i) => (
        <DocSection key={i} title={`CA ${i + 1}`} subtitle={ca.counter}>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Response</p>
          <Para text={ca.response} />
        </DocSection>
      ))}
      <DocSection title="Conclusion"><Para text={s.conclusion} /></DocSection>
    </>
  );
}

function PolicyOutput({ s }: { s: PolicySections }) {
  return (
    <>
      <DocSection title="Executive Summary"><Para text={s.executiveSummary} /></DocSection>
      <DocSection title="Background"><Para text={s.background} /></DocSection>
      <DocSection title="Problem Statement"><Para text={s.problem} /></DocSection>
      <DocSection title="Policy Options">
        <div className="space-y-3">
          {s.options.map((o, i) => (
            <div key={i}>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{o.label}</p>
              <Para text={o.description} />
            </div>
          ))}
        </div>
      </DocSection>
      <DocSection title="Recommendation"><Para text={s.recommendation} /></DocSection>
      <DocSection title="Next Steps"><Para text={s.nextSteps} /></DocSection>
    </>
  );
}

function EssayOutput({ s }: { s: EssaySections }) {
  return (
    <>
      <DocSection title="Hook"><Para text={s.hook} /></DocSection>
      <DocSection title="Core Story"><Para text={s.coreStory} /></DocSection>
      <DocSection title="Three Moments">
        <div className="space-y-2">
          {s.moments.map((m, i) => <Para key={i} text={`• ${m}`} />)}
        </div>
      </DocSection>
      <DocSection title="Reflection"><Para text={s.reflection} /></DocSection>
      <DocSection title="Takeaway"><Para text={s.takeaway} /></DocSection>
    </>
  );
}

function BriefOutput({ brief }: { brief: GeneratedBrief }) {
  const { sections } = brief;
  if (sections.type === "debate") return <DebateOutput s={sections} />;
  if (sections.type === "policy") return <PolicyOutput s={sections} />;
  return <EssayOutput s={sections as EssaySections} />;
}

function BriefBuilder({ initialPrompt = "", linkedOpportunityId = null }: { initialPrompt?: string; linkedOpportunityId?: string | null }) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [sourceNotes, setSourceNotes] = useState("");
  const [briefType, setBriefType] = useState<BriefType>("essay");
  const [tone, setTone] = useState<Tone>("neutral");
  const [generated, setGenerated] = useState<GeneratedBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState<string | null>(null);

  useEffect(() => { if (initialPrompt) setPrompt(initialPrompt); }, [initialPrompt]);

  async function handleGenerate() {
    if (!prompt.trim()) { setError("Please enter a prompt or question."); return; }
    setError(null); setSavedAt(null); setSaveError(null); setGenerating(true);
    setGenerated(null); setStreamText("");

    try {
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), sourceNotes, briefType, tone }),
      });

      if (!res.ok || !res.body) {
        setGenerated(generateBrief(prompt.trim(), sourceNotes, briefType, tone));
        setStreamText(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let evt: { chunk?: string; done?: boolean; result?: GeneratedBrief; error?: string };
          try { evt = JSON.parse(raw); } catch { continue; }

          if (evt.chunk) {
            setStreamText((prev) => (prev ?? "") + evt.chunk);
          } else if (evt.done && evt.result) {
            setStreamText(null);
            setGenerated(evt.result);
          } else if (evt.error) {
            setError(evt.error);
            setStreamText(null);
          }
        }
      }
    } catch {
      // Network error — fall back to the template generator
      setStreamText(null);
      setGenerated(generateBrief(prompt.trim(), sourceNotes, briefType, tone));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!generated) return;
    const title = prompt.trim().slice(0, 80);
    addLocalBrief({ title, briefType, createdAt: Date.now(), outlineText: generated.plainText });
    if (!user) { setSaveError("Guest mode: saved to this device only."); return; }
    setSaving(true); setSaveError(null);
    try {
      await saveBriefToFirestore({ uid: user.uid, title, briefType, prompt: prompt.trim(), sourceNotes, tone, outlineText: generated.plainText, createdAt: Date.now(), updatedAt: Date.now(), linkedOpportunityId });
      setSavedAt(formatTime(Date.now()));
      incrementBriefStats(user.uid).catch(() => {});
    } catch (e) { console.warn("[CBL] Save failed:", e); setSaveError("Save failed — stored locally only."); }
    finally { setSaving(false); }
  }

  async function handleCopy() {
    if (!generated) return;
    try { await navigator.clipboard.writeText(generated.plainText); setCopyMsg("Copied!"); }
    catch { setCopyMsg("Copy failed — select and copy manually."); }
    setTimeout(() => setCopyMsg(null), 2500);
  }

  const inputClass = "w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {!user && <div className="mb-4 px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-muted-foreground">Guest mode: your data is only stored on this device.</div>}
      {linkedOpportunityId && <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">Creating a brief linked to your opportunity.</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-semibold text-foreground">Inputs</h2>
          <Field label="Prompt or Question *">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="e.g. Describe a challenge that has shaped who you are. / Should the US adopt a carbon tax? / This house believes AI is net harmful." className={`${inputClass} resize-none leading-relaxed`} />
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </Field>
          <Field label="Source / Reading (optional)">
            <textarea value={sourceNotes} onChange={(e) => setSourceNotes(e.target.value)} rows={3} placeholder="Paste a summary, key quotes, or notes from any article or reading. Keywords will be woven into the brief." className={`${inputClass} resize-none leading-relaxed`} />
          </Field>
          <Field label="Brief type">
            <select value={briefType} onChange={(e) => setBriefType(e.target.value as BriefType)} className={inputClass}>
              {BRIEF_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Tone">
            <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className={inputClass}>
              {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <button onClick={handleGenerate} disabled={generating} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
            {generating ? "Generating…" : "Generate brief"}
          </button>
        </div>
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm min-h-[300px] max-h-[80vh] overflow-y-auto">
          <h2 className="text-sm font-semibold text-foreground mb-5">Output</h2>
          {streamText !== null ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                </span>
                Writing your brief…
              </div>
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border border-border rounded-lg p-3 bg-slate-50">
                {streamText}<span className="animate-pulse">▌</span>
              </pre>
            </div>
          ) : generated ? (
            <div className="space-y-1">
              <BriefOutput brief={generated} />
              <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-border mt-5">
                <button onClick={handleCopy} className="text-sm px-4 py-2 rounded border border-border text-foreground hover:bg-accent transition-colors">Copy brief</button>
                <button onClick={handleSave} disabled={saving} className="text-sm px-4 py-2 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                  {saving ? "Saving…" : "Save brief"}
                </button>
                {copyMsg && <span className="text-xs text-muted-foreground">{copyMsg}</span>}
                {savedAt && !saving && <span className="text-xs text-muted-foreground">Saved at {savedAt}</span>}
                {saveError && <span className="text-xs text-destructive">{saveError}</span>}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground text-center px-4">
              Fill in the inputs and click "Generate brief" to build your structured outline.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Opportunity Planner ──────────────────────────────────────────────────────

const OPP_TYPES = ["scholarship", "program", "competition", "other"];
const STATUSES: { value: FirestoreOpportunity["status"]; label: string; color: string }[] = [
  { value: "not_started", label: "Not started", color: "bg-secondary text-secondary-foreground" },
  { value: "drafting", label: "Drafting", color: "bg-blue-50 text-blue-700" },
  { value: "submitted", label: "Submitted", color: "bg-green-50 text-green-700" },
  { value: "result", label: "Result", color: "bg-purple-50 text-purple-700" },
];

function OpportunityPlanner({ onNav }: { onNav: (v: View, payload?: unknown) => void }) {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<FirestoreOpportunityWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(""); const [type, setType] = useState("scholarship");
  const [deadline, setDeadline] = useState(""); const [link, setLink] = useState("");
  const [goal, setGoal] = useState(""); const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getUserOpportunities(user.uid).then(setOpportunities).catch((e) => console.warn("[CBL] load opportunities failed:", e)).finally(() => setLoading(false));
  }, [user]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setFormError("Name is required."); return; }
    if (!type) { setFormError("Type is required."); return; }
    if (!deadline) { setFormError("Deadline is required."); return; }
    if (!user) { setFormError("Sign in to save opportunities."); return; }
    setFormError(null); setSubmitting(true);
    try {
      const payload: FirestoreOpportunity = { uid: user.uid, name: name.trim(), type, deadline, status: "not_started", link: link.trim(), goal: goal.trim(), linkedBriefId: null, createdAt: Date.now(), updatedAt: Date.now() };
      const id = await saveOpportunityToFirestore(payload);
      setOpportunities([{ id, ...payload }, ...opportunities]);
      incrementOpportunityStats(user.uid).catch(() => {});
      setName(""); setDeadline(""); setLink(""); setGoal(""); setType("scholarship");
    } catch (e) { console.warn("[CBL] saveOpportunity failed:", e); setFormError("Failed to save — check your connection."); }
    finally { setSubmitting(false); }
  }

  async function handleStatusChange(id: string, status: FirestoreOpportunity["status"]) {
    setOpportunities((prev) => prev.map((o) => o.id === id ? { ...o, status, updatedAt: Date.now() } : o));
    try { await updateOpportunityStatus(id, status); }
    catch (e) { console.warn("[CBL] updateStatus failed:", e); }
  }

  function handleOpenBrief(opp: FirestoreOpportunityWithId) {
    const prompt = `Write a brief/outline for this opportunity: ${opp.name} — ${opp.type}${opp.goal ? `. Goal: ${opp.goal}` : ""}.`;
    onNav("builder", { prompt, linkedOpportunityId: opp.id });
  }

  const inputClass = "w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-lg font-bold text-foreground">Opportunity Planner</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track scholarships, programs, and competitions. Link each to a brief.</p>
      </div>
      {!user && <div className="px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-muted-foreground">Sign in to save and manage opportunities.</div>}
      <form onSubmit={handleAdd} className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Add an opportunity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gates Scholarship, Yale Young Global Scholars" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              {OPP_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deadline *</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Goal / Angle</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="One-line angle or hook for this application" className={inputClass} />
          </div>
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
        <button type="submit" disabled={submitting || !user} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
          {submitting ? "Adding…" : "Add opportunity"}
        </button>
      </form>
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Your opportunities</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : opportunities.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">No opportunities yet. Add one above.</div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp) => {
              const sm = STATUSES.find((x) => x.value === opp.status) || STATUSES[0];
              const deadlineDate = opp.deadline ? new Date(opp.deadline + "T00:00:00") : null;
              const overdue = deadlineDate && deadlineDate < new Date() && opp.status !== "submitted" && opp.status !== "result";
              return (
                <div key={opp.id} className="bg-white border border-border rounded-xl px-5 py-4 shadow-sm">
                  <div className="flex flex-wrap items-start gap-3 justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{opp.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{opp.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sm.color}`}>{sm.label}</span>
                        {overdue && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Overdue</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {opp.deadline && <span className="text-xs text-muted-foreground">Due {new Date(opp.deadline + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}
                        {opp.goal && <span className="text-xs text-muted-foreground italic">"{opp.goal}"</span>}
                        {opp.link && <a href={opp.link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>Visit site →</a>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <select value={opp.status} onChange={(e) => handleStatusChange(opp.id, e.target.value as FirestoreOpportunity["status"])} className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      <button onClick={() => handleOpenBrief(opp)} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
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

// ─── App Shell ────────────────────────────────────────────────────────────────

function AppShell() {
  const { user, loading, signInGoogle } = useAuth();
  const [view, setView] = useState<View>("dashboard");
  const [builderPayload, setBuilderPayload] = useState<BuilderPayload>({});

  function handleNav(v: View, payload?: unknown) {
    setView(v);
    if (v === "builder" && payload) setBuilderPayload(payload as BuilderPayload);
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar view={view} onNav={handleNav} />
      <main>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading…</div>
        ) : !user ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-sm px-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
                <span className="text-primary-foreground text-xl font-bold">C</span>
              </div>
              <h1 className="text-2xl font-bold text-primary">College Brief Lab</h1>
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed">Turn prompts, readings, and opportunities into structured briefs and plans.</p>
              <p className="text-sm text-muted-foreground mt-6">Sign in to create and save briefs and opportunities.</p>
              <button onClick={signInGoogle} className="mt-4 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                Sign in with Google
              </button>
            </div>
          </div>
        ) : (
          <>
            {view === "dashboard" && <Dashboard onNav={handleNav} />}
            {view === "builder" && <BriefBuilder key={JSON.stringify(builderPayload)} initialPrompt={builderPayload.prompt} linkedOpportunityId={builderPayload.linkedOpportunityId} />}
            {view === "opportunities" && <OpportunityPlanner onNav={handleNav} />}
          </>
        )}
      </main>
    </div>
  );
}

function FirebaseSetupScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Firebase Setup Required</h1>
        </div>
        <p className="text-slate-600 mb-5">
          College Brief Lab needs Firebase credentials to enable Google sign-in and cloud storage.
          Add the following environment variables to your project:
        </p>
        <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm text-slate-300 space-y-1 mb-5">
          {[
            "VITE_FIREBASE_API_KEY",
            "VITE_FIREBASE_AUTH_DOMAIN",
            "VITE_FIREBASE_PROJECT_ID",
            "VITE_FIREBASE_STORAGE_BUCKET",
            "VITE_FIREBASE_MESSAGING_SENDER_ID",
            "VITE_FIREBASE_APP_ID",
          ].map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-emerald-400">→</span>
              <span>{k}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-500">
          Find these values in your{" "}
          <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">
            Firebase Console
          </a>{" "}
          under Project Settings → Your apps → SDK setup and configuration.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!firebaseConfigured) return <FirebaseSetupScreen />;
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
