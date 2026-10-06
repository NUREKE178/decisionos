import { html } from "../lib/preact.js";
import { useExperiments } from "../lib/experimentsStore.js";
import { useOrgSessions } from "../lib/participants.js";
import { navigate } from "../router.js";
import { Card, SectionHeading, StatTile, Badge, Button, EmptyState } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { DonutChart, LineChart } from "../components/charts.js";
import { experimentSummary, completedParticipants, averageCompletionTimeMs } from "../lib/stats.js";
import { pct, durationFromMs, relativeDate, shortDate } from "../lib/format.js";
import { researchTypeLabel } from "../lib/questionTypes.js";

const STATUS_TONE = { active: "emerald", completed: "indigo", draft: "slate", paused: "amber" };

function StatusBadge({ status }) {
  return html`<${Badge} tone=${STATUS_TONE[status] ?? "slate"}>${status}<//>`;
}

function dailyCompletionSeries(participants) {
  const days = 14;
  const buckets = new Array(days).fill(0);
  const now = Date.now();
  for (const p of participants) {
    if (p.status !== "completed" || !p.completedAt) continue;
    const diffDays = Math.floor((now - new Date(p.completedAt).getTime()) / 86400000);
    if (diffDays >= 0 && diffDays < days) buckets[days - 1 - diffDays]++;
  }
  const labels = buckets.map((_, i) => {
    const d = new Date(now - (days - 1 - i) * 86400000);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });
  return { labels, data: buckets };
}

export function Overview() {
  const { experiments, loading: experimentsLoading } = useExperiments();
  const { sessions: participants, loading: sessionsLoading } = useOrgSessions();

  const activeCount = experiments.filter((e) => e.status === "active").length;
  const completedCount = experiments.filter((e) => e.status === "completed").length;
  const draftCount = experiments.filter((e) => e.status === "draft").length;
  const pausedCount = experiments.filter((e) => e.status === "paused").length;

  const allCompletedParticipants = completedParticipants(participants);
  const totalStarted = participants.length;
  const responseRate = totalStarted ? allCompletedParticipants.length / totalStarted : 0;
  const avgCompletionMs = averageCompletionTimeMs(participants);

  const summaries = experiments.map((e) => ({ experiment: e, summary: experimentSummary(e, participants) }));

  const recent = summaries.slice().sort((a, b) => new Date(b.experiment.updatedAt) - new Date(a.experiment.updatedAt)).slice(0, 5);

  const topVariants = summaries
    .filter((s) => s.summary.topVariant && s.summary.participantCount > 0)
    .map((s) => ({ ...s.summary.topVariant, experimentName: s.experiment.name, experimentId: s.experiment.id, participantCount: s.summary.participantCount, sufficient: s.summary.sampleSize.sufficient }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  const series = dailyCompletionSeries(participants);

  return html`
    <div class="fade-in">
      <${SectionHeading}
        title="Обзор"
        subtitle="Снимок состояния вашего исследовательского пространства."
        action=${html`<${Button} onClick=${() => navigate("/app/experiments/new")}><${Icon} name="plus" size=${16}/> Новый эксперимент<//>`}
      />

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <${StatTile} label="Активные эксперименты" value=${activeCount} hint=${`${draftCount} черновиков · ${pausedCount} на паузе`} />
        <${StatTile} label="Завершившие участники" value=${allCompletedParticipants.length.toLocaleString()} hint=${`${totalStarted.toLocaleString()} начали всего`} />
        <${StatTile} label="Доля завершения" value=${pct(responseRate)} hint="Завершили ÷ начали, все эксперименты" />
        <${StatTile} label="Среднее время прохождения" value=${durationFromMs(avgCompletionMs)} hint="На участника, по всем задачам" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 space-y-5">
          <${Card} className="p-5">
            <${SectionHeading} title="Завершения за 14 дней" subtitle="По всем экспериментам" />
            <${LineChart} labels=${series.labels} data=${series.data} color="#6366f1" height=${200} />
          <//>

          <${Card} className="p-5">
            <${SectionHeading}
              title="Недавние эксперименты"
              action=${html`<button class="text-sm text-indigo-400 hover:text-indigo-300" onClick=${() => navigate("/app/experiments")}>Все<//>`}
            />
            ${experimentsLoading
              ? html`<p class="text-sm text-slate-500">Загрузка…</p>`
              : recent.length === 0
              ? html`<${EmptyState} title="У вас пока нет исследований" body="Создайте первый эксперимент, чтобы начать сбор ответов." icon="experiments"
                  action=${html`<${Button} onClick=${() => navigate("/app/experiments/new")}>Создать первое исследование<//>`} />`
              : html`
                <div class="divide-y divide-slate-800">
                  ${recent.map(
                    ({ experiment: e, summary }) => html`
                      <button key=${e.id} onClick=${() => navigate(e.status === "draft" ? `/app/experiments/${e.id}/edit` : `/app/experiments/${e.id}/results`)}
                        class="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-slate-800/40 rounded-lg px-2 -mx-2">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="font-medium text-sm text-slate-100 truncate">${e.name}</span>
                            <${StatusBadge} status=${e.status} />
                          </div>
                          <div class="text-xs text-slate-500 mt-0.5">${researchTypeLabel(e.researchType)} · обновлено ${relativeDate(e.updatedAt)}</div>
                        </div>
                        <div class="text-right shrink-0">
                          <div class="text-sm font-medium text-slate-200">${summary.participantCount}/${e.participantSettings.targetCount}</div>
                          <div class="text-xs text-slate-500">участников</div>
                        </div>
                      </button>
                    `
                  )}
                </div>
              `}
          <//>
        </div>

        <div class="space-y-5">
          <${Card} className="p-5">
            <${SectionHeading} title="Статус исследований" />
            <${DonutChart}
              labels=${["Активные", "Завершённые", "Черновики", "На паузе"]}
              data=${[activeCount, completedCount, draftCount, pausedCount]}
              colors=${["#10b981", "#6366f1", "#64748b", "#f59e0b"]}
              height=${190}
            />
          <//>

          <${Card} className="p-5">
            <${SectionHeading} title="Лучшие варианты" subtitle="Наивысшая доля выбора, по экспериментам" />
            ${sessionsLoading
              ? html`<p class="text-sm text-slate-500">Загрузка…</p>`
              : topVariants.length === 0
              ? html`<p class="text-sm text-slate-500">Пока нет данных о выборе.</p>`
              : html`
                <div class="space-y-3">
                  ${topVariants.map(
                    (v) => html`
                      <button key=${v.experimentId + v.variantId} onClick=${() => navigate(`/app/experiments/${v.experimentId}/results`)} class="w-full text-left">
                        <div class="flex items-center justify-between text-sm">
                          <span class="text-slate-200 font-medium truncate pr-2">${v.name} <span class="text-slate-500">· ${v.experimentName}</span></span>
                          <span class="text-slate-300 shrink-0">${pct(v.rate)}</span>
                        </div>
                        <div class="h-1.5 mt-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div class="h-full rounded-full bg-indigo-500" style=${{ width: `${Math.round(v.rate * 100)}%` }}></div>
                        </div>
                        ${!v.sufficient && html`<div class="text-[11px] text-amber-400 mt-1">Маленькая выборка — пока недостаточно надёжно</div>`}
                      </button>
                    `
                  )}
                </div>
              `}
          <//>
        </div>
      </div>
    </div>
  `;
}
