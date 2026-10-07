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

## Bugfix — couldn't delete a user from Supabase Auth ✅ (migration 0007, needs push)

Real-world report: deleting a user from Supabase Dashboard → Authentication
→ Users failed with "Database error deleting user". Root cause: `created_by`
on `organizations`, `experiments`, `ai_insights`, `reports` referenced
`auth.users(id)` with the Postgres default `on delete no action`, so any
user who ever created an org/experiment could never be deleted.

Reproduced the exact error locally first (`organizations_created_by_fkey`
violation) against migrations `0001`-`0006` on real PostgreSQL 16, with no
`0007` applied — confirmed this was the real cause, not a guess. Fixed in
migration `0007_created_by_set_null.sql`: these FKs are now `on delete set
null` (an audit/attribution column shouldn't keep a user — or their
teammates' shared org data — hostage; `created_by` just becomes null for
rows made by a deleted account). Re-tested the same scenario end to end
against a fresh local DB with `0007` applied: the delete now succeeds, the
organization and experiment survive with `created_by = null`.

### ⚠️ Action needed: push migration 0007

```bash
git pull origin main
npx supabase db push
```

Until this is pushed, deleting a user who ever created an organization or
experiment will keep failing in the live project the same way it did in
your screenshot.

---

## MAJOR PRODUCT UPGRADE — comparison-first research platform v2

Requested: a full redesign into a premium, 10/10 "Consumer Decision
Intelligence" platform — design system, app shell, full profile/account
system, a comparison-first (A/B/C/D) research builder, redesigned
participant experience, redesigned results + comparison matrix, structured
AI insight cards, participant accounts + reward architecture, full RU/KZ/EN
i18n, and a production QA pass.

### Audit (before writing any code)

- Stack confirmed: Preact + htm, no build step, ES modules via import map;
  Tailwind compiled with the real CLI into `vendor/tailwind.css` (not CDN
  JIT) — **any new class needs `npx tailwindcss -i ./src/tailwind-input.css
  -o ./vendor/tailwind.css --config ./tailwind.config.js --minify` rerun**,
  done after every markup change in this pass.
- Backend: Supabase (Postgres + Auth + Storage + Edge Functions + RLS), no
  custom server — upgrade work stays in that model.
- The 7-step `ExperimentBuilder` (Information → Research type → Stimuli →
  Questions → Participants → Settings → Preview) was already close to the
  requested structure, already variant-aware (A-D), already has real upload
  + real randomization. It's being evolved (Phase 2 of this upgrade, not
  started yet), not rebuilt.
- `shell.js`'s nav was in English in a Russian product, had no user
  dropdown, no workspace section, no profile. `profiles` table existed
  (full_name/avatar_url/locale/email) but had no username, bio, role,
  country, timezone, or public-profile support. No `/profile`, `/u/:username`
  or `/app/billing` routes existed. `lib/format.js`'s relative/short dates
  were hardcoded English ("3d ago") inside an otherwise-Russian app — fixed
  as part of this pass.
- Reward/marketplace/participant-payment sections of the request need a real
  business decision (currency, payment provider, KYC/payout compliance) that
  isn't mine to make — consistent with the request's own "never fabricate
  real monetary balances" rule. Deferred until the user picks a provider;
  everything else in the 10-phase plan proceeds without blocking on it.

### Upgrade Phase 1 — design system + shell + profile ✅ (migration 0008, needs push)

