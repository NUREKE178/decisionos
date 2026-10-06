import { html, useState } from "../lib/preact.js";
import { useStore, deleteExperiment, addExperiment } from "../lib/store.js";
import { navigate } from "../router.js";
import { Card, SectionHeading, Badge, DemoTag, Button, EmptyState, Tabs } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { experimentSummary } from "../lib/stats.js";
import { pct, relativeDate } from "../lib/format.js";
import { researchTypeLabel } from "../lib/questionTypes.js";
import { uid } from "../lib/prng.js";

const STATUS_TONE = { active: "emerald", completed: "indigo", draft: "slate", paused: "amber" };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "draft", label: "Draft" },
  { id: "paused", label: "Paused" },
];

export function ExperimentsList() {
  const experiments = useStore((s) => s.experiments);
  const participants = useStore((s) => s.participants);
  const [filter, setFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = filter === "all" ? experiments : experiments.filter((e) => e.status === filter);
  const sorted = filtered.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  function duplicate(e) {
    const copy = {
      ...e,
      id: uid("exp"),
      name: `${e.name} (copy)`,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: false,
    };
    addExperiment(copy);
    navigate(`/app/experiments/${copy.id}/edit`);
  }

  return html`
    <div class="fade-in">
      <${SectionHeading}
        title="Experiments"
        subtitle="Create, publish and manage your consumer research studies."
        action=${html`<${Button} onClick=${() => navigate("/app/experiments/new")}><${Icon} name="plus" size=${16}/> New experiment<//>`}
      />
      <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <${Tabs} tabs=${FILTERS} active=${filter} onChange=${setFilter} />
        <${DemoTag} />
      </div>

      ${sorted.length === 0
        ? html`<${EmptyState} title="No experiments here" body="Try a different filter, or create a new experiment." icon="experiments"
            action=${html`<${Button} onClick=${() => navigate("/app/experiments/new")}>Create experiment<//>`} />`
        : html`
          <div class="space-y-3">
            ${sorted.map((e) => {
              const summary = experimentSummary(e, participants);
              return html`
                <${Card} key=${e.id} className="p-4 sm:p-5">
                  <div class="flex flex-wrap items-start justify-between gap-4">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <button class="font-semibold text-slate-100 hover:text-indigo-300 text-left" onClick=${() => navigate(e.status === "draft" ? `/app/experiments/${e.id}/edit` : `/app/experiments/${e.id}/results`)}>${e.name}</button>
                        <${Badge} tone=${STATUS_TONE[e.status]}>${e.status}<//>
                        ${e.isDemo && html`<${Badge} tone="amber">demo<//>`}
                      </div>
                      <p class="text-sm text-slate-500 mt-1 max-w-2xl">${e.objective}</p>
                      <div class="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
                        <span>${researchTypeLabel(e.researchType)}</span>
                        <span>${e.variants.length} variants</span>
                        <span>${e.questions.length} questions</span>
                        <span>Updated ${relativeDate(e.updatedAt)}</span>
                      </div>
                    </div>

                    <div class="flex flex-col items-end gap-2 shrink-0">
                      <div class="text-right">
                        <div class="text-sm font-semibold text-slate-100">${summary.participantCount}/${e.participantSettings.targetCount}</div>
                        <div class="text-xs text-slate-500">participants · ${pct(summary.completion.rate)} completion</div>
                      </div>
                      <div class="flex items-center gap-1.5">
                        ${e.status === "draft"
                          ? html`<${Button} size="sm" variant="secondary" onClick=${() => navigate(`/app/experiments/${e.id}/edit`)}><${Icon} name="edit" size=${14}/> Edit<//>`
                          : html`<${Button} size="sm" variant="secondary" onClick=${() => navigate(`/app/experiments/${e.id}/results`)}><${Icon} name="results" size=${14}/> Results<//>`}
                        <button title="Preview participant experience" class="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800" onClick=${() => navigate(`/app/experiments/${e.id}/preview`)}><${Icon} name="play" size=${15} /></button>
                        <button title="Duplicate" class="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800" onClick=${() => duplicate(e)}><${Icon} name="copy" size=${15} /></button>
                        <button title="Delete" class="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800" onClick=${() => setConfirmDelete(e)}><${Icon} name="trash" size=${15} /></button>
                      </div>
                    </div>
                  </div>
                <//>
              `;
            })}
          </div>
        `}

      ${confirmDelete && html`
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick=${(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
          <${Card} className="max-w-sm p-5">
            <div class="font-semibold text-slate-100">Delete "${confirmDelete.name}"?</div>
            <p class="text-sm text-slate-500 mt-1.5">This removes the experiment and all its participant responses. This cannot be undone.</p>
            <div class="flex justify-end gap-2 mt-5">
              <${Button} variant="secondary" size="sm" onClick=${() => setConfirmDelete(null)}>Cancel<//>
              <${Button} variant="danger" size="sm" onClick=${() => { deleteExperiment(confirmDelete.id); setConfirmDelete(null); }}>Delete<//>
            </div>
          <//>
        </div>
      `}
    </div>
  `;
}
