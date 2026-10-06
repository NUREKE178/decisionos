import { html, useState, useMemo, useEffect } from "../lib/preact.js";
import { useExperiments } from "../lib/experimentsStore.js";
import { fetchSessionsForExperiment } from "../lib/participants.js";
import { navigate } from "../router.js";
import { Card, SectionHeading, Badge, Select, Button, EmptyState } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { experimentSummary, choiceStatsForQuestion, primarySelectionQuestion, completedParticipants, segmentBreakdown } from "../lib/stats.js";
import { generateInsights } from "../lib/insights.js";
import { pct, durationFromMs, shortDate } from "../lib/format.js";
import { researchTypeLabel } from "../lib/questionTypes.js";

function buildMarkdownReport(experiment, summary, choice, segments, insights) {
  const lines = [];
  lines.push(`# ${experiment.name}`);
  lines.push("");
  lines.push(`*Тип исследования: ${researchTypeLabel(experiment.researchType)} · Сформирован ${new Date().toLocaleDateString("ru-RU")}*`);
  lines.push("");
  lines.push("## Цель");
  lines.push(experiment.objective || "—");
  lines.push("");
  lines.push("## Методология");
  lines.push(`Контролируемый эксперимент с ${experiment.variants.length} вариантами и ${experiment.questions.length} вопросами. ` +
    `Порядок вариантов ${experiment.settings.randomizeVariantOrder ? "рандомизирован (уравновешен между участниками)" : "фиксирован"}.`);
  lines.push("");
  lines.push("## Выборка");
  lines.push(`- Завершивших участников: ${summary.participantCount} (из ${experiment.participantSettings.targetCount} целевых)`);
  lines.push(`- Доля завершения: ${pct(summary.completion.rate)}`);
  lines.push(`- Размер выборки: ${summary.sampleSize.sufficient ? "достаточен" : "НЕДОСТАТОЧЕН для надёжного вывода"} (n=${summary.sampleSize.n})`);
  lines.push("");
  if (choice) {
    lines.push("## Сравнение вариантов");
    for (const row of choice.rows) {
      lines.push(`- Вариант ${row.label} (${row.name}): ${pct(row.rate)} (95% ДИ ${pct(row.ci[0])}–${pct(row.ci[1])}, n=${row.count})`);
    }
    lines.push("");
  }
  if (segments?.length) {
    lines.push("## Сегменты");
    for (const seg of segments) {
      const leader = seg.rows[0];
      lines.push(`- ${seg.segment} (n=${seg.n}${!seg.sufficient ? ", маленькая выборка" : ""}): лидирует ${leader.label} — ${pct(leader.rate)}`);
    }
    lines.push("");
  }
  lines.push("## Ключевые выводы (ИИ-инсайты — предсказания, не достоверные факты)");
  lines.push("**Что произошло**");
  insights.whatHappened.forEach((l) => lines.push(`- ${l}`));
  lines.push("\n**Почему это могло произойти**");
  insights.whyMightHaveHappened.forEach((l) => lines.push(`- ${l}`));
  lines.push(`\n**Рекомендация (уверенность: ${insights.recommendation.confidence})**\n${insights.recommendation.text}`);
  lines.push("");
  lines.push("## Ограничения");
  lines.push("- Выводы основаны на статистических оценках наблюдаемого поведения и не являются точным предсказанием будущего поведения.");
  lines.push("- Связи между метриками являются ассоциациями, а не доказанными причинно-следственными связями.");
  if (!summary.sampleSize.sufficient) lines.push("- Размер выборки недостаточен для надёжного вывода — результаты стоит считать предварительными.");
  lines.push("");
  lines.push("## Следующий эксперимент");
  lines.push(summary.sampleSize.sufficient
    ? "Рассмотрите повторное исследование с иной сегментацией аудитории или дополнительными вопросами (воспринимаемое качество, фактор влияния), чтобы углубить понимание «почему»."
    : `Соберите больше ответов (минимум ${Math.max(0, 30 - summary.sampleSize.n)}) перед тем, как принимать решения на основе этого исследования.`);
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
  const { experiments, loading: experimentsLoading } = useExperiments();
  const eligible = experiments.filter((e) => e.status !== "draft");
  const [selectedId, setSelectedId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(true);

  const experiment = useMemo(() => experiments.find((e) => e.id === selectedId) ?? eligible[0] ?? null, [experiments, selectedId]);

  useEffect(() => {
    if (!experiment) { setParticipants([]); setLoadingParticipants(false); return; }
    let cancelled = false;
    setLoadingParticipants(true);
    fetchSessionsForExperiment(experiment.id).then((sessions) => {
      if (!cancelled) { setParticipants(sessions); setLoadingParticipants(false); }
    });
    return () => { cancelled = true; };
  }, [experiment?.id]);

  const completed = useMemo(() => completedParticipants(participants), [participants]);
  const selQ = experiment ? primarySelectionQuestion(experiment) : null;
  const choice = experiment && selQ ? choiceStatsForQuestion(experiment, completed, selQ.id) : null;
  const segments = experiment && selQ ? segmentBreakdown(experiment, completed, selQ.id, "ageRange") : [];
  const summary = experiment ? experimentSummary(experiment, participants) : null;
  const insights = experiment && !loadingParticipants ? generateInsights(experiment, participants) : null;

  if (experimentsLoading) return html`<p class="text-sm text-slate-500">Загрузка…</p>`;
  if (eligible.length === 0) {
    return html`<${EmptyState} title="Пока нет отчётов" body="Опубликуйте эксперимент, чтобы сформировать отчёт для скачивания." icon="reports"
      action=${html`<${Button} onClick=${() => navigate("/app/experiments/new")}>Создать эксперимент<//>`} />`;
  }

  return html`
    <div class="fade-in max-w-3xl">
      <${SectionHeading}
        title="Отчёты"
        subtitle="Сводка результатов и ИИ-инсайтов по одному эксперименту, готовая к скачиванию."
        action=${html`
          <${Select} className="w-auto min-w-[240px]" options=${eligible.map((e) => ({ value: e.id, label: e.name }))} value=${experiment?.id} onChange=${(e) => setSelectedId(e.target.value)} />
        `}
      />

      ${experiment && (loadingParticipants
        ? html`<p class="text-sm text-slate-500">Загрузка ответов…</p>`
        : html`
        <${Card} className="p-6">
          <div class="flex items-start justify-between gap-3 mb-5 flex-wrap">
            <div>
              <h3 class="text-lg font-semibold text-slate-100">${experiment.name}</h3>
              <p class="text-sm text-slate-500 mt-1">${researchTypeLabel(experiment.researchType)} · сформирован ${shortDate(new Date().toISOString())}</p>
            </div>
            <${Button} size="sm" variant="secondary" onClick=${() => downloadText(`${experiment.name.replace(/\s+/g, "-").toLowerCase()}-report.md`, buildMarkdownReport(experiment, summary, choice, segments, insights))}>
              <${Icon} name="reports" size=${14} /> Скачать .md
            <//>
          </div>

          <p class="text-sm text-slate-300 mb-5">${experiment.objective}</p>

          <div class="grid sm:grid-cols-3 gap-3 mb-6">
            <div class="rounded-lg border border-slate-800 p-3"><div class="text-xs text-slate-500">Участники</div><div class="text-lg font-semibold text-slate-100">${summary.participantCount}</div></div>
            <div class="rounded-lg border border-slate-800 p-3"><div class="text-xs text-slate-500">Доля завершения</div><div class="text-lg font-semibold text-slate-100">${pct(summary.completion.rate)}</div></div>
            <div class="rounded-lg border border-slate-800 p-3"><div class="text-xs text-slate-500">Среднее время</div><div class="text-lg font-semibold text-slate-100">${durationFromMs(summary.avgCompletionTimeMs)}</div></div>
          </div>

          ${!summary.sampleSize.sufficient && html`
            <div class="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">Недостаточно данных для надежного вывода (n=${summary.sampleSize.n}).</div>
          `}

          ${choice && html`
            <h4 class="text-sm font-semibold text-slate-200 mb-2">Сравнение вариантов</h4>
            <div class="space-y-1.5 mb-6">
              ${choice.rows.map((r) => html`<div key=${r.variantId} class="flex justify-between text-sm"><span class="text-slate-300">${r.label} — ${r.name}</span><span class="text-slate-500">${pct(r.rate)} (ДИ ${pct(r.ci[0])}–${pct(r.ci[1])})</span></div>`)}
            </div>
          `}

          <h4 class="text-sm font-semibold text-slate-200 mb-2">Рекомендация</h4>
          <div class="flex items-center gap-2 mb-2"><${Badge} tone="indigo">уверенность: ${insights.recommendation.confidence}<//></div>
          <p class="text-sm text-slate-300">${insights.recommendation.text}</p>
          <p class="text-xs text-slate-500 mt-4 italic">${insights.disclaimer}</p>
        <//>
      `)}
    </div>
  `;
}
