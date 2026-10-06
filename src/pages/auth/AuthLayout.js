import { html } from "../../lib/preact.js";
import { navigate } from "../../router.js";
import { Icon } from "../../components/icons.js";

export function AuthLayout({ title, subtitle, children, footer }) {
  return html`
    <div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6 py-10">
      <div class="w-full max-w-sm">
        <button onClick=${() => navigate("/")} class="flex items-center gap-2.5 mb-8 mx-auto">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white"><${Icon} name="logo" size=${18} strokeWidth=${2} /></div>
          <span class="font-semibold text-lg">DecisionOS</span>
        </button>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7 fade-in">
          <h1 class="text-lg font-semibold text-slate-50">${title}</h1>
          ${subtitle && html`<p class="text-sm text-slate-400 mt-1.5">${subtitle}</p>`}
          <div class="mt-6">${children}</div>
        </div>
        ${footer && html`<div class="text-center mt-5 text-sm text-slate-500">${footer}</div>`}
      </div>
    </div>
  `;
}

export function AuthError({ message }) {
  if (!message) return null;
  return html`<div class="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">${message}</div>`;
}

export function AuthSuccess({ message }) {
  if (!message) return null;
  return html`<div class="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">${message}</div>`;
}
