import { mulberry32, hashStringToSeed, weightedPick, gaussian, uid } from "./prng.js";
import { assignRandomization } from "./randomization.js";
import { AGE_RANGES, COUNTRIES, LANGUAGES, INFLUENCE_FACTORS } from "./questionTypes.js";

// -----------------------------------------------------------------------
// All data below is SYNTHETIC. It exists so the product can be explored
// before a real company connects real experiments. Every record carries
// `isDemo: true` and the UI is expected to label it as illustrative.
// -----------------------------------------------------------------------

const PALETTE = ["#6366f1", "#14b8a6", "#f59e0b", "#ec4899"];

function variant(label, name, blurb, color) {
  return { id: uid("var"), label, name, description: blurb, color, assetType: "generated", assetUrl: null };
}

function q(partial) {
  return {
    id: uid("q"),
    required: true,
    role: null,
    appliesTo: "general",
    options: null,
    scale: null,
    ...partial,
  };
}

function daysAgo(rand, maxDays, recencyBias = 2.2) {
  // Exponential-ish skew toward more recent days (recent growth curve).
  const t = Math.pow(rand(), recencyBias);
  return Math.round(t * maxDays);
}

function makeTimestamp(rand, maxDays) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo(rand, maxDays));
  d.setHours(8 + Math.floor(rand() * 12), Math.floor(rand() * 60), 0, 0);
  return d.toISOString();
}

function pickDemographics(rand) {
  return {
    ageRange: weightedPick(rand, [
      ["18-24", 18], ["25-34", 30], ["35-44", 24], ["45-54", 15], ["55-64", 9], ["65+", 4],
    ]),
    country: weightedPick(rand, COUNTRIES.map((c) => [c, c === "United States" ? 30 : 10])),
    language: weightedPick(rand, LANGUAGES.map((l) => [l, l === "English" ? 55 : 9])),
  };
}

function responseTimeFor(type, rand) {
  const means = {
    single_choice: 4200, multiple_choice: 5200, rating: 2600, ranking: 7200,
    yes_no: 1800, price_perception: 4800, recall: 3400, open_text: 8600,
  };
  const ms = gaussian(rand, means[type] ?? 3500, (means[type] ?? 3500) * 0.35);
  return Math.max(500, Math.round(ms));
}

/**
 * Builds one simulated participant's full response set for an experiment,
 * with intrinsic variant "appeal" driving selection/premium/recall so the
 * dataset contains a real, inspectable signal rather than pure noise.
 */
