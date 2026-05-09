export type BriefType = "essay" | "policy" | "debate";
export type Tone = "neutral" | "advocacy" | "academic";

// ─── Rich typed section shapes ────────────────────────────────────────────────

export type DebateSections = {
  type: "debate";
  thesis: string;
  contentions: { title: string; body: string }[];
  counterarguments: { counter: string; response: string }[];
  conclusion: string;
};

export type PolicySections = {
  type: "policy";
  executiveSummary: string;
  background: string;
  problem: string;
  options: { label: string; description: string }[];
  recommendation: string;
  nextSteps: string;
};

export type EssaySections = {
  type: "essay";
  hook: string;
  coreStory: string;
  moments: string[];
  reflection: string;
  takeaway: string;
};

export type BriefSections = DebateSections | PolicySections | EssaySections;

export type GeneratedBrief = {
  sections: BriefSections;
  plainText: string;
};

// ─── Pre-processing ───────────────────────────────────────────────────────────

const STOPS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","have","has","had","do",
  "does","did","will","would","could","should","may","might","this","that",
  "these","those","it","its","their","they","them","there","here","which",
  "what","when","where","who","how","why","than","then","more","also","into",
  "about","over","such","both","very","just","each","much","some","your",
  "you","we","our","can","not","all","any","being","whether","through","very",
]);

/** Pull the first clean sentence (≤ 100 chars), or truncate at a word boundary */
function extractTopic(prompt: string): string {
  const stripped = prompt.trim()
    .replace(/^this house (believes|would|should)\s+/i, "")
    .replace(/^(should|does|is|are|can|describe|discuss|explain|consider)\s+/i, "")
    .trim();

  const firstSentence = stripped.split(/[.?!]/)[0].trim();
  if (firstSentence.length <= 100) return firstSentence;

  const cut = stripped.slice(0, 90);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > 40 ? lastSpace : 90);
}

/** Top-5 keywords by frequency, length ≥ 4, not stopwords */
function extractKeywords(notes: string, prompt: string): string[] {
  const src = (notes.trim() || prompt.trim()).toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = src.split(/\s+/).filter((w) => w.length >= 4 && !STOPS.has(w));

  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 5);
}

