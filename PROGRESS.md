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

**Update — rollout now complete** for every researcher-facing page: Reports
(including the downloadable .md report text and date formatting per
locale), Team, Settings, Participants, Billing, Profile (all 5 tabs, incl.
its own language picker now writing through the same global `setLocale()`
instead of a disconnected local copy), PublicProfile, `lib/insights.js`
(every AI-insight sentence template -- was the one place still silently
hardcoded Russian even though `Insights.js`/`Reports.js` were already
passing it a `locale` argument), and `ParticipantRunner.js`. The last one
follows the **experiment's own configured language** (`experiments.language`,
default `ru`) rather than the researcher's own account locale, per the
architecture doc's §5 rationale -- participants are a different, often
differently-languaged, audience. Added the missing `language` field to
`lib/experiments.js`'s row mapper so the builder-preview path carries it
too (the live `/research/:slug` path already got it from `start-session`).

`ExperimentBuilder.js` is the one remaining page still hardcoded Russian --
left alone deliberately, since the UX architecture doc's §6 replaces its
Step 4 entirely; translating strings that are about to be deleted would be
wasted work. Everything else in the app now genuinely switches, in every
language, everywhere, as asked.

Verified with a full Playwright pass: every route's module graph loads
clean (catches any broken import across the whole app, since this is
native ESM with no bundler -- a single broken export anywhere fails every
page), a mocked-auth pass through every reworked page including all 5
Profile tabs, and -- the real test -- actually switching to KZ mid-session
and re-checking Overview/Team/Reports/Profile: sidebar, stats, charts,
empty states, the downloadable report, and the AI-insight disclaimer text
all rendered correctly in Kazakh, with live data flowing through
`lib/insights.js`'s real sentence generation, not just static labels.

## Next: full UX/IA redesign requested (superseded in part -- see below)

A large follow-up brief had come in: rethink navigation/IA around
Create → Collect → Understand → Decide, an adaptive (new/active/completed)
dashboard state, a guided multi-step research-creation flow, a
dimension-based (not form-based) comparison question builder, a
three-questions-in-10-seconds Results redesign, structured AI insight
cards with an evidence drill-down, a real participant marketplace account
view, and a mobile-first pass throughout. Its own §12 "Visual language"
explicitly said to *keep* the existing flat dark-surface/indigo-accent
system -- superseded by the skeuomorphic brief below, visual language only;
the IA/structural content (sitemap, dashboard states, creation flow,
comparison builder, Results reorder, profile tabs) still stands as the plan.

## FULL SKEUOMORPHIC REDESIGN + COMPLETE BUG FIX + PRODUCTION STABILITY

New brief: (1) find and fix every loading/runtime/data stability bug,
(2) only then redesign the entire visual language into full skeuomorphism
(dimensional surfaces, bevels, inset controls, tactile press states -- a
"physical research instrument", not flat cards or glassmorphism), in that
explicit order. This update covers stage (1), done first exactly as
instructed ("Do NOT guess. Inspect the actual implementation" before any
visual change). Stage (2) is tracked separately below, not started yet.

### Stability audit -- method

