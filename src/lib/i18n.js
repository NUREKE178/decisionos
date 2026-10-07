import { useState, useEffect } from "./preact.js";
import ru from "./locales/ru.js";
import kk from "./locales/kk.js";
import en from "./locales/en.js";

export const LOCALES = [
  { id: "ru", label: "RU" },
  { id: "kk", label: "KZ" },
  { id: "en", label: "EN" },
];

const DICTS = { ru, kk, en };
const STORAGE_KEY = "decisionos_locale";
const DEFAULT_LOCALE = "ru";

function detectInitialLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DICTS[stored]) return stored;
  } catch { /* localStorage unavailable (SSR-like or blocked) -- fall through */ }
  try {
    const nav = (navigator.language || "").slice(0, 2).toLowerCase();
    if (nav === "kk" || nav === "kz") return "kk";
    if (nav === "en") return "en";
  } catch { /* navigator unavailable */ }
  return DEFAULT_LOCALE;
}

let state = { locale: detectInitialLocale() };
const listeners = new Set();
function notify() {
  for (const l of listeners) l();
}

export function getLocale() {
  return state.locale;
}

/** Explicit, user-driven language switch -- always wins, persists locally
 * so it survives reloads and applies even to a visitor who never signs in
 * (public landing page, a participant on a /research/:slug link, etc). */
export function setLocale(id) {
  if (!DICTS[id] || id === state.locale) return;
  state = { locale: id };
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* best-effort persistence only */ }
  try { document.documentElement.lang = id; } catch { /* non-browser context */ }
  notify();
}

/** Called once a signed-in user's profile is known (e.g. right after
 * useMyProfile() resolves), to adopt their saved account preference --
 * but only when this browser has no explicit choice of its own yet.
 * A locale picked in *this* browser (localStorage) is more specific than
 * "whatever the account was last set to on some other device", so it's
 * never overridden by this call. */
export function adoptProfileLocale(id) {
  try { if (localStorage.getItem(STORAGE_KEY)) return; } catch { /* fall through and adopt anyway */ }
  if (DICTS[id] && id !== state.locale) {
    state = { locale: id };
    try { document.documentElement.lang = id; } catch { /* non-browser context */ }
    notify();
  }
}

function lookup(dict, path) {
  return path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), dict);
}

/** Plain (non-reactive) translator with an explicit locale -- for use
 * outside component render (lib/insights.js, lib/experiments report
 * builder) and for text that must follow something other than the current
 * app locale, like participant-facing copy, which follows the experiment's
 * own configured language rather than the researcher's own account. */
export function t(locale, key, vars) {
  let str = lookup(DICTS[locale] ?? DICTS[DEFAULT_LOCALE], key);
  if (str == null) str = lookup(DICTS[DEFAULT_LOCALE], key);
  if (str == null) return key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
  }
  return str;
}

/** Subscribes the calling component to locale changes (so it re-renders
 * when the language switches) and returns the current locale id. */
export function useLocale() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    listener(); // re-sync in case the locale changed between this render and this effect committing
    return () => listeners.delete(listener);
  }, []);
  return state.locale;
}

/** The hook most components should use: subscribes to locale changes and
 * returns a t(key, vars) bound to the current app locale. */
export function useT() {
  const locale = useLocale();
  return (key, vars) => t(locale, key, vars);
}
