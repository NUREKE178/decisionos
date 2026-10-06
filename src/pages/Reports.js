import { html, useState, useMemo } from "../lib/preact.js";
import { useStore } from "../lib/store.js";
import { navigate } from "../router.js";
import { Card, SectionHeading, Badge, DemoTag, Select, Button, EmptyState } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { experimentSummary, choiceStatsForQuestion, primarySelectionQuestion, completedParticipants } from "../lib/stats.js";
import { generateInsights } from "../lib/insights.js";
import { pct, pts, durationFromMs, shortDate } from "../lib/format.js";
import { researchTypeLabel } from "../lib/questionTypes.js";

function buildMarkdownReport(experiment, summary, choice, insights) {
  const lines = [];
  lines.push(`# ${experiment.name}`);
  lines.push("");
  lines.push(`*Research type: ${researchTypeLabel(experiment.researchType)} · Generated ${new Date().toLocaleDateString()}*`);
  if (experiment.isDemo) lines.push("\n> ⚠️ Demo data — illustrative, synthetic sample.");
  lines.push("");
  lines.push(`**Objective:** ${experiment.objective}`);
  lines.push("");
  lines.push("## Key metrics");
  lines.push(`- Completed participants: ${summary.participantCount} (of ${experiment.participantSettings.targetCount} target)`);
  lines.push(`- Completion rate: ${pct(summary.completion.rate)}`);
  lines.push(`- Sample size: ${summary.sampleSize.sufficient ? "sufficient" : "INSUFFICIENT for a reliable conclusion"} (n=${summary.sampleSize.n})`);
  lines.push("");
  if (choice) {
    lines.push("## Selection results");
    for (const row of choice.rows) {
      lines.push(`- Variant ${row.label} (${row.name}): ${pct(row.rate)} (95% CI ${pct(row.ci[0])}–${pct(row.ci[1])}, n=${row.count})`);
    }
    lines.push("");
  }
  lines.push("## AI-generated insights (predictions, not certainties)");
  lines.push("**What happened**");
  insights.whatHappened.forEach((l) => lines.push(`- ${l}`));
  lines.push("\n**Why might it have happened**");
  insights.whyMightHaveHappened.forEach((l) => lines.push(`- ${l}`));
  lines.push(`\n**Recommendation (${insights.recommendation.confidence} confidence)**\n${insights.recommendation.text}`);
  lines.push(`\n---\n${insights.disclaimer}`);
  return lines.join("\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function Reports() {
  const experiments = useStore((s) => s.experiments);
  const participants = useStore((s) => s.participants);
  const eligible = experiments.filter((e) => e.status !== "draft");
  const [selectedId, setSelectedId] = useState(eligible[0]?.id ?? null);

  const experiment = useMemo(() => experiments.find((e) => e.id === selectedId), [experiments, selectedId]);
  const completed = useMemo(() => (experiment ? completedParticipants(participants.filter((p) => p.experimentId === experiment.id)) : []), [experiment, participants]);
  const selQ = experiment ? primarySelectionQuestion(experiment) : null;
  const choice = experiment && selQ ? choiceStatsForQuestion(experiment, completed, selQ.id) : null;
  const summary = experiment ? experimentSummary(experiment, participants) : null;
  const insights = experiment ? generateInsights(experiment, participants) : null;

  if (eligible.length === 0) {
    return html`<${EmptyState} title="No reports yet" body="Publish an experiment to generate a shareable report." icon="reports"
      action=${html`<${Button} onClick=${() => navigate("/app/experiments/new")}>Create experiment<//>`} />`;
  }

  return html`
    <div class="fade-in max-w-3xl">
      <${SectionHeading}
        title="Reports"
        subtitle="A shareable summary of results and AI insights for one experiment."
        action=${html`
          <${Select} className="w-auto min-w-[240px]" options=${eligible.map((e) => ({ value: e.id, label: e.name }))} value=${selectedId} onChange=${(e) => setSelectedId(e.target.value)} />
        `}
      />

      ${experiment && html`
        <${Card} className="p-6">
          <div class="flex items-start justify-between gap-3 mb-5 flex-wrap">
            <div>
              <h3 class="text-lg font-semibold text-slate-100">${experiment.name}</h3>
              <p class="text-sm text-slate-500 mt-1">${researchTypeLabel(experiment.researchType)} · generated ${shortDate(new Date().toISOString())}</p>
            </div>
            <div class="flex items-center gap-2">
              ${experiment.isDemo && html`<${DemoTag} />`}
              <${Button} size="sm" variant="secondary" onClick=${() => downloadText(`${experiment.name.replace(/\s+/g, "-").toLowerCase()}-report.md`, buildMarkdownReport(experiment, summary, choice, insights))}>
                <${Icon} name="reports" size=${14} /> Download .md
              <//>
            </div>
          </div>

          <p class="text-sm text-slate-300 mb-5">${experiment.objective}</p>

          <div class="grid sm:grid-cols-3 gap-3 mb-6">
            <div class="rounded-lg border border-slate-800 p-3"><div class="text-xs text-slate-500">Participants</div><div class="text-lg font-semibold text-slate-100">${summary.participantCount}</div></div>
            <div class="rounded-lg border border-slate-800 p-3"><div class="text-xs text-slate-500">Completion rate</div><div class="text-lg font-semibold text-slate-100">${pct(summary.completion.rate)}</div></div>
            <div class="rounded-lg border border-slate-800 p-3"><div class="text-xs text-slate-500">Avg. time</div><div class="text-lg font-semibold text-slate-100">${durationFromMs(summary.avgCompletionTimeMs)}</div></div>
          </div>

          ${choice && html`
            <h4 class="text-sm font-semibold text-slate-200 mb-2">Selection results</h4>
            <div class="space-y-1.5 mb-6">
              ${choice.rows.map((r) => html`<div key=${r.variantId} class="flex justify-between text-sm"><span class="text-slate-300">${r.label} — ${r.name}</span><span class="text-slate-500">${pct(r.rate)} (CI ${pct(r.ci[0])}–${pct(r.ci[1])})</span></div>`)}
            </div>
          `}

          <h4 class="text-sm font-semibold text-slate-200 mb-2">Recommendation</h4>
          <div class="flex items-center gap-2 mb-2"><${Badge} tone="indigo">${insights.recommendation.confidence} confidence<//></div>
          <p class="text-sm text-slate-300">${insights.recommendation.text}</p>
          <p class="text-xs text-slate-500 mt-4 italic">${insights.disclaimer}</p>
        <//>
      `}
    </div>
  `;
}
