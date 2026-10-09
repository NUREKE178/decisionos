import { html, useState, useEffect } from "./lib/preact.js";
import { useRoute, matchRoute, navigate } from "./router.js";
import { Shell } from "./components/shell.js";
import { Landing } from "./pages/Landing.js";
import { Overview } from "./pages/Overview.js";
import { ExperimentsList } from "./pages/ExperimentsList.js";
import { ExperimentBuilder } from "./pages/ExperimentBuilder.js";
import { Results } from "./pages/Results.js";
import { Insights } from "./pages/Insights.js";
import { Participants } from "./pages/Participants.js";
import { Reports } from "./pages/Reports.js";
import { Team } from "./pages/Team.js";
import { Settings } from "./pages/Settings.js";
import { Profile } from "./pages/Profile.js";
import { PublicProfile } from "./pages/PublicProfile.js";
import { Billing } from "./pages/Billing.js";
import { ParticipantRunner } from "./pages/ParticipantRunner.js";
import { Login } from "./pages/auth/Login.js";
import { Register } from "./pages/auth/Register.js";
import { ForgotPassword } from "./pages/auth/ForgotPassword.js";
import { ResetPassword } from "./pages/auth/ResetPassword.js";
import { Onboarding } from "./pages/auth/Onboarding.js";
import { useSession } from "./lib/auth.js";
import { fetchMyOrganizations } from "./lib/org.js";
import { IS_CONFIGURED } from "./lib/env.js";
import { useT } from "./lib/i18n.js";
import { Button } from "./components/ui.js";
import { withTimeout } from "./lib/async.js";
import { useAutoUpdate } from "./lib/useAutoUpdate.js";

const DASHBOARD_ROUTES = [
  { pattern: "/app/overview", Page: Overview },
  { pattern: "/app/experiments", Page: ExperimentsList },
  { pattern: "/app/experiments/new", Page: ExperimentBuilder },
  { pattern: "/app/experiments/:id/edit", Page: ExperimentBuilder },
  { pattern: "/app/experiments/:id/results", Page: Results },
  { pattern: "/app/experiments/:id/insights", Page: Insights },
  { pattern: "/app/results", Page: Results },
  { pattern: "/app/insights", Page: Insights },
  { pattern: "/app/participants", Page: Participants },
  { pattern: "/app/reports", Page: Reports },
  { pattern: "/app/team", Page: Team },
  { pattern: "/app/billing", Page: Billing },
  { pattern: "/app/settings", Page: Settings },
  { pattern: "/profile", Page: Profile },
];

const AUTH_ROUTES = [
  { pattern: "/login", Page: Login },
  { pattern: "/register", Page: Register },
  { pattern: "/forgot-password", Page: ForgotPassword },
  { pattern: "/reset-password", Page: ResetPassword },
];

function FullScreenLoading() {
  const t = useT();
  return html`<div class="flex min-h-screen items-center justify-center text-slate-500 text-sm bg-slate-950">${t("common.loading")}</div>`;
}

/** Gatekeeper for everything under /app: requires a signed-in session, then
 * requires the user to belong to at least one organization (routing them to
 * /onboarding to create one otherwise). */
function ProtectedApp({ path, query }) {
  const t = useT();
  const { session, loading: sessionLoading } = useSession();
  const [orgChecked, setOrgChecked] = useState(false);
  const [hasOrg, setHasOrg] = useState(false);
  const [orgError, setOrgError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setOrgError(false);
    withTimeout(fetchMyOrganizations(), 15000)
      .then((orgs) => { if (!cancelled) { setHasOrg(orgs.length > 0); setOrgChecked(true); } })
      .catch(() => { if (!cancelled) { setOrgError(true); setOrgChecked(true); } });
    return () => { cancelled = true; };
  }, [session, retryTick]);

  if (!IS_CONFIGURED) {
    return html`
      <div class="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <div class="max-w-md text-center">
          <h1 class="text-lg font-semibold text-slate-100">${t("common.notConfiguredTitle")}</h1>
          <p class="text-sm text-slate-400 mt-2">${t("common.notConfiguredBody")}</p>
        </div>
      </div>
    `;
  }

  if (sessionLoading) return html`<${FullScreenLoading} />`;
  if (!session) { navigate("/login"); return null; }
  if (!orgChecked) return html`<${FullScreenLoading} />`;
  if (orgError) {
    return html`
      <div class="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
        <div class="max-w-sm">
          <h1 class="text-lg font-semibold text-slate-100">${t("common.loadOrgErrorTitle")}</h1>
          <p class="text-sm text-slate-400 mt-2">${t("common.loadOrgErrorBody")}</p>
        </div>
        <${Button} onClick=${() => setRetryTick((n) => n + 1)}>${t("common.retry")}<//>
      </div>
    `;
  }
  if (!hasOrg) { navigate("/onboarding"); return null; }

  for (const route of DASHBOARD_ROUTES) {
    const params = matchRoute(route.pattern, path);
    if (params) {
      const Page = route.Page;
      return html`
        <${Shell} currentPath=${path}>
          <${Page} params=${params} query=${query} />
        <//>
      `;
    }
  }
  navigate("/app/overview");
  return null;
}

export function App() {
  useAutoUpdate();
  const { path, query } = useRoute();

  if (path === "/" || path === "") return html`<${Landing} />`;

  if (path.startsWith("/research/")) {
    const params = matchRoute("/research/:slug", path);
    return html`<${ParticipantRunner} slug=${params.slug} preview=${false} />`;
  }

  if (path.startsWith("/u/")) {
    const params = matchRoute("/u/:username", path);
    if (params) return html`<${PublicProfile} params=${params} />`;
  }

  if (path.startsWith("/app/experiments/") && path.endsWith("/preview")) {
    const params = matchRoute("/app/experiments/:id/preview", path);
    if (params) {
      return html`<${ParticipantRunner} experimentId=${params.id} preview=${true} />`;
    }
  }

  if (path === "/onboarding") return html`<${Onboarding} />`;

  for (const route of AUTH_ROUTES) {
    if (matchRoute(route.pattern, path)) {
      const Page = route.Page;
      return html`<${Page} />`;
    }
  }

  if (path.startsWith("/app") || path === "/profile") {
    return html`<${ProtectedApp} path=${path} query=${query} />`;
  }

  navigate("/");
  return null;
}
