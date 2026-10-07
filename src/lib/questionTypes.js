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

export const INFLUENCE_FACTORS = ["Price", "Design", "Brand", "Packaging", "Quality perception", "Other"];

export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

export const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Germany",
  "Kazakhstan", "Brazil", "India", "Australia",
];

export const LANGUAGES = ["English", "Spanish", "German", "Russian", "Portuguese", "Kazakh"];
