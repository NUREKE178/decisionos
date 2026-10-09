import { html, useState, useEffect, useRef } from "../lib/preact.js";
import { navigate } from "../router.js";
import { Icon } from "../components/icons.js";
import { Button, Badge } from "../components/ui.js";
import { useT } from "../lib/i18n.js";

const DEMO_VARIANTS = [
  { id: "A", grad: "linear-gradient(160deg,#f97316 0%,#7c2d12 100%)", accent: "#fed7aa", dot: "#f97316" },
  { id: "B", grad: "linear-gradient(160deg,#e2e8f0 0%,#64748b 100%)", accent: "#1e293b", dot: "#94a3b8" },
  { id: "C", grad: "linear-gradient(160deg,#4ade80 0%,#14532d 100%)", accent: "#dcfce7", dot: "#4ade80" },
  { id: "D", grad: "linear-gradient(160deg,#312e81 0%,#020617 100%)", accent: "#fbbf24", dot: "#818cf8" },
];

function DemoStimulus({ v, t }) {
  return html`
    <div class="sk-display rounded-xl h-32 sm:h-40 relative overflow-hidden m-1.5 mb-0">
      <div class="absolute inset-3 rounded-lg" style=${{ background: v.grad }}>
        <div class="absolute left-0 right-0 bottom-3 h-2 mx-3 rounded-full opacity-80" style=${{ background: v.accent }}></div>
      </div>
    </div>
    <div class="px-3 py-2.5">
      <div class="text-xs font-semibold text-slate-500">${t("landing.demo.variantLabel", { label: v.id })}</div>
      <div class="text-sm font-medium text-slate-100">${t(`landing.demo.variants.${v.id}`)}</div>
    </div>
  `;
}

function HomepageDemo() {
  const t = useT();
  const [phase, setPhase] = useState("intro"); // intro | q1 | q2 | done
  const [picks, setPicks] = useState({ q1: null, q2: null });
  const rootRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (phase === "done" || phase === "intro") return;
      const active = document.activeElement?.tagName;
      if (active === "INPUT" || active === "TEXTAREA") return;
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      if (idx === -1) return;
      const el = rootRef.current?.querySelectorAll("[data-demo-slot]")?.[idx];
      el?.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  function choose(qid, variantId) {
    setPicks((p) => ({ ...p, [qid]: variantId }));
    setTimeout(() => setPhase(qid === "q1" ? "q2" : "done"), 500);
  }

  function restart() {
    setPicks({ q1: null, q2: null });
    setPhase("q1");
  }

  const question = phase === "q1" ? t("landing.demo.q1Title") : t("landing.demo.q2Title");
  const pickedId = phase === "q1" ? picks.q1 : picks.q2;

  return html`
    <div ref=${rootRef} class="sk-panel rounded-2xl p-5 sm:p-8">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <${Badge} tone="amber">${t("landing.demo.badge")}<//>
        <span class="text-xs text-slate-500">${t("landing.demo.hint")}</span>
      </div>

      ${phase === "intro" && html`
        <div class="fade-in text-center max-w-md mx-auto py-6">
          <button type="button" onClick=${() => setPhase("q1")} aria-label=${t("landing.demo.intro.cta")}
            class="sk-display sk-breathe mx-auto h-20 w-20 rounded-2xl flex items-center justify-center text-amber-300 mb-6 hover:text-amber-200 transition-colors">
            <${Icon} name="play" size=${30} />
          </button>
          <h3 class="text-2xl font-semibold text-slate-50">${t("landing.demo.intro.title")}</h3>
          <p class="text-sm text-slate-400 mt-3 leading-relaxed">${t("landing.demo.intro.body")}</p>
          <div class="flex items-center justify-center gap-2 mt-5">
            ${DEMO_VARIANTS.map((v) => html`<span key=${v.id} class="h-2 w-2 rounded-full" style=${{ background: v.dot }}></span>`)}
          </div>
          <div class="mt-6">
            <${Button} size="lg" className="sk-btn-hero" onClick=${() => setPhase("q1")}><${Icon} name="play" size=${16} /> ${t("landing.demo.intro.cta")}<//>
          </div>
        </div>
      `}

      ${(phase === "q1" || phase === "q2") && html`
        <div class="fade-in" key=${phase}>
          <h3 class="text-xl sm:text-2xl font-semibold text-slate-50 text-center mb-6">${question}</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
            ${DEMO_VARIANTS.map((v) => html`
              <button key=${v.id} data-demo-slot type="button"
                data-selected=${pickedId === v.id}
                onClick=${() => choose(phase, v.id)}
                class="sk-slot text-left rounded-2xl overflow-hidden">
                <${DemoStimulus} v=${v} t=${t} />
              </button>
            `)}
          </div>
          <p class="text-center text-xs text-slate-600 mt-5">${t("landing.demo.keyboardHint")}</p>
        </div>
      `}

      ${phase === "done" && html`
        <div class="fade-in text-center max-w-md mx-auto py-4">
          <div class="sk-display mx-auto h-14 w-14 rounded-xl flex items-center justify-center text-emerald-300 mb-5"><${Icon} name="check" size=${24} /></div>
          <h3 class="text-xl font-semibold text-slate-50">${t("landing.demo.completeTitle")}</h3>
          <p class="text-sm text-slate-400 mt-3 leading-relaxed">${t("landing.demo.completeBody")}</p>
          <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
            <${Button} onClick=${() => navigate("/register")}><${Icon} name="plus" size=${16} /> ${t("landing.createResearch")}<//>
            <${Button} variant="secondary" onClick=${restart}>${t("landing.demo.restart")}<//>
          </div>
        </div>
      `}
    </div>
  `;
}