function generateParticipant(rand, experiment, index, status) {
  const { variantOrder, questionOrder } = assignRandomization(experiment, index);
  const demographics = pickDemographics(rand);
  const weights = experiment.variants.map((v) => [v.id, v.appealWeight ?? 1]);
  const premiumWeights = experiment.variants.map((v) => [v.id, v.premiumWeight ?? v.appealWeight ?? 1]);
  const recallWeights = experiment.variants.map((v) => [v.id, v.recallWeight ?? v.appealWeight ?? 1]);

  const responses = [];
  let selectedVariantId = null;
  const answeredQuestionIds = status === "abandoned"
    ? questionOrder.slice(0, Math.max(1, Math.floor(questionOrder.length * (0.2 + rand() * 0.5))))
    : questionOrder;

  for (const questionId of answeredQuestionIds) {
    const question = experiment.questions.find((qq) => qq.id === questionId);
    if (!question) continue;
    const responseTimeMs = responseTimeFor(question.type, rand);
    let value;

    if (question.appliesTo === "variants" && question.type === "single_choice") {
      value = weightedPick(rand, question.role === "premium" && selectedVariantId && rand() < 0.7
        ? premiumWeights.map(([id, w]) => [id, id === selectedVariantId ? w * 3 : w])
        : weights);
      if (question.role === "selection" || !selectedVariantId) selectedVariantId = selectedVariantId ?? value;
    } else if (question.type === "recall") {
      value = rand() < 0.6 && selectedVariantId
        ? selectedVariantId
        : weightedPick(rand, recallWeights);
    } else if (question.type === "rating" && question.appliesTo === "variants") {
      const max = question.scale?.max ?? 5;
      value = {};
      for (const v of experiment.variants) {
        const base = 1 + ((v.appealWeight ?? 1) / Math.max(...experiment.variants.map((x) => x.appealWeight ?? 1))) * (max - 1.4);
        value[v.id] = Math.min(max, Math.max(1, Math.round(gaussian(rand, base, 0.7))));
      }
    } else if (question.type === "yes_no" && question.appliesTo === "variants") {
      value = {};
      for (const v of experiment.variants) {
        const p = 0.35 + 0.5 * ((v.appealWeight ?? 1) / Math.max(...experiment.variants.map((x) => x.appealWeight ?? 1)));
        value[v.id] = rand() < p;
      }
    } else if (question.type === "yes_no") {
      value = rand() < (question.baseYesRate ?? 0.6);
    } else if (question.type === "ranking" && question.appliesTo === "variants") {
      const scored = experiment.variants.map((v) => ({ id: v.id, score: (v.appealWeight ?? 1) + gaussian(rand, 0, 1.1) }));
      scored.sort((a, b) => b.score - a.score);
      value = scored.map((s) => s.id);
    } else if (question.type === "multiple_choice") {
      const opts = question.options ?? INFLUENCE_FACTORS;
      value = opts.filter(() => rand() < 0.32);
      if (value.length === 0) value = [opts[Math.floor(rand() * opts.length)]];
    } else if (question.type === "single_choice") {
      const opts = question.options ?? INFLUENCE_FACTORS;
      if (question.role === "influence" && selectedVariantId) {
        const winner = experiment.variants.find((v) => v.id === selectedVariantId);
        const favored = winner?.favoredInfluence ?? opts[0];
        value = weightedPick(rand, opts.map((o) => [o, o === favored ? 6 : 1]));
      } else {
        value = weightedPick(rand, opts.map((o) => [o, 1]));
      }
    } else if (question.type === "price_perception") {
      if (question.options) {
        value = weightedPick(rand, question.options.map((o, i) => [o, question.options.length - Math.abs(i - question.options.length / 2)]));
      } else {
        value = Math.max(1, Math.round(gaussian(rand, question.basePrice ?? 10, (question.basePrice ?? 10) * 0.22)));
      }
    } else if (question.type === "open_text") {
      const pool = question.samplePool ?? ["Good", "Interesting", "Not sure", "Looks nice", "Could be better"];
      value = pool[Math.floor(rand() * pool.length)];
    } else {
      value = null;
    }

    responses.push({ questionId, value, responseTimeMs, shownAt: makeTimestamp(rand, 1) });
  }

  const startedAt = makeTimestamp(rand, experiment.demoMaxAgeDays ?? 60);
  const completionMs = responses.reduce((s, r) => s + r.responseTimeMs, 0) + 3000;
  const completedAt = status === "completed"
    ? new Date(new Date(startedAt).getTime() + completionMs).toISOString()
    : null;

  return {
    id: uid("p"),
    experimentId: experiment.id,
    status,
    isDemo: true,
    startedAt,
    completedAt,
    variantOrder,
    questionOrder,
    demographics,
    responses,
  };
}

function buildExperiment(def) {
  const now = new Date().toISOString();
  return {
    id: uid("exp"),
    isDemo: true,
    createdAt: now,
    updatedAt: now,
    createdBy: "Demo Researcher",
    settings: {
      randomizeVariantOrder: true,
      randomizeQuestionOrder: false,
      timeLimitSeconds: null,
      anonymous: true,
      requireConsent: true,
      preventDuplicates: true,
    },
    participantSettings: {
      targetCount: def.targetCount,
      ageRange: ["18", "65+"],
      countries: [],
      languages: [],
      demographicQuestions: ["ageRange", "country", "language"],
    },
    ...def,
  };
}

