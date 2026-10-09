import { html, useState, useEffect, useRef } from "../lib/preact.js";
import { navigate } from "../router.js";
import { Icon } from "./icons.js";
import { useCurrentOrg } from "../lib/currentOrg.js";
import { useExperiments } from "../lib/experimentsStore.js";
import { useSession, signOut } from "../lib/auth.js";
import { useMyProfile, updateMyProfile } from "../lib/profile.js";
import { useT, useLocale, setLocale, LOCALES } from "../lib/i18n.js";
import { toast } from "./ui.js";

const NAV = [
  { id: "overview", key: "shell.nav.overview", icon: "overview", path: "/app/overview" },
  { id: "experiments", key: "shell.nav.experiments", icon: "experiments", path: "/app/experiments" },
  { id: "participants", key: "shell.nav.participants", icon: "participants", path: "/app/participants" },
  { id: "results", key: "shell.nav.results", icon: "results", path: "/app/results" },
  { id: "insights", key: "shell.nav.insights", icon: "insights", path: "/app/insights" },
  { id: "reports", key: "shell.nav.reports", icon: "reports", path: "/app/reports" },
];

const WORKSPACE_NAV = [
  { id: "team", key: "shell.workspace.team", icon: "team", path: "/app/team" },
  { id: "billing", key: "shell.workspace.billing", icon: "card", path: "/app/billing" },
  { id: "profile", key: "shell.workspace.profile", icon: "user", path: "/profile" },
  { id: "settings", key: "shell.workspace.settings", icon: "settings", path: "/app/settings" },
];

