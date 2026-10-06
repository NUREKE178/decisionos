# DecisionOS — production migration progress

## Phase 0 — repo scaffold ✅

## Phase 1 — DB schema, RLS, Auth, Organizations ✅ DEPLOYED

Schema + RLS pushed to the real project (`kjqqqovjapmktpdvfbyv`); all 4
Edge Functions (`start-session`, `submit-response`, `complete-session`,
`generate-insights`) deployed and `ACTIVE`. Real Supabase Auth
(register/login/logout/forgot/reset password). Organization model with
owner/admin/researcher/viewer roles. `/app/*` is a real protected route.

A real bug was found and fixed here, the hard way: `INSERT ... RETURNING`
(what `supabase-js`'s `.insert().select()` always sends) is filtered by a
table's SELECT policies, not just the INSERT policy's `WITH CHECK`. A
brand-new org's creator isn't a member of it yet at the moment of insert,
so the original "members can read" policy hid the row Postgres had just
correctly inserted, and reported that identically to an actual rejection.
Fixed in migration `0004` (a narrow "creator can read their own new org"
policy, plus folding org-create + owner-seating into one atomic
`create_organization_with_owner()` function). Verified with `SET LOCAL`
per simulated request (not a mid-session GUC flip, which had produced a
false pass earlier) against real PostgreSQL 16.

## Phase 2 — Real experiment CRUD + builder wired to DB ✅ (migrations 0005 not yet pushed to the live project — see below)

- `lib/experiments.js`: DB ⇄ JS shape mapping, draft save (full
  replace-sync of variants/questions/options while a draft), publish
  (generates a public slug), duplicate, delete (+ storage cleanup).
- `lib/storage.js` + migration `0005_storage.sql`: real file upload to a
  `variant-assets` Storage bucket, type/size validated client-side, RLS
  scoped by `<org_id>/<experiment_id>/...` path. Verified locally: an org
  member uploads into their own folder fine; a different org's member and
  `anon` are both blocked, even with a syntactically valid org-shaped
  path.
- `ExperimentBuilder.js` persists every step to Supabase (real UUIDs via
  `crypto.randomUUID()`, no more fake `exp_...` ids). `ExperimentsList.js`
  publishes / duplicates / deletes for real and copies a real public link
  (`#/research/<slug>`).

## Phase 3 — Public participant flow + real response collection ✅ (needs migration 0005 pushed to go fully live)

- `lib/participantApi.js` calls the three Phase-1 Edge Functions.
  `ParticipantRunner.js` now has two genuinely separate paths:
  - **Preview** (builder step 7, or "preview" from the experiments list) —
    100% local, no network call, nothing persisted. Exactly like before.
  - **Live** (`/research/:slug`) — calls `start-session` (server-assigned
    counterbalanced order), `submit-response` per answer (idempotent on
    retry, with a visible "couldn't send, retry" UI on network failure),
    `complete-session` at the end. Duplicate-run guard via localStorage
    keyed by slug, same rigor as the old demo build.
- `App.js`: `/r/:id` replaced with `/research/:slug`.

## Phase 4 — Real analytics from DB, demo data removed ✅

- `lib/participants.js` fetches real `participant_sessions` + `responses`
  and maps them into the exact shape `lib/stats.js` / `lib/insights.js`
  already expected — so the analytics engine and the AI-insight generator
  needed **zero logic changes** to work against real data.
- Overview, Results, Insights, Reports, Participants, Team, Settings all
  read live Supabase data. `lib/store.js` and `lib/demoData.js` (the
  entire localStorage/synthetic-data layer) are **deleted** — there is no
  code path left in this app that can show fabricated numbers.
- Team: migration `0006_team.sql` adds `profiles.email`, co-member profile
  visibility (scoped to shared org membership, verified non-members can't
  see it), and an `add_member_by_email()` RPC (owner/admin-only, existing
  accounts only).
- Landing page rewritten with the requested Russian copy
  ("Понимайте, почему люди выбирают…"). Most user-facing strings touched
  this pass are now Russian; a real i18n system (RU default, + KZ/EN
  switcher) is still Phase 6, not done piecemeal here.

## ⚠️ Action needed: push migrations 0005 + 0006

Only `0001`–`0004` are applied to the live project so far. From your
machine, in the repo:

```bash
git pull origin main
npx supabase db push
npx supabase functions list   # sanity check, unchanged this round
```

Until `0005` is pushed, uploading a variant image will fail (no bucket
yet). Until `0006` is pushed, Team will fail to load member names/emails
and "add by email" will error.

## Phase 5 — AI insights via Edge Function — stubbed only, deferred by request

## Phase 6 — i18n (RU default, KZ/EN switcher) — not started
(Most strings are already Russian as a side effect of Phases 2-4, but
there's no language-switching system, no KZ/EN translations, and no
per-user locale persistence yet.)

## Phase 7 — Error/loading states, responsive QA, security audit, final checklist — not started