function generateExperimentWithParticipants(rand, def, { participantCount, abandonedCount = 0, status }) {
  const experiment = buildExperiment({ ...def, status });
  const participants = [];
  let idx = 0;
  for (let i = 0; i < participantCount; i++) participants.push(generateParticipant(rand, experiment, idx++, "completed"));
  for (let i = 0; i < abandonedCount; i++) participants.push(generateParticipant(rand, experiment, idx++, "abandoned"));
  return { experiment, participants };
}

export function generateDemoDataset() {
  const rand = mulberry32(hashStringToSeed("decisionos-demo-seed-v1"));
  const experiments = [];
  const participants = [];

  // 1) Flagship packaging study -- large completed sample, clear winner.
  {
    const variants = [
      { ...variant("A", "Classic Can", "Original red can design", PALETTE[0]), appealWeight: 2.0, premiumWeight: 1.4, recallWeight: 1.8, favoredInfluence: "Price" },
      { ...variant("B", "Modern Minimal", "Flat minimalist redesign", PALETTE[1]), appealWeight: 3.4, premiumWeight: 3.8, recallWeight: 3.0, favoredInfluence: "Design" },
      { ...variant("C", "Bold Gradient", "Vibrant gradient concept", PALETTE[2]), appealWeight: 1.6, premiumWeight: 1.8, recallWeight: 1.5, favoredInfluence: "Packaging" },
    ];
    const questions = [
      q({ type: "single_choice", appliesTo: "variants", role: "selection", prompt: "Imagine you are choosing a drink in a supermarket. Which product would you choose?" }),
      q({ type: "single_choice", role: "influence", prompt: "What influenced your decision most?", options: INFLUENCE_FACTORS }),
      q({ type: "single_choice", appliesTo: "variants", role: "premium", prompt: "Which product looks most premium?" }),
      q({ type: "recall", appliesTo: "variants", role: "recall", prompt: "Which product do you remember most clearly?" }),
    ];
    const { experiment, participants: ps } = generateExperimentWithParticipants(rand, {
      name: "Sparkling Drink Packaging Study",
      objective: "Identify which can redesign drives the strongest shelf preference before a national relaunch.",
      category: "Beverages",
      targetAudience: "Adults 18-45 who buy sparkling drinks at least monthly",
      description: "Three packaging directions tested against the current shelf context to see which earns the most first-choice picks.",
      researchType: "packaging_testing",
      variants, questions, targetCount: 150, demoMaxAgeDays: 52,
    }, { participantCount: 161, abandonedCount: 9, status: "completed" });
    experiments.push(experiment); participants.push(...ps);
  }

  // 2) Small-sample logo test -- triggers the "insufficient sample" warning.
  {
    const variants = [
      { ...variant("A", "Angular Mark", "Sharp geometric logo mark", PALETTE[0]), appealWeight: 2.2, premiumWeight: 2.0, recallWeight: 2.0, favoredInfluence: "Design" },
      { ...variant("B", "Rounded Mark", "Soft rounded logo mark", PALETTE[1]), appealWeight: 1.8, premiumWeight: 1.6, recallWeight: 1.7, favoredInfluence: "Brand" },
    ];
    const questions = [
      q({ type: "single_choice", appliesTo: "variants", role: "selection", prompt: "Which logo would you choose for this brand?" }),
      q({ type: "rating", appliesTo: "variants", role: "modernity", prompt: "How modern does this logo feel?", scale: { min: 1, max: 5 } }),
      q({ type: "yes_no", appliesTo: "general", prompt: "Would this logo make you trust the brand more?", baseYesRate: 0.55 }),
      q({ type: "open_text", prompt: "What's the first word that comes to mind when you see this logo?", samplePool: ["Clean", "Sharp", "Friendly", "Generic", "Bold", "Trustworthy"] }),
    ];
    const { experiment, participants: ps } = generateExperimentWithParticipants(rand, {
      name: "Energy Drink Logo Perception",
      objective: "Gauge early reaction to two logo redesign directions before committing design resources.",
      category: "Sports & Energy",
      targetAudience: "Adults 18-34 who consume energy drinks",
      description: "Early-stage pulse check on two logo concepts with a small panel ahead of a larger follow-up study.",
      researchType: "logo_testing",
      variants, questions, targetCount: 100, demoMaxAgeDays: 10,
    }, { participantCount: 22, abandonedCount: 2, status: "active" });
    experiments.push(experiment); participants.push(...ps);
  }

  // 3) Checkout UX test -- 3 variants, ranking + price perception.
  {
    const variants = [
      { ...variant("A", "Single Page", "One-step checkout", PALETTE[0]), appealWeight: 2.6, premiumWeight: 2.0, recallWeight: 2.2, favoredInfluence: "Quality perception" },
      { ...variant("B", "Multi-Step Wizard", "Three-step guided checkout", PALETTE[1]), appealWeight: 2.0, premiumWeight: 2.4, recallWeight: 1.8, favoredInfluence: "Design" },
      { ...variant("C", "Sidebar Summary", "Persistent order summary panel", PALETTE[2]), appealWeight: 2.9, premiumWeight: 2.6, recallWeight: 2.4, favoredInfluence: "Quality perception" },
    ];
    const questions = [
      q({ type: "single_choice", appliesTo: "variants", role: "selection", prompt: "Which checkout flow would you be most comfortable completing a purchase on?" }),
      q({ type: "rating", appliesTo: "variants", role: "ease", prompt: "How easy does this checkout flow feel to use?", scale: { min: 1, max: 7 } }),
      q({ type: "ranking", appliesTo: "variants", prompt: "Rank these flows from most to least trustworthy." }),
      q({ type: "price_perception", prompt: "What would you expect a plan using this checkout to cost per month?", options: ["$9", "$19", "$29", "$49", "$79"] }),
    ];
    const { experiment, participants: ps } = generateExperimentWithParticipants(rand, {
      name: "Checkout Page UX Comparison",
      objective: "Determine which checkout layout reduces perceived friction and feels most trustworthy.",
      category: "SaaS / E-commerce",
      targetAudience: "Online shoppers 25-54 in the US and UK",
      description: "Three checkout layouts tested for comfort, perceived ease and trust ahead of a redesign.",
      researchType: "ux_testing",
      variants, questions, targetCount: 120, demoMaxAgeDays: 34,
    }, { participantCount: 118, abandonedCount: 14, status: "completed" });
    experiments.push(experiment); participants.push(...ps);
  }

  // 4) Pricing research -- 4 price-point variants.
  {
    const variants = [
      { ...variant("A", "$12.99", "Entry price point", PALETTE[0]), appealWeight: 2.0, premiumWeight: 1.0, recallWeight: 1.6, favoredInfluence: "Price", basePrice: 12.99 },
      { ...variant("B", "$15.99", "Mid price point", PALETTE[1]), appealWeight: 3.0, premiumWeight: 2.2, recallWeight: 2.2, favoredInfluence: "Price", basePrice: 15.99 },
      { ...variant("C", "$18.99", "Premium price point", PALETTE[2]), appealWeight: 2.1, premiumWeight: 3.2, recallWeight: 1.8, favoredInfluence: "Quality perception", basePrice: 18.99 },
      { ...variant("D", "$22.99", "Super-premium price point", PALETTE[3]), appealWeight: 1.1, premiumWeight: 3.6, recallWeight: 1.2, favoredInfluence: "Quality perception", basePrice: 22.99 },
    ];
    const questions = [
      q({ type: "single_choice", appliesTo: "variants", role: "selection", prompt: "Which price feels like the best overall value to you?" }),
      q({ type: "rating", appliesTo: "variants", role: "fairness", prompt: "How fair does this price feel for the product shown?", scale: { min: 1, max: 5 } }),
      q({ type: "yes_no", appliesTo: "variants", prompt: "Would you purchase at this price?" }),
    ];
    const { experiment, participants: ps } = generateExperimentWithParticipants(rand, {
      name: "Premium Coffee Pricing Research",
      objective: "Find the price point that balances perceived value and purchase intent before shelf launch.",
      category: "Food & Beverage",
      targetAudience: "Adults 25-54 who buy specialty coffee",
      description: "Four price points on an identical package design, testing value perception and stated purchase intent.",
      researchType: "pricing_research",
      variants, questions, targetCount: 100, demoMaxAgeDays: 21,
    }, { participantCount: 96, abandonedCount: 6, status: "completed" });
    experiments.push(experiment); participants.push(...ps);
  }

  // 5) Ad concept test -- still collecting (active, partial progress).
  {
    const variants = [
      { ...variant("A", "Lifestyle Story", "Narrative lifestyle ad cut", PALETTE[0]), appealWeight: 2.3, premiumWeight: 2.0, recallWeight: 2.6, favoredInfluence: "Brand" },
      { ...variant("B", "Product Demo", "Fast-paced product demo cut", PALETTE[1]), appealWeight: 2.7, premiumWeight: 1.8, recallWeight: 2.0, favoredInfluence: "Quality perception" },
    ];
    const questions = [
      q({ type: "single_choice", appliesTo: "variants", role: "selection", prompt: "Which ad would make you more likely to try the product?" }),
      q({ type: "multiple_choice", role: "influence", prompt: "Which elements stood out to you? (Select all that apply)", options: ["Music", "Story", "Visuals", "Pacing", "Message clarity"] }),
      q({ type: "recall", appliesTo: "variants", role: "recall", prompt: "Which ad do you remember best?" }),
    ];
    const { experiment, participants: ps } = generateExperimentWithParticipants(rand, {
      name: "Streaming Service Ad Concepts",
      objective: "Compare two ad cuts for recall and purchase intent ahead of a paid media push.",
      category: "Media & Entertainment",
      targetAudience: "Adults 18-44 who stream video weekly",
      description: "Two 15-second ad concepts tested for stand-out elements, recall and intent to try the service.",
      researchType: "ad_testing",
      variants, questions, targetCount: 150, demoMaxAgeDays: 6,
    }, { participantCount: 71, abandonedCount: 5, status: "active" });
    experiments.push(experiment); participants.push(...ps);
  }

  // 6) Draft experiment -- not yet published, zero participants.
  {
    const variants = [
      { ...variant("A", "Classic Gift Box", "Traditional box shape and palette", PALETTE[0]), appealWeight: 1, premiumWeight: 1, recallWeight: 1 },
      { ...variant("B", "Sustainable Kraft", "Recycled kraft material concept", PALETTE[1]), appealWeight: 1, premiumWeight: 1, recallWeight: 1 },
    ];
    const questions = [
      q({ type: "single_choice", appliesTo: "variants", role: "selection", prompt: "Which gift box feels right for this brand?" }),
      q({ type: "rating", appliesTo: "variants", prompt: "How premium does this packaging feel?", scale: { min: 1, max: 5 } }),
    ];
    const experiment = buildExperiment({
      name: "Holiday Gift Box Brand Perception",
      objective: "Pressure-test two seasonal packaging directions before committing to print.",
      category: "Retail / Gifting",
      targetAudience: "Adults 25-60 who purchase gifts seasonally",
      description: "Draft experiment -- not yet published to participants.",
      researchType: "brand_perception",
      variants, questions, targetCount: 100, demoMaxAgeDays: 0, status: "draft",
    });
    experiments.push(experiment);
  }

  return { experiments, participants };
}
