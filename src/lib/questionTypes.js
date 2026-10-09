// Shared question-type / research-type vocabulary used by the builder,
// the participant runner, the analytics engine and the demo data generator.
// Ids are stable identifiers (stored in the DB / used as React keys);
// labels and blurbs are looked up through the i18n dictionary. Callers
// should pass their useT()-bound translator in, but every function here
// falls back to the app's current locale when `t` is omitted -- so a call
// site not yet updated to the i18n pass still renders correctly (always in
// the current locale) instead of throwing.
import { t as translate, getLocale } from "./i18n.js";
function resolveT(t) {
  return t ?? ((key, vars) => translate(getLocale(), key, vars));
}

export const RESEARCH_TYPE_IDS = [
  "product_comparison", "ad_testing", "packaging_testing", "logo_testing",
  "pricing_research", "ux_testing", "brand_perception", "custom",
];

export const QUESTION_TYPE_IDS = [
  "single_choice", "multiple_choice", "rating", "ranking",
  "yes_no", "price_perception", "recall", "open_text",
];

const SUPPORTS_VARIANTS = {
  single_choice: true, multiple_choice: false, rating: true, ranking: true,
  yes_no: true, price_perception: false, recall: true, open_text: false,
};

export function researchTypes(t) {
  const tt = resolveT(t);
  return RESEARCH_TYPE_IDS.map((id) => ({
    id,
    label: tt(`questionTypes.research.${id}.label`),
    blurb: tt(`questionTypes.research.${id}.blurb`),
  }));
}

export function questionTypes(t) {
  const tt = resolveT(t);
  return QUESTION_TYPE_IDS.map((id) => ({ id, label: tt(`questionTypes.question.${id}`), supportsVariants: SUPPORTS_VARIANTS[id] }));
}

export function typeSupportsVariants(id) {
  return SUPPORTS_VARIANTS[id] ?? false;
}

export function questionTypeLabel(id, t) {
  const tt = resolveT(t);
  return QUESTION_TYPE_IDS.includes(id) ? tt(`questionTypes.question.${id}`) : id;
}

export function researchTypeLabel(id, t) {
  const tt = resolveT(t);
  return RESEARCH_TYPE_IDS.includes(id) ? tt(`questionTypes.research.${id}.label`) : id;
}

// Measurement dimensions -- the "what do you want to learn" entry point for
// the question builder. Each produces a ready-to-use question object (not a
// new schema: same question_type enum + free-text role column every other
// question already uses), so results/insights calculations work on these
// exactly like a hand-built question -- nothing here is a frontend-only mock.
const DIMENSION_DEFS = [
  { id: "preference", icon: "check", type: "single_choice", role: "selection" },
  { id: "attention", icon: "search", type: "single_choice", role: "attention" },
  { id: "trust", icon: "shield", type: "single_choice", role: "trust" },
  { id: "quality", icon: "sparkle", type: "single_choice", role: "quality" },
  { id: "premium", icon: "card", type: "single_choice", role: "premium" },
  { id: "clarity", icon: "insights", type: "single_choice", role: "clarity" },
  { id: "recall", icon: "clock", type: "recall", role: "recall" },
  { id: "purchaseIntent", icon: "results", type: "rating", role: "purchase_intention", scale: { min: 1, max: 7 } },
];

export const DIMENSION_IDS = DIMENSION_DEFS.map((d) => d.id);

export function measurementDimensions(t) {
  const tt = resolveT(t);
  return DIMENSION_DEFS.map((d) => ({
    ...d,
    label: tt(`builder.dimensions.${d.id}.label`),
    blurb: tt(`builder.dimensions.${d.id}.blurb`),
    defaultPrompt: tt(`builder.dimensions.${d.id}.prompt`),
  }));
}

/** Builds a ready-to-insert question draft for one dimension (uid is the
 * caller's id generator, e.g. crypto.randomUUID). */
export function questionFromDimension(dimensionId, uid, t) {
  const def = DIMENSION_DEFS.find((d) => d.id === dimensionId);
  if (!def) return null;
  const tt = resolveT(t);
  return {
    id: uid(),
    type: def.type,
    appliesTo: "variants",
    role: def.role,
    prompt: tt(`builder.dimensions.${def.id}.prompt`),
    options: null,
    scale: def.scale ?? (def.type === "rating" ? { min: 1, max: 5 } : null),
    required: true,
  };
}

export const INFLUENCE_FACTORS = ["Price", "Design", "Brand", "Packaging", "Quality perception", "Other"];

export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

export const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Germany",
  "Kazakhstan", "Brazil", "India", "Australia",
];

export const LANGUAGES = ["English", "Spanish", "German", "Russian", "Portuguese", "Kazakh"];
