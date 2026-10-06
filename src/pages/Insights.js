import { html, useState, useMemo } from "../lib/preact.js";
import { useStore } from "../lib/store.js";
import { navigate } from "../router.js";
import { Card, SectionHeading, Badge, DemoTag, Select, Button, EmptyState, ConfidenceBadge } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { generateInsights } from "../lib/insights.js";
import { researchTypeLabel } from "../lib/questionTypes.js";

function ExperimentPicker({ experiments, selectedId, onChange }) {
  return html`
    <${Select}
      className="w-auto min-w-[260px]"
      options=${experiments.map((e) => ({ value: e.id, label: `${e.name} (${e.status})` }))}
      value=${selectedId}
      onChange=${(e) => onChange(e.target.value)}
    />
  `;
}

export function Insights({ params }) {
  const experiments = useStore((s) => s.experiments);
  const participants = useStore((s) => s.participants);
  const eligible = experiments.filter((e) => e.status !== "draft");
  const [selectedId, setSelectedId] = useState(params?.id ?? eligible[0]?.id ?? null);

  const experiment = useMemo(() => experiments.find((e) => e.id === (params?.id ?? selectedId)), [experiments, params?.id, selectedId]);
  const insights = useMemo(() => (experiment ? generateInsights(experiment, participants) : null), [experiment, participants]);

  if (eligible.length === 0) {
    return html`<${EmptyState} title="No insights yet" body="Publish an experiment and collect responses to generate AI insights." icon="insights"
      action=${html`<${Button} onClick=${() => navigate("/app/experiments/new")}>Create experiment<//>`} />`;
  }
  if (!experiment || !insights) {
    return html`<${EmptyState} title="Experiment not found" icon="insights" />`;
  }

  return html`
    <div class="fade-in max-w-3xl">
      <${SectionHeading}
        title="Insights"
        subtitle="AI-generated research interpretation — predictions and estimates, not certainties."
        action=${!params?.id && html`<${ExperimentPicker} experiments=${eligible} selectedId=${experiment.id} onChange=${setSelectedId} />`}
      />

      <div class="flex items-center gap-2 mb-6 flex-wrap">
        <span class="font-medium text-slate-200">${experiment.name}</span>
        <${Badge} tone="indigo">${researchTypeLabel(experiment.researchType)}<//>
        ${experiment.isDemo && html`<${DemoTag} />`}
        <button class="ml-auto text-sm text-indigo-400 hover:text-indigo-300" onClick=${() => navigate(`/app/experiments/${experiment.id}/results`)}>View full results →</button>
      </div>

      <div class="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 text-xs text-amber-200/90 mb-6 flex gap-2">
        <${Icon} name="shield" size=${15} className="shrink-0 mt-0.5" />
        <span>${insights.disclaimer}</span>
      </div>

      <${Card} className="p-5 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300"><${Icon} name="results" size=${15} /></div>
          <h3 class="font-semibold text-slate-100">What happened</h3>
        </div>
        <ul class="space-y-2.5">
          ${insights.whatHappened.map((line, i) => html`<li key=${i} class="flex gap-2.5 text-sm text-slate-300"><span class="text-indigo-400 mt-0.5">•</span><span>${line}</span></li>`)}
        </ul>
      <//>

      <${Card} className="p-5 mb-5">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300"><${Icon} name="sparkle" size=${15} /></div>
          <h3 class="font-semibold text-slate-100">Why might it have happened?</h3>
        </div>
        <ul class="space-y-2.5">
          ${insights.whyMightHaveHappened.map((line, i) => html`<li key=${i} class="flex gap-2.5 text-sm text-slate-300"><span class="text-teal-400 mt-0.5">•</span><span>${line}</span></li>`)}
        </ul>
        <p class="text-xs text-slate-500 mt-4 italic">Relationships above describe associations observed in this sample. They do not establish that one factor caused another.</p>
      <//>

      <${Card} className="p-5 border-indigo-500/30 bg-indigo-500/[0.04]">
        <div class="flex items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300"><${Icon} name="check" size=${15} /></div>
            <h3 class="font-semibold text-slate-100">Decision recommendation</h3>
          </div>
          <${ConfidenceBadge} confidence=${insights.recommendation.confidence} />
        </div>
        <p class="text-sm text-slate-200 leading-relaxed">${insights.recommendation.text}</p>
      <//>
    </div>
  `;
}
