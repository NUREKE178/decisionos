import { html, useState, useMemo } from "../lib/preact.js";
import { useStore } from "../lib/store.js";
import { Card, SectionHeading, StatTile, Badge, DemoTag, Select, Button } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { durationFromMs, shortDate } from "../lib/format.js";

const STATUS_TONE = { completed: "emerald", in_progress: "amber", abandoned: "rose" };
const PAGE_SIZE = 20;

export function Participants() {
  const experiments = useStore((s) => s.experiments);
  const participants = useStore((s) => s.participants);
  const [experimentFilter, setExperimentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  const expMap = useMemo(() => new Map(experiments.map((e) => [e.id, e])), [experiments]);

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      if (experimentFilter !== "all" && p.experimentId !== experimentFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [participants, experimentFilter, statusFilter]);

  const sorted = filtered.slice().sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const completedCount = participants.filter((p) => p.status === "completed").length;
  const abandonedCount = participants.filter((p) => p.status === "abandoned").length;
  const inProgressCount = participants.length - completedCount - abandonedCount;

  function changeFilter(setter, value) { setter(value); setPage(0); }

  return html`
    <div class="fade-in">
      <${SectionHeading} title="Participants" subtitle="Everyone who has taken part in your experiments." />
      <div class="mb-3"><${DemoTag} /></div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <${StatTile} label="Total participants" value=${participants.length.toLocaleString()} />
        <${StatTile} label="Completed" value=${completedCount.toLocaleString()} />
        <${StatTile} label="In progress" value=${inProgressCount.toLocaleString()} />
        <${StatTile} label="Abandoned" value=${abandonedCount.toLocaleString()} />
      </div>

      <${Card} className="p-5">
        <div class="flex items-center gap-3 mb-4 flex-wrap">
          <${Select} className="w-auto min-w-[200px]"
            options=${[{ value: "all", label: "All experiments" }, ...experiments.map((e) => ({ value: e.id, label: e.name }))]}
            value=${experimentFilter} onChange=${(e) => changeFilter(setExperimentFilter, e.target.value)} />
          <${Select} className="w-auto"
            options=${[{ value: "all", label: "All statuses" }, { value: "completed", label: "Completed" }, { value: "in_progress", label: "In progress" }, { value: "abandoned", label: "Abandoned" }]}
            value=${statusFilter} onChange=${(e) => changeFilter(setStatusFilter, e.target.value)} />
          <span class="text-sm text-slate-500 ml-auto">${sorted.length} participants</span>
        </div>

        <div class="overflow-x-auto -mx-5">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
                <th class="px-5 py-2 font-medium">Experiment</th>
                <th class="px-3 py-2 font-medium">Status</th>
                <th class="px-3 py-2 font-medium">Age</th>
                <th class="px-3 py-2 font-medium">Country</th>
                <th class="px-3 py-2 font-medium">Language</th>
                <th class="px-3 py-2 font-medium">Started</th>
                <th class="px-3 py-2 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/70">
              ${pageRows.map((p) => {
                const exp = expMap.get(p.experimentId);
                const duration = p.completedAt ? new Date(p.completedAt).getTime() - new Date(p.startedAt).getTime() : null;
                return html`
                  <tr key=${p.id} class="hover:bg-slate-800/30">
                    <td class="px-5 py-2.5 text-slate-200 max-w-[220px] truncate">${exp?.name ?? "—"}</td>
                    <td class="px-3 py-2.5"><${Badge} tone=${STATUS_TONE[p.status] ?? "slate"}>${p.status.replace("_", " ")}<//></td>
                    <td class="px-3 py-2.5 text-slate-400">${p.demographics?.ageRange ?? "—"}</td>
                    <td class="px-3 py-2.5 text-slate-400">${p.demographics?.country ?? "—"}</td>
                    <td class="px-3 py-2.5 text-slate-400">${p.demographics?.language ?? "—"}</td>
                    <td class="px-3 py-2.5 text-slate-400">${shortDate(p.startedAt)}</td>
                    <td class="px-3 py-2.5 text-slate-400">${duration ? durationFromMs(duration) : "—"}</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
          <span class="text-xs text-slate-500">Page ${page + 1} of ${totalPages}</span>
          <div class="flex gap-2">
            <${Button} size="sm" variant="secondary" disabled=${page === 0} onClick=${() => setPage((p) => p - 1)}>Previous<//>
            <${Button} size="sm" variant="secondary" disabled=${page >= totalPages - 1} onClick=${() => setPage((p) => p + 1)}>Next<//>
          </div>
        </div>
      <//>
    </div>
  `;
}
