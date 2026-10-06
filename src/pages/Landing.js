import { html } from "../lib/preact.js";
import { navigate } from "../router.js";
import { Icon } from "../components/icons.js";
import { Button, Badge } from "../components/ui.js";
import { useStore } from "../lib/store.js";

const STEPS = [
  { icon: "image", title: "Stimulus", desc: "Upload the variants you want to test — packaging, ads, logos, prices, screens." },
  { icon: "experiments", title: "Controlled experiment", desc: "Randomized, counterbalanced exposure so order never decides the winner." },
  { icon: "participants", title: "Participant response", desc: "A distraction-free task flow captures real choices, not surveys about choices." },
  { icon: "clock", title: "Behavioral data", desc: "Selection, response time, recall and ranking — timestamped and structured." },
  { icon: "results", title: "Statistical analysis", desc: "Selection rates, confidence intervals, and a sample-size check, always." },
  { icon: "sparkle", title: "AI interpretation", desc: "Plain-language read of what happened and what might explain it." },
  { icon: "check", title: "Decision recommendation", desc: "A confidence-rated recommendation you can act on — or push back on." },
];

export function Landing() {
  const experiments = useStore((s) => s.experiments);
  const completed = experiments.filter((e) => e.status === "completed").length;

  return html`
    <div class="min-h-screen bg-slate-950 text-slate-100">
      <header class="flex items-center justify-between px-6 py-5 lg:px-12 max-w-7xl mx-auto">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white"><${Icon} name="logo" size=${18} strokeWidth=${2} /></div>
          <span class="font-semibold text-lg">DecisionOS</span>
        </div>
        <div class="flex items-center gap-3">
          <${Button} variant="ghost" size="sm" onClick=${() => navigate("/app/overview")}>Researcher dashboard<//>
          <${Button} variant="primary" size="sm" onClick=${() => navigate("/r/demo")}>Try a sample study<//>
        </div>
      </header>

      <section class="px-6 lg:px-12 max-w-5xl mx-auto text-center pt-14 pb-10">
        <${Badge} tone="indigo" className="mb-5">Consumer decision intelligence platform<//>
        <h1 class="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-slate-50">
          Understand <span class="text-indigo-400">why</span> people choose what they choose
        </h1>
        <p class="mt-5 text-lg text-slate-400 max-w-2xl mx-auto">
          DecisionOS turns controlled consumer experiments into evidence-based decisions —
          from stimulus to statistical analysis to a confidence-rated recommendation.
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <${Button} size="lg" onClick=${() => navigate("/app/experiments/new")}><${Icon} name="plus" size=${18}/> Create an experiment<//>
          <${Button} size="lg" variant="outline" onClick=${() => navigate("/app/overview")}>Explore the demo workspace<//>
        </div>
        <p class="mt-4 text-xs text-slate-500">${completed} demo experiments already loaded with illustrative, synthetic data — nothing to connect.</p>
      </section>

      <section class="px-6 lg:px-12 max-w-6xl mx-auto py-10">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          ${STEPS.map(
            (s, i) => html`
              <div key=${s.title} class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 relative">
                <div class="absolute top-4 right-4 text-xs text-slate-600 font-mono">${String(i + 1).padStart(2, "0")}</div>
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300 mb-3"><${Icon} name=${s.icon} size=${18} /></div>
                <div class="font-semibold text-slate-100 text-sm">${s.title}</div>
                <div class="text-xs text-slate-500 mt-1.5 leading-relaxed">${s.desc}</div>
              </div>
            `
          )}
        </div>
      </section>

      <section class="px-6 lg:px-12 max-w-4xl mx-auto py-10">
        <div class="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6">
          <div class="flex items-start gap-3">
            <${Icon} name="shield" size=${20} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div class="font-semibold text-amber-200 text-sm">What DecisionOS is — and isn't</div>
              <p class="text-sm text-slate-400 mt-1.5 leading-relaxed">
                DecisionOS analyzes behavior people actually show in a controlled task — selections, ratings, timing, recall —
                and turns it into statistical estimates and research-backed predictions. It does not read minds, does not detect
                emotions with certainty, and never claims to perfectly predict real-world behavior. Every AI-generated insight is
                labeled as a prediction, and small samples are always flagged as insufficient for a reliable conclusion.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer class="px-6 lg:px-12 max-w-6xl mx-auto py-10 text-center text-xs text-slate-600">
        DecisionOS MVP — demo workspace with synthetic, illustrative data.
      </footer>
    </div>
  `;
}
