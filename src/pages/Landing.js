import { html } from "../lib/preact.js";
import { navigate } from "../router.js";
import { Icon } from "../components/icons.js";
import { Button, Badge } from "../components/ui.js";
import { useT } from "../lib/i18n.js";

const STEP_ICONS = { s1: "image", s2: "experiments", s3: "participants", s4: "clock", s5: "results", s6: "sparkle", s7: "check" };

export function Landing() {
  const t = useT();
  const steps = Object.keys(STEP_ICONS).map((key) => ({
    key, icon: STEP_ICONS[key],
    title: t(`landing.steps.${key}.title`),
    desc: t(`landing.steps.${key}.desc`),
  }));

  return html`
    <div class="min-h-screen bg-slate-950 text-slate-100">
      <header class="flex items-center justify-between px-6 py-5 lg:px-12 max-w-7xl mx-auto">
        <div class="flex items-center gap-2.5">
          <div class="sk-panel-flat flex h-9 w-9 items-center justify-center rounded-lg text-indigo-300"><${Icon} name="logo" size=${18} strokeWidth=${2} /></div>
          <span class="font-semibold text-lg tracking-tight">DecisionOS</span>
        </div>
        <div class="flex items-center gap-3">
          <${Button} variant="ghost" size="sm" onClick=${() => navigate("/login")}>${t("landing.login")}<//>
          <${Button} variant="primary" size="sm" onClick=${() => navigate("/register")}>${t("landing.createResearch")}<//>
        </div>
      </header>

      <section class="px-6 lg:px-12 max-w-5xl mx-auto text-center pt-14 pb-10">
        <${Badge} tone="indigo" className="mb-5">${t("landing.badge")}<//>
        <h1 class="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-slate-50">
          ${t("landing.heroTitlePre")} <span class="text-indigo-400">${t("landing.heroTitleWhy")}</span> ${t("landing.heroTitlePost")}
        </h1>
        <p class="mt-5 text-lg text-slate-400 max-w-2xl mx-auto">${t("landing.heroSubtitle")}</p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <${Button} size="lg" onClick=${() => navigate("/register")}><${Icon} name="plus" size=${18}/> ${t("landing.createResearch")}<//>
          <${Button} size="lg" variant="outline" onClick=${() => navigate("/login")}>${t("landing.ctaSecondary")}<//>
        </div>
      </section>

      <section class="px-6 lg:px-12 max-w-6xl mx-auto py-10">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          ${steps.map(
            (s, i) => html`
              <div key=${s.key} class="sk-panel-flat rounded-2xl p-5 relative">
                <div class="absolute top-4 right-4 text-xs text-slate-600 font-mono tracking-wider">${String(i + 1).padStart(2, "0")}</div>
                <div class="sk-display flex h-10 w-10 items-center justify-center rounded-lg text-indigo-300 mb-3"><${Icon} name=${s.icon} size=${18} /></div>
                <div class="font-semibold text-slate-100 text-sm">${s.title}</div>
                <div class="text-xs text-slate-500 mt-1.5 leading-relaxed">${s.desc}</div>
              </div>
            `
          )}
        </div>
      </section>

      <section class="px-6 lg:px-12 max-w-4xl mx-auto py-10">
        <div class="sk-panel-flat rounded-2xl border-amber-500/15 p-6">
          <div class="flex items-start gap-3">
            <${Icon} name="shield" size=${20} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div class="font-semibold text-amber-200 text-sm">${t("landing.disclaimerTitle")}</div>
              <p class="text-sm text-slate-400 mt-1.5 leading-relaxed">${t("landing.disclaimerBody")}</p>
            </div>
          </div>
        </div>
      </section>

      <footer class="px-6 lg:px-12 max-w-6xl mx-auto py-10 text-center text-xs text-slate-600">
        ${t("landing.footer")}
      </footer>
    </div>
  `;
}
