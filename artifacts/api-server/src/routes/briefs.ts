import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, like, desc } from "drizzle-orm";
import { db, briefsTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  GenerateBriefBody,
  ListBriefsQueryParams,
  CreateBriefBody,
  GetBriefParams,
  UpdateBriefParams,
  UpdateBriefBody,
  DeleteBriefParams,
  GetBriefStatsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function buildSystemPrompt(briefType: string, tone: string): string {
  const toneDesc =
    tone === "Advocacy"
      ? "persuasive and one-sided, building the strongest possible case"
      : tone === "Academic Formal"
        ? "scholarly, measured, and evidence-driven"
        : "balanced, clear, and analytically rigorous";

  if (briefType === "Debate Case") {
    return `You are an expert competitive debate coach and legal researcher. Generate structured debate briefs with the following sections:
- Resolution Analysis (define key terms, scope, burden of proof)
- Contentions (2-3 main arguments, each with: claim, warrant, evidence/example, impact)
- Rebuttal Anticipation (2-3 likely counterarguments and responses)
- Summary & Voting Issues

Each section should have 3-5 bullet points. Tone: ${toneDesc}.

IMPORTANT: Return ONLY valid JSON. No markdown code blocks. No extra text.
Format: {"quality":"good","sections":[{"heading":"...","bullets":["..."]}],"score":{"logic":85,"evidence":80,"clarity":90,"originality":75},"summary":"One-sentence brief summary"}`;
  }

  if (briefType === "Policy Memo") {
    return `You are a senior policy analyst. Generate a structured policy memo with:
- Executive Summary (problem statement, recommendation)
- Background & Context (history, stakeholders, current state)
- Policy Options (2-3 options with pros/cons)
- Recommendation & Rationale (preferred option with justification)
- Implementation Considerations (timeline, risks, metrics)

Each section should have 3-5 bullet points. Tone: ${toneDesc}.

IMPORTANT: Return ONLY valid JSON. No markdown code blocks. No extra text.
Format: {"quality":"good","sections":[{"heading":"...","bullets":["..."]}],"score":{"logic":85,"evidence":80,"clarity":90,"originality":75},"summary":"One-sentence memo summary"}`;
  }

  // College Essay Outline
  return `You are an experienced college admissions counselor and writing coach. Generate a structured college essay outline with:
- Hook & Opening (3 compelling opening approaches)
- Context & Background (personal context that grounds the essay)
- Thesis / Central Claim (the core insight or argument)
- Body Move 1 (first key narrative point or argument with evidence)
- Body Move 2 (second key narrative point or argument with evidence)
- Body Move 3 (third key narrative point or argument, if applicable)
- Reflection & So What (deeper meaning, what you learned, why it matters)
- Closing (memorable final note that circles back to the opening)

Each section should have 3-5 bullet points. Tone: ${toneDesc}.

IMPORTANT: Return ONLY valid JSON. No markdown code blocks. No extra text.
Format: {"quality":"good","sections":[{"heading":"...","bullets":["..."]}],"score":{"logic":85,"evidence":80,"clarity":90,"originality":75},"summary":"One-sentence outline summary"}`;
}

function buildPolishPrompt(existingText: string, briefType: string, tone: string): string {
  return `You are an expert ${briefType === "Debate Case" ? "debate coach" : briefType === "Policy Memo" ? "policy analyst" : "college admissions counselor"}.

Polish and improve the following brief. Make the arguments sharper, evidence more specific, and language more compelling.

Existing brief:
${existingText}

Return the improved version in the SAME JSON format. ONLY valid JSON, no markdown.
Format: {"quality":"good","sections":[{"heading":"...","bullets":["..."]}],"score":{"logic":number,"evidence":number,"clarity":number,"originality":number},"summary":"..."}`;
}

router.post("/generate-brief", async (req: Request, res: Response): Promise<void> => {
  const parsed = GenerateBriefBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, sourceNotes, briefType, tone, mode } = parsed.data;

  let userPrompt: string;
  if (mode === "polish") {
    userPrompt = buildPolishPrompt(prompt, briefType, tone);
  } else {
    userPrompt = `Generate a ${briefType} for the following topic: "${prompt}"`;
    if (sourceNotes && sourceNotes.trim()) {
      userPrompt += `\n\nSource notes to incorporate:\n${sourceNotes}`;
    }
  }

  const systemPrompt = buildSystemPrompt(briefType, tone);

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    req.log.warn({ text }, "Failed to parse Gemini JSON response");
    res.json({
      quality: "filler",
      sections: [],
      message: "Could not parse the AI response. Please try again.",
    });
    return;
  }

  res.json(data);
});

router.get("/briefs", async (req: Request, res: Response): Promise<void> => {
  const parsed = ListBriefsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { firebaseUid, briefType, search } = parsed.data;

  const conditions = [eq(briefsTable.firebaseUid, firebaseUid)];
  if (briefType) conditions.push(eq(briefsTable.briefType, briefType));
  if (search) conditions.push(like(briefsTable.title, `%${search}%`));

  const briefs = await db
    .select()
    .from(briefsTable)
    .where(and(...conditions))
    .orderBy(desc(briefsTable.createdAt));

  res.json(
    briefs.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt?.toISOString(),
    })),
  );
});

router.post("/briefs", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateBriefBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [brief] = await db
    .insert(briefsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json({
    ...brief,
    createdAt: brief.createdAt.toISOString(),
    updatedAt: brief.updatedAt?.toISOString(),
  });
});

router.get("/briefs/stats", async (req: Request, res: Response): Promise<void> => {
  const parsed = GetBriefStatsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { firebaseUid } = parsed.data;

  const briefs = await db
    .select()
    .from(briefsTable)
    .where(eq(briefsTable.firebaseUid, firebaseUid));

  const total = briefs.length;
  const byType: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};

  briefs.forEach((b) => {
    byType[b.briefType] = (byType[b.briefType] || 0) + 1;
    if (b.tags) {
      b.tags.split(",").forEach((t) => {
        const tag = t.trim();
        if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentCount = briefs.filter((b) => b.createdAt > sevenDaysAgo).length;

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  res.json({ total, byType, recentCount, topTags });
});

router.get("/briefs/:id", async (req: Request, res: Response): Promise<void> => {
  const params = GetBriefParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [brief] = await db
    .select()
    .from(briefsTable)
    .where(eq(briefsTable.id, params.data.id));

  if (!brief) {
    res.status(404).json({ error: "Brief not found" });
    return;
  }

  res.json({
    ...brief,
    createdAt: brief.createdAt.toISOString(),
    updatedAt: brief.updatedAt?.toISOString(),
  });
});

router.patch("/briefs/:id", async (req: Request, res: Response): Promise<void> => {
  const params = UpdateBriefParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateBriefBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [brief] = await db
    .update(briefsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(briefsTable.id, params.data.id))
    .returning();

  if (!brief) {
    res.status(404).json({ error: "Brief not found" });
    return;
  }

  res.json({
    ...brief,
    createdAt: brief.createdAt.toISOString(),
    updatedAt: brief.updatedAt?.toISOString(),
  });
});

router.delete("/briefs/:id", async (req: Request, res: Response): Promise<void> => {
  const params = DeleteBriefParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [brief] = await db
    .delete(briefsTable)
    .where(eq(briefsTable.id, params.data.id))
    .returning();

  if (!brief) {
    res.status(404).json({ error: "Brief not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
