import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  generateBrief,
  type BriefType,
  type Tone,
  type GeneratedBrief,
  type DebateSections,
  type PolicySections,
  type EssaySections,
} from "@/lib/generateBrief";
import { addLocalBrief, formatTime } from "@/lib/localHistory";
import { saveBriefToFirestore, incrementBriefStats } from "@/lib/firestoreOps";

type Props = {
  initialPrompt?: string;
  linkedOpportunityId?: string | null;
};

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

export default function BriefBuilder({ initialPrompt = "", linkedOpportunityId = null }: Props) {
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

  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);

  function handleGenerate() {
    if (!prompt.trim()) {
      setError("Please enter a prompt or question.");
      return;
    }
    setError(null);
    setSavedAt(null);
    setSaveError(null);
    setGenerated(generateBrief(prompt.trim(), sourceNotes, briefType, tone));
  }

  async function handleSave() {
    if (!generated) return;
    const title = prompt.trim().slice(0, 80);

    addLocalBrief({ title, briefType, createdAt: Date.now(), outlineText: generated.plainText });

    if (!user) {
      setSaveError("Guest mode: saved to this device only.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await saveBriefToFirestore({
        uid: user.uid,
        title,
        briefType,
        prompt: prompt.trim(),
        sourceNotes,
        tone,
        outlineText: generated.plainText,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        linkedOpportunityId,
      });
      setSavedAt(formatTime(Date.now()));
      incrementBriefStats(user.uid).catch(() => {});
    } catch (e) {
      console.warn("[CBL] Save failed:", e);
      setSaveError("Save failed — stored locally only.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.plainText);
      setCopyMsg("Copied!");
    } catch {
      setCopyMsg("Copy failed — select and copy manually.");
    }
    setTimeout(() => setCopyMsg(null), 2500);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {!user && (
        <div className="mb-4 px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-muted-foreground">
          Guest mode: your data is only stored on this device.
        </div>
      )}
      {linkedOpportunityId && (
        <div className="mb-4 px-4 py-2.5 bg-primary/8 border border-primary/20 rounded-lg text-sm text-primary">
          Creating a brief linked to your opportunity.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Inputs ── */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-semibold text-foreground">Inputs</h2>

          <Field label="Prompt or Question *">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. Describe a challenge that has shaped who you are. / Should the US adopt a carbon tax? / This house believes AI is net harmful."
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
            />
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </Field>

          <Field label="Source / Reading (optional)">
            <textarea
              value={sourceNotes}
              onChange={(e) => setSourceNotes(e.target.value)}
              rows={3}
              placeholder="Paste a summary, key quotes, or notes from any article or reading. Keywords will be woven into the brief."
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
            />
          </Field>

          <Field label="Brief type">
            <select
              value={briefType}
              onChange={(e) => setBriefType(e.target.value as BriefType)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {BRIEF_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Tone">
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>

          <button
            onClick={handleGenerate}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Generate brief
          </button>
        </div>

        {/* ── Output ── */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm min-h-[300px] max-h-[80vh] overflow-y-auto">
          <h2 className="text-sm font-semibold text-foreground mb-5">Output</h2>

          {generated ? (
            <div className="space-y-1">
              <BriefOutput brief={generated} />

              <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-border mt-5">
                <button
                  onClick={handleCopy}
                  className="text-sm px-4 py-2 rounded border border-border text-foreground hover:bg-accent transition-colors"
                >
                  Copy brief
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-sm px-4 py-2 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save brief"}
                </button>
                {copyMsg && <span className="text-xs text-muted-foreground">{copyMsg}</span>}
                {savedAt && !saving && (
                  <span className="text-xs text-muted-foreground">Saved at {savedAt}</span>
                )}
                {saveError && (
                  <span className="text-xs text-destructive">{saveError}</span>
                )}
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

// ─── Document renderer ────────────────────────────────────────────────────────

function BriefOutput({ brief }: { brief: GeneratedBrief }) {
  const { sections } = brief;
  if (sections.type === "debate") return <DebateOutput s={sections} />;
  if (sections.type === "policy") return <PolicyOutput s={sections} />;
  return <EssayOutput s={sections} />;
}

function DocSection({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 border-b border-border last:border-0">
      <p className="text-sm font-bold text-foreground mb-2">
        {title}
        {subtitle && (
          <span className="font-normal text-muted-foreground"> — {subtitle}</span>
        )}
      </p>
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
      <DocSection title="Thesis">
        <Para text={s.thesis} />
      </DocSection>

      {s.contentions.map((c, i) => (
        <DocSection key={i} title={`Contention ${i + 1}`} subtitle={c.title}>
          <Para text={c.body} />
        </DocSection>
      ))}

      <DocSection title="Counterarguments & Responses">
        <div className="space-y-4">
          {s.counterarguments.map((ca, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-muted-foreground mb-1">
                CA {i + 1}
              </p>
              <Para text={ca.counter} />
              <p className="text-sm font-semibold text-muted-foreground mt-2 mb-1">
                Response
              </p>
              <Para text={ca.response} />
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection title="Conclusion">
        <Para text={s.conclusion} />
      </DocSection>
    </>
  );
}

function PolicyOutput({ s }: { s: PolicySections }) {
  return (
    <>
      <DocSection title="Executive Summary">
        <Para text={s.executiveSummary} />
      </DocSection>

      <DocSection title="Background">
        <Para text={s.background} />
      </DocSection>

      <DocSection title="Problem Statement">
        <Para text={s.problem} />
      </DocSection>

      <DocSection title="Policy Options">
        <div className="space-y-3">
          {s.options.map((o, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-foreground mb-1">{o.label}</p>
              <Para text={o.description} />
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection title="Recommendation">
        <Para text={s.recommendation} />
      </DocSection>

      <DocSection title="Next Steps">
        <Para text={s.nextSteps} />
      </DocSection>
    </>
  );
}

function EssayOutput({ s }: { s: EssaySections }) {
  return (
    <>
      <DocSection title="Hook">
        <Para text={s.hook} />
      </DocSection>

      <DocSection title="Core Story">
        <Para text={s.coreStory} />
      </DocSection>

      <DocSection title="Three Moments">
        <ul className="space-y-2.5 mt-1">
          {s.moments.map((m, i) => {
            const dashIdx = m.indexOf(":");
            const heading = dashIdx > -1 ? m.slice(0, dashIdx + 1) : `Moment ${i + 1}:`;
            const body = dashIdx > -1 ? m.slice(dashIdx + 1).trim() : m;
            return (
              <li key={i} className="text-sm text-foreground leading-[1.75]">
                <span className="font-semibold">{heading}</span> {body}
              </li>
            );
          })}
        </ul>
      </DocSection>

      <DocSection title="Reflection">
        <Para text={s.reflection} />
      </DocSection>

      <DocSection title="Takeaway">
        <Para text={s.takeaway} />
      </DocSection>
    </>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