function ReportMetric({ label, value }) {
  return html`
    <div class="sk-display rounded-lg p-3">
      <div class="text-[11px] text-slate-500">${label}</div>
      <div class="text-lg font-semibold text-slate-100" style="font-variant-numeric:tabular-nums">${value}</div>
    </div>
  `;
}

function ExampleReport({ t }) {
  return html`
    <div class="sk-panel rounded-2xl p-5 sm:p-8">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h3 class="text-lg font-semibold text-slate-100">${t("landing.report.title")}</h3>
          <p class="text-sm text-slate-500 mt-1">${t("landing.report.subtitle")}</p>
        </div>
        <${Badge} tone="amber">${t("landing.report.badge")}<//>
      </div>

      <div class="sk-panel-flat rounded-xl p-5 mb-5">
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">${t("landing.report.winnerLabel")}</div>
        <div class="flex items-end gap-3 flex-wrap">
          <span class="sk-slot-label inline-flex h-9 w-9 items-center justify-center rounded-lg text-white font-bold">B</span>
          <span class="text-2xl font-semibold text-slate-50">${t("landing.report.winnerName")}</span>
          <span class="text-3xl font-semibold text-emerald-400 ml-auto" style="font-variant-numeric:tabular-nums">42%</span>
        </div>
        <div class="sk-display flex h-2.5 w-full overflow-hidden rounded-full mt-4">
          <div style="width:42%;background:linear-gradient(180deg,#34d399,#10b981);box-shadow:0 0 8px -1px rgba(16,185,129,.7)"></div>
          <div style="width:27%;background:#475569"></div>
          <div style="width:19%;background:#475569"></div>
          <div style="width:12%;background:#475569"></div>
        </div>
        <div class="text-xs text-slate-500 mt-2">${t("landing.report.sampleLine")}</div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <${ReportMetric} label=${t("landing.report.metricTrust")} value="61%" />
        <${ReportMetric} label=${t("landing.report.metricQuality")} value="58%" />
        <${ReportMetric} label=${t("landing.report.metricPremium")} value="34%" />
        <${ReportMetric} label=${t("landing.report.metricPurchase")} value="4.6/7" />
      </div>

      <div class="sk-panel-flat rounded-xl p-5">
        <div class="flex items-center gap-2 mb-3 text-indigo-300"><${Icon} name="sparkle" size=${16} /><span class="text-sm font-semibold">${t("landing.report.aiTitle")}</span></div>
        <dl class="space-y-2.5 text-sm">
          <div><dt class="text-slate-500 text-xs uppercase tracking-wide">${t("landing.report.aiObservedLabel")}</dt><dd class="text-slate-300 mt-0.5">${t("landing.report.aiObserved")}</dd></div>
          <div><dt class="text-slate-500 text-xs uppercase tracking-wide">${t("landing.report.aiInterpretationLabel")}</dt><dd class="text-slate-300 mt-0.5">${t("landing.report.aiInterpretation")}</dd></div>
          <div><dt class="text-slate-500 text-xs uppercase tracking-wide">${t("landing.report.aiLimitationLabel")}</dt><dd class="text-slate-300 mt-0.5">${t("landing.report.aiLimitation")}</dd></div>
          <div><dt class="text-slate-500 text-xs uppercase tracking-wide">${t("landing.report.aiNextStepLabel")}</dt><dd class="text-slate-300 mt-0.5">${t("landing.report.aiNextStep")}</dd></div>
        </dl>
      </div>

      <p class="text-xs text-slate-500 mt-5 leading-relaxed">${t("landing.report.winnerCaveat")}</p>
    </div>
  `;
}