/** Safely get keyword i, fallback to last or a generic term */
function kw(kws: string[], i: number, fallback = "policy outcomes"): string {
  return kws[i] ?? kws[kws.length - 1] ?? fallback;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Tone starters ────────────────────────────────────────────────────────────

const T = {
  neutral: {
    open: "The evidence suggests",
    argue: "This brief finds",
    note: "It is worth noting that",
    conclude: "The weight of evidence supports",
    data: "Available data on",
  },
  advocacy: {
    open: "This brief argues",
    argue: "We must recognize",
    note: "Critically,",
    conclude: "Decision-makers must act on",
    data: "Documented evidence on",
  },
  academic: {
    open: "This paper contends",
    argue: "The available literature indicates",
    note: "It bears noting that",
    conclude: "The preponderance of scholarly evidence supports",
    data: "Empirical research on",
  },
} as const;

// ─── DEBATE ───────────────────────────────────────────────────────────────────

function buildDebate(topic: string, kws: string[], tone: Tone): DebateSections {
  const t = T[tone];
  const topicLow = topic.toLowerCase();

  // Derive contention titles from keywords + topic words
  const topicWords = topic.replace(/[^a-z0-9\s]/gi, " ").split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPS.has(w.toLowerCase()));

  const title0 = cap(kw(kws, 0, "social impact")) + " and documented harm";
  const title1 = "Institutional failure and accountability";
  const title2 = cap(topicWords[0] ?? kw(kws, 2, "reform")) + " — the path forward";

  const thesis =
    tone === "academic"
      ? `${t.open} that ${topicLow}. Normative and empirical analysis converge on this conclusion across three dimensions: documented harm under the status quo, structural institutional failure, and the availability of a superior alternative.`
      : tone === "advocacy"
      ? `${t.open} that ${topicLow} is both necessary and long overdue. The evidence is not merely suggestive — it is decisive — and the moral imperative could not be clearer. Three contentions make this case.`
      : `${t.open} that ${topicLow}. Examined across principled, practical, and evidential dimensions, the affirmative case is robust and the opposition's path is foreclosed on each of them.`;

  const contentions: DebateSections["contentions"] = [
    {
      title: title0,
      body: `${t.open} that ${kw(kws, 0)} is a primary driver of the harm this proposition addresses. The structural conditions that enable ${topicLow} have persisted without adequate remedy for an extended period, and that persistence is not accidental — it reflects a failure of political will and institutional design. ${t.data} ${kw(kws, 0)} and ${kw(kws, 1)} consistently show that the negative effects are not marginal but systematic, and that they compound over time in the absence of intervention. This contention establishes the baseline harm the affirmative resolves.`,
    },
    {
      title: title1,
      body: `${t.argue} that existing institutions have proven structurally inadequate to address ${topicLow} without the kind of intervention this proposition authorizes. ${t.note} current frameworks underweight the interests of those most affected, creating an accountability gap that voluntary action and incremental reform have consistently failed to close. ${t.data} ${kw(kws, 1)} and ${kw(kws, 2)} illustrates this pattern: despite years of reform efforts, the core dysfunction persists. The proposition directly targets this gap.`,
    },
    {
      title: title2,
      body: `${t.open} that affirming this proposition produces concrete, measurable benefits that the opposition cannot match. Comparative evidence from contexts where similar approaches have been adopted — particularly around ${kw(kws, 2)} and ${kw(kws, 3, kw(kws, 0))} — demonstrates improved outcomes across the key indicators. ${t.note} the cost of inaction exceeds the cost of a well-designed response by a significant margin, and that margin widens the longer action is deferred.`,
    },
  ];

  const counterarguments: DebateSections["counterarguments"] = [
    {
      counter: `Critics argue that the proposition overcorrects and would produce implementation costs — particularly around ${kw(kws, 0)} — that rival or exceed the harms it claims to address.`,
      response:
        tone === "academic"
          ? `This objection confuses short-term transitional friction with long-term systemic failure. The literature on comparable interventions indicates that implementation costs are bounded and recoverable; the costs of status quo continuation are neither. Contention Two addresses the institutional mechanisms that manage this transition.`
          : tone === "advocacy"
          ? `This objection inverts the risk calculus entirely. The proposition does not overcorrect — it corrects. The burden of proof lies with those defending a status quo that has already failed, not with those proposing a principled path forward. Inaction is not neutral; it is a choice with consequences.`
          : `This concern is real but does not survive scrutiny. Evidence from Contention Three demonstrates that comparable approaches have managed implementation risk effectively. The objection assumes a fragility in this proposition that the comparative record does not support.`,
    },
    {
      counter: `A second line of objection holds that alternative approaches — incremental reform, incentive mechanisms, or voluntary adoption — could achieve equivalent outcomes with less disruption.`,
      response:
        tone === "academic"
          ? `The available evidence on ${kw(kws, 1)} indicates that incremental and voluntary approaches have had sufficient time to demonstrate efficacy and have not done so. The proposition is warranted precisely because gradualism has failed as a strategy. Contention One documents this failure systematically.`
          : tone === "advocacy"
          ? `Incremental approaches have been tried and have failed — repeatedly. Defending gradualism in the face of documented failure is not moderation; it is complicity with an unjust status quo. Contention One makes this case in detail. The time for half-measures has passed.`
          : `The track record of voluntary and market-based alternatives on this issue is not encouraging. Analysis of ${kw(kws, 2)} outcomes over time suggests these mechanisms consistently underperform on the key indicators. The proposition addresses the structural gap that alternatives reliably leave unresolved.`,
    },
  ];

  const conclusion =
    tone === "academic"
      ? `${t.conclude} the affirmative position on ${topicLow}. Across principled, institutional, and evidential dimensions, the three contentions presented herein form a coherent and mutually reinforcing case. Each stands independently; together they are decisive. Adjudicators are invited to weigh them accordingly.`
      : tone === "advocacy"
      ? `${t.conclude} the affirmative. Systematic harm, institutional failure, and a clear path forward — these three contentions make the case, and the opposition has not answered any of them substantively. This is not a close call. The motion affirms.`
      : `${t.conclude} the affirmative position on ${topicLow}. Each of the three contentions — harm, accountability, and forward-looking benefit — is independently sufficient. Together, they render the affirmative case compelling. The preponderance of evidence and argument favors this side.`;

  return { type: "debate", thesis, contentions, counterarguments, conclusion };
}

// ─── POLICY ───────────────────────────────────────────────────────────────────

