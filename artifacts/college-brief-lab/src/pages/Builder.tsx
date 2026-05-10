import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGenerateBrief,
  useCreateBrief,
  getListBriefsQueryKey,
  getGetBriefStatsQueryKey,
  BriefGenerateInputBriefType,
  BriefGenerateInputTone,
  BriefGenerateInputMode,
} from "@workspace/api-client-react";
import type { BriefResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  Copy,
  Save,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  BookOpen,
  FileText,
  MessageSquare,
  LogIn,
} from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

type BriefType = "debate" | "policy" | "essay";
type Tone = "formal" | "persuasive" | "analytical" | "narrative";

const TYPE_CONFIG: Record<BriefType, {
  label: string;
  icon: typeof Wand2;
  placeholder: string;
  color: string;
  wordLimits: { label: string; value: number | null }[];
}> = {
  debate: {
    label: "Debate Case",
    icon: MessageSquare,
    color: "text-blue-500",
    placeholder: "Enter your debate resolution or topic...\n\nExample: Social media does more harm than good to teenagers",
    wordLimits: [
      { label: "Standard Case (800w)", value: 800 },
      { label: "Short Case (400w)", value: 400 },
      { label: "No limit", value: null },
    ],
  },
  policy: {
    label: "Policy Memo",
    icon: FileText,
    color: "text-violet-500",
    placeholder: "Enter your policy question or issue...\n\nExample: Should the US lower the voting age to 16?",
    wordLimits: [
      { label: "Standard Memo (1000w)", value: 1000 },
      { label: "Executive Brief (500w)", value: 500 },
      { label: "One-Pager (300w)", value: 300 },
      { label: "No limit", value: null },
    ],
  },
  essay: {
    label: "College Essay",
    icon: BookOpen,
    color: "text-emerald-500",
    placeholder: "Enter your essay prompt or topic...\n\nExample: Describe a challenge you overcame that changed who you are",
    wordLimits: [
      { label: "Common App Main (650w)", value: 650 },
      { label: "Why Us Supplement (250w)", value: 250 },
      { label: "Short Answer (150w)", value: 150 },
      { label: "No limit", value: null },
    ],
  },
};

const TEMPLATES: Record<BriefType, string[]> = {
  essay: [
    "Why I want to study Computer Science",
    "A challenge I overcame that changed me",
    "How a mentor shaped my ambitions",
    "Why I want to attend a small liberal arts college",
  ],
  policy: [
    "Should the US lower the voting age to 16?",
    "How should universities address student mental health?",
    "Should standardized testing be eliminated in admissions?",
  ],
  debate: [
    "Social media does more harm than good to teenagers",
    "Universal basic income would benefit society",
    "AI in education threatens academic integrity",
    "The US should abolish the Electoral College",
    "Affirmative action in college admissions is justified",
  ],
};