- **Migration `0008_profile_system.sql`**: `profiles` gains `username`
  (unique, format-checked, case-insensitive), `bio`, `role_title`,
  `country`, `timezone`, `research_interests`, `public_profile_enabled`,
  `notify_email_responses`, `notify_email_digest`. A new `avatars` storage
  bucket (public read, write restricted to the owning user's own
  `<user_id>/...` folder — same pattern as `variant-assets` but keyed by
  user). A `get_public_profile(username)` SECURITY DEFINER function returns
  only safe columns, and only for rows that opted in — never a relaxed RLS
  policy on the table that already holds `email`. Tested locally end to end
  against real PostgreSQL 16: username uniqueness (case-insensitive)
  blocked a collision, `get_public_profile` returned Alice's data once she
  opted in and zero rows for Bob (who hadn't), anon still can't read the raw
  `profiles` table, and avatar storage RLS blocked both a cross-user upload
  and an anonymous upload while allowing a user's own. (The avatar storage
  test caught a gap in the local test harness itself — `storage.objects`
  had no RLS enabled, so every policy was silently bypassed; fixed the
  harness, not just worked around it, re-verified after the fix.)
- **`lib/profile.js`** (new): reactive `useMyProfile()` store (same
  listener-set pattern as `useCurrentOrg`), `updateMyProfile`, `uploadAvatar`
  (validates type/size, replaces + cleans up the old file), real
  `fetchMyProfileStats` (experiments created, completed participants — both
  real queries, nothing invented), `fetchPublicProfile` via the RPC.
  `lib/auth.js` gained `requestEmailChange`.
- **Shell redesign** (`components/shell.js`): nav translated to Russian
  (Обзор/Исследования/Участники/Результаты/Инсайты/Отчёты), a "Рабочее
  пространство" section (Команда/Биллинг/Профиль/Настройки), a real user
  menu (avatar, name, org, online dot, dropdown → Профиль/Настройки/Выйти),
  a functional search box (filters `/app/experiments` by name/objective —
  honestly scoped; it doesn't search participants/results yet, and the
  placeholder copy was corrected to stop implying it does), an honest
  notifications dropdown ("Пока нет уведомлений" — no fake notification
  feed), and a language switcher (RU/KZ/EN) that persists to
  `profiles.locale` — full UI translation into KZ/EN is still Phase 8
  (unchanged from the original plan), so this ships the control and the
  persisted preference now rather than pretending the whole app is
  translated.
- **`/profile`** (new): Личная информация (avatar upload, name, username,
  role, country, bio, research interests, public-profile opt-in, email
  change), Безопасность (password change), Уведомления, Предпочтения
  (locale + timezone), Сессии (real account-created date, real experiment
  and completed-participant counts — no fake "last active" tracking, since
  nothing logs that yet).
- **`/u/:username`** (new): opt-in public researcher profile via
  `get_public_profile()` — shows name/role/org/bio/interests, never email or
  private data; renders a clean "not found" state when the username doesn't
  exist or hasn't opted in.
- **`/app/billing`** (new): honest placeholder — states plainly that no
  paid plan or payment processing exists yet rather than showing an
  invented balance.
- **Overview**: personalized "Добро пожаловать, {имя}" header with a real
  secondary CTA ("Открыть последние результаты", only shown when a
  non-draft experiment actually has participant data).
- **`lib/format.js`**: fixed English date strings ("3d ago", "yesterday")
  that were leaking into the Russian UI everywhere `relativeDate`/`shortDate`
  were used (Overview, ExperimentsList, Reports, Results, Participants).

Verified: all touched files pass `node --check`; a Playwright pass over
every unauthenticated-reachable route (landing, login, register, public
profile 404, all `/app/*` and `/profile` auth gates, research-link 404) at
desktop and mobile widths shows zero console/page errors; an authenticated
pass (mocked Supabase session + REST responses, since this sandbox's
network policy blocks the real Supabase project) exercises the shell, all
five profile tabs, the user dropdown, billing and the public-profile view.

### ⚠️ Action needed: push migration 0008

```bash
git pull origin main
npx supabase db push
```

Until this is pushed, `/profile` will fail to load (missing columns) and
avatar upload will fail (no bucket yet).

### Remaining upgrade phases (not started)

2. Comparison-first builder upgrade: richer question library (best/worst
   pair, attribute comparison, 2D matrix, forced choice, recognition),
   question-recommendation engine, duration/burden estimate, mobile-ready
   drag-and-drop variant reordering.
