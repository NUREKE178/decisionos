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

## Phase 1 — DB schema, RLS, Auth, Organizations ✅ DEPLOYED

**What's real now, live on a real Supabase project
(`kjqqqovjapmktpdvfbyv`):**
- Full Postgres schema + RLS pushed (`supabase db push`): `profiles`,
  `organizations`, `organization_members`, `experiments`,
  `experiment_variants`, `experiment_questions`,
  `experiment_question_options`, `participant_sessions`, `responses`,
  `response_events`, `ai_insights`, `reports`.
- Anonymous participants have zero direct table/view access anywhere — all
  public reads/writes go through Edge Functions using the service role.
  **Deployed and ACTIVE**: `start-session`, `submit-response`,
  `complete-session`, `generate-insights`.
- Real Supabase Auth: register/login/logout/forgot/reset password.
- Organization model with owner/admin/researcher/viewer roles.
- `/app/*` is a real protected route: no session → `/login`; session but
  no org → `/onboarding`.
- `src/lib/env.js` carries the real `SUPABASE_URL` and publishable
  (anon-equivalent) key — not secrets by Supabase's own design, safe in
  the repo.

**Verified before deployment:** all three migrations were applied against a
real local PostgreSQL 16 first (with a stand-in for Supabase's `auth`
schema/roles) and exercised with a functional two-organization isolation
test, which caught and fixed two real bugs:
1. A chicken-and-egg bug where an org's creator couldn't seat themselves as
   its first `owner` member.
2. A cross-tenant data leak from a SELECT policy missing a `to anon` clause
   (Postgres OR-combines permissive policies across roles). Fixed, then
   redesigned so anon has no direct table access at all.

**Verified after deployment:** `supabase db push` applied all 3 migrations
to the live project with no errors; all 4 Edge Functions deployed and show
`ACTIVE` in `supabase functions list`.

**Still running on the old local demo store (unchanged, not yet migrated):**
Overview, Experiments, Results, Insights, Participants, Reports, Team,
Settings all still read/write `localStorage` via the original `lib/
store.js` + `lib/demoData.js` — that's Phases 2–4. Logging in gets you to
the *same* demo dashboard as before, just behind real auth now.

**Deferred, documented, not forgotten:**
- Inviting a teammate without an existing account (needs
  `supabase.auth.admin.inviteUserByEmail` from a dedicated Edge Function).
- AI insights: Edge Function deployed, checks org membership, returns
  `status: "not_configured"` until `AI_API_KEY` is set as an Edge Function
  secret (explicit decision, not an oversight).

## Phase 2 — Real experiment CRUD + builder wired to DB — not started

## Phase 3 — Public participant flow + real response collection — not started
(Edge Functions for this are deployed per Phase 1, just not yet wired into
the `ParticipantRunner` frontend component.)

## Phase 4 — Real analytics from DB, demo data removed from production path — not started

## Phase 5 — AI insights via Edge Function — stubbed only, deferred by request

## Phase 6 — i18n (RU default, KZ/EN) — not started

## Phase 7 — Error/loading states, responsive QA, security audit, final checklist — not started
