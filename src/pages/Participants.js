import { html, useState, useMemo } from "../lib/preact.js";
import { useExperiments } from "../lib/experimentsStore.js";
import { useOrgSessions } from "../lib/participants.js";
import { Card, SectionHeading, StatTile, Badge, Select, Button } from "../components/ui.js";
import { durationFromMs, shortDate } from "../lib/format.js";

const STATUS_TONE = { completed: "emerald", in_progress: "amber", abandoned: "rose" };
const STATUS_LABEL = { completed: "завершено", in_progress: "в процессе", abandoned: "прервано" };
const PAGE_SIZE = 20;

export function Participants() {
  const { experiments } = useExperiments();
  const { sessions: participants, loading } = useOrgSessions();
  const [experimentFilter, setExperimentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

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
      <${SectionHeading} title="Участники" subtitle="Все, кто принял участие в ваших экспериментах." />

      ${loading
        ? html`<p class="text-sm text-slate-500">Загрузка…</p>`
        : html`
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <${StatTile} label="Всего участников" value=${participants.length.toLocaleString()} />
          <${StatTile} label="Завершили" value=${completedCount.toLocaleString()} />
          <${StatTile} label="В процессе" value=${inProgressCount.toLocaleString()} />
          <${StatTile} label="Прервали" value=${abandonedCount.toLocaleString()} />
        </div>

        <${Card} className="p-5">
          <div class="flex items-center gap-3 mb-4 flex-wrap">
            <${Select} className="w-auto min-w-[200px]"
              options=${[{ value: "all", label: "Все эксперименты" }, ...experiments.map((e) => ({ value: e.id, label: e.name }))]}
              value=${experimentFilter} onChange=${(e) => changeFilter(setExperimentFilter, e.target.value)} />
            <${Select} className="w-auto"
              options=${[{ value: "all", label: "Все статусы" }, { value: "completed", label: "Завершено" }, { value: "in_progress", label: "В процессе" }, { value: "abandoned", label: "Прервано" }]}
              value=${statusFilter} onChange=${(e) => changeFilter(setStatusFilter, e.target.value)} />
            <span class="text-sm text-slate-500 ml-auto">${sorted.length} участников</span>
          </div>

          <div class="overflow-x-auto -mx-5">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
                  <th class="px-5 py-2 font-medium">Эксперимент</th>
                  <th class="px-3 py-2 font-medium">Статус</th>
                  <th class="px-3 py-2 font-medium">Возраст</th>
                  <th class="px-3 py-2 font-medium">Страна</th>
                  <th class="px-3 py-2 font-medium">Язык</th>
                  <th class="px-3 py-2 font-medium">Начало</th>
                  <th class="px-3 py-2 font-medium">Длительность</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/70">
                ${pageRows.map((p) => {
                  const duration = p.completedAt ? new Date(p.completedAt).getTime() - new Date(p.startedAt).getTime() : null;
                  return html`
                    <tr key=${p.id} class="hover:bg-slate-800/30">
                      <td class="px-5 py-2.5 text-slate-200 max-w-[220px] truncate">${p.experimentName ?? "—"}</td>
                      <td class="px-3 py-2.5"><${Badge} tone=${STATUS_TONE[p.status] ?? "slate"}>${STATUS_LABEL[p.status] ?? p.status}<//></td>
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
            <span class="text-xs text-slate-500">Страница ${page + 1} из ${totalPages}</span>
            <div class="flex gap-2">
              <${Button} size="sm" variant="secondary" disabled=${page === 0} onClick=${() => setPage((p) => p - 1)}>Назад<//>
              <${Button} size="sm" variant="secondary" disabled=${page >= totalPages - 1} onClick=${() => setPage((p) => p + 1)}>Далее<//>
            </div>
          </div>
        <//>
      `}
    </div>
  `;
}