Grepped the whole `src/` tree for every `.then(` not immediately followed
by a `.catch(` on the same chain (the strongest available signal for "this
can get stuck in loading forever if the request fails"), then individually
read and classified each hit -- a line-based grep produces false positives
whenever a `.catch()` exists further down the same chain, so every hit was
confirmed by hand, not assumed. 11 hits total: 2 already safe (`Onboarding.js`'s
org-check, `ParticipantRunner.js`'s `startSession` call both already had a
`.catch()` a line or two down), 9 were real.

### Bug map (all 9 fixed)

| # | Root cause | Affected route / component | Fix |
|---|---|---|---|
| 1 | `lib/auth.js`: `supabase.auth.getSession()` had no `.catch()` -- a rejection left `initialized` false forever, hanging `useSession().loading` (and therefore every `/app/*` route + `/profile`) indefinitely, with zero recovery path. Highest-severity: this gated the entire authenticated app. | All of `/app/*`, `/profile` | Added `.catch()`: fail closed to signed-out (`currentSession=null; initialized=true`) instead of hanging. Also wrapped the call in a 10s `withTimeout` -- this exact "GoTrueClient session-restore hangs" failure mode was directly observed earlier in this session's own test harness. |
| 2 | `ExperimentBuilder.js`'s edit-mode fetch had no `.catch()` (stuck "Загрузка…" forever on a real error) **and** silently kept the blank new-experiment draft on a resolved-but-`null` result (a nonexistent/inaccessible id renders an empty "create new experiment" form under what looks like a real edit URL -- exactly the "fake success" the brief forbids). | `/app/experiments/:id/edit` | Added a `loadError` state distinguishing `"not_found"` from a thrown error, each with its own `EmptyState` (not-found → back to list; error → Retry, re-runs the fetch). 15s timeout. |
| 3 | `Profile.js`'s `SessionsTab` stats fetch had no `.catch()` -- the two stat rows stayed at `"…"` forever on error, indistinguishable from "still loading". | `/profile` → Sessions tab | Added `statsError` state + inline retry banner; rows show `"—"` instead of an eternal `"…"`. |
| 4 | `Results.js` / `Reports.js` / `Insights.js`: identical `fetchSessionsForExperiment(...).then(...)` with no `.catch()`. Insights/Reports: the whole page/card hung on "Загрузка ответов…" forever. Results: worse -- the page doesn't gate render on this fetch at all, so a real fetch error rendered a full results page with silently-zeroed stats, indistinguishable from "0 participants so far" (a fake-success case, not just a hang). | `/app/experiments/:id/results`, `/app/reports`, `/app/experiments/:id/insights` (+ their org-wide variants) | Added a `participantsError` state + `.catch()` to all three, each with a distinct, visible error banner/EmptyState and a Retry button that re-runs the fetch. 15s timeout each. |
| 5 | `ParticipantRunner.js`'s dashboard-preview path (`/app/experiments/:id/preview`): same double bug as #2 -- no `.catch()`, and a resolved-`null` silently left the UI on its "loading" text forever (looking identical to a real hang, not a distinct not-found state). | `/app/experiments/:id/preview` | Same `loadError` (`"not_found"` vs. error) pattern as #2, with a "back to experiments" action. 15s timeout. Also timeout-wrapped the live public flow's `startSession`/`submitResponse`/`completeSession` calls (already had `.catch()`/try-catch, but none had a ceiling against a connection that never settles at all -- the highest-stakes path, real participants, real research data). |
| 6 | `App.js`'s `ProtectedApp`: the org-fetch `.catch()` already existed, but **mis-categorized a real fetch error as "this user has zero organizations"**, silently redirecting them into the onboarding/create-org flow -- a legitimate existing org member could be shown "create a workspace" because of a transient network blip. | Every `/app/*` route, first load after sign-in | Added a distinct `orgError` state checked *before* the zero-orgs redirect, with its own error card + Retry (re-runs the fetch) instead of redirecting. 15s timeout. |
| 7 | `PublicProfile.js`: already had a `.catch()` and tracked `error` in state, but the render never used it -- a real fetch error and a genuine "this username doesn't exist" collapsed into the exact same message. | `/u/:username` | Added a distinct error branch (different title/body + Retry) ahead of the not-found branch. 15s timeout. |
| 8 | `auth/Onboarding.js`'s org-check: already safe (had a `.catch()`), but shared the same "could hang forever if the promise never settles at all" exposure as everything else, on a path every brand-new signup hits. | `/onboarding` | Added the 15s timeout wrapper (no behavior change otherwise). |
| 9 | No request in the app had any timeout at all -- a dropped connection that never resolves *or* rejects would hang a loading state forever even with a correct `.catch()`, since nothing ever calls it. | All of the above | New `src/lib/async.js`: `withTimeout(promise, ms, message)` races a promise against a timeout (default 15s; 10s for the app-gating `getSession` call). Doesn't abort the underlying request (no abstraction threads an `AbortSignal` through the data layer today, and building one was out of scope for this pass), but guarantees the UI always reaches an error state. Applied to all 9 fixes above. One regression caught and fixed while wiring this up: `ParticipantRunner.js`'s answer-submit error path did `err.message \|\| networkError`, which would have shown the raw English `"Request timed out"` debug string in the RU/KZ UI -- fixed to special-case `TimeoutError` into the localized network-error message instead. |

Scope note: timeouts were added to every fetch that gates a loading state on
page load/route change (the "blank/stuck page" class of bug the brief is
about), plus the live participant flow's three Edge Function calls
(highest real-world stakes). Button-triggered save/update actions elsewhere
(Settings, Team, Billing, Profile's save handlers, publish/persist in the
builder) already fail safely into a toast + re-enabled button via existing
try/catch/finally -- they weren't additionally time-boxed in this pass.

### Verification

Not just re-read -- reproduced. A Playwright harness (mocked Supabase
responses, real browser) drove each of the 9 fixes through its actual
failure path: forced a 500 on the exact table/RPC each bug depends on,
confirmed the new distinct error UI renders (not a hang, not silently
mistaken for empty/not-found), clicked the real Retry button, and confirmed
it re-fetches and recovers into real content. 15/15 scripted checks passed,
zero unexpected console/page errors. (One real methodology trap hit and
fixed along the way: Supabase's `detectSessionInUrl` races this app's own
hash router on a *fresh* navigation straight to a `#/...` URL, which can
hang client-side with zero network requests ever firing -- a known
pre-existing sandbox quirk, not an app bug; worked around with the
established two-step navigation pattern, same as earlier in this session.)
Re-ran the existing full-i18n and mobile-overflow regression smoke tests
against the current code afterward -- both still pass clean, confirming
nothing in this pass regressed the earlier i18n/mobile fixes.

## RELEASE BLOCKER fixed: direct URL / hard-refresh hung on "Загрузка..." forever

Real-world report: opening `https://decisionos-self.vercel.app/#/app/overview`
directly (hard refresh, fresh tab, incognito) often left the whole app stuck
on "Загрузка..." forever -- never an error, never content. This was
initially suspected to be a Supabase `detectSessionInUrl` vs. hash-router
conflict (a real, separate quirk also present in this project's Playwright
test harness -- worked around there with a two-step navigation), but
instrumented tracing proved the actual production root cause is different
and more fundamental:

**Root cause**: every module-level reactive store in this app (`useSession`,
`useRoute`, `useLocale`, `useExperiments`, `useCurrentOrg`, `useMyProfile`,
`useOrgSessions` -- 7 in total) subscribes to change notifications inside a
`useEffect`, which Preact (like React) defers until *after* the first paint.
`lib/auth.js`'s `getSession()` / `onAuthStateChange("INITIAL_SESSION")`
need only a few microtasks (a `localStorage` read, no network) and -- on a
cold boot through this app's large single-bundle static-import module graph
-- reliably *resolve before* `useSession()`'s effect has committed. Its
`notify()` fires into an **empty listener set** (nothing has subscribed
yet) and is silently lost forever; no later event ever fires again to
trigger the catch-up render. The component is left showing its first,
stale `loading: true` render permanently, even though the module-level
auth state resolved correctly in the background within milliseconds.
Confirmed by direct instrumented tracing (not guessed): `getSession()`
resolved in ~20ms every time, while `ProtectedApp` rendered exactly once
and never again, for the entire observed window.

This is a textbook "external store missed between render and effect commit"
race (the reason React later shipped `useSyncExternalStore`) -- and with
no code-splitting, every route hits the same module graph, so it isn't
unique to `/app/overview`; direct URL load for `/app/experiments`,
`/app/participants`, results/insights/reports, `/profile`, and
`/app/settings` all shared the identical exposure.

**Fix**: every one of the 7 stores now calls its own listener once,
immediately after subscribing (`listeners.add(listener); listener();`),
to re-sync against whatever the store's live state already is by the time
the effect commits -- cheap, idempotent, and the standard correct fix for
this pattern. `lib/auth.js` was the only one that could actually lose a
notification today (its write path runs at module-eval time, independent
of any component); the other six write from inside an effect gated behind
the same subscription, so they were latent rather than proven-exploitable,
but get the identical defensive fix for the same reason the brief asked
for a full audit, not a single patch.

**Verified by reproduction**: a fresh-context-per-route Playwright suite
(no shared state between loads, matching "hard refresh" / "fresh tab"
exactly) direct-loads `/app/overview`, `/app/experiments`,
`/app/participants`, `/app/experiments/:id/results`, `.../insights`,
`/app/reports`, `/profile`, `/app/settings`, plus a signed-out cold boot --
all 9 resolve to real content (or the login page) in under 450ms, zero
console errors. Before the fix, the exact same single-step direct
navigation hung for 24+ seconds straight with zero network requests ever
firing (confirmed instrumented, not inferred). Re-ran the full 15-check
stability-fix suite afterward too -- still 15/15, no regressions from
touching these shared hooks.

## Skeuomorphic visual redesign -- shipped across the whole app

The brief was explicit that this had to be a *visible* change now, not a
future phase, and that it had to look like "a physical research
instrument" -- dimensional surfaces, bevels, inset/raised controls -- not
1990s skeuomorphism, not neon/gaming/crypto, not just recolored flat cards.

**System** (`styles.css`, pure CSS, no raster textures, no rebuild step):
a set of `.sk-*` classes layered on the *existing* slate neutrals + indigo
accent (not a new palette) -- `sk-panel`/`sk-panel-flat` (raised, gradient
+ bevel + outer shadow), `sk-display`/`sk-display-deep` (recessed/inset,
for stat numbers, chart frames, upload slots), `sk-btn`/`sk-btn-primary`
(tactile, real `:active` press-down state), `sk-input`, `sk-tabs`/`sk-tab`,
`sk-switch-track`/`sk-switch-knob`, `sk-sidebar`/`sk-topbar`/`sk-nav-item`
(pressed/recessed active state), `sk-badge`, `sk-modal`, `sk-checkbox`,
`sk-slot`/`sk-slot-label` (the A/B/C/D "physical specimen slot" -- selected
state glows, used for variant cards, research-type picker, and every
A/B/C/D control in the participant flow).

**Applied to**: `components/ui.js` (every shared primitive --
Card/Button/Badge/StatTile/ProgressBar/EmptyState/Modal/Tabs/TextInput/
TextArea/Select/Checkbox/Switch/ToastHost) and `components/charts.js`
(every chart now sits in a recessed display frame) first, since nearly
every page composes from these and it cascades everywhere for free; then
`components/shell.js` (sidebar as a physical control panel, topbar as an
instrument strip, language switcher as a tactile segmented control);
then per-page bespoke surfaces that don't go through the shared
components: Landing, AuthLayout (Login/Register/Forgot/Reset all inherit
it), `ExperimentBuilder.js` (step tracker, research-type picker, A/B/C/D
variant upload slots, question cards, publish checklist -- all 7 steps),
`ParticipantRunner.js` (stimulus cards, progress track, timer ring,
yes/no + rating controls, consent/demographics/done icons -- kept
deliberately simpler/flatter than the researcher side per the brief's own
"distraction-free, mobile-first" instruction for participants), Profile,
PublicProfile, Reports, Results, Overview. Swept the rest of the app
(Team, Settings, Billing, ExperimentsList, Participants, Insights,
Login/Register/Onboarding) for any remaining bespoke flat surface after
the shared-component pass -- all were already clean, confirming they're
built entirely from the now-updated shared primitives.

**Left alone on purpose**: semantic alert/disclaimer banners (error, "small
sample", research disclaimers) keep a flat colored-tint treatment --
instrument "warning lights" read better as flat strips than bevelled
panels, and it keeps real errors visually distinct from structural chrome.

**Not done this pass**: the Question Builder's Step 4 is reskinned (new
question-card surface, tactile type/role selects) but still its original
generic-form-builder structure -- the brief's "three-panel, dimension-based
(pick what to measure, A/B/C/D auto-built)" rebuild is a data-model-facing
feature change, not a skin, and `UX_ARCHITECTURE.md` §6 already has that
design worked out (confirmed zero-migration, maps to the existing `role`
column) for whoever picks this up next.

**Verified**: not just screenshots. Rebuilt `vendor/tailwind.css` after
every markup pass. Re-ran the full 15-check stability suite, the 9-check
direct-URL suite, and the i18n regression suite after the *entire* redesign
-- all still pass, zero console errors, confirming the visual pass didn't
regress any of the stability work. Screenshotted desktop (Overview, Login,
builder steps 2/3, Results) and mobile 390px width (Overview, Profile,
builder) -- no horizontal overflow anywhere, language switcher still
visible on mobile (the earlier mobile fix holds).
