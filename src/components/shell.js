import { html, useState } from "../lib/preact.js";
import { navigate } from "../router.js";
import { Icon } from "./icons.js";
import { useCurrentOrg } from "../lib/currentOrg.js";
import { useExperiments } from "../lib/experimentsStore.js";
import { useSession, signOut } from "../lib/auth.js";
import { Button } from "./ui.js";

const NAV = [
  { id: "overview", label: "Overview", icon: "overview", path: "/app/overview" },
  { id: "experiments", label: "Experiments", icon: "experiments", path: "/app/experiments" },
  { id: "participants", label: "Participants", icon: "participants", path: "/app/participants" },
  { id: "results", label: "Results", icon: "results", path: "/app/results" },
  { id: "insights", label: "Insights", icon: "insights", path: "/app/insights" },
  { id: "reports", label: "Reports", icon: "reports", path: "/app/reports" },
  { id: "team", label: "Team", icon: "team", path: "/app/team" },
  { id: "settings", label: "Settings", icon: "settings", path: "/app/settings" },
];

function initialsFor(nameOrEmail) {
  if (!nameOrEmail) return "?";
  const parts = nameOrEmail.split(/[\s@._]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function SidebarContent({ currentPath, onNavigate }) {
  const { org } = useCurrentOrg();
  return html`
    <div class="flex h-full flex-col">
      <div class="flex items-center gap-2.5 px-5 py-5">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white">
          <${Icon} name="logo" size=${18} strokeWidth=${2} />
        </div>
        <div>
          <div class="font-semibold text-slate-50 leading-tight">DecisionOS</div>
          <div class="text-[11px] text-slate-500 leading-tight truncate max-w-[9rem]">${org?.name ?? "…"}</div>
        </div>
      </div>

      <div class="px-3 mb-2">
        <${Button} variant="primary" size="sm" className="w-full" onClick=${() => onNavigate("/app/experiments/new")}>
          <${Icon} name="plus" size=${16} /> New experiment
        <//>
      </div>

      <nav class="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        ${NAV.map((item) => {
          const active = currentPath === item.path || currentPath.startsWith(item.path + "/");
          return html`
            <button
              key=${item.id}
              onClick=${() => onNavigate(item.path)}
              class=${`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-indigo-500/15 text-indigo-300" : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
              }`}
            >
              <${Icon} name=${item.icon} size=${17} />
              ${item.label}
            </button>
          `;
        })}
      </nav>

      <div class="px-4 py-4 border-t border-slate-800/80 space-y-2">
        <button onClick=${async () => { await signOut(); navigate("/"); }} class="flex items-center gap-2 text-xs text-slate-500 hover:text-rose-400">
          <${Icon} name="arrowLeft" size=${14} /> Выйти
        </button>
      </div>
    </div>
  `;
}

export function Shell({ currentPath, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { experiments } = useExperiments();
  const { user } = useSession();
  const activeCount = experiments.filter((e) => e.status === "active").length;
  const displayName = user?.user_metadata?.full_name || user?.email || "";

  const onNavigate = (path) => { setMobileOpen(false); navigate(path); };

  return html`
    <div class="min-h-screen bg-slate-950 text-slate-100">
      <!-- Desktop sidebar -->
      <aside class="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-800/80 bg-slate-950">
        <${SidebarContent} currentPath=${currentPath} onNavigate=${onNavigate} />
      </aside>

      <!-- Mobile sidebar -->
      ${mobileOpen && html`
        <div class="fixed inset-0 z-40 lg:hidden">
          <div class="absolute inset-0 bg-slate-950/70" onClick=${() => setMobileOpen(false)}></div>
          <aside class="absolute inset-y-0 left-0 w-64 border-r border-slate-800 bg-slate-950">
            <${SidebarContent} currentPath=${currentPath} onNavigate=${onNavigate} />
          </aside>
        </div>
      `}

      <div class="lg:pl-64">
        <header class="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur px-4 py-3 lg:px-8">
          <div class="flex items-center gap-3">
            <button class="lg:hidden text-slate-400" onClick=${() => setMobileOpen(true)}><${Icon} name="menu" size=${22} /></button>
            <div class="hidden sm:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-500 w-72">
              <${Icon} name="search" size=${15} />
              <span>Поиск экспериментов, участников…</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> ${activeCount} активных
            </span>
            <button class="text-slate-400 hover:text-slate-200"><${Icon} name="bell" size=${19} /></button>
            <div title=${displayName} class="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center text-xs font-semibold text-white">${initialsFor(displayName)}</div>
          </div>
        </header>
        <main class="px-4 py-6 lg:px-8 lg:py-8 max-w-[1400px]">
          ${children}
        </main>
      </div>
    </div>
  `;
}
