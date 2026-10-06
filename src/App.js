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
import { ParticipantRunner } from "./pages/ParticipantRunner.js";
import { Login } from "./pages/auth/Login.js";
import { Register } from "./pages/auth/Register.js";
import { ForgotPassword } from "./pages/auth/ForgotPassword.js";
import { ResetPassword } from "./pages/auth/ResetPassword.js";
import { Onboarding } from "./pages/auth/Onboarding.js";
import { useSession } from "./lib/auth.js";
import { fetchMyOrganizations } from "./lib/org.js";
import { IS_CONFIGURED } from "./lib/env.js";

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
  { pattern: "/app/settings", Page: Settings },
];

const AUTH_ROUTES = [
  { pattern: "/login", Page: Login },
  { pattern: "/register", Page: Register },
  { pattern: "/forgot-password", Page: ForgotPassword },
  { pattern: "/reset-password", Page: ResetPassword },
];

function FullScreenLoading() {
  return html`<div class="flex min-h-screen items-center justify-center text-slate-500 text-sm bg-slate-950">Загрузка…</div>`;
}

/** Gatekeeper for everything under /app: requires a signed-in session, then
 * requires the user to belong to at least one organization (routing them to
 * /onboarding to create one otherwise). */
function ProtectedApp({ path, query }) {
  const { session, loading: sessionLoading } = useSession();
  const [orgChecked, setOrgChecked] = useState(false);
  const [hasOrg, setHasOrg] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchMyOrganizations()
      .then((orgs) => { if (!cancelled) { setHasOrg(orgs.length > 0); setOrgChecked(true); } })
      .catch(() => { if (!cancelled) setOrgChecked(true); });
    return () => { cancelled = true; };
  }, [session]);

  if (!IS_CONFIGURED) {
    return html`
      <div class="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <div class="max-w-md text-center">
          <h1 class="text-lg font-semibold text-slate-100">Supabase не настроен</h1>
          <p class="text-sm text-slate-400 mt-2">
            Заполните SUPABASE_URL и SUPABASE_ANON_KEY в src/lib/env.js, чтобы включить вход и рабочее пространство.
          </p>
        </div>
      </div>
    `;
  }

  if (sessionLoading) return html`<${FullScreenLoading} />`;
  if (!session) { navigate("/login"); return null; }
  if (!orgChecked) return html`<${FullScreenLoading} />`;
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
  const { path, query } = useRoute();

  if (path === "/" || path === "") return html`<${Landing} />`;

  if (path.startsWith("/r/")) {
    const params = matchRoute("/r/:id", path);
    return html`<${ParticipantRunner} experimentId=${params.id} preview=${false} />`;
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

  if (path.startsWith("/app")) {
    return html`<${ProtectedApp} path=${path} query=${query} />`;
  }

  navigate("/");
  return null;
}