3. Participant experience redesign: distraction-free mobile-first runner
   polish, smart/branching question flow, low-quality-response signal
   (flagged for review, never auto-deleted).
4. Results redesign: "winning variant" summary, full comparison matrix
   (metric × variant), "best for X" callouts grounded in the actual sample.
5. AI insights as structured cards (key finding / evidence / why it matters
   / who it applies to / next test) instead of prose paragraphs — still
   gated on a real AI_API_KEY the user hasn't provided yet.
6. Participant accounts + reward **architecture only** (budget/reserved/
   pending tracking schema) — real payment/withdrawal needs a provider
   decision from the user first; nothing here will show a fabricated
   balance.
7. Full RU/KZ/EN i18n across every string (the language switcher from
   Phase 1 currently only persists a preference).
8. Responsive/accessibility/performance pass, production QA checklist.

## Critical bugfix found during the i18n pass: publishing an experiment has always failed ✅

While wiring real i18n, `lib/experiments.js`'s `publishExperiment()` turned
out to write `status: "active"` -- but the DB enum (`experiment_status` in
migration `0001`) only accepts `draft | published | paused | completed |
archived`. Reproduced directly against real PostgreSQL 16: `update ... set
status = 'active'` throws `invalid input value for enum experiment_status:
"active"`. Every single publish attempt has been failing this whole time;
it only went unnoticed because `toast()` was a no-op (now fixed) so the
error was silently swallowed. Fixed the write (`"published"`) and every
frontend place that compared/filtered on `"active"` (shell active-count,
Overview, ExperimentsList, Results) to match -- the user-facing label
stays "Активные/Active/Белсенді", only the stored/compared value changed.

## i18n (RU default + real KZ/EN) -- infrastructure done, page coverage in progress

`lib/i18n.js`: a reactive locale store (`useT()`/`useLocale()`/`setLocale()`
following the same listener-set pattern as `useCurrentOrg`), backed by three
full dictionaries (`lib/locales/{ru,kk,en}.js`, 536 matching keys each,
parity-checked by script) covering the shell, landing, auth, overview,
experiments list, results, insights (including every AI-insight sentence
template, not just UI chrome), question/research-type vocabulary. Locale
resolution: an explicit choice (`localStorage`) always wins; failing that,
a signed-in user's saved `profiles.locale`; failing that, browser language;
default `ru`. Participant-facing copy is meant to follow the experiment's
own configured language rather than the researcher's -- plumbing (`t(locale,
key, vars)` with an explicit locale) is in place for this but
`ParticipantRunner.js` itself isn't wired yet (see below).

**Already fully switchable between RU/KZ/EN**: shell/nav, Landing, all auth
pages + onboarding, Overview, ExperimentsList, Results, Insights.

**Not yet wired (still hardcoded Russian, unchanged behavior)**: Reports.js,
Team.js, Settings.js, Participants.js, Billing.js, Profile.js,
PublicProfile.js, ExperimentBuilder.js, ParticipantRunner.js. These are
unaffected functionally -- `questionTypes.js`'s and `auth.js`'s helpers now
accept an optional `t` and fall back to translating in the app's current
locale when a caller doesn't pass one yet, specifically so this file-by-file
rollout can't break an un-migrated page. Verified via a full Playwright
pass (every route loads cleanly, zero console/page errors) and a direct
runtime check of every 1-arg fallback call site.

## Next: full UX/IA redesign requested (not started)

A large follow-up brief has come in: rethink navigation/IA around
Create → Collect → Understand → Decide, an adaptive (new/active/completed)
dashboard state, a guided multi-step research-creation flow, a
dimension-based (not form-based) comparison question builder, a
three-questions-in-10-seconds Results redesign, structured AI insight
cards with an evidence drill-down, a real participant marketplace account
view, and a mobile-first pass throughout. Per its own instructions this
needs a UX architecture (sitemap, flows, wireframe structure) produced
*before* any implementation -- that hasn't started yet.
