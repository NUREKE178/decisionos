// Analytics engine. Every function here is a pure read over
// (experiment, participants) -- no hidden state, no mutation. Keeping it
// pure makes the numbers trustworthy: the same inputs always produce the
// same output, and the Results/Insights pages can recompute on every
// render without caching bugs.

export const MIN_RELIABLE_SAMPLE = 30;

export function completedParticipants(participants) {
  return participants.filter((p) => p.status === "completed");
}

export function sampleSizeCheck(n, threshold = MIN_RELIABLE_SAMPLE) {
  return {
    sufficient: n >= threshold,
    n,
    threshold,
    message: n >= threshold
      ? null
      : "Insufficient sample size for a reliable conclusion.",
  };
}

export function completionRate(participants) {
  const total = participants.length;
  const completed = participants.filter((p) => p.status === "completed").length;
  return { completed, total, rate: total ? completed / total : 0 };
}

export function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function median(arr) {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stddev(arr) {
  if (arr.length < 2) return null;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Wilson score interval for a binomial proportion -- better behaved than
 * the normal approximation for small n or proportions near 0/1, which is
 * exactly the regime small research panels tend to fall into.
 */
export function wilsonInterval(successes, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (center - margin) / denom), Math.min(1, (center + margin) / denom)];
}

export function responseTimeFor(participants, questionId) {
  const times = [];
  for (const p of participants) {
    const r = p.responses?.find((r) => r.questionId === questionId);
    if (r) times.push(r.responseTimeMs);
  }
  return { meanMs: mean(times), medianMs: median(times), n: times.length };
}

export function primarySelectionQuestion(experiment) {
  return (
    experiment.questions.find((q) => q.role === "selection") ??
    experiment.questions.find((q) => q.appliesTo === "variants" && q.type === "single_choice") ??
    experiment.questions[0] ??
    null
  );
}

function variantLookup(experiment) {
  const map = new Map();
  for (const v of experiment.variants) map.set(v.id, v);
  return map;
}

/** Selection-style stats for any variants/single_choice or recall question: count, rate, 95% CI per variant. */
export function choiceStatsForQuestion(experiment, participants, questionId) {
  const vmap = variantLookup(experiment);
  const counts = new Map(experiment.variants.map((v) => [v.id, 0]));
  let n = 0;
  for (const p of participants) {
    const r = p.responses?.find((r) => r.questionId === questionId);
    if (!r || r.value == null) continue;
    if (counts.has(r.value)) {
      counts.set(r.value, counts.get(r.value) + 1);
      n++;
    }
  }
  const rows = experiment.variants.map((v) => {
    const count = counts.get(v.id) ?? 0;
    const rate = n ? count / n : 0;
    const ci = wilsonInterval(count, n);
    return { variantId: v.id, label: v.label, name: v.name, color: v.color, count, rate, ci };
  });
  rows.sort((a, b) => b.rate - a.rate);
  return { rows, n, ...sampleSizeCheck(n) };
}

/** Rating stats (mean/median) for a rating question, per-variant or single-target. */
export function ratingStatsForQuestion(experiment, participants, question) {
  if (question.appliesTo === "variants") {
    return experiment.variants.map((v) => {
      const values = [];
      for (const p of participants) {
        const r = p.responses?.find((r) => r.questionId === question.id);
        if (r && r.value && typeof r.value === "object" && r.value[v.id] != null) values.push(r.value[v.id]);
      }
      return { variantId: v.id, label: v.label, name: v.name, mean: mean(values), median: median(values), n: values.length };
    });
  }
  const values = [];
  for (const p of participants) {
    const r = p.responses?.find((r) => r.questionId === question.id);
    if (r && typeof r.value === "number") values.push(r.value);
  }
  return [{ variantId: null, label: null, name: "Overall", mean: mean(values), median: median(values), n: values.length }];
}

/** Yes/No stats, per-variant or overall. */
export function yesNoStatsForQuestion(experiment, participants, question) {
  if (question.appliesTo === "variants") {
    return experiment.variants.map((v) => {
      let yes = 0, n = 0;
      for (const p of participants) {
        const r = p.responses?.find((r) => r.questionId === question.id);
        if (r && r.value && typeof r.value === "object" && typeof r.value[v.id] === "boolean") {
          n++; if (r.value[v.id]) yes++;
        }
      }
      return { variantId: v.id, label: v.label, name: v.name, yes, n, rate: n ? yes / n : 0, ci: wilsonInterval(yes, n) };
    });
  }
  let yes = 0, n = 0;
  for (const p of participants) {
    const r = p.responses?.find((r) => r.questionId === question.id);
    if (r && typeof r.value === "boolean") { n++; if (r.value) yes++; }
  }
  return [{ variantId: null, label: null, name: "Overall", yes, n, rate: n ? yes / n : 0, ci: wilsonInterval(yes, n) }];
}

