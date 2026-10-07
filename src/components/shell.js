import { html, useState, useEffect, useRef } from "../lib/preact.js";
import { navigate } from "../router.js";
import { Icon } from "./icons.js";
import { useCurrentOrg } from "../lib/currentOrg.js";
import { useExperiments } from "../lib/experimentsStore.js";
import { useSession, signOut } from "../lib/auth.js";
import { useMyProfile, updateMyProfile } from "../lib/profile.js";
import { toast } from "./ui.js";

const NAV = [
  { id: "overview", label: "Обзор", icon: "overview", path: "/app/overview" },
  { id: "experiments", label: "Исследования", icon: "experiments", path: "/app/experiments" },
  { id: "participants", label: "Участники", icon: "participants", path: "/app/participants" },
  { id: "results", label: "Результаты", icon: "results", path: "/app/results" },
  { id: "insights", label: "Инсайты", icon: "insights", path: "/app/insights" },
  { id: "reports", label: "Отчёты", icon: "reports", path: "/app/reports" },
];

const WORKSPACE_NAV = [
  { id: "team", label: "Команда", icon: "team", path: "/app/team" },
  { id: "billing", label: "Биллинг", icon: "card", path: "/app/billing" },
  { id: "profile", label: "Профиль", icon: "user", path: "/profile" },
  { id: "settings", label: "Настройки", icon: "settings", path: "/app/settings" },
];

const LOCALES = [
  { id: "ru", label: "RU" },
  { id: "kk", label: "KZ" },
  { id: "en", label: "EN" },
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
    <div ref=${ref} class=${`absolute ${align === "right" ? "right-0" : "left-0"} bottom-full mb-2 z-40 w-56 rounded-xl border border-slate-800 bg-slate-900 shadow-xl py-1.5 fade-in`}>
      ${children}
    </div>
  `;
}

function MenuItem({ icon, label, onClick, danger = false }) {
  return html`
    <button onClick=${onClick}
      class=${`flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors ${danger ? "text-rose-400 hover:bg-rose-500/10" : "text-slate-300 hover:bg-slate-800"}`}>
      <${Icon} name=${icon} size=${15} /> ${label}
    </button>
  `;
}

function UserMenu({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const { org } = useCurrentOrg();
  const { user } = useSession();
  const { profile } = useMyProfile();
  const displayName = profile?.full_name || user?.email || "";

  return html`
    <div class="relative px-3">
      <button onClick=${() => setOpen((v) => !v)} class="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 hover:bg-slate-800/70 transition-colors">
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
        <${MenuItem} icon="user" label="Профиль" onClick=${() => { setOpen(false); onNavigate("/profile"); }} />
        <${MenuItem} icon="settings" label="Настройки" onClick=${() => { setOpen(false); onNavigate("/app/settings"); }} />
        <div class="my-1 border-t border-slate-800"></div>
        <${MenuItem} icon="logout" label="Выйти" danger onClick=${async () => { setOpen(false); await signOut(); navigate("/"); }} />
      <//>
    </div>
  `;
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

      <div class="px-3 mb-3">
        <button onClick=${() => onNavigate("/app/experiments/new")}
          class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 shadow-lg shadow-indigo-500/20 transition-colors">
          <${Icon} name="plus" size=${16} /> Новое исследование
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
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

        <div class="pt-4 pb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Рабочее пространство</div>
        ${WORKSPACE_NAV.map((item) => {
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

      <div class="border-t border-slate-800/80 py-3">
        <${UserMenu} onNavigate=${onNavigate} />
      </div>
    </div>
  `;
}

function NotificationsMenu() {
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
      <button class="text-slate-400 hover:text-slate-200" onClick=${() => setOpen((v) => !v)}><${Icon} name="bell" size=${19} /></button>
      ${open && html`
        <div class="absolute right-0 top-full mt-2 z-40 w-72 rounded-xl border border-slate-800 bg-slate-900 shadow-xl fade-in">
          <div class="px-4 py-3 border-b border-slate-800 text-sm font-medium text-slate-200">Уведомления</div>
          <div class="px-4 py-8 text-center text-sm text-slate-500">Пока нет уведомлений</div>
        </div>
      `}
    </div>
  `;
}

function LanguageSwitch() {
  const { profile } = useMyProfile();
  const current = profile?.locale ?? "ru";
  async function choose(id) {
    if (id === current) return;
    try {
      await updateMyProfile({ locale: id });
      document.documentElement.lang = id;
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    }
  }
  return html`
    <div class="hidden sm:flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-xs font-medium">
      ${LOCALES.map((l) => html`
        <button key=${l.id} onClick=${() => choose(l.id)}
          class=${`px-2 py-1 rounded-md transition-colors ${current === l.id ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}>${l.label}</button>
      `)}
    </div>
  `;
}

export function Shell({ currentPath, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { experiments } = useExperiments();
  const activeCount = experiments.filter((e) => e.status === "active").length;

  const onNavigate = (path) => { setMobileOpen(false); navigate(path); };

  function onSearchSubmit(e) {
    e.preventDefault();
    if (search.trim()) navigate(`/app/experiments?q=${encodeURIComponent(search.trim())}`);
  }

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
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <button class="lg:hidden text-slate-400 shrink-0" onClick=${() => setMobileOpen(true)}><${Icon} name="menu" size=${22} /></button>
            <form onSubmit=${onSearchSubmit} class="hidden sm:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-400 w-72 focus-within:border-slate-600">
              <${Icon} name="search" size=${15} className="shrink-0" />
              <input value=${search} onInput=${(e) => setSearch(e.target.value)} placeholder="Поиск исследований…"
                class="bg-transparent outline-none placeholder:text-slate-500 w-full text-slate-200" />
            </form>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <${LanguageSwitch} />
            <span class="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> ${activeCount} активных
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
