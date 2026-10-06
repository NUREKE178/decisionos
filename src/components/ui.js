import { html } from "../lib/preact.js";
import { Icon } from "./icons.js";

export function Card({ className = "", children, ...rest }) {
  return html`<div class=${`rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm ${className}`} ...${rest}>${children}</div>`;
}

export function SectionHeading({ title, subtitle, action }) {
  return html`
    <div class="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h2 class="text-lg font-semibold text-slate-100">${title}</h2>
        ${subtitle && html`<p class="text-sm text-slate-400 mt-0.5">${subtitle}</p>`}
      </div>
      ${action && html`<div class="shrink-0">${action}</div>`}
    </div>
  `;
}

const BUTTON_VARIANTS = {
  primary: "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20",
  secondary: "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700",
  ghost: "bg-transparent hover:bg-slate-800 text-slate-300",
  danger: "bg-rose-500/90 hover:bg-rose-500 text-white",
  outline: "bg-transparent border border-slate-700 hover:border-slate-500 text-slate-200",
};

export function Button({ variant = "primary", size = "md", className = "", children, disabled, ...rest }) {
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm", lg: "px-5 py-2.5 text-base" };
  return html`
    <button
      class=${`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${sizes[size]} ${className}`}
      disabled=${disabled}
      ...${rest}
    >${children}</button>
  `;
}

const BADGE_TONES = {
  slate: "bg-slate-800 text-slate-300 border-slate-700",
  indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  teal: "bg-teal-500/15 text-teal-300 border-teal-500/30",
};

export function Badge({ tone = "slate", className = "", children }) {
  return html`<span class=${`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}>${children}</span>`;
}

export function DemoTag({ className = "" }) {
  return html`<${Badge} tone="amber" className=${className}>Demo data · illustrative<//>`;
}

export function StatTile({ label, value, hint, tone = "slate" }) {
  return html`
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div class="text-xs font-medium uppercase tracking-wide text-slate-500">${label}</div>
      <div class="mt-1.5 text-2xl font-semibold text-slate-50">${value}</div>
      ${hint && html`<div class="mt-1 text-xs text-slate-500">${hint}</div>`}
    </div>
  `;
}

export function ProgressBar({ value, tone = "indigo" }) {
  const colors = { indigo: "bg-indigo-500", emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500", teal: "bg-teal-500" };
  const pctVal = Math.max(0, Math.min(1, value ?? 0)) * 100;
  return html`
    <div class="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
      <div class=${`h-full rounded-full ${colors[tone] ?? colors.indigo}`} style=${{ width: `${pctVal}%` }}></div>
    </div>
  `;
}

export function EmptyState({ title, body, action, icon = "sparkle" }) {
  return html`
    <div class="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-slate-800">
      <div class="mb-3 text-slate-600"><${Icon} name=${icon} size=${30} strokeWidth=${1.4} /></div>
      <h3 class="text-base font-semibold text-slate-200">${title}</h3>
      ${body && html`<p class="text-sm text-slate-500 mt-1.5 max-w-sm">${body}</p>`}
      ${action && html`<div class="mt-5">${action}</div>`}
    </div>
  `;
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  if (!open) return null;
  return html`
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" onClick=${(e) => e.target === e.currentTarget && onClose?.()}>
      <div class=${`w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl`}>
        <div class="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 class="font-semibold text-slate-100">${title}</h3>
          <button class="text-slate-500 hover:text-slate-200" onClick=${onClose}>✕</button>
        </div>
        <div class="px-5 py-4">${children}</div>
        ${footer && html`<div class="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">${footer}</div>`}
      </div>
    </div>
  `;
}

export function Tabs({ tabs, active, onChange }) {
  return html`
    <div class="flex gap-1 rounded-lg bg-slate-900 border border-slate-800 p-1 w-fit overflow-x-auto">
      ${tabs.map(
        (t) => html`
          <button
            key=${t.id}
            onClick=${() => onChange(t.id)}
            class=${`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active === t.id ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >${t.label}</button>
        `
      )}
    </div>
  `;
}

const CONFIDENCE_LABEL = { high: "High confidence", moderate: "Moderate confidence", "low-moderate": "Low-moderate confidence", low: "Low confidence", none: "No data yet" };
const CONFIDENCE_TONE = { high: "emerald", moderate: "teal", "low-moderate": "amber", low: "amber", none: "slate" };

export function ConfidenceBadge({ confidence }) {
  return html`<${Badge} tone=${CONFIDENCE_TONE[confidence] ?? "slate"}>${CONFIDENCE_LABEL[confidence] ?? confidence}<//>`;
}

export function Field({ label, hint, children, required }) {
  return html`
    <label class="block mb-4">
      <span class="block text-sm font-medium text-slate-300 mb-1.5">${label}${required && html`<span class="text-rose-400"> *</span>`}</span>
      ${children}
      ${hint && html`<span class="block text-xs text-slate-500 mt-1">${hint}</span>`}
    </label>
  `;
}

const inputBase = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed";

export function TextInput({ className = "", ...rest }) {
  return html`<input class=${`${inputBase} ${className}`} ...${rest} />`;
}

export function TextArea({ className = "", ...rest }) {
  return html`<textarea class=${`${inputBase} min-h-[88px] resize-y ${className}`} ...${rest}></textarea>`;
}

export function Select({ options, className = "", ...rest }) {
  return html`
    <select class=${`${inputBase} ${className}`} ...${rest}>
      ${options.map((o) => html`<option key=${o.value ?? o} value=${o.value ?? o}>${o.label ?? o}</option>`)}
    </select>
  `;
}

export function Checkbox({ label, className = "", ...rest }) {
  return html`
    <label class="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer select-none py-1">
      <input type="checkbox" class=${`h-4 w-4 rounded border-slate-600 bg-slate-950 text-indigo-500 focus:ring-indigo-500 ${className}`} ...${rest} />
      ${label}
    </label>
  `;
}

export function Switch({ checked, onChange, label }) {
  return html`
    <label class="flex items-center justify-between gap-3 py-2 cursor-pointer select-none">
      <span class="text-sm text-slate-300">${label}</span>
      <button
        type="button"
        onClick=${() => onChange(!checked)}
        class=${`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-indigo-500" : "bg-slate-700"}`}
      >
        <span class=${`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`}></span>
      </button>
    </label>
  `;
}

let toastRoot = null;
export function setToastRoot(fn) { toastRoot = fn; }
export function toast(message, tone = "slate") { toastRoot?.(message, tone); }
