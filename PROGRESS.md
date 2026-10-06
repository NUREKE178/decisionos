# DecisionOS — production migration progress

Phased migration from the client-only demo prototype to a real Supabase-backed
SaaS. Updated at the end of each phase.

## Phase 0 — repo scaffold ✅

- New dedicated repo (separate from the personal portfolio site the
  prototype lived under).
- Ported over everything framework/design-reusable as-is: `components/`
  (ui, shell, charts, icons), `lib/stats.js` (analytics engine), `lib/
  randomization.js` (counterbalancing), `lib/format.js`, `lib/
  questionTypes.js`, all vendored CDN-free dependencies.
- Vendored `@supabase/supabase-js` (UMD build) alongside the existing
  vendored Preact/htm/Chart.js, so the frontend still has zero runtime CDN
  dependency.

## Phase 1 — DB schema, RLS, Auth, Organizations ✅ (code-complete, not yet deployed)

**What's real now:**
- Full Postgres schema: `profiles`, `organizations`, `organization_members`,
  `experiments`, `experiment_variants`, `experiment_questions`,
  `experiment_question_options`, `participant_sessions`, `responses`,
  `response_events`, `ai_insights`, `reports`. FKs, indexes,
  `updated_at` triggers. (`supabase/migrations/0001_init.sql`)
- RLS on every table: org members read, owner/admin/researcher write,
  viewer read-only. (`supabase/migrations/0002_rls.sql`)
- Anonymous participants have **zero** direct table/view access anywhere —
  all public reads/writes go through Edge Functions using the service role
  (`supabase/migrations/0003_public_access.sql`, `supabase/functions/`).
- Supabase Auth wired for real: Register, Login, Logout, Forgot password,
  Reset password (`src/pages/auth/*.js`, `src/lib/auth.js`). No custom/fake
  auth.
- Organization model: create org, see your orgs, member roles (owner /
  admin / researcher / viewer), first-member-seats-as-owner handled
  correctly in RLS (`src/lib/org.js`).
- `/app/*` is now a real protected route: no session → `/login`; session
  but no org → `/onboarding`.
- Edge Functions written and type-checked (not yet deployed — needs a live
  project): `start-session` (slug lookup, server-side counterbalanced
  randomization, session creation), `submit-response` (token-validated,
  idempotent on retry/duplicate), `complete-session`, `generate-insights`
  (stub — see Phase 5).

**Verified, not just written:** all three migrations were applied against a
real local PostgreSQL 16 (with a minimal stand-in for Supabase's `auth`
schema/roles) and exercised with a functional test simulating two separate
organizations. Caught and fixed two real bugs this way before they could
ever reach a live project:
1. A chicken-and-egg bug where an org's creator couldn't seat themselves as
   its first `owner` member (the policy's own subquery was itself blocked
   by `organizations`' RLS). Fixed with a `SECURITY DEFINER` helper.
2. A cross-tenant data leak: a SELECT policy meant only for `anon` had no
   `to anon` clause, so Postgres OR-combined it with every authenticated
   user's policy on the same table — any signed-in researcher could read
   every other organization's *published* experiments. Fixed by scoping it,
   then redesigned to give anon no direct table access at all (safer than
   trying to get a scoped policy exactly right).

**Still running on the old local demo store (unchanged, not yet migrated):**
Overview, Experiments, Results, Insights, Participants, Reports, Team,
Settings all still read/write `localStorage` via the original `lib/
store.js` + `lib/demoData.js` — exactly as in the prototype. That's Phases
2–4. Logging in now gets you to the *same* demo dashboard as before, just
behind real auth.

**Deferred, documented, not forgotten:**
- Inviting a teammate who doesn't have an account yet (needs
  `supabase.auth.admin.inviteUserByEmail`, which requires a dedicated Edge
  Function — noted in `src/lib/org.js`).
- AI insights are not connected to a real model yet (explicit decision —
  see Phase 5). The Edge Function is written, checks org membership,
  builds nothing fabricated, and returns `status: "not_configured"` until
  `AI_API_KEY` is set as an Edge Function secret.

**Blocking the next step:** a live Supabase project. Nothing above has been
`db push`-ed or `functions deploy`-ed anywhere — it's validated against a
local Postgres stand-in, not a real project, until `SUPABASE_URL` /
`SUPABASE_ANON_KEY` / `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` exist
(see `.env.example` and this session's environment variables).

## Phase 2 — Real experiment CRUD + builder wired to DB — not started

## Phase 3 — Public participant flow + real response collection — not started
(Edge Functions for this are written per Phase 1, just not yet wired to the
`ParticipantRunner` frontend component or deployed.)

## Phase 4 — Real analytics from DB, demo data removed from production path — not started

## Phase 5 — AI insights via Edge Function — stubbed only, deferred by request

## Phase 6 — i18n (RU default, KZ/EN) — not started

## Phase 7 — Error/loading states, responsive QA, security audit, final checklist — not started
