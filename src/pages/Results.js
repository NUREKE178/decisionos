import { html, useState, useMemo } from "../lib/preact.js";
import { useStore } from "../lib/store.js";
import { navigate } from "../router.js";
import { Card, SectionHeading, StatTile, Badge, DemoTag, Select, Button, EmptyState } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { BarChart, DonutChart } from "../components/charts.js";
import {
  completedParticipants, experimentSummary, statsForQuestion, segmentBreakdown, responseTimeFor, primarySelectionQuestion,
} from "../lib/stats.js";
import { pct, pts, num, durationFromMs, money } from "../lib/format.js";
import { researchTypeLabel } from "../lib/questionTypes.js";

const SEGMENT_OPTIONS = [{ value: "ageRange", label: "Age range" }, { value: "country", label: "Country" }, { value: "language", label: "Language" }];
const VARIANT_COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ec4899"];

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

function QuestionCard({ experiment, participants, question, index }) {
  const result = statsForQuestion(experiment, participants, question);
  return html`
    <${Card} className="p-5">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div>
          <div class="text-xs text-slate-500 mb-1">Q${index + 1} · ${question.type.replace("_", " ")}${question.role ? ` · ${question.role}` : ""}</div>
          <div class="font-medium text-slate-100">${question.prompt || "(untitled question)"}</div>
        </div>
      </div>

      ${result.kind === "choice" && html`
        <div class="grid sm:grid-cols-2 gap-5">
          <${BarChart}
            labels=${result.data.rows.map((r) => `${r.label}`)}
            data=${result.data.rows.map((r) => Math.round(r.rate * 1000) / 10)}
            colors=${result.data.rows.map((r) => r.color)}
            height=${180}
          />
          <div class="space-y-2">
            ${result.data.rows.map(
              (r) => html`
                <div key=${r.variantId} class="flex items-center justify-between text-sm border-b border-slate-800/60 pb-2 last:border-0">
                  <span class="text-slate-300">${r.label} — ${r.name}</span>
                  <span class="text-slate-400">${pct(r.rate)} <span class="text-slate-600">(CI ${pct(r.ci[0])}–${pct(r.ci[1])})</span></span>
                </div>
              `
            )}
            ${!result.data.sufficient && html`<p class="text-xs text-amber-400 mt-1">${result.data.message}</p>`}
          </div>
        </div>
      `}

      ${result.kind === "rating" && html`
        <${BarChart}
          labels=${result.data.map((r) => r.label ?? r.name)}
          data=${result.data.map((r) => r.mean ? Math.round(r.mean * 100) / 100 : 0)}
          colors=${VARIANT_COLORS}
          suffix=""
          height=${180}
        />
        <div class="flex gap-5 mt-3 text-xs text-slate-500 flex-wrap">
          ${result.data.map((r) => html`<span key=${r.variantId ?? r.name}>${r.label ?? r.name}: mean ${num(r.mean, 2)}, median ${num(r.median, 1)} (n=${r.n})</span>`)}
        </div>
      `}

      ${result.kind === "yesno" && html`
        <div class="space-y-2">
          ${result.data.map(
            (r) => html`
              <div key=${r.variantId ?? "overall"} class="flex items-center justify-between text-sm">
                <span class="text-slate-300">${r.label ? `${r.label} — ${r.name}` : "Yes"}</span>
                <span class="text-slate-400">${pct(r.rate)} yes (n=${r.n})</span>
              </div>
            `
          )}
        </div>
      `}

      ${result.kind === "ranking" && html`
        <div class="space-y-2">
          ${result.data.map(
            (r, i) => html`
              <div key=${r.variantId} class="flex items-center justify-between text-sm">
                <span class="text-slate-300">#${i + 1} ${r.label} — ${r.name}</span>
                <span class="text-slate-400">avg. rank ${num(r.avgRank, 2)} (n=${r.n})</span>
              </div>
            `
          )}
        </div>
      `}

      ${result.kind === "distribution" && html`
        <${BarChart}
          labels=${result.data.rows.map((r) => r.option)}
          data=${result.data.rows.map((r) => Math.round(r.rate * 1000) / 10)}
          colors=${result.data.rows.map((_, i) => VARIANT_COLORS[i % VARIANT_COLORS.length])}
          horizontal=${true}
          height=${Math.max(140, result.data.rows.length * 34)}
        />
      `}

      ${result.kind === "price" && html`
        ${result.data.rows
          ? html`<${BarChart} labels=${result.data.rows.map((r) => r.option)} data=${result.data.rows.map((r) => Math.round(r.rate * 1000) / 10)} colors=${VARIANT_COLORS} height=${160} />`
          : html`<p class="text-sm text-slate-400">Mean expected price: ${money(result.data.mean)} · Median: ${money(result.data.median)} (n=${result.data.n})</p>`}
      `}

      ${result.kind === "text" && html`
        <div class="flex flex-wrap gap-2">
          ${result.data.length === 0
            ? html`<p class="text-sm text-slate-500">No responses yet.</p>`
            : result.data.slice(0, 24).map((t, i) => html`<span key=${i} class="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">"${t}"</span>`)}
        </div>
      `}
    <//>
  `;
}

