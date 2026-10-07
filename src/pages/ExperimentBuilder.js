import { html, useState, useEffect, useMemo } from "../lib/preact.js";
import { navigate } from "../router.js";
import { fetchExperiment, saveExperimentDraft, publishExperiment } from "../lib/experiments.js";
import { withTimeout } from "../lib/async.js";
import { uploadVariantAsset, deleteVariantAsset, pathFromPublicUrl } from "../lib/storage.js";
import { useCurrentOrg } from "../lib/currentOrg.js";
import { invalidateExperiments } from "../lib/experimentsStore.js";
import {
  Card, SectionHeading, Button, Field, TextInput, TextArea, Select, Checkbox, Switch, Badge, EmptyState, toast,
} from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { researchTypes, questionTypes, typeSupportsVariants, AGE_RANGES, COUNTRIES, LANGUAGES, INFLUENCE_FACTORS } from "../lib/questionTypes.js";
import { ParticipantRunner } from "./ParticipantRunner.js";

const uid = () => crypto.randomUUID();

const STEPS = [
  { id: 1, label: "Information" },
  { id: 2, label: "Research type" },
  { id: 3, label: "Stimuli" },
  { id: 4, label: "Questions" },
  { id: 5, label: "Participants" },
  { id: 6, label: "Settings" },
  { id: 7, label: "Preview" },
];

const VARIANT_LABELS = ["A", "B", "C", "D"];
const ASSET_TYPES = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "design", label: "Product design" },
  { value: "ad", label: "Advertisement" },
  { value: "logo", label: "Logo" },
  { value: "screenshot", label: "Screenshot" },
];

function emptyExperiment() {
  return {
    id: uid(),
    isDemo: false,
    status: "draft",
    name: "",
    objective: "",
    category: "",
    targetAudience: "",
    description: "",
    researchType: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "You",
    variants: [
      { id: uid(), label: "A", name: "", description: "", assetType: "image", assetUrl: null },
      { id: uid(), label: "B", name: "", description: "", assetType: "image", assetUrl: null },
    ],
    questions: [],
    participantSettings: {
      targetCount: 100,
      ageRange: ["18-24", "65+"],
      countries: [],
      languages: [],
      demographicQuestions: ["ageRange", "country", "language"],
    },
    settings: {
      randomizeVariantOrder: true,
      randomizeQuestionOrder: false,
      timeLimitSeconds: null,
      anonymous: true,
      requireConsent: true,
      preventDuplicates: true,
    },
  };
}

function emptyQuestion(type = "single_choice") {
  return {
    id: uid(),
    type,
    appliesTo: type === "single_choice" || type === "rating" || type === "yes_no" || type === "ranking" || type === "recall" ? "variants" : "general",
    role: null,
    prompt: "",
    options: type === "single_choice" || type === "multiple_choice" ? [...INFLUENCE_FACTORS] : null,
    scale: type === "rating" ? { min: 1, max: 5 } : null,
    required: true,
  };
}