function initialsFor(nameOrEmail) {
  if (!nameOrEmail) return "?";
  const parts = nameOrEmail.split(/[\s@._]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function Avatar({ name, url, size = 32 }) {
  if (url) {
    return html`<img src=${url} class="rounded-full object-cover shrink-0" style=${{ width: `${size}px`, height: `${size}px` }} />`;
  }
  return html`
    <div class="rounded-full bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center font-semibold text-white shrink-0"
      style=${{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(10, size * 0.38)}px` }}>${initialsFor(name)}</div>
  `;
}

/** Click-outside dropdown wrapper -- closes on outside click or Escape. */
function Dropdown({ open, onClose, align = "left", children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onKey); };
  }, [open]);
  if (!open) return null;
  return html`
    <div ref=${ref} class=${`sk-modal absolute ${align === "right" ? "right-0" : "left-0"} bottom-full mb-2 z-40 w-56 rounded-xl py-1.5 fade-in`}>
      ${children}
    </div>
  `;
}

function MenuItem({ icon, label, onClick, danger = false }) {
  return html`
    <button onClick=${onClick}
      class=${`flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors ${danger ? "text-rose-400 hover:bg-rose-500/10" : "text-slate-300 hover:bg-white/5"}`}>
      <${Icon} name=${icon} size=${15} /> ${label}
    </button>
  `;
}

function UserMenu({ onNavigate }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { org } = useCurrentOrg();
  const { user } = useSession();
  const { profile } = useMyProfile();
  const displayName = profile?.full_name || user?.email || "";

  return html`
    <div class="relative px-3">
      <button onClick=${() => setOpen((v) => !v)} class="sk-nav-item flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors" data-active="false">
        <div class="relative shrink-0">
          <${Avatar} name=${displayName} url=${profile?.avatar_url} />
          <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-slate-950"></span>
        </div>
        <div class="min-w-0 flex-1 text-left">
          <div class="text-sm font-medium text-slate-100 truncate">${displayName || "…"}</div>
          <div class="text-[11px] text-slate-500 truncate">${org?.name ?? ""}</div>
        </div>
        <${Icon} name="chevronDown" size=${14} className="text-slate-500 shrink-0" />
      </button>
      <${Dropdown} open=${open} onClose=${() => setOpen(false)}>
        <${MenuItem} icon="user" label=${t("shell.userMenu.profile")} onClick=${() => { setOpen(false); onNavigate("/profile"); }} />
        <${MenuItem} icon="settings" label=${t("shell.userMenu.settings")} onClick=${() => { setOpen(false); onNavigate("/app/settings"); }} />
        <div class="my-1 border-t border-slate-800"></div>
        <${MenuItem} icon="logout" label=${t("shell.userMenu.logout")} danger onClick=${async () => { setOpen(false); await signOut(); navigate("/"); }} />
      <//>
    </div>
  `;
}

function SidebarContent({ currentPath, onNavigate }) {
  const t = useT();
  const { org } = useCurrentOrg();
  return html`
    <div class="flex h-full flex-col">
      <button type="button" onClick=${() => onNavigate("/app/overview")}
        class="flex items-center gap-2.5 px-5 py-5 text-left w-full hover:opacity-80 transition-opacity">
        <div class="sk-panel-flat flex h-9 w-9 items-center justify-center rounded-lg text-indigo-300">
          <${Icon} name="logo" size=${18} strokeWidth=${2} />
        </div>
        <div>
          <div class="font-semibold text-slate-50 leading-tight tracking-tight">DecisionOS</div>
          <div class="text-[11px] text-slate-500 leading-tight truncate max-w-[9rem]">${org?.name ?? "…"}</div>
        </div>
      </button>

      <div class="px-3 mb-3">
        <button onClick=${() => onNavigate("/app/experiments/new")}
          class="sk-btn sk-btn-primary flex w-full items-center justify-center gap-1.5 rounded-lg text-white text-sm font-medium px-4 py-2.5">
          <${Icon} name="plus" size=${16} /> ${t("shell.newResearch")}
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        ${NAV.map((item) => {
          const active = currentPath === item.path || currentPath.startsWith(item.path + "/");
          return html`
            <button
              key=${item.id}
              onClick=${() => onNavigate(item.path)}
              data-active=${active}
              class=${`sk-nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                active ? "text-indigo-300" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <${Icon} name=${item.icon} size=${17} />
              ${t(item.key)}
            </button>
          `;
        })}

        <div class="pt-4 pb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">${t("shell.workspaceLabel")}</div>
        ${WORKSPACE_NAV.map((item) => {
          const active = currentPath === item.path || currentPath.startsWith(item.path + "/");
          return html`
            <button
              key=${item.id}
              onClick=${() => onNavigate(item.path)}
              data-active=${active}
              class=${`sk-nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                active ? "text-indigo-300" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <${Icon} name=${item.icon} size=${17} />
              ${t(item.key)}
            </button>
          `;
        })}
      </nav>

      <div class="border-t border-black/40 py-3">
        <${UserMenu} onNavigate=${onNavigate} />
      </div>
    </div>
  `;
}

function NotificationsMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);
  return html`
    <div class="relative" ref=${ref}>
      <button class="sk-btn h-8 w-8 rounded-lg text-slate-400 hover:text-slate-200" onClick=${() => setOpen((v) => !v)}><${Icon} name="bell" size=${17} /></button>
      ${open && html`
        <div class="sk-modal absolute right-0 top-full mt-2 z-40 w-72 rounded-xl fade-in">
          <div class="px-4 py-3 border-b border-black/40 text-sm font-medium text-slate-200">${t("shell.notifications.title")}</div>
          <div class="px-4 py-8 text-center text-sm text-slate-500">${t("shell.notifications.empty")}</div>
        </div>
      `}
    </div>
  `;
}

function LanguageSwitch() {
  const locale = useLocale();
  const { profile } = useMyProfile();
  const [pending, setPending] = useState(false);

  async function choose(id) {
    if (id === locale || pending) return;
    setLocale(id); // local + immediate -- the UI updates now, regardless of auth/DB state
    if (!profile) return; // not signed in (or profile still loading) -- nothing to persist
    setPending(true);
    try {
      await updateMyProfile({ locale: id });
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setPending(false);
    }
  }
  return html`
    <div class="sk-tabs flex items-center rounded-lg p-0.5 text-xs font-medium">
      ${LOCALES.map((l) => html`
        <button key=${l.id} disabled=${pending} data-active=${locale === l.id} onClick=${() => choose(l.id)}
          class=${`sk-tab px-2 py-1 rounded-md disabled:opacity-50 ${locale === l.id ? "text-white" : "text-slate-500 hover:text-slate-300"}`}>${l.label}</button>
      `)}
    </div>
  `;
}

export function Shell({ currentPath, children }) {
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { experiments } = useExperiments();
  const activeCount = experiments.filter((e) => e.status === "published").length;

  const onNavigate = (path) => { setMobileOpen(false); navigate(path); };

  function onSearchSubmit(e) {
    e.preventDefault();
    if (search.trim()) navigate(`/app/experiments?q=${encodeURIComponent(search.trim())}`);
  }

  return html`
    <div class="min-h-screen bg-slate-950 text-slate-100">
      <!-- Desktop sidebar -->
      <aside class="sk-sidebar hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <${SidebarContent} currentPath=${currentPath} onNavigate=${onNavigate} />
      </aside>

      <!-- Mobile sidebar -->
      ${mobileOpen && html`
        <div class="fixed inset-0 z-40 lg:hidden">
          <div class="absolute inset-0 bg-black/70" onClick=${() => setMobileOpen(false)}></div>
          <aside class="sk-sidebar absolute inset-y-0 left-0 w-64">
            <${SidebarContent} currentPath=${currentPath} onNavigate=${onNavigate} />
          </aside>
        </div>
      `}

      <div class="lg:pl-64">
        <header class="sk-topbar sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <button class="sk-btn lg:hidden h-9 w-9 rounded-lg text-slate-400 shrink-0" onClick=${() => setMobileOpen(true)}><${Icon} name="menu" size=${19} /></button>
            <form onSubmit=${onSearchSubmit} class="sk-display hidden sm:flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-400 w-72">
              <${Icon} name="search" size=${15} className="shrink-0" />
              <input value=${search} onInput=${(e) => setSearch(e.target.value)} placeholder=${t("shell.searchPlaceholder")}
                class="bg-transparent outline-none placeholder:text-slate-500 w-full text-slate-200" />
            </form>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <${LanguageSwitch} />
            <span class="sk-badge hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> ${t("shell.activeCount", { count: activeCount })}
            </span>
            <${NotificationsMenu} />
            <button onClick=${() => navigate("/profile")} class="lg:hidden">
              <${Avatar} size=${30} />
            </button>
          </div>
        </header>
        <main class="px-4 py-6 lg:px-8 lg:py-8 max-w-[1400px]">
          ${children}
        </main>
      </div>
    </div>
  `;
}