export function Results({ params }) {
  const experiments = useStore((s) => s.experiments);
  const participants = useStore((s) => s.participants);
  const eligible = experiments.filter((e) => e.status !== "draft");
  const [selectedId, setSelectedId] = useState(params?.id ?? eligible[0]?.id ?? null);
  const [segmentKey, setSegmentKey] = useState("ageRange");

  const experiment = useMemo(() => experiments.find((e) => e.id === (params?.id ?? selectedId)), [experiments, params?.id, selectedId]);
  const experimentParticipants = useMemo(() => participants.filter((p) => p.experimentId === experiment?.id), [participants, experiment]);
  const completed = useMemo(() => completedParticipants(experimentParticipants), [experimentParticipants]);

  if (eligible.length === 0) {
    return html`<${EmptyState} title="No results yet" body="Publish an experiment to start collecting participant responses." icon="results"
      action=${html`<${Button} onClick=${() => navigate("/app/experiments/new")}>Create experiment<//>`} />`;
  }
  if (!experiment) {
    return html`<${EmptyState} title="Experiment not found" body="It may have been deleted." icon="results" />`;
  }

  const summary = experimentSummary(experiment, participants);
  const selQ = primarySelectionQuestion(experiment);
  const segments = selQ ? segmentBreakdown(experiment, completed, selQ.id, segmentKey) : [];
  const rt = selQ ? responseTimeFor(completed, selQ.id) : null;

  return html`
    <div class="fade-in">
      <${SectionHeading}
        title="Results"
        subtitle="Statistical analysis of collected responses."
        action=${!params?.id && html`<${ExperimentPicker} experiments=${eligible} selectedId=${experiment.id} onChange=${setSelectedId} />`}
      />

      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <span class="font-medium text-slate-200">${experiment.name}</span>
        <${Badge} tone=${experiment.status === "active" ? "emerald" : "indigo"}>${experiment.status}<//>
        <span class="text-sm text-slate-500">${researchTypeLabel(experiment.researchType)}</span>
        ${experiment.isDemo && html`<${DemoTag} />`}
        <button class="ml-auto text-sm text-indigo-400 hover:text-indigo-300" onClick=${() => navigate(`/app/experiments/${experiment.id}/insights`)}>View AI insights →</button>
      </div>

      ${!summary.sampleSize.sufficient && html`
        <div class="mb-5 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <${Icon} name="shield" size=${16} /> Insufficient sample size for a reliable conclusion (n=${summary.sampleSize.n}, recommended minimum ${summary.sampleSize.threshold}).
        </div>
      `}

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <${StatTile} label="Completed participants" value=${summary.participantCount} hint=${`of ${experiment.participantSettings.targetCount} target`} />
        <${StatTile} label="Completion rate" value=${pct(summary.completion.rate)} hint=${`${summary.completion.total} started`} />
        <${StatTile} label="Avg. completion time" value=${durationFromMs(summary.avgCompletionTimeMs)} />
        <${StatTile} label="Avg. decision time" value=${rt ? durationFromMs(rt.meanMs) : "—"} hint="Time to answer the primary question" />
      </div>

      <div class="space-y-5">
        ${experiment.questions.map((q, i) => html`<${QuestionCard} key=${q.id} experiment=${experiment} participants=${completed} question=${q} index=${i} />`)}

        <${Card} className="p-5">
          <${SectionHeading}
            title="Segment comparison"
            subtitle="Primary selection question, broken down by participant segment"
            action=${html`<${Select} className="w-auto" options=${SEGMENT_OPTIONS} value=${segmentKey} onChange=${(e) => setSegmentKey(e.target.value)} />`}
          />
          <div class="space-y-4">
            ${segments.map(
              (seg) => html`
                <div key=${seg.segment}>
                  <div class="flex items-center justify-between text-sm mb-1.5">
                    <span class="text-slate-300 font-medium">${seg.segment}</span>
                    <span class="text-slate-500">n=${seg.n}${!seg.sufficient ? " · small sample" : ""}</span>
                  </div>
                  <div class="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    ${seg.rows.map((r) => html`<div key=${r.variantId} style=${{ width: `${r.rate * 100}%`, background: r.color }} title=${`${r.label}: ${pct(r.rate)}`}></div>`)}
                  </div>
                </div>
              `
            )}
          </div>
        <//>
      </div>
    </div>
  `;
}