export function ExperimentBuilder({ params }) {
  const editingId = params?.id ?? null;
  const { org, loading: orgLoading } = useCurrentOrg();
  const [draft, setDraft] = useState(() => ({ ...emptyExperiment(), id: editingId ?? uid() }));
  const [loadingExisting, setLoadingExisting] = useState(!!editingId);
  const [loadError, setLoadError] = useState(null); // null | "not_found" | <error message>
  const [retryTick, setRetryTick] = useState(0);
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    setLoadingExisting(true);
    setLoadError(null);
    withTimeout(fetchExperiment(editingId), 15000)
      .then((existing) => {
        if (cancelled) return;
        if (existing) setDraft(existing);
        else setLoadError("not_found"); // real row, found nothing -- not an empty new draft
        setLoadingExisting(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err?.message ?? String(err));
        setLoadingExisting(false);
      });
    return () => { cancelled = true; };
  }, [editingId, retryTick]);

  function patch(fields) {
    setDraft((d) => ({ ...d, ...fields }));
    setSaved(false);
  }

  async function persist(extra = {}) {
    const toSave = { ...draft, ...extra };
    setSaving(true);
    try {
      const result = await saveExperimentDraft(org.id, toSave);
      setDraft(result);
      setSaved(true);
      invalidateExperiments();
      return result;
    } catch (err) {
      toast(err.message ?? String(err), "rose");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function goTo(n) {
    try { await persist(); setStep(n); } catch { /* error already toasted */ }
  }
  function next() { goTo(Math.min(7, step + 1)); }
  function back() { goTo(Math.max(1, step - 1)); }

  async function publish() {
    try {
      const saved = await persist();
      await publishExperiment(saved.id);
      invalidateExperiments();
      toast("Эксперимент опубликован");
      navigate(`/app/experiments/${saved.id}/results`);
    } catch { /* error already toasted */ }
  }

  const canAdvance = useMemo(() => {
    if (step === 1) return draft.name.trim().length > 0 && draft.objective.trim().length > 0;
    if (step === 2) return !!draft.researchType;
    if (step === 3) return draft.variants.filter((v) => v.name.trim()).length >= 2;
    if (step === 4) return draft.questions.length >= 1;
    return true;
  }, [draft, step]);

  if (orgLoading || loadingExisting) {
    return html`<p class="text-sm text-slate-500">Загрузка…</p>`;
  }

  if (loadError === "not_found") {
    return html`<${EmptyState}
      title="Эксперимент не найден"
      body="Он мог быть удалён, или у вас нет к нему доступа."
      icon="experiments"
      action=${html`<${Button} onClick=${() => navigate("/app/experiments")}>К списку экспериментов<//>`}
    />`;
  }
  if (loadError) {
    return html`<${EmptyState}
      title="Не удалось загрузить эксперимент"
      body="Проверьте соединение и попробуйте снова."
      icon="shield"
      action=${html`<${Button} onClick=${() => setRetryTick((n) => n + 1)}>Повторить<//>`}
    />`;
  }

  return html`
    <div class="fade-in max-w-5xl">
      <${SectionHeading}
        title=${editingId ? "Редактировать эксперимент" : "Создать эксперимент"}
        subtitle="Соберите контролируемый эксперимент за семь шагов."
        action=${html`
          <div class="flex items-center gap-2">
            ${saved && html`<${Badge} tone="emerald">Сохранено как черновик<//>`}
            <${Button} variant="secondary" size="sm" disabled=${saving} onClick=${async () => { await persist(); navigate("/app/experiments"); }}>Сохранить и выйти<//>
          </div>
        `}
      />

      <div class="sk-display flex items-center gap-1 overflow-x-auto p-1.5 mb-6 rounded-xl">
        ${STEPS.map(
          (s, i) => html`
            <div key=${s.id} class="flex items-center">
              <button
                onClick=${() => goTo(s.id)}
                data-active=${step === s.id}
                class=${`sk-tab flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${
                  step === s.id ? "text-white" : step > s.id ? "text-emerald-400" : "text-slate-500"
                }`}
              >
                <span class=${`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step === s.id ? "bg-white/20" : "bg-black/30"}`}>
                  ${step > s.id ? html`<${Icon} name="check" size=${11} /> ` : s.id}
                </span>
                ${s.label}
              </button>
              ${i < STEPS.length - 1 && html`<div class="w-3 h-px bg-black/40 mx-0.5"></div>`}
            </div>
          `
        )}
      </div>

      <${Card} className="p-5 sm:p-7">
        ${step === 1 && html`<${StepInfo} draft=${draft} patch=${patch} />`}
        ${step === 2 && html`<${StepResearchType} draft=${draft} patch=${patch} />`}
        ${step === 3 && html`<${StepStimuli} draft=${draft} patch=${patch} orgId=${org.id} />`}
        ${step === 4 && html`<${StepQuestions} draft=${draft} patch=${patch} />`}
        ${step === 5 && html`<${StepParticipants} draft=${draft} patch=${patch} />`}
        ${step === 6 && html`<${StepSettings} draft=${draft} patch=${patch} />`}
        ${step === 7 && html`<${StepPreview} draft=${draft} onPublish=${publish} />`}

        <div class="flex items-center justify-between mt-8 pt-5 border-t border-black/40">
          <${Button} variant="ghost" onClick=${back} disabled=${step === 1 || saving}><${Icon} name="chevronLeft" size=${16}/> Назад<//>
          ${step < 7
            ? html`<${Button} onClick=${next} disabled=${!canAdvance || saving}>${saving ? "Сохраняем…" : "Продолжить"} <${Icon} name="chevronRight" size=${16}/><//>`
            : html`<${Button} variant="primary" onClick=${publish} disabled=${saving}><${Icon} name="play" size=${16}/> ${saving ? "Публикуем…" : "Опубликовать эксперимент"}<//>`}
        </div>
      <//>
    </div>
  `;
}

// ---- Step 1: Information --------------------------------------------------
function StepInfo({ draft, patch }) {
  return html`
    <div>
      <${Field} label="Experiment name" required>
        <${TextInput} value=${draft.name} placeholder="e.g. Sparkling Drink Packaging Study" onInput=${(e) => patch({ name: e.target.value })} />
      <//>
      <${Field} label="Research objective" required hint="What decision will this experiment help you make?">
        <${TextArea} value=${draft.objective} placeholder="e.g. Identify which packaging direction drives the strongest shelf preference." onInput=${(e) => patch({ objective: e.target.value })} />
      <//>
      <div class="grid sm:grid-cols-2 gap-x-4">
        <${Field} label="Product category">
          <${TextInput} value=${draft.category} placeholder="e.g. Beverages" onInput=${(e) => patch({ category: e.target.value })} />
        <//>
        <${Field} label="Target audience">
          <${TextInput} value=${draft.targetAudience} placeholder="e.g. Adults 18-45 who buy sparkling drinks monthly" onInput=${(e) => patch({ targetAudience: e.target.value })} />
        <//>
      </div>
      <${Field} label="Description" hint="Optional context for your team.">
        <${TextArea} value=${draft.description} onInput=${(e) => patch({ description: e.target.value })} />
      <//>
    </div>
  `;
}

// ---- Step 2: Research type -------------------------------------------------
function StepResearchType({ draft, patch }) {
  return html`
    <div>
      <p class="text-sm text-slate-400 mb-4">Choose the research type that best matches what you're testing. This tailors defaults for later steps.</p>
      <div class="grid sm:grid-cols-2 gap-3">
        ${researchTypes().map(
          (rt) => html`
            <button key=${rt.id} onClick=${() => patch({ researchType: rt.id })}
              data-selected=${draft.researchType === rt.id}
              class="sk-slot text-left rounded-xl p-4">
              <div class="font-medium text-slate-100 text-sm">${rt.label}</div>
              <div class="text-xs text-slate-500 mt-1">${rt.blurb}</div>
            </button>
          `
        )}
      </div>
    </div>
  `;
}

// ---- Step 3: Stimuli / variants --------------------------------------------
function StepStimuli({ draft, patch, orgId }) {
  const [uploadingId, setUploadingId] = useState(null);

  function updateVariant(id, fields) {
    patch({ variants: draft.variants.map((v) => (v.id === id ? { ...v, ...fields } : v)) });
  }
  function addVariant() {
    if (draft.variants.length >= 4) return;
    const label = VARIANT_LABELS[draft.variants.length];
    patch({ variants: [...draft.variants, { id: uid(), label, name: "", description: "", assetType: "image", assetUrl: null }] });
  }
  function removeVariant(id) {
    if (draft.variants.length <= 2) return;
    const removed = draft.variants.find((v) => v.id === id);
    if (removed?.assetUrl) { const p = pathFromPublicUrl(removed.assetUrl); if (p) deleteVariantAsset(p); }
    const remaining = draft.variants.filter((v) => v.id !== id).map((v, i) => ({ ...v, label: VARIANT_LABELS[i] }));
    patch({ variants: remaining });
  }
  async function onFile(id, file) {
    if (!file) return;
    setUploadingId(id);
    try {
      const previous = draft.variants.find((v) => v.id === id)?.assetUrl;
      const { url } = await uploadVariantAsset({ orgId, experimentId: draft.id, file });
      updateVariant(id, { assetUrl: url });
      if (previous) { const p = pathFromPublicUrl(previous); if (p) deleteVariantAsset(p); }
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setUploadingId(null);
    }
  }

  return html`
    <div>
      <p class="text-sm text-slate-400 mb-4">Загрузите или опишите до 4 вариантов, которые будут сравнивать участники.</p>
      <div class="grid sm:grid-cols-2 gap-4">
        ${draft.variants.map(
          (v) => html`
            <div key=${v.id} class="sk-slot rounded-xl p-4">
              <div class="flex items-center justify-between mb-3">
                <span class="sk-slot-label flex h-6 w-6 items-center justify-center rounded-md text-white text-xs font-bold">${v.label}</span>
                ${draft.variants.length > 2 && html`<button onClick=${() => removeVariant(v.id)} class="text-slate-500 hover:text-rose-400"><${Icon} name="trash" size=${14} /></button>`}
              </div>

              <label class="sk-display flex flex-col items-center justify-center rounded-lg h-28 mb-3 cursor-pointer overflow-hidden">
                ${uploadingId === v.id
                  ? html`<span class="text-xs text-slate-500">Загрузка…</span>`
                  : v.assetUrl
                  ? html`<img src=${v.assetUrl} class="h-full w-full object-cover" />`
                  : html`<${Icon} name="upload" size=${18} className="text-slate-500" /><span class="text-xs text-slate-500 mt-1">Загрузить изображение</span>`}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" disabled=${uploadingId === v.id} onChange=${(e) => onFile(v.id, e.target.files?.[0])} />
              </label>

              <${TextInput} className="mb-2" placeholder="Variant name" value=${v.name} onInput=${(e) => updateVariant(v.id, { name: e.target.value })} />
              <${TextInput} className="mb-2" placeholder="Short description" value=${v.description} onInput=${(e) => updateVariant(v.id, { description: e.target.value })} />
              <${Select} options=${ASSET_TYPES} value=${v.assetType} onChange=${(e) => updateVariant(v.id, { assetType: e.target.value })} />
            </div>
          `
        )}
      </div>
      ${draft.variants.length < 4 && html`
        <button onClick=${addVariant} class="mt-4 flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300">
          <${Icon} name="plus" size=${15} /> Add variant ${VARIANT_LABELS[draft.variants.length]}
        </button>
      `}
    </div>
  `;
}

// ---- Step 4: Questions ------------------------------------------------------
function StepQuestions({ draft, patch }) {
  function update(id, fields) {
    patch({ questions: draft.questions.map((q) => (q.id === id ? { ...q, ...fields } : q)) });
  }
  function add() {
    patch({ questions: [...draft.questions, emptyQuestion()] });
  }
  function remove(id) {
    patch({ questions: draft.questions.filter((q) => q.id !== id) });
  }
  function move(id, dir) {
    const idx = draft.questions.findIndex((q) => q.id === id);
    const target = idx + dir;
    if (target < 0 || target >= draft.questions.length) return;
    const list = draft.questions.slice();
    [list[idx], list[target]] = [list[target], list[idx]];
    patch({ questions: list });
  }

  return html`
    <div>
      <p class="text-sm text-slate-400 mb-4">Add the questions participants will answer after seeing your variants.</p>
      <div class="space-y-3">
        ${draft.questions.map(
          (q, i) => html`
            <div key=${q.id} class="sk-panel-flat rounded-xl p-4">
              <div class="flex items-center gap-2 mb-3">
                <span class="text-xs font-mono text-slate-500 w-5">${i + 1}.</span>
                <div class="flex-1"><${TextInput} placeholder="Question prompt" value=${q.prompt} onInput=${(e) => update(q.id, { prompt: e.target.value })} /></div>
                <button onClick=${() => move(q.id, -1)} class="p-1.5 text-slate-500 hover:text-slate-200 disabled:opacity-30" disabled=${i === 0}><${Icon} name="chevronLeft" size=${14} className="rotate-90" /></button>
                <button onClick=${() => move(q.id, 1)} class="p-1.5 text-slate-500 hover:text-slate-200 disabled:opacity-30" disabled=${i === draft.questions.length - 1}><${Icon} name="chevronRight" size=${14} className="rotate-90" /></button>
                <button onClick=${() => remove(q.id)} class="p-1.5 text-slate-500 hover:text-rose-400"><${Icon} name="trash" size=${14} /></button>
              </div>
              <div class="grid sm:grid-cols-3 gap-3 pl-7">
                <${Select} options=${questionTypes().map((qt) => ({ value: qt.id, label: qt.label }))} value=${q.type}
                  onChange=${(e) => update(q.id, emptyQuestionPatch(q, e.target.value))} />
                <${Select} options=${[{ value: "variants", label: "Applies to variants" }, { value: "general", label: "Fixed options / general" }]}
                  value=${q.appliesTo} onChange=${(e) => update(q.id, { appliesTo: e.target.value })} disabled=${!typeSupportsVariants(q.type)} />
                <${Select} options=${[{ value: "", label: "No special role" }, { value: "selection", label: "Primary selection question" }, { value: "premium", label: "Premium perception" }, { value: "influence", label: "Influence factor" }, { value: "recall", label: "Recall" }]}
                  value=${q.role ?? ""} onChange=${(e) => update(q.id, { role: e.target.value || null })} />
              </div>
              ${(q.type === "single_choice" || q.type === "multiple_choice") && q.appliesTo === "general" && html`
                <div class="pl-7 mt-3">
                  <${Field} label="Options (comma-separated)">
                    <${TextInput} value=${(q.options ?? []).join(", ")} onInput=${(e) => update(q.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                  <//>
                </div>
              `}
              ${q.type === "rating" && html`
                <div class="pl-7 mt-3 flex items-center gap-2 text-sm text-slate-400">
                  Scale: 1 to
                  <${Select} options=${["5", "7", "10"]} value=${String(q.scale?.max ?? 5)} onChange=${(e) => update(q.id, { scale: { min: 1, max: Number(e.target.value) } })} />
                </div>
              `}
              ${q.type === "price_perception" && html`
                <div class="pl-7 mt-3">
                  <${Field} label="Price bands (optional, comma-separated — leave blank for open numeric entry)">
                    <${TextInput} value=${(q.options ?? []).join(", ")} onInput=${(e) => update(q.id, { options: e.target.value.trim() ? e.target.value.split(",").map((s) => s.trim()) : null })} />
                  <//>
                </div>
              `}
            </div>
          `
        )}
      </div>
      <button onClick=${add} class="mt-4 flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300">
        <${Icon} name="plus" size=${15} /> Add question
      </button>
    </div>
  `;
}
function emptyQuestionPatch(q, newType) {
  const fresh = emptyQuestion(newType);
  return { type: newType, appliesTo: fresh.appliesTo, options: fresh.options, scale: fresh.scale };
}

// ---- Step 5: Participant settings ------------------------------------------
function StepParticipants({ draft, patch }) {
  const ps = draft.participantSettings;
  function updatePs(fields) { patch({ participantSettings: { ...ps, ...fields } }); }
  function toggleDemo(key) {
    const has = ps.demographicQuestions.includes(key);
    updatePs({ demographicQuestions: has ? ps.demographicQuestions.filter((k) => k !== key) : [...ps.demographicQuestions, key] });
  }
  return html`
    <div>
      <div class="grid sm:grid-cols-2 gap-x-4">
        <${Field} label="Target participant count" required>
          <${TextInput} type="number" min="1" value=${ps.targetCount} onInput=${(e) => updatePs({ targetCount: Number(e.target.value) || 0 })} />
        <//>
        <${Field} label="Age range">
          <div class="flex items-center gap-2">
            <${Select} options=${AGE_RANGES} value=${ps.ageRange[0]} onChange=${(e) => updatePs({ ageRange: [e.target.value, ps.ageRange[1]] })} />
            <span class="text-slate-500">to</span>
            <${Select} options=${AGE_RANGES} value=${ps.ageRange[1]} onChange=${(e) => updatePs({ ageRange: [ps.ageRange[0], e.target.value] })} />
          </div>
        <//>
      </div>

      <${Field} label="Countries" hint="Leave empty to allow all countries.">
        <div class="flex flex-wrap gap-x-4 gap-y-1">
          ${COUNTRIES.map(
            (c) => html`<${Checkbox} key=${c} label=${c} checked=${ps.countries.includes(c)}
              onChange=${() => updatePs({ countries: ps.countries.includes(c) ? ps.countries.filter((x) => x !== c) : [...ps.countries, c] })} />`
          )}
        </div>
      <//>

      <${Field} label="Languages" hint="Leave empty to allow all languages.">
        <div class="flex flex-wrap gap-x-4 gap-y-1">
          ${LANGUAGES.map(
            (l) => html`<${Checkbox} key=${l} label=${l} checked=${ps.languages.includes(l)}
              onChange=${() => updatePs({ languages: ps.languages.includes(l) ? ps.languages.filter((x) => x !== l) : [...ps.languages, l] })} />`
          )}
        </div>
      <//>

      <${Field} label="Optional demographic questions" hint="Keep this minimal — only ask what you need.">
        <div class="flex flex-wrap gap-x-5">
          <${Checkbox} label="Age range" checked=${ps.demographicQuestions.includes("ageRange")} onChange=${() => toggleDemo("ageRange")} />
          <${Checkbox} label="Country" checked=${ps.demographicQuestions.includes("country")} onChange=${() => toggleDemo("country")} />
          <${Checkbox} label="Language" checked=${ps.demographicQuestions.includes("language")} onChange=${() => toggleDemo("language")} />
        </div>
      <//>
    </div>
  `;
}

// ---- Step 6: Experiment settings -------------------------------------------
function StepSettings({ draft, patch }) {
  const s = draft.settings;
  function update(fields) { patch({ settings: { ...s, ...fields } }); }
  return html`
    <div class="divide-y divide-slate-800">
      <${Switch} label="Randomize variant order" checked=${s.randomizeVariantOrder} onChange=${(v) => update({ randomizeVariantOrder: v })} />
      <${Switch} label="Randomize question order" checked=${s.randomizeQuestionOrder} onChange=${(v) => update({ randomizeQuestionOrder: v })} />
      <${Switch} label="Anonymous participation" checked=${s.anonymous} onChange=${(v) => update({ anonymous: v })} />
      <${Switch} label="Require consent before starting" checked=${s.requireConsent} onChange=${(v) => update({ requireConsent: v })} />
      <${Switch} label="Prevent duplicate submissions" checked=${s.preventDuplicates} onChange=${(v) => update({ preventDuplicates: v })} />
      <div class="py-3">
        <${Checkbox} label="Set a time limit per task" checked=${s.timeLimitSeconds != null}
          onChange=${(e) => update({ timeLimitSeconds: e.target.checked ? 60 : null })} />
        ${s.timeLimitSeconds != null && html`
          <div class="mt-2 pl-6 flex items-center gap-2 text-sm text-slate-400">
            <${TextInput} type="number" min="5" className="w-24" value=${s.timeLimitSeconds} onInput=${(e) => update({ timeLimitSeconds: Number(e.target.value) || 60 })} />
            seconds per task
          </div>
        `}
      </div>
    </div>
  `;
}

// ---- Step 7: Preview --------------------------------------------------------
function StepPreview({ draft, onPublish }) {
  const [showRunner, setShowRunner] = useState(false);
  return html`
    <div>
      <div class="grid sm:grid-cols-2 gap-5">
        <div>
          <h3 class="font-semibold text-slate-100">${draft.name || "Untitled experiment"}</h3>
          <p class="text-sm text-slate-400 mt-1">${draft.objective}</p>
          <dl class="mt-4 space-y-2 text-sm">
            <div class="flex justify-between"><dt class="text-slate-500">Research type</dt><dd class="text-slate-200">${draft.researchType || "—"}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-500">Variants</dt><dd class="text-slate-200">${draft.variants.length}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-500">Questions</dt><dd class="text-slate-200">${draft.questions.length}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-500">Target participants</dt><dd class="text-slate-200">${draft.participantSettings.targetCount}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-500">Randomized order</dt><dd class="text-slate-200">${draft.settings.randomizeVariantOrder ? "Variants" : ""}${draft.settings.randomizeVariantOrder && draft.settings.randomizeQuestionOrder ? " + " : ""}${draft.settings.randomizeQuestionOrder ? "Questions" : ""}${!draft.settings.randomizeVariantOrder && !draft.settings.randomizeQuestionOrder ? "Off" : ""}</dd></div>
          </dl>
        </div>
        <div class="sk-panel-flat rounded-xl p-4">
          <div class="text-sm font-medium text-slate-200 mb-2">Before you publish</div>
          <ul class="text-sm text-slate-500 space-y-1.5">
            <li class="flex gap-2"><${Icon} name=${draft.name && draft.objective ? "check" : "close"} size=${14} className=${draft.name && draft.objective ? "text-emerald-400 mt-0.5" : "text-rose-400 mt-0.5"} /> Experiment info complete</li>
            <li class="flex gap-2"><${Icon} name=${draft.variants.filter((v) => v.name).length >= 2 ? "check" : "close"} size=${14} className=${draft.variants.filter((v) => v.name).length >= 2 ? "text-emerald-400 mt-0.5" : "text-rose-400 mt-0.5"} /> At least 2 named variants</li>
            <li class="flex gap-2"><${Icon} name=${draft.questions.length >= 1 ? "check" : "close"} size=${14} className=${draft.questions.length >= 1 ? "text-emerald-400 mt-0.5" : "text-rose-400 mt-0.5"} /> At least 1 question</li>
          </ul>
        </div>
      </div>

      <div class="mt-5">
        <${Button} variant="secondary" onClick=${() => setShowRunner(true)}><${Icon} name="play" size=${15}/> Preview exact participant experience<//>
      </div>
    </div>

    ${showRunner && html`
      <div class="fixed inset-0 z-50 bg-slate-950 overflow-y-auto">
        <button onClick=${() => setShowRunner(false)} class="fixed top-4 right-4 z-50 rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"><${Icon} name="close" size=${18} /></button>
        <${ParticipantRunner} experimentId=${draft.id} preview=${true} previewExperiment=${draft} />
      </div>
    `}
  `;
}
