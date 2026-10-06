// Shared question-type / research-type vocabulary used by the builder,
// the participant runner, the analytics engine and the demo data generator.

export const RESEARCH_TYPES = [
  { id: "product_comparison", label: "Product comparison", blurb: "Compare two or more competing products head-to-head." },
  { id: "ad_testing", label: "Advertisement testing", blurb: "Test how audiences react to different ad concepts." },
  { id: "packaging_testing", label: "Packaging testing", blurb: "Compare package designs for shelf appeal and clarity." },
  { id: "logo_testing", label: "Logo testing", blurb: "Evaluate logo concepts for memorability and fit." },
  { id: "pricing_research", label: "Pricing research", blurb: "Understand price perception and willingness to pay." },
  { id: "ux_testing", label: "Website / UX testing", blurb: "Test flows, layouts and screens for usability." },
  { id: "brand_perception", label: "Brand perception", blurb: "Measure how a brand is perceived across attributes." },
  { id: "custom", label: "Custom experiment", blurb: "Start from a blank experiment and define your own flow." },
];

export const QUESTION_TYPES = [
  { id: "single_choice", label: "Single choice", supportsVariants: true },
  { id: "multiple_choice", label: "Multiple choice", supportsVariants: false },
  { id: "rating", label: "Rating", supportsVariants: true },
  { id: "ranking", label: "Ranking", supportsVariants: true },
  { id: "yes_no", label: "Yes / No", supportsVariants: true },
  { id: "price_perception", label: "Price perception", supportsVariants: false },
  { id: "recall", label: "Recall question", supportsVariants: true },
  { id: "open_text", label: "Open text", supportsVariants: false },
];

export const INFLUENCE_FACTORS = ["Price", "Design", "Brand", "Packaging", "Quality perception", "Other"];

export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

export const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Germany",
  "Kazakhstan", "Brazil", "India", "Australia",
];

export const LANGUAGES = ["English", "Spanish", "German", "Russian", "Portuguese", "Kazakh"];

export function questionTypeLabel(id) {
  return QUESTION_TYPES.find((q) => q.id === id)?.label ?? id;
}

export function researchTypeLabel(id) {
  return RESEARCH_TYPES.find((r) => r.id === id)?.label ?? id;
}