function buildPolicy(
  topic: string, kws: string[], tone: Tone, sourceNotes: string
): PolicySections {
  const t = T[tone];
  const topicLow = topic.toLowerCase();
  const hasNotes = sourceNotes.trim().length > 0;
  const notesSnippet = hasNotes
    ? `${sourceNotes.slice(0, 100).replace(/\n/g, " ")}${sourceNotes.length > 100 ? "…" : ""}`
    : null;

  const executiveSummary = `${t.open} that immediate policy action on ${topicLow} is warranted. ${t.data} ${kw(kws, 0)} and ${kw(kws, 1)} indicates that current frameworks are insufficient to address the scale of the problem. This memo recommends a targeted regulatory intervention, phased over eighteen months, with defined accountability measures and a built-in review process. ${t.note} the costs of continued inaction are compounding; acting now limits long-run exposure and preserves the policy options that delay would foreclose.`;

  const background = `The issue of ${topicLow} has developed over an extended period, shaped by structural factors including ${kw(kws, 0)}, ${kw(kws, 1)}, and ${kw(kws, 2)}. ${notesSnippet ? `Source documentation is instructive: ${notesSnippet}` : `Prior policy analysis has consistently identified ${kw(kws, 0)} as a central driver of the current gap.`} Stakeholder groups across civil society, affected communities, and relevant sectors have raised consistent concerns about the adequacy of the existing framework. The current policy environment has reached an inflection point: the gap between stated objectives and observed outcomes has widened to the point where incremental adjustment is no longer an adequate response.`;

  const problem = `The core problem is that ${topicLow} continues to generate measurable harm under the status quo, and existing mechanisms have failed to arrest this trend. The primary causes are three: inadequate regulation of ${kw(kws, 0)}, misaligned incentives around ${kw(kws, 1)}, and insufficient coordination across the relevant institutional actors. The stakes are not speculative — without intervention, current trajectories suggest the problem will deepen, with effects falling disproportionately on those with the least capacity to absorb additional burdens. ${t.note} the cost of a well-designed regulatory response is now lower than the cost of continued inaction.`;

  const options: PolicySections["options"] = [
    {
      label: "Option A — Targeted Regulatory Framework",
      description: `Introduce binding standards addressing ${kw(kws, 0)} and ${kw(kws, 1)}, administered by an existing regulatory body with augmented authority and dedicated enforcement capacity. This approach is direct, enforceable, and has clear precedent in analogous policy domains. Upfront compliance costs are real but bounded; durable outcomes are well-documented in comparable contexts.`,
    },
    {
      label: "Option B — Incentive-Based Approach",
      description: `Deploy a structured incentive scheme — tax credits, preferential procurement, or conditional grants — to encourage voluntary adoption of better practices around ${kw(kws, 2)}. This approach is politically viable and avoids mandatory compliance friction, but the evidence base suggests slower and more uneven uptake, particularly in sectors where short-term incentive alignment is weak.`,
    },
    {
      label: "Option C — Status Quo with Enhanced Monitoring",
      description: `Maintain existing policy architecture while expanding outcome data collection on ${kw(kws, 0)} and adjacent indicators. This option avoids short-term disruption, but it accepts continued harm and provides no structural resolution to the accountability gap already documented. Given current evidence, this option is not recommended.`,
    },
  ];

  const recommendation = `${t.argue} that Option A — the targeted regulatory framework — is the appropriate course of action. It directly addresses the structural causes identified in the problem statement, creates enforceable and auditable standards, and has demonstrated efficacy at scale in comparable policy contexts. The concerns associated with compliance costs are legitimate but manageable through a phased implementation schedule and targeted support for smaller actors. Option B, while politically convenient, lacks sufficient evidence of impact at the required scale. Option C is untenable given what the data on ${kw(kws, 0)} already demonstrates.`;

  const nextSteps = `Immediate (0–30 days): Convene an inter-agency working group to draft the regulatory framework, drawing on precedent from comparable policy domains and including a representative from affected communities in the drafting process. Short-term (30–90 days): Conduct a structured stakeholder consultation with a defined comment period, ensuring input from both sector representatives and independent technical experts. Longer-term (90–180 days): Publish a draft rule with a public comment period; finalize and implement with an eighteen-month review clause that evaluates outcomes against pre-defined benchmarks and triggers a formal reassessment if targets are not met.`;

  return { type: "policy", executiveSummary, background, problem, options, recommendation, nextSteps };
}

// ─── ESSAY ────────────────────────────────────────────────────────────────────

