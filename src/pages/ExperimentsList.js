import { html, useState } from "../lib/preact.js";
import { useExperiments, invalidateExperiments } from "../lib/experimentsStore.js";
import { useCurrentOrg } from "../lib/currentOrg.js";
import { deleteExperiment as deleteExperimentApi, duplicateExperiment as duplicateExperimentApi, publishExperiment } from "../lib/experiments.js";
import { navigate } from "../router.js";
import { Card, SectionHeading, Badge, Button, EmptyState, Tabs, toast } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { relativeDate } from "../lib/format.js";
import { researchTypeLabel } from "../lib/questionTypes.js";

const STATUS_TONE = { active: "emerald", completed: "indigo", draft: "slate", paused: "amber", archived: "slate" };

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "completed", label: "Завершённые" },
  { id: "draft", label: "Черновики" },
  { id: "paused", label: "Приостановлены" },
];

export function ExperimentsList() {
  const { org } = useCurrentOrg();
  const { experiments, loading } = useExperiments();
  const [filter, setFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const filtered = filter === "all" ? experiments : experiments.filter((e) => e.status === filter);
  const sorted = filtered.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  async function duplicate(e) {
    setBusyId(e.id);
    try {
      const copy = await duplicateExperimentApi(org.id, e);
      invalidateExperiments();
      navigate(`/app/experiments/${copy.id}/edit`);
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setBusyId(null);
    }
  }

  async function publish(e) {
    setBusyId(e.id);
    try {
      await publishExperiment(e.id);
      invalidateExperiments();
      toast("Эксперимент опубликован");
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setBusyId(null);
    }
  }

  async function doDelete(e) {
    setBusyId(e.id);
    try {
      await deleteExperimentApi(e);
      invalidateExperiments();
      setConfirmDelete(null);
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setBusyId(null);
    }
  }

  return html`
    <div class="fade-in">
      <${SectionHeading}
        title="Эксперименты"
        subtitle="Создавайте, публикуйте и управляйте своими исследованиями."
        action=${html`<${Button} onClick=${() => navigate("/app/experiments/new")}><${Icon} name="plus" size=${16}/> Новый эксперимент<//>`}
      />
      <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <${Tabs} tabs=${FILTERS} active=${filter} onChange=${setFilter} />
      </div>

      ${loading
        ? html`<p class="text-sm text-slate-500">Загрузка…</p>`
        : sorted.length === 0
        ? html`<${EmptyState} title="Здесь пока ничего нет" body="Попробуйте другой фильтр или создайте новый эксперимент." icon="experiments"
            action=${html`<${Button} onClick=${() => navigate("/app/experiments/new")}>Создать эксперимент<//>`} />`
        : html`
          <div class="space-y-3">
            ${sorted.map((e) => html`
              <${Card} key=${e.id} className="p-4 sm:p-5">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <button class="font-semibold text-slate-100 hover:text-indigo-300 text-left" onClick=${() => navigate(e.status === "draft" ? `/app/experiments/${e.id}/edit` : `/app/experiments/${e.id}/results`)}>${e.name}</button>
                      <${Badge} tone=${STATUS_TONE[e.status]}>${e.status}<//>
                    </div>
                    <p class="text-sm text-slate-500 mt-1 max-w-2xl">${e.objective}</p>
                    <div class="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
                      <span>${researchTypeLabel(e.researchType)}</span>
                      <span>${e.variants.length} вариантов</span>
                      <span>${e.questions.length} вопросов</span>
                      <span>Обновлено ${relativeDate(e.updatedAt)}</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    ${e.status === "draft"
                      ? html`
                        <${Button} size="sm" variant="secondary" disabled=${busyId===e.id} onClick=${() => navigate(`/app/experiments/${e.id}/edit`)}><${Icon} name="edit" size=${14}/> Изменить<//>
                        <${Button} size="sm" variant="primary" disabled=${busyId===e.id} onClick=${() => publish(e)}><${Icon} name="play" size=${14}/> Опубликовать<//>
                      `
                      : html`<${Button} size="sm" variant="secondary" onClick=${() => navigate(`/app/experiments/${e.id}/results`)}><${Icon} name="results" size=${14}/> Результаты<//>`}
                    ${e.status !== "draft" && html`<button title="Публичная ссылка" class="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800" onClick=${() => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}#/research/${e.publicSlug}`); toast("Ссылка скопирована"); }}><${Icon} name="external" size=${15} /></button>`}
                    <button title="Дублировать" disabled=${busyId===e.id} class="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800" onClick=${() => duplicate(e)}><${Icon} name="copy" size=${15} /></button>
                    <button title="Удалить" disabled=${busyId===e.id} class="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800" onClick=${() => setConfirmDelete(e)}><${Icon} name="trash" size=${15} /></button>
                  </div>
                </div>
              <//>
            `)}
          </div>
        `}

      ${confirmDelete && html`
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick=${(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
          <${Card} className="max-w-sm p-5">
            <div class="font-semibold text-slate-100">Удалить «${confirmDelete.name}»?</div>
            <p class="text-sm text-slate-500 mt-1.5">Эксперимент и все ответы участников будут удалены безвозвратно.</p>
            <div class="flex justify-end gap-2 mt-5">
              <${Button} variant="secondary" size="sm" onClick=${() => setConfirmDelete(null)}>Отмена<//>
              <${Button} variant="danger" size="sm" disabled=${busyId===confirmDelete.id} onClick=${() => doDelete(confirmDelete)}>Удалить<//>
            </div>
          <//>
        </div>
      `}
    </div>
  `;
}