const TONES: { value: Tone; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "persuasive", label: "Persuasive" },
  { value: "analytical", label: "Analytical" },
  { value: "narrative", label: "Narrative" },
];

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 10) * 100;
  const color =
    value >= 8 ? "bg-emerald-500" : value >= 5 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span className="capitalize font-medium">{label}</span>
        <span className="font-semibold text-foreground">{value}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function ResultPanel({ result, onSave, onPolish, saving }: {
  result: BriefResult;
  onSave: () => void;
  onPolish: () => void;
  saving: boolean;
}) {
  const { toast } = useToast();
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));

  const toggleSection = (i: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const plainText = result.sections
    .map((s) => `## ${s.heading}\n${s.bullets.map((b) => `• ${b}`).join("\n")}`)
    .join("\n\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(plainText);
    toast({ title: "Copied to clipboard" });
  };

  const handleExport = () => {
    const blob = new Blob([plainText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brief.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (result.quality === "filler") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
        <h3 className="font-semibold text-foreground mb-1">Brief needs more detail</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{result.message}</p>
        <Button onClick={onPolish} variant="outline" size="sm" className="mt-4 gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </Button>
      </div>
    );
  }

  const score = result.score;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Summary */}
      {result.summary && (
        <blockquote className="border-l-2 border-primary pl-3 italic text-sm text-muted-foreground">
          {result.summary}
        </blockquote>
      )}

      {/* Score */}
      {score && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Quality Score</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 grid grid-cols-2 gap-3">
            {Object.entries(score).map(([k, v]) => (
              <ScoreBar key={k} label={k} value={v as number} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      <div className="space-y-2">
        {result.sections.map((sec, i) => (
          <Collapsible
            key={i}
            open={openSections.has(i)}
            onOpenChange={() => toggleSection(i)}
          >
            <Card data-testid={`card-section-${i}`}>
              <CollapsibleTrigger asChild>
                <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-xl">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{sec.heading}</CardTitle>
                    {openSections.has(i) ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0">
                  <ul className="space-y-1.5">
                    {sec.bullets.map((b, j) => (
                      <motion.li
                        key={j}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: j * 0.05 }}
                        className="flex gap-2 text-sm text-foreground"
                      >
                        <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                        {b}
                      </motion.li>
                    ))}
                  </ul>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          data-testid="button-copy-brief"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5 text-xs"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy
        </Button>
        <Button
          data-testid="button-save-brief"
          size="sm"
          onClick={onSave}
          disabled={saving}
          className="gap-1.5 text-xs"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          data-testid="button-polish-brief"
          variant="outline"
          size="sm"
          onClick={onPolish}
          className="gap-1.5 text-xs"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Polish
        </Button>
        <Button
          data-testid="button-export-brief"
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="gap-1.5 text-xs"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
      </div>
    </motion.div>
  );
}

export default function Builder() {
  const { user, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [briefType, setBriefType] = useState<BriefType>("debate");
  const [prompt, setPrompt] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [tone, setTone] = useState<Tone>("persuasive");
  const [wordLimitIdx, setWordLimitIdx] = useState(0);
  const [result, setResult] = useState<BriefResult | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const config = TYPE_CONFIG[briefType];
  const wordLimit = config.wordLimits[wordLimitIdx]?.value ?? null;
  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;

  const generateMutation = useGenerateBrief({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
      },
      onError: () => {
        toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
      },
    },
  });

  const createMutation = useCreateBrief({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBriefsQueryKey({ firebaseUid: user?.uid ?? "" }) });
        queryClient.invalidateQueries({ queryKey: getGetBriefStatsQueryKey({ firebaseUid: user?.uid ?? "" }) });
        toast({ title: "Brief saved" });
      },
      onError: () => {
        toast({ title: "Failed to save brief", variant: "destructive" });
      },
    },
  });

  const API_BRIEF_TYPE: Record<BriefType, typeof BriefGenerateInputBriefType[keyof typeof BriefGenerateInputBriefType]> = {
    debate: BriefGenerateInputBriefType.Debate_Case,
    policy: BriefGenerateInputBriefType.Policy_Memo,
    essay: BriefGenerateInputBriefType.College_Essay_Outline,
  };

  const API_TONE: Record<Tone, typeof BriefGenerateInputTone[keyof typeof BriefGenerateInputTone]> = {
    formal: BriefGenerateInputTone.Academic_Formal,
    persuasive: BriefGenerateInputTone.Advocacy,
    analytical: BriefGenerateInputTone.Neutral_Analytic,
    narrative: BriefGenerateInputTone.Advocacy,
  };

  const handleGenerate = useCallback(
    (mode: "generate" | "polish" = "generate") => {
      if (!prompt.trim()) {
        toast({ title: "Enter a prompt first", variant: "destructive" });
        return;
      }
      generateMutation.mutate({
        data: {
          prompt,
          sourceNotes: sourceNotes || undefined,
          briefType: API_BRIEF_TYPE[briefType],
          tone: API_TONE[tone],
          mode: mode === "generate" ? BriefGenerateInputMode.generate : BriefGenerateInputMode.polish,
        },
      });
    },
    [prompt, sourceNotes, briefType, tone, generateMutation, toast]
  );

  const handleSave = useCallback(() => {
    if (!result || !user) return;
    const title = prompt.split("\n")[0].slice(0, 120) || "Untitled Brief";
    createMutation.mutate({
      data: {
        firebaseUid: user.uid,
        title,
        briefType,
        tone,
        outlineText: result.sections.map((s) => `${s.heading}: ${s.bullets.join(". ")}`).join("\n"),
        sections: JSON.stringify(result.sections),
        score: JSON.stringify(result.score),
        summary: result.summary ?? undefined,
        prompt,
        sourceNotes: sourceNotes || undefined,
      },
    });
  }, [result, user, prompt, briefType, tone, sourceNotes, createMutation]);

  const selectTemplate = (t: string) => {
    setPrompt(t);
    setTemplatesOpen(false);
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 h-full">
        <div className="text-center max-w-md">
          <Wand2 className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">Brief Builder</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Sign in to start generating AI-powered debate cases, policy memos, and college essays.
          </p>
          <Button data-testid="button-sign-in-builder" onClick={signInWithGoogle} className="gap-2">
            <SiGoogle className="w-4 h-4" />
            Sign in with Google
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — Input */}
      <div className="w-96 flex-shrink-0 flex flex-col border-r border-border overflow-y-auto p-5 space-y-4">
        {/* Mode tabs */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mode</div>
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            {(["debate", "policy", "essay"] as BriefType[]).map((t) => {
              const Icon = TYPE_CONFIG[t].icon;
              return (
                <button
                  key={t}
                  data-testid={`button-mode-${t}`}
                  onClick={() => { setBriefType(t); setWordLimitIdx(0); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    briefType === t
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t === "debate" ? "Debate" : t === "policy" ? "Policy" : "Essay"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Templates */}
        <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
          <CollapsibleTrigger asChild>
            <button
              data-testid="button-toggle-templates"
              className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              Templates
              {templatesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1">
              {TEMPLATES[briefType].map((t) => (
                <button
                  key={t}
                  data-testid={`button-template-${t.slice(0, 20)}`}
                  onClick={() => selectTemplate(t)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Prompt */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Prompt</div>
          <Textarea
            data-testid="input-prompt"
            placeholder={config.placeholder}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-32 text-sm resize-none"
          />
          {wordLimit && (
            <div className="mt-1.5">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Word count</span>
                <span className={wordCount > wordLimit ? "text-destructive" : ""}>{wordCount} / {wordLimit}</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${wordCount > wordLimit ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min((wordCount / wordLimit) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Source notes */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Source Notes <span className="normal-case font-normal">(optional)</span></div>
          <Textarea
            data-testid="input-source-notes"
            placeholder="Paste quotes, stats, or key facts to incorporate..."
            value={sourceNotes}
            onChange={(e) => setSourceNotes(e.target.value)}
            className="min-h-20 text-sm resize-none"
          />
        </div>

        {/* Tone + Word limit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tone</div>
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger data-testid="select-tone" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map(({ value, label }) => (
                  <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Word Limit</div>
            <Select
              value={String(wordLimitIdx)}
              onValueChange={(v) => setWordLimitIdx(Number(v))}
            >
              <SelectTrigger data-testid="select-word-limit" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.wordLimits.map((wl, idx) => (
                  <SelectItem key={idx} value={String(idx)} className="text-xs">{wl.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generate button */}
        <Button
          data-testid="button-generate-brief"
          onClick={() => handleGenerate("generate")}
          disabled={generateMutation.isPending}
          className="w-full gap-2"
          size="lg"
        >
          {generateMutation.isPending ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Brief
            </>
          )}
        </Button>
      </div>

      {/* Right panel — Output */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {generateMutation.isPending ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </motion.div>
          ) : result ? (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-4 flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">{briefType}</Badge>
                <Badge variant="outline" className="text-xs capitalize">{tone}</Badge>
                {wordLimit && <Badge variant="outline" className="text-xs">{wordLimit}w limit</Badge>}
              </div>
              <ResultPanel
                result={result}
                onSave={handleSave}
                onPolish={() => handleGenerate("polish")}
                saving={createMutation.isPending}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full min-h-64 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Wand2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Ready to generate</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Enter a prompt on the left, choose your settings, and click Generate Brief.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