function buildEssay(
  topic: string, kws: string[], tone: Tone, sourceNotes: string
): EssaySections {
  const topicLow = topic.toLowerCase();
  const hasNotes = sourceNotes.trim().length > 0;

  const hook =
    tone === "academic"
      ? `The relationship between direct experience and intellectual formation is rarely linear. My engagement with ${topicLow} did not begin in a classroom or a book — it began in a moment of practical difficulty that forced me to think more carefully about what I actually believed and what I was actually capable of.`
      : tone === "advocacy"
      ? `There are moments when a question stops being abstract. For me, ${topicLow} became concrete in a way I had not anticipated — and what I found on the other side of that reckoning changed how I approach nearly every hard problem I have encountered since.`
      : `The first time I seriously confronted ${topicLow}, I underestimated how much it would ask of me. It started as something bounded — a specific task, a particular challenge — and expanded into something that required me to think differently about my own assumptions and capabilities.`;

  const coreStory =
    tone === "academic"
      ? `The experience at the center of this essay brought me into sustained engagement with ${hasNotes ? kw(kws, 0) + " and " + kw(kws, 1) : "questions I had previously held at a comfortable distance"}. What began as a discrete challenge gradually revealed itself to be an education in how complex problems actually behave — resistant to simple framing, sensitive to context, and deeply shaped by the choices of the people closest to them. The central insight I took from this process is that the gap between what we intend and what we achieve is rarely a failure of effort; it is almost always a failure of understanding. That distinction has organized how I approach difficult problems ever since.`
      : tone === "advocacy"
      ? `This essay is about what happened when I decided to take ${topicLow} seriously, rather than treating it as someone else's concern. ${hasNotes ? `Engaging with ${kw(kws, 0)} and ${kw(kws, 1)} was the beginning of a broader commitment — one I did not fully understand at first but have since chosen deliberately.` : "What I discovered was that the problem was both more complex and more tractable than I had assumed, and that the difference between those two things depended almost entirely on the quality of attention you brought to it."} I am a different thinker because of that choice — more willing to stay in a hard problem, and less willing to settle for answers that feel clean but leave the core question untouched.`
      : `This essay is about ${topicLow} and what it taught me about sustained effort, intellectual honesty, and the difference between knowing something and understanding it. ${hasNotes ? `Working through questions of ${kw(kws, 0)} and ${kw(kws, 1)} pushed me past my initial frame.` : "The process was slower than I expected and more instructive than I anticipated."} What I came away with is not a single lesson but a changed relationship with difficulty — one that I am still learning to use well.`;

  const moments = [
    `Moment 1 — The initial encounter: When ${topicLow} first presented itself as a real and specific problem rather than a general concern. ${hasNotes ? `Engaging with material on ${kw(kws, 0)} made what had been abstract suddenly concrete.` : "I had to commit to a direction without knowing whether it was the right one — and that uncertainty was itself the first lesson."}`,
    `Moment 2 — The turning point: When the approach I had been using stopped working and I was forced to reconsider my assumptions rather than simply work harder within them. ${hasNotes ? `The significance of ${kw(kws, 1)} in shaping the problem was something I had underestimated, and recognizing that required a kind of intellectual honesty I had been avoiding.` : "Failure, in this case, was more instructive than success would have been — it showed me exactly where my model of the situation was wrong."}`,
    `Moment 3 — The resolution: Not a perfect outcome, but a clearer and more honest understanding of the terrain and my own place within it. ${hasNotes ? `Insights connected to ${kw(kws, 2, kw(kws, 0))} changed how I framed the question going forward.` : "I finished this experience with more questions than I started with — and for the first time, that felt like the right result."}`,
  ];

  const reflection =
    tone === "academic"
      ? `Taken together, these three moments represent a process of conceptual revision rather than simple skill acquisition. My prior assumptions about ${topicLow} were not entirely wrong, but they were insufficiently complex — they missed the dimensions that matter most in practice. What changed was not just my position on a particular question but my understanding of what kinds of questions are worth asking, and how to pursue them rigorously without losing sight of what is actually at stake. ${hasNotes ? `The material on ${kw(kws, 0)} and ${kw(kws, 1)} was instrumental in this reorientation.` : "This experience made me a more careful and more honest thinker, and that is the most durable thing I took from it."}`
      : tone === "advocacy"
      ? `What I took from this experience is that real engagement — sustained, honest, and willing to be wrong — changes you in ways that observation from the outside does not. I came into this encounter thinking I understood ${topicLow}; I came out knowing how much I had not seen, and more importantly, knowing that I could work through that gap rather than retreat from it. ${hasNotes ? `${cap(kw(kws, 0))} turned out to be the variable I had most underestimated.` : "The willingness to be wrong turned out to be a precondition for getting things right — a counterintuitive lesson I have had to relearn more than once."}`
      : `Reflecting on these moments, what I notice is that what shifted was not just my understanding of ${topicLow} but my relationship to uncertainty itself. I became more comfortable holding a question open while I worked through it, rather than forcing a resolution before I had earned one. ${hasNotes ? `The way ${kw(kws, 0)} and ${kw(kws, 1)} intersected — something I had not initially perceived — became the most productive part of the inquiry.` : "That comfort with uncertainty, built slowly and sometimes uncomfortably, is the most durable thing I gained from this experience."}`;

  const takeaway =
    tone === "academic"
      ? `The experience of engaging seriously with ${topicLow} has prepared me, in ways I am still discovering, for the kind of sustained intellectual work I intend to pursue at university. I am bringing to college not certainty but a demonstrated capacity to stay in difficult problems long enough to understand them — and a conviction that the most important questions rarely have easy answers.`
      : tone === "advocacy"
      ? `I am applying to college because I want to do more with what this experience taught me, not less. The challenge of ${topicLow} showed me that I can stay in a hard problem long enough to make genuine progress. I want to build on that — with better analytical tools, more rigorous frameworks, and a wider sense of what is achievable.`
      : `The question of ${topicLow} is one I expect to keep working on. What college offers is the chance to do that work with more resources, more intellectual rigor, and more people who take the same questions seriously. That is not an abstract aspiration. It is exactly what I am looking for.`;

  return { type: "essay", hook, coreStory, moments, reflection, takeaway };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function generateBrief(
  prompt: string,
  sourceNotes: string,
  briefType: BriefType,
  tone: Tone
): GeneratedBrief {
  const cleanPrompt = prompt.trim();
  const cleanNotes = sourceNotes.trim();
  const topic = extractTopic(cleanPrompt);
  const kws = extractKeywords(cleanNotes, cleanPrompt);

  const toneLabel = { neutral: "Neutral Analytic", advocacy: "Advocacy", academic: "Academic Formal" }[tone];

  let sections: BriefSections;
  let plainText: string;

  if (briefType === "debate") {
    const d = buildDebate(topic, kws, tone);
    sections = d;
    plainText = [
      "DEBATE CASE",
      `Motion: ${cleanPrompt}`,
      `Tone: ${toneLabel}`,
      "",
      "THESIS",
      d.thesis,
      "",
      ...d.contentions.flatMap((c, i) => [
        `CONTENTION ${i + 1} — ${c.title.toUpperCase()}`,
        c.body,
        "",
      ]),
      "COUNTERARGUMENTS & RESPONSES",
      ...d.counterarguments.flatMap((ca, i) => [
        `CA ${i + 1}: ${ca.counter}`,
        `Response: ${ca.response}`,
        "",
      ]),
      "CONCLUSION",
      d.conclusion,
    ].join("\n");
  } else if (briefType === "policy") {
    const p = buildPolicy(topic, kws, tone, cleanNotes);
    sections = p;
    plainText = [
      "POLICY MEMO",
      `Subject: ${cleanPrompt}`,
      `Tone: ${toneLabel}`,
      "",
      "EXECUTIVE SUMMARY",
      p.executiveSummary,
      "",
      "BACKGROUND",
      p.background,
      "",
      "PROBLEM STATEMENT",
      p.problem,
      "",
      "POLICY OPTIONS",
      ...p.options.flatMap((o) => [`${o.label}`, o.description, ""]),
      "RECOMMENDATION",
      p.recommendation,
      "",
      "NEXT STEPS",
      p.nextSteps,
    ].join("\n");
  } else {
    const e = buildEssay(topic, kws, tone, cleanNotes);
    sections = e;
    plainText = [
      "COLLEGE ESSAY OUTLINE",
      `Prompt: ${cleanPrompt}`,
      `Tone: ${toneLabel}`,
      "",
      "HOOK",
      e.hook,
      "",
      "CORE STORY",
      e.coreStory,
      "",
      "THREE MOMENTS",
      ...e.moments.map((m) => `• ${m}`),
      "",
      "REFLECTION",
      e.reflection,
      "",
      "TAKEAWAY",
      e.takeaway,
    ].join("\n");
  }

  return { sections, plainText };
}