export function Landing() {
  const t = useT();
  const WORKFLOW_ICONS = ["upload", "edit", "participants", "results", "insights"];
  const workflowSteps = ["s1", "s2", "s3", "s4", "s5"].map((key, i) => ({
    key, icon: WORKFLOW_ICONS[i],
    title: t(`landing.workflow.steps.${key}.title`),
    desc: t(`landing.workflow.steps.${key}.desc`),
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

      <section class="px-6 lg:px-12 max-w-4xl mx-auto text-center pt-10 pb-10">
        <h1 class="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-slate-50">${t("landing.heroTitle")}</h1>
        <p class="mt-5 text-lg text-slate-400 max-w-2xl mx-auto">${t("landing.heroSubtitle")}</p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <${Button} size="lg" onClick=${() => navigate("/register")}><${Icon} name="plus" size=${18}/> ${t("landing.createResearch")}<//>
          <${Button} size="lg" variant="outline" onClick=${() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" })}>${t("landing.ctaSecondary")}<//>
        </div>
      </section>

      <section id="demo" class="px-6 lg:px-12 max-w-3xl mx-auto py-8 scroll-mt-6">
        <${HomepageDemo} />
      </section>

      <section class="px-6 lg:px-12 max-w-6xl mx-auto py-14">
        <div class="text-center mb-10">
          <h2 class="text-2xl font-semibold text-slate-50">${t("landing.workflow.title")}</h2>
          <p class="text-sm text-slate-500 mt-2 max-w-xl mx-auto">${t("landing.workflow.subtitle")}</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          ${workflowSteps.map(
            (s, i) => html`
              <div key=${s.key} class="sk-panel-flat rounded-2xl p-5 relative">
                <div class="absolute top-4 right-4 text-xs text-slate-600 font-mono tracking-wider">${String(i + 1).padStart(2, "0")}</div>
                <div class="sk-display flex h-10 w-10 items-center justify-center rounded-lg text-indigo-300 mb-3"><${Icon} name=${s.icon} size=${18} /></div>
                <div class="font-semibold text-slate-100 text-sm">${s.title}</div>
                <div class="text-xs text-slate-500 mt-1.5 leading-relaxed">${s.desc}</div>
                ${i < workflowSteps.length - 1 && html`<div class="hidden lg:block absolute top-1/2 -right-2 text-slate-700"><${Icon} name="chevronRight" size=${14} /></div>`}
              </div>
            `
          )}
        </div>
      </section>

      <section class="px-6 lg:px-12 max-w-3xl mx-auto py-8">
        <${ExampleReport} t=${t} />
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
