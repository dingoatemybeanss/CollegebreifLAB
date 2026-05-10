# College Brief Lab

A web app that helps students generate structured debate cases, policy memos, and college essay outlines using AI (Gemini). Sign in with Google, build a brief, and save it to your account.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 → 8080 in practice)
- `pnpm --filter @workspace/college-brief-lab run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` — Gemini AI via Replit integrations

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind CSS v4, shadcn/ui, framer-motion, wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: Google Gemini via `@workspace/integrations-gemini-ai`
- Auth: Firebase Auth (client-side Google Sign-In)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — generated TanStack Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `lib/db/src/schema/briefs.ts` — Briefs table schema
- `artifacts/api-server/src/routes/briefs.ts` — brief CRUD + AI generation routes
- `artifacts/college-brief-lab/src/` — React frontend
- `artifacts/college-brief-lab/src/lib/firebase.ts` — Firebase config
- `artifacts/college-brief-lab/src/contexts/AuthContext.tsx` — Firebase auth context
- `artifacts/college-brief-lab/src/pages/` — Dashboard, Builder, History pages

## Architecture decisions

- Firebase Auth is client-side only — the Firebase UID is passed as a query param to the backend, no session/JWT on the server
- Gemini is used for AI generation via the Replit-managed integrations proxy (not raw OpenAI)
- Briefs are stored in PostgreSQL keyed by `firebaseUid` string
- The API type enums use verbose names ("Debate Case", "Policy Memo", "College Essay Outline") matching the OpenAPI spec; the frontend maps from short internal names ("debate"/"policy"/"essay")
- `@google/genai` must be a direct dependency of `api-server` since esbuild externalizes `@google/*`

## Product

Three brief types: Debate Case, Policy Memo, College Essay Outline. Each generates structured sections with headings and bullet points, plus a quality score (logic/evidence/clarity/originality). Users can save briefs to their account, view history, and export to text.

## User preferences

- Use Gemini (NOT OpenAI) for AI — OpenAI costs money
- Firebase config is for project `college-breif` (note the misspelling — that's the actual project ID)

## Gotchas

- `@google/genai` must be in `artifacts/api-server/package.json` as a direct dep (not just in the gemini-ai lib)
- The `limit` param is NOT in `ListBriefsParams` (the OpenAPI spec doesn't define it) — filter client-side
- `useListBriefs` returns `Brief[]` directly, not `{ briefs: Brief[] }`
- `BriefStats.recentCount` (not `thisWeek`) tracks the last 7 days

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
