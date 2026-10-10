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

### Bugfix -- small icon buttons rendered visibly skewed/notched (mobile and desktop) ✅

Real-world report (screenshot): the topbar's menu and notification icon
buttons looked "crooked." Reproduced at 8x device-scale-factor zoom on the
exact button in the real app (not a guess) -- the bottom-left corner had a
visible diagonal notch, all four other corners clean. Root cause: several
`.sk-*` classes gave a button/panel a uniform `border` color and then
overrode just one edge (`border-bottom-color` or `border-top-color`) to
fake a bevel -- Chromium renders the mitered seam between two
differently-colored adjacent border edges as a visible diagonal cut at
their shared rounded corner, invisible on large panels but glaring on a
32px square icon button. Fixed in all 6 affected classes (`sk-panel`,
`sk-panel-flat`, `sk-display`, `sk-btn`, `sk-btn-primary`, `sk-input`) plus
one inline style (`ui.js`'s `DANGER_STYLE`): single uniform border color
on every element, with the light-top/dark-bottom bevel illusion coming
entirely from `box-shadow` insets (which don't have this per-corner
color-mitering problem). Re-screenshotted the same button at the same zoom
afterward -- notch gone, all four corners clean -- then re-ran all three
regression suites (stability/direct-URL/i18n) to confirm the fix didn't
touch anything functional.

### Bugfix -- icon-only buttons rendered off-center (bell/menu icon not centered on its button) ✅

Second, distinct report on the same icon buttons (screenshot): after the
corner-notch fix above, the bell and menu icons themselves sat off-center
inside their button -- a different bug, not a regression of the first fix.
Root cause: the base `.sk-btn` class never declared `display`/alignment at
all, so a raw `<button class="sk-btn">` with no additional centering
classes of its own laid its icon out at the default inline position
instead of centered. Fixed at the base class (`display:inline-flex;
align-items:center; justify-content:center;` on `.sk-btn` itself), which
retroactively centers every call site, including three not-yet-reported
instances it also caught: the modal close button, and the participant
runner's yes/no and rating buttons. Verified via zoomed before/after
screenshots of the exact reported icons.

### Homepage redesign: real A/B/C/D demo, 5-step workflow, example report ✅

Full rebuild of `Landing.js` per the brief: a reader has to understand the
product and see it work within five seconds, with the interactive demo as
the centerpiece, not a feature list.

- **Hero**: new RU headline/subhead (`landing.heroTitle`/`heroSubtitle`),
  secondary CTA scrolls to `#demo` instead of linking out.
- **`<HomepageDemo/>`**: a real, self-contained, local-only A/B/C/D demo --
  4 visually distinct packaging variants (CSS gradients, no stock art),
  built from the same `sk-slot`/`sk-slot-label` components the real
  participant runner uses, so the demo *looks* like the actual product,
  not a mockup of it. Flow: pick a variant → immediate visual selection
  state → second question (perceived trust) → completion state showing
  what a participant would see, with a restart control. Keyboard nav
  (digit keys 1-4 map to `[data-demo-slot]`, guarded against stealing
  focus from a real input/textarea) and verified on a 390px mobile
  viewport with zero horizontal overflow. Clearly labelled as demo data
  throughout (`landing.demo.badge`/`hint`) -- never reads as live research.
- **5-step workflow strip** (`landing.workflow.*`): Upload → Questions →
  Collect → Analyze → Insights, replacing the old generic feature-card
  grid, each step with its own icon and one-line description.
- **`<ExampleReport/>`**: a static, explicitly-labelled
  ("Демонстрационные данные") sample results card -- preferred variant,
  response count, trust/quality/premium/purchase-intention metrics, an
  AI-interpretation block that keeps Observed/Interpretation/Limitation/
  Next-step distinct (never claims to read minds, hedges on sample size),
  and an explicit "the winner depends on your research objective" caveat
  so it can't be read as a universal verdict.
- **i18n**: the entire `landing` namespace was rebuilt in all three locale
  files (`ru`/`kk`/`en`) -- old `badge`/`heroTitlePre`/`steps.s1-s7` keys
  removed, new `heroTitle`/`demo.*`/`workflow.*`/`report.*` keys added.
  Parity re-verified: 603 matching dot-path keys across all three locales.

**Verified**: Playwright run exercising the full demo interaction (click
through both questions, completion state, restart, keyboard selection),
desktop + mobile (390px, zero overflow), zero console/page errors -- 13/13
checks passed. Manually reviewed screenshots of both viewports.

### Question Builder: real named measurement dimensions ✅

The brief called the Question Builder a core feature and asked for named
measurement types beyond generic question forms -- trust, perceived
quality, premium perception, clarity, recall, purchase intention, on top
of the existing selection/preference and attention roles. Implemented as
an *additive* quick-add layer on Step 4, not a replacement of the manual
question editor:

- `lib/questionTypes.js`: `DIMENSION_DEFS` (8 dimensions, each with an id,
  icon, underlying `question_type`, and `role`), `measurementDimensions(t)`
  (resolves current-locale label/blurb/default prompt via the existing
  `resolveT` fallback so callers don't need to import `useT()`), and
  `questionFromDimension(id, uid, t)` (builds a ready-to-insert question
  draft with the right type/role/prompt pre-filled).
- **Zero migration**: `experiment_questions.role` is already
  unconstrained free text and `question_type` already has every type this
  needs (`single_choice`, `rating`, `recall`) -- confirmed by reading the
  actual migration files rather than assuming.
- `ExperimentBuilder.js` Step 4: a new row of dimension chips ("Or pick
  what you want to measure -- the question is added automatically")
  above the existing manual question list. Clicking a chip appends a
  fully-formed question via `addDimension(id)`; chips already represented
  among the draft's questions show a checkmark. The question `role`
  dropdown was also expanded to include the new roles so they remain
  editable by hand.
- `locales/{ru,kk,en}.js`: new `builder.dimensions.*` namespace (intro +
  8 × `{label, blurb, prompt}`), kept in the same 603-key parity as above.

**Verified end-to-end, not just at the UI layer**: built a fully stateful
mocked-Supabase Playwright harness (tracking experiment/variants/
questions/options across POST/PATCH/DELETE/GET, not a generic empty-body
mock) and walked the real wizard -- fill Step 1, pick a research type,
name two variants, click the Trust and Premium dimension chips on Step 4,
and confirmed via the mock's captured insert payloads that both questions
reach the save pipeline correctly formed
(`{type: "single_choice", role: "trust", prompt: "Какой вариант вызывает
у вас больше доверия?"}` and the equivalent for premium) -- then advanced
through Steps 5-7 to the preview step without error. 6/6 checks passed.
Re-ran the full stability (15/15), direct-URL (9/9), i18n (zero errors),
locale-parity (603/603/603), and landing-page (13/13) regression suites
after this round's full diff -- all clean.

**Deferred** (unchanged from the brief's own priority order): objective-
based AI-assisted question suggestions -- the brief requires these to be
honest and reviewable, not fabricated, and there's still no real AI
provider wired in (`AI_API_KEY` not supplied), so this stays a rule-based
follow-up rather than something faked to look like a model output.

### Product-direction clarification: social/community layer

A later brief asked for a full pivot of the homepage to a Threads-style
marketing social network (feed-first, posts/comments/follows), which
directly conflicted with the homepage work above (sent only shortly
before). Flagged the contradiction rather than guessing silently, given
the size and one-way cost of standing up a social-network backend on a
possibly-wrong premise. Resolved: the research platform stays the primary
product (this redesign is it); a social/community layer is scoped as a
new, additive section alongside it, not a replacement -- not started yet.

### Homepage demo: added an intro gate before the first question ✅

Feedback on the live demo: it dropped straight into "Which variant would
you choose?" with no framing the instant the section scrolled into view.
Added a third phase to the demo's state machine (`intro -> q1 -> q2 ->
done`, was `q1 -> q2 -> done`) -- on load it now shows a centered card
(play icon, one-line explanation of what's about to happen, a primary
"Начать демо" button) and only mounts the variant tiles once that's
clicked. Deliberately mirrors the existing `done` state's layout (icon +
title + body + button) so the demo reads as a matched pair of bookends
around the two interactive questions, rather than a bolted-on screen.
`restart()` still returns straight to `q1`, not back through the intro --
a user who already finished the demo once doesn't need the explanation
again. New `landing.demo.intro.{title,body,cta}` keys in all three
locales (606/606/606 parity).

**Verified**: new 10-check Playwright pass (intro shows on load with zero
variant tiles present, Q1/tiles only appear after clicking start, full
q1→q2→done flow still works, restart skips the intro, zero console
errors) plus updated the existing landing-page regression script to click
through the new gate -- 14/14. Re-ran the stability (15/15) and
direct-URL (9/9) suites unchanged. Screenshots reviewed on desktop and
390px mobile.

### Auto-update on deploy: open tabs pick up a new push without a manual hard refresh ✅

Request: when a push ships a new version, users already sitting on the
site shouldn't have to notice and hard-refresh themselves -- the tab
should pick it up on its own, given a reference React hook that polls a
`version.json` and reloads on change.

Adapted rather than copied verbatim, because the premise (a build step
stamps a static `version.json` file) doesn't hold here -- this app has no
JS bundler/build step by design, so nothing exists to stamp that file on
every push, and bolting one on (a CI job that commits a version file back
to the repo) would mean every push triggers two back-to-back Vercel
deploys with a real (if small) window where the code is new but the
version file isn't yet. Used a Vercel zero-config serverless function
instead (`api/version.js`, plain CommonJS, no build step, no `package.json`
needed -- Vercel treats any file under `/api` as a function regardless of
the rest of the project): it reads `VERCEL_GIT_COMMIT_SHA`, which Vercel
itself sets fresh on every single deploy, so the reported version is
always correct by construction with nothing to keep in sync by hand.

- `src/lib/useAutoUpdate.js`: the reference hook ported to this project's
  Preact hooks (`lib/preact.js`) and plain JS (no TypeScript in this
  codebase). Same shape: polls `/api/version` every 2 minutes and on
  window focus, 3s request timeout, skips while a reload is already in
  flight, clears Cache Storage before reloading if any exists. One
  deliberate addition beyond the reference: if a text input or textarea is
  focused at the moment a new version is detected, the reload is deferred
  (retried on the next poll or focus event) instead of firing immediately
  -- the same focus-guard pattern already used by the homepage demo's
  keyboard handler -- so a background deploy can't silently discard an
  unsaved keystroke mid-form. Mounted once in `App()` (`App.js`), the
  single persistent root component, so it runs for every route.
- `api/version.js`: returns `{ version, env }` with `Cache-Control:
  no-store` so no CDN layer serves a stale answer.

**Verified**: dedicated 5-check Playwright pass against a mocked endpoint
-- no reload on first sighting of a version, a real version change causes
an actual `window.location.reload()` (not just a state flag), the reload
is deferred while an input is focused and fires on the next check once
it's blurred. Confirmed separately that a genuinely missing endpoint (this
sandbox's plain static file server has no serverless functions, so
`/api/version` 404s here) degrades silently with no thrown/uncaught error
-- the only console noise is Chromium's own "failed to load resource"
network log for the 404 itself, not application code, and it won't occur
in production once this is deployed to Vercel. Added a matching
`/api/version` mock to every existing Playwright regression script (same
pattern already used for mocking Supabase) since the hook now mounts
globally on every page; re-ran all of them clean: stability 15/15,
direct-URL 9/9, i18n, landing 14/14, demo-intro 10/10, dimension-picker
6/6.

### Bugfix -- Insights mislabeled "Purchase intention" data as "premium/quality" ✅

User report: "Experiments doesn't work, what about Results/Insights/Reports?"
after the dimension-picker round. Clicking through all four nav sections
with mocked data showed every page loading and rendering real content with
zero console errors -- so not a crash, a routing break, or anything the
earlier stability work would have caught. Went further: built a Playwright
scenario using the REAL `participant_sessions`/`responses` DB column shapes
(not the app's in-memory camelCase shape) for an experiment that actually
uses two of the new dimension roles (`trust`, `purchase_intention`) with
real participant answers, and found a genuine content-correctness bug in
`lib/insights.js`'s generated narrative.

Root cause: a pre-existing line (`const premiumQ = findQuestionByRole(...,
"premium") ?? experiment.questions.find(q => q.type === "rating" &&
q.appliesTo === "variants")`) was written back when a "premium" rating
question was the only kind of rating+variants question the app could
produce, so falling back to *any* such question was a safe way to still
surface a secondary signal for experiments that never set a role. The new
"Purchase intention" dimension (added this session) is also `type:
"rating"`+`appliesTo:"variants"` -- so for any experiment using it without
also using the Premium dimension, this fallback silently grabbed the
purchase-intention question and labelled its data "воспринимаемого
качества/премиальности" (perceived quality/premium) in the generated
insight text. Wrong semantic claim about real response data, not just a
missing nice-to-have.

Fixed by excluding any question whose role is a different *known* dimension
role (new `DIMENSION_ROLES` export from `questionTypes.js`, the role side
of the same table the dimension chips are built from) from the fallback,
while still allowing it for a question with no role or a free-text/legacy
one -- preserving the original fallback's intent for experiments built
before the dimension system existed. Verified both directions: the
trust+purchase_intention experiment no longer shows the mislabeled
sentence (falls through to the honest "no secondary pattern found"
message instead), and a second scenario with a legacy no-role rating
question confirms the fallback still fires for it exactly as before.
Also confirmed the `rating`+`appliesTo:"variants"` response value shape
end-to-end while building this test (one row, `value` is a `{variantId:
rating}` object, per `ParticipantRunner.js`'s real submit path and
`ratingStatsForQuestion` in `stats.js` -- not one row per variant, which
was my own test mock's first mistake before reading the real code).

Re-ran the full regression suite after the fix: stability 15/15,
direct-URL 9/9, i18n, landing 14/14, dimension-picker 6/6 -- all clean.

### Bugfix -- nav label mismatch, dead logo, and "Sign in" re-prompting an already-signed-in user ✅

Three small reports in one message.

**Nav/page name mismatch ("Эксперименты деген не түсінбедім" -- "I don't
understand what 'Эксперименты' is").** The sidebar link to the research
list was labelled "Исследования" (RU) / "Зерттеулер" (KZ) / "Research"
(EN), but every other place in the product -- the page's own heading once
you're there, "New experiment" button, builder subtitle, chart captions,
25+ strings total -- calls the same thing "Эксперименты"/"Эксперименттер"/
"Experiments". The nav label was the one outlier, in all three languages
symmetrically (confirmed by grepping each locale file, not guessing from
one). Renamed `shell.nav.experiments` to match the dominant term in all
three locales.

**Dashboard logo didn't go anywhere.** The DecisionOS logo + name block in
the sidebar was a plain `<div>` with no `onClick` at all -- clicking it,
the single most reflexive "take me home" gesture in any app, did nothing.
Turned it into a real `<button>` wired to the same `onNavigate` handler
the rest of the sidebar already uses (so it also closes the mobile drawer),
going to `/app/overview` -- the signed-in user's home, not the public
marketing page, since jumping a logged-in user out to the landing page
mid-task would be the more surprising behavior of the two.

**Already-authenticated user hitting "Войти" had to log in again.**
`Login.js` rendered the sign-in form unconditionally, with no check for an
existing session -- so a signed-in user who ended up back on `/login`
(e.g. clicking "Войти" on the public landing page without it noticing
they're already signed in) just saw the form again instead of going
straight into the app. Added a `useSession()` check at the top that
redirects to `/app/overview` once loading is resolved and a session
exists, following the exact same "call navigate() then return null"
pattern `ProtectedApp` already uses elsewhere in `App.js`, rather than
introducing a different pattern for one page. Deliberately scoped to
`Login.js` only, not `Register.js`: a successful sign-up already does its
own `navigate("/onboarding")` immediately after the session is set, and a
second, more general redirect-if-authenticated guard sitting above it
could race that -- overwrite the just-set `/onboarding` hash with
`/app/overview` on the brief re-render before the hash change is
processed, skipping org creation for a brand-new user. Not worth the risk
for a path the report didn't actually describe.

**Verified**: 7-check Playwright pass -- logo is a real clickable button
and navigates to the dashboard home from a deep page (Settings), an
already-signed-in session hitting `/login` lands on the dashboard without
ever showing the form, and a genuinely signed-out session still sees the
real form (no regression on the common case). Zero console errors across
all three. Re-ran the full regression suite: stability 15/15, direct-URL
9/9, i18n, landing 14/14, dimension-picker 6/6 -- all clean.

### Homepage demo intro: "powerful/release," not "placeholder demo" ✅

Feedback on the intro gate added earlier this round: it read as flat and
sparse -- a small static icon in a box, no sense of invitation. Asked for
it to feel like a finished, confident release, not a prototype screen.

- The play icon is now a real clickable control (not just decoration --
  clicking it also starts the demo, same as the button below), bigger
  (80px, was 56px), with a soft amber glow that breathes in and out
  (new `.sk-breathe` keyframe animation in `styles.css`) -- a standby/
  power-light effect consistent with the "physical instrument" language
  the rest of the skeuomorphic system already uses, not a generic UI
  pulse. Exactly one element on the page breathes, deliberately, so nothing
  competes with it for attention.
- Added a row of 4 small colored dots beneath the body copy, one per demo
  variant (orange/silver/green/indigo), teasing what's behind the gate
  without revealing it -- ties visually to the "4 варианта" already in the
  copy instead of leaving it as a bare number. (Had to add a dedicated
  `dot` color per variant in `DEMO_VARIANTS` -- variant B's existing
  `accent` value is near-black and would have been invisible on this dark
  UI; the dot needs to read clearly, the accent stripe doesn't.)
- The "Начать демо" button gets a new `.sk-btn-hero` modifier -- a
  stronger indigo bloom than the standard button glow, reserved for a
  single hero CTA rather than applied to buttons generally.

**Verified**: re-ran the 10-check demo-intro suite and the 14-check
landing suite (both still clean after the markup changes), added a
dedicated check that clicking the glowing icon itself -- not just the text
button -- starts the demo, and reviewed a screenshot at the same crop used
throughout this round. Full regression suite (stability 15/15, direct-URL
9/9, i18n, logo/login 7/7) re-run clean.

### Social layer, slice 1: posts + feed ("Создать" -- a place to post) ✅

Per the user's own earlier resolution (keep research primary, add a
social/community layer as a new, additive section, not a replacement),
the first real slice of it: a platform-wide feed where any signed-in user
can write and read posts.

- **`supabase/migrations/0009_posts.sql`**: new `posts` table --
  deliberately references `profiles` directly with no `organization_id`,
  since this is a cross-org social layer, not scoped to one org like
  experiments. `author_id` defaults to `auth.uid()` server-side and is
  never sent by the client, specifically repeating the pattern
  `0004_server_derived_ownership.sql` fixed for organizations/experiments
  rather than reintroducing the same staleness bug for a new table. RLS:
  any authenticated user can read every post (true platform feed); insert/
  update/delete only your own. Checked against the 0004 migration's
  documented RETURNING-filtered-by-SELECT-policy trap -- doesn't apply
  here, since the SELECT policy is unconditional (`using (true)`), so a
  freshly inserted row is always visible back to its own author regardless
  of timing.
- **`lib/postsStore.js`**: `createPost(body)` (sends only `body`, nothing
  else) and a reactive `usePosts()` cache, same module-level
  state+listeners+catch-up-notify shape as every other store this session.
  Caught a real bug in my own first draft before it ever ran: initializing
  `loading: true` while the mount effect's trigger condition was `!loading
  && !loaded` meant the very first load would never fire -- the exact
  "lost notification, stuck on loading forever" bug class this whole
  session has been about. Fixed before testing, not found by testing.
- **`pages/Feed.js`**: inline composer (avatar, textarea, char counter,
  disabled-until-non-empty submit) at the top, chronological post list
  below -- one page doing both jobs, matching this app's own existing
  pattern of "the page is named after the collection, creation is a
  button inside it" (Эксперименты + "Новый эксперимент") rather than
  splitting into a separate bare compose screen.
- **Nav**: new "Сообщество" group in the sidebar, below the research nav
  and above "Рабочее пространство" -- visually and structurally separate,
  not mixed into or reordering the existing research items, per the
  additive-not-replacing resolution. One item for this slice: "Лента".
- **i18n**: new `shell.community.*` and `feed.*` namespaces in all three
  locales (619/619/619 parity).

**Verified**: 14-check Playwright pass against a stateful mocked backend --
nav exists and routes correctly, empty state, composer enable/disable,
publish adds the post to the visible feed immediately, composer clears,
author name renders, and (the one that mattered most) the actual INSERT
payload captured by the mock contains only `{body}` -- no `author_id` --
confirming the client genuinely never sends it. Separate error+retry pass.
Added `/app/feed` to the direct-URL cold-load regression script (10/10).
Re-ran the full suite: stability 15/15, direct-URL 10/10, i18n, landing
14/14, logo/login 7/7 -- all clean.

**Not yet live**: this session has no `SUPABASE_ACCESS_TOKEN` /
`SUPABASE_PROJECT_REF` in its environment, so `npx supabase db push`
cannot be run from here -- the migration is written and committed but not
yet applied to the real database. The app code is correct and fully
tested against a faithful mock of the schema the migration creates, but
the Feed page will fail against the live backend (the `posts` table
doesn't exist yet) until someone with Supabase credentials runs the push
-- flagged explicitly rather than silently assumed to be live.

### Feed composer: compact, auto-growing, no raw browser chrome ✅

Real-screenshot feedback on the new composer (`Feed.js`): it looked out of
place -- a static 88px-tall box with the browser's own default resize
handle poking out of the corner, the one clearly unstyled element on an
otherwise fully bespoke skeuomorphic page.

Stopped using the shared `TextArea` component here specifically (it
always adds `resize-y`, with no clean override) and wrote the textarea
directly with `resize-none` plus a small auto-grow handler: starts at a
single compact line (44px, matching the avatar's height so the row reads
as one aligned unit instead of an oversized empty box next to a small
circle), and grows with `scrollHeight` as the author types, up to a 240px
cap, instead of ever exposing a manual resize affordance. Same `sk-input`
inset styling as every other field in the app -- the box itself wasn't
mis-themed, just mis-sized with a raw HTML artifact sitting on top of it.

**Verified**: measured the actual rendered height before (44px) and after
typing a two-line post (66px) to confirm the grow behavior fires, not just
that it compiles. Re-ran the 14-check Feed suite (still clean) and the
full regression suite: stability 15/15, direct-URL 10/10, i18n, landing
14/14.

### Feed: profanity guard on posting, hashtags (render + click-to-filter) ✅

Two requested additions to the composer: block posts containing strong
profanity, and support hashtags.

- **`lib/profanityFilter.js`**: a stem-based RU/KK/EN blocklist (common
  strong profanity roots, not an exhaustive dictionary) matched with a
  Unicode-aware word-boundary regex (`\p{L}`/`\p{N}` lookbehind, so it
  only triggers at the start of a word, not mid-word) and trailing
  `[\p{L}]*` so inflected/declined forms (very common in Russian/Kazakh --
  a single root can appear in a dozen grammatical forms) are still caught
  without hand-listing every one. `ё`/`е` normalized before matching, a
  common spelling variance, not evasion. Explicitly a client-side UX
  guard, documented in the file itself as not a hard security boundary --
  a request sent straight to the API bypasses it, same caveat as any
  client-only validation.
  Verified with a deliberate false-positive pass before wiring it into any
  UI: common benign words that merely *contain* a flagged substring
  ("Хусейн", "ассистент"-style "ass...", "Шипучка") all correctly pass,
  profane RU/KK/EN phrases including inflected forms ("ёбнутый",
  "сіктір") all correctly block -- caught and fixed one missed
  derivational form (the "-ну-" infix, e.g. "ёбнутый") during this pass,
  before it ever reached a browser test.
  `Composer.submit()` checks the trimmed body before calling `createPost`;
  on a hit it shows a toast and returns without submitting or clearing the
  draft, so the author can edit rather than losing what they wrote.
- **Hashtags**: `#word` tokens (Unicode-aware, so Cyrillic tags work) are
  parsed out of each post's body at render time and rendered as styled,
  clickable spans (`renderPostBody` in `Feed.js`) rather than plain text.
  Clicking one sets an active-filter chip above the list and narrows
  `visiblePosts` to posts containing that tag (plain client-side
  substring filtering over the already-fetched posts -- no new schema, no
  migration, so this works immediately with no backend dependency). A
  dedicated empty state (not the generic "no posts yet" one) covers zero
  matches for the active tag, with a clear-filter control to return to
  the full feed.

**Verified**: 12-check Playwright pass -- a profane post is blocked (toast
shown, zero insert requests sent, draft text preserved for editing, not
wiped), a clean post with two hashtags submits normally, both hashtags
render as distinct clickable elements, clicking one shows the filter chip
and narrows the visible list to only the matching post while hiding an
unrelated one, and clearing the filter restores the full feed. Re-ran the
original 14-check Feed suite (unaffected, still clean) and the full
regression suite: stability 15/15, direct-URL 10/10, i18n, landing 14/14.
New `feed.profanityBlocked`/`clearFilter`/`noHashtagTitle`/`noHashtagBody`
keys in all three locales (623/623/623 parity).

### Feed: photo attachments, softer/stricter moderation policy, and a real identity-resolution bug ✅

Three requests in one message: let people attach a photo to a post (with
real checking, not just a UI affordance); make the word filter stricter;
and change single-slip handling from a hard block to censoring just that
word, so an otherwise-fine post (e.g. about marketing) isn't killed over
one word -- multiple instances still hard-block, since that pattern reads
as abuse rather than a slip.

- **`supabase/migrations/0010_post_images.sql`**: `posts.image_url`
  column + a `post-images` Storage bucket, public read, upload/delete
  restricted to the uploader's own folder (`<author_id>/<file>`, checked
  against `auth.uid()` -- same shape as `0005_storage.sql`'s org-folder
  check, keyed to the user directly since posts aren't org-scoped).
- **`lib/storage.js`**: `uploadPostImage()`, reusing the existing
  `validateAssetFile()` (JPEG/PNG/WEBP/GIF only, 5MB max) rather than
  duplicating it. That validation is real and enforced (checked both at
  file-pick time for instant feedback and again inside the upload call) --
  but it's file type/size only. There is no visual content-moderation
  capability available in this environment (no image-moderation API
  credentials), so this does not and cannot inspect what's actually in the
  photo; said so plainly rather than implying a check that isn't real.
- **`lib/profanityFilter.js`** reworked from boolean `containsProfanity`
  to `moderatePost(text)`: zero matches -> post as-is, exactly one ->
  `censorProfanity()` masks that word (first letter kept, rest asterisks)
  and the post still goes through, two or more -> hard block, unchanged
  from before. Word list widened (added a compound form, "долбоеб", that
  the previous prefix-anchored stems couldn't reach since the profane
  root isn't at the start of the word -- plus a few more common RU/EN
  roots) and re-verified against the same false-positive set as before
  (benign RU/KZ/EN text, words merely containing a flagged substring)
  before wiring the new policy into the UI.
- **Found while building the image feature, not asked for but real**: the
  `Avatar` component in `Feed.js` only ever rendered initials -- it never
  had an image-rendering branch at all, unlike the one in `shell.js`
  (which already does this correctly for the sidebar). Fixed by matching
  that existing pattern.
- **The actual root cause of "doesn't my avatar show to everyone"**: a lot
  more significant than the component bug above. `profiles`' own RLS
  (`"profiles: read own"`, `id = auth.uid()`, from `0002_rls.sql`) means a
  user can only read their OWN profile row directly -- and `fetchPosts()`
  was embedding `author:profiles(...)` on the posts query, which
  PostgREST filters through the embedded table's own SELECT policy (the
  exact mechanism `0004_server_derived_ownership.sql` already documented
  for `RETURNING`, which turns out to apply the same way to a plain
  embedded SELECT). So on the real backend, every post NOT authored by
  the viewer was resolving its author to nothing, regardless of the
  component bug -- not a privacy feature, a side effect of a table-wide
  policy that predates this feature.
  Fixed with `supabase/migrations/0011_profiles_public.sql`: a narrow
  view exposing only the already-effectively-public identity columns
  (name, username, avatar -- never email/bio/notification settings) for
  every user, with no RLS of its own since views can't carry column-level
  security -- the SELECT list itself is the boundary. Runs as its owner
  (no `security_invoker`), the same mechanism `get_public_profile()`
  (0008) already relies on to read past the base table's restrictive
  policy. `postsStore.js`'s `fetchPosts()` now does two queries -- plain
  `posts`, then author identities from `profiles_public` for the distinct
  `author_id`s -- merged client-side, instead of one broken embed.
  `createPost()` simplified to not bother resolving/returning the author
  at all, since nothing read that return value; `invalidatePosts()`
  already triggers the real refresh.

**Verified**: 19-check Playwright pass covering the censor-vs-block split
(single word censored and published with a distinct gentler toast;
multiple words hard-blocked with zero insert; draft preserved either way
so nothing is silently lost), photo attachment (invalid file type
rejected before any upload attempt, valid image previewed locally then
actually uploaded on submit, saved with a real `image_url`), plus the
original 14-check base suite and 12-check moderation/hashtag suite
re-run clean. Then a dedicated 6-check test specifically reproducing the
real bug: mocked `/rest/v1/profiles` to only ever return the viewer's own
row (mirroring the real RLS) while `/rest/v1/profiles_public` correctly
serves any requested user -- confirmed BOTH a post's own author and a
different post's different author resolve to their own distinct real
name and distinct real avatar photo, scoped to each post's own card
(not a page-wide substring check, which would have falsely passed off
the sidebar's unrelated copy of the viewer's own name/avatar). Full
regression suite re-run clean: stability 15/15, direct-URL 10/10, i18n,
landing 14/14.

**Not yet live**: migrations 0010 and 0011, like 0009 before them, are
written and committed but not applied to the real database from this
session (same missing Supabase credentials as before) -- until they're
run, photo upload and cross-author identity resolution won't work on the
live site even though the code and tests are correct against the schema
they create.

### Collapsible sidebar, phone-only drawer, and a real pre-existing CSS bug ✅

Three asks: the mobile hamburger menu should only appear on an actual
phone; desktop/tablet should get an explicit collapse toggle instead of
relying on viewport width alone; and the Feed composer should sit below
the post list, not above it.

- **Breakpoint**: the mobile drawer pattern (hamburger + overlay) now
  switches in only below `md` (768px) instead of the old `lg` (1024px) --
  everything `md` and up (tablets included, not just wide desktops) gets
  the persistent sidebar. Every `lg:` class governing this layout in
  `shell.js` moved to `md:`.
- **Collapse**: new `collapsed` state in `Shell`, persisted to
  `localStorage` (`decisionos_sidebar_collapsed`) so it survives a
  reload. Collapsed, the desktop sidebar shrinks to a 72px icon rail --
  logo, nav icons (each with a `title` tooltip since the label is gone),
  section dividers become plain rules, the primary CTA and user menu
  collapse to icon-only. A toggle button (chevron, flips direction) sits
  right under the logo, in the same place whichever state it's in.
  Mobile's overlay drawer always renders expanded regardless of this
  state -- collapsing a temporary overlay you're about to close doesn't
  help anyone. Factored the three near-identical nav-item blocks (main/
  community/workspace) into one `NavItem` component while touching all
  three anyway for the new collapsed-state logic, rather than tripling
  the same conditional a third time.
- **Feed composer**: moved from the top of the page to below the post
  list (and its own `Card` margin flipped from `mb-6` to `mt-6` to match).

**A real, pre-existing bug found while verifying the hamburger actually
hides on desktop, not assumed from reading the JSX**: it didn't -- at any
width, before or after this change. `index.html` loads
`vendor/tailwind.css` before `styles.css`; `.sk-btn` (styles.css) sets
`display: inline-flex` with no `!important`, so at equal CSS specificity
it always wins the cascade over a later-irrelevant-order Tailwind
responsive utility like `md:hidden`/`lg:hidden` on the same element --
the hamburger button has combined `sk-btn` with a responsive `hidden`
class since the skeuomorphic pass gave it that class, so this had been
silently broken since then, independent of which breakpoint number was
used. Swept every other `sk-*` class in the app combined with a
responsive display utility (`sk-sidebar`, `sk-display`, `sk-badge`) --
none of the other three actually set `display` themselves, so only this
one button was affected, not a wider pattern. Fixed narrowly with
Tailwind's `!` important modifier (`md:!hidden`) on just that element,
rather than reordering the global stylesheet link order and risking
every other `sk-*`/Tailwind-utility interaction in the app.

**Verified**: a 14-check Playwright pass across two viewports -- phone
width (375px) shows the hamburger, hides the persistent sidebar, and
opening the drawer shows full labels; tablet width (900px, deliberately
chosen as above the old 768px `md` boundary's low end but below the old
1024px `lg` one, to directly probe the actual bug report) hides the
hamburger, shows the persistent sidebar expanded by default, and clicking
collapse actually shrinks it (measured 256px to 72px, not just checking a
class is present), hides labels, persists across a reload, and reverses
cleanly. This test caught the cascade bug directly -- the hamburger
visibility check failed first, which is what led to tracing it to the
stylesheet order rather than assuming the responsive class alone was
enough. A separate check confirms the Feed composer now renders below an
existing post, not above it. Full regression suite re-run clean:
stability 15/15, direct-URL 10/10, i18n, landing 14/14, logo/login 7/7.

### Bugfix -- native `<select>` dropdown options unreadable (light text on a near-white popup) ✅

Screenshot report: the country dropdown's open option list looked washed
out/odd, options barely readable. Root cause: a `<select>` styled via
`sk-input` gets light text color (`text-slate-100`), which `<option>`
elements inherit -- but the OPEN option list is rendered by the browser/
OS chrome, which ignores most CSS on the select (background, shadow,
gradient) while still applying the inherited text color, so the popup
fell back to the browser's own near-white default background under
light-on-light-ish text. `background-color`/`color` are the two
properties that do reliably apply to `<option>` across Chromium/Firefox,
unlike everything else on `.sk-input`.

Fixed with explicit `select.sk-input option` / `:checked` rules in
`styles.css` -- since every `<select>` in the app goes through the shared
`Select` component (which always applies `sk-input`), this fixes every
dropdown app-wide (timezone, research type, question type, ...), not
just the one in the report.

**Verified**: checked the actual computed `background-color`/`color` on a
rendered `<option>` (not just that the CSS rule compiles) -- confirmed
dark background + light readable text -- then opened the real dropdown
and screenshotted the native popup itself to visually confirm against the
original report. Stability and i18n suites re-run clean.

### Centered content on wide screens, delete your own post, admin can delete any post ✅

- **Content centering**: `<main class="... max-w-[1400px]">` had the
  width cap but no `mx-auto`, so on a wide monitor the 1400px box just
  sat flush against its parent's left edge (right after the sidebar),
  leaving all the extra space stacked on the right only -- exactly the
  "everything's glued to the menu" look in the report. Added `mx-auto`.
  The sidebar itself is unaffected (still a fixed column on the left,
  per the other request to leave it where it is) -- only the content
  box centers within the remaining width to its right.
- **`supabase/migrations/0012_post_deletion.sql`**: adds
  `profiles.is_admin` (a genuine platform-wide flag, unrelated to
  `member_role`, which is scoped to one organization and has no bearing
  on a cross-org feature like the feed -- default `false` for everyone,
  no UI to grant it, set directly via SQL by whoever controls the
  database) and a `posts_delete_admin` RLS policy. Deleting your own post
  needed no new policy -- `posts_delete_own` already covered it in 0009.
  `profiles`' existing "read own" policy already covers the new column
  for its own row, so no new SELECT policy either; deliberately not
  added to `profiles_public` (0011), since the UI only ever needs the
  viewer's own admin status, never anyone else's.
- `lib/postsStore.js`: `deletePost(id)`. `lib/profile.js`: added
  `is_admin` to the explicit profile column list (it's an explicit list,
  not `select *`, so a new column silently would not have been fetched).
- `Feed.js`: a delete (trash) icon appears on a post when
  `post.authorId === currentUserId || profile.is_admin`, opening the same
  confirm-dialog pattern `ExperimentsList.js` already uses (Cancel/Delete,
  danger-styled) rather than a different one-off pattern.

**Verified**: measured the actual rendered gap on each side of the
content box at a 1920px viewport (132px/132px, matching the user's own
screenshot's width) rather than eyeballing a screenshot. A 17-check
Playwright pass run twice (non-admin and admin profile) confirms: a
non-admin sees a delete button only on their own post, never on someone
else's; an admin sees it on every post; the confirm dialog blocks an
accidental click (Cancel truly sends no request); confirming actually
removes the post from the list and fires exactly one DELETE request; and
critically, the mock mirrors real RLS (a non-owner, non-admin DELETE
request is rejected server-side) so the test isn't just checking that a
button is hidden, but that the underlying permission actually holds.
Full regression suite re-run clean.

**Not yet live**: migration 0012 has the same credential gap as 0009-0011
-- written and committed, not yet applied. Once it is, set your own
account's flag with (replace the email):
```sql
update profiles set is_admin = true where email = 'you@example.com';
```