/** Average rank per variant for a ranking question (1 = best). Lower avgRank is better. */
export function rankingStatsForQuestion(experiment, participants, question) {
  const sums = new Map(experiment.variants.map((v) => [v.id, { total: 0, n: 0 }]));
  for (const p of participants) {
    const r = p.responses?.find((r) => r.questionId === question.id);
    if (!Array.isArray(r?.value)) continue;
    r.value.forEach((variantId, idx) => {
      const bucket = sums.get(variantId);
      if (bucket) { bucket.total += idx + 1; bucket.n += 1; }
    });
  }
  return experiment.variants
    .map((v) => {
      const bucket = sums.get(v.id);
      return { variantId: v.id, label: v.label, name: v.name, avgRank: bucket.n ? bucket.total / bucket.n : null, n: bucket.n };
    })
    .sort((a, b) => (a.avgRank ?? 99) - (b.avgRank ?? 99));
}

/** Distribution of answers for a fixed-option single/multiple-choice question. */
export function optionDistributionForQuestion(participants, questionId, options) {
  const counts = new Map(options.map((o) => [o, 0]));
  let n = 0;
  for (const p of participants) {
    const r = p.responses?.find((r) => r.questionId === questionId);
    if (!r) continue;
    const values = Array.isArray(r.value) ? r.value : [r.value];
    for (const v of values) {
      if (counts.has(v)) counts.set(v, counts.get(v) + 1);
    }
    n++;
  }
  return {
    n,
    rows: options.map((o) => ({ option: o, count: counts.get(o) ?? 0, rate: n ? (counts.get(o) ?? 0) / n : 0 })),
  };
}

/** Price distribution for a price_perception question (fixed bands or free numeric). */
export function priceStatsForQuestion(participants, question) {
  const values = [];
  for (const p of participants) {
    const r = p.responses?.find((r) => r.questionId === question.id);
    if (r && r.value != null) values.push(r.value);
  }
  if (question.options) return optionDistributionForQuestion(participants, question.id, question.options);
  const numeric = values.filter((v) => typeof v === "number");
  return { n: numeric.length, mean: mean(numeric), median: median(numeric) };
}

export function openTextResponses(participants, questionId) {
  const out = [];
  for (const p of participants) {
    const r = p.responses?.find((r) => r.questionId === questionId);
    if (r && typeof r.value === "string") out.push(r.value);
  }
  return out;
}

/** Breaks a choice question's results down by a demographic key (ageRange, country, language). */
export function segmentBreakdown(experiment, participants, questionId, demographicKey) {
  const groups = new Map();
  for (const p of participants) {
    const key = p.demographics?.[demographicKey] ?? "Unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const segments = [];
  for (const [key, group] of groups) {
    segments.push({ segment: key, ...choiceStatsForQuestion(experiment, group, questionId) });
  }
  segments.sort((a, b) => b.n - a.n);
  return segments;
}

export function averageCompletionTimeMs(participants) {
  const times = [];
  for (const p of participants) {
    if (p.status === "completed" && p.startedAt && p.completedAt) {
      times.push(new Date(p.completedAt).getTime() - new Date(p.startedAt).getTime());
    }
  }
  return mean(times);
}

/** High-level KPI summary for a single experiment, used by Overview/Results cards. */
export function experimentSummary(experiment, allParticipants) {
  const participants = allParticipants.filter((p) => p.experimentId === experiment.id);
  const completed = completedParticipants(participants);
  const selQ = primarySelectionQuestion(experiment);
  const choice = selQ ? choiceStatsForQuestion(experiment, completed, selQ.id) : null;
  const top = choice?.rows?.[0] ?? null;
  const runnerUp = choice?.rows?.[1] ?? null;
  return {
    participantCount: completed.length,
    totalStarted: participants.length,
    completion: completionRate(participants),
    avgCompletionTimeMs: averageCompletionTimeMs(participants),
    sampleSize: sampleSizeCheck(completed.length),
    topVariant: top,
    marginPts: top && runnerUp ? (top.rate - runnerUp.rate) * 100 : top ? top.rate * 100 : 0,
  };
}

/** Generic dispatcher so UI code can render any question's stats without a type switch of its own. */
export function statsForQuestion(experiment, participants, question) {
  switch (question.type) {
    case "single_choice":
    case "recall":
      return question.appliesTo === "variants"
        ? { kind: "choice", data: choiceStatsForQuestion(experiment, participants, question.id) }
        : { kind: "distribution", data: optionDistributionForQuestion(participants, question.id, question.options ?? []) };
    case "multiple_choice":
      return { kind: "distribution", data: optionDistributionForQuestion(participants, question.id, question.options ?? []) };
    case "rating":
      return { kind: "rating", data: ratingStatsForQuestion(experiment, participants, question) };
    case "yes_no":
      return { kind: "yesno", data: yesNoStatsForQuestion(experiment, participants, question) };
    case "ranking":
      return { kind: "ranking", data: rankingStatsForQuestion(experiment, participants, question) };
    case "price_perception":
      return { kind: "price", data: priceStatsForQuestion(participants, question) };
    case "open_text":
      return { kind: "text", data: openTextResponses(participants, question.id) };
    default:
      return { kind: "unknown", data: null };
  }
}
