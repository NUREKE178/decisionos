// Rule-based research interpreter. This intentionally stays deterministic
// and fully explainable: every sentence it produces traces back to a
// specific statistic computed by lib/stats.js. There is no hidden model
// making unverifiable claims -- which is also why the UI must always
// label this feature as "AI-generated research insights" / predictions,
// never as fact.
import {
  completedParticipants, primarySelectionQuestion, choiceStatsForQuestion,
  statsForQuestion, sampleSizeCheck, MIN_RELIABLE_SAMPLE,
} from "./stats.js";
import { pct, pts } from "./format.js";
import { t as translate } from "./i18n.js";

function variantName(row, t) {
  return t("insightsGen.variantName", { label: row.label, name: row.name });
}

function findQuestionByRole(experiment, role) {
  return experiment.questions.find((q) => q.role === role) ?? null;
}

/** Among participants who picked `targetVariantId` on the selection question, what fraction picked `targetVariantId` again on `question` (a variants-choice question like premium/recall)? */
function alignmentRate(experiment, participants, selectionQuestionId, question, targetVariantId) {
  let withTarget = 0, aligned = 0;
  for (const p of participants) {
    const sel = p.responses?.find((r) => r.questionId === selectionQuestionId);
    if (!sel || sel.value !== targetVariantId) continue;
    withTarget++;
    const other = p.responses?.find((r) => r.questionId === question.id);
    if (other && other.value === targetVariantId) aligned++;
  }
  return { n: withTarget, rate: withTarget ? aligned / withTarget : null };
}

/** Among participants who did NOT pick targetVariantId on selection, baseline rate of picking it on `question`. */
function baselineRate(experiment, participants, selectionQuestionId, question, targetVariantId) {
  let others = 0, picked = 0;
  for (const p of participants) {
    const sel = p.responses?.find((r) => r.questionId === selectionQuestionId);
    if (!sel || sel.value === targetVariantId) continue;
    others++;
    const other = p.responses?.find((r) => r.questionId === question.id);
    if (other && other.value === targetVariantId) picked++;
  }
  return { n: others, rate: others ? picked / others : null };
}

function topInfluenceFactor(participants, influenceQuestionId, selectionQuestionId, targetVariantId) {
  const counts = new Map();
  let n = 0;
  for (const p of participants) {
    const sel = p.responses?.find((r) => r.questionId === selectionQuestionId);
    if (!sel || sel.value !== targetVariantId) continue;
    const inf = p.responses?.find((r) => r.questionId === influenceQuestionId);
    if (!inf || inf.value == null) continue;
    const values = Array.isArray(inf.value) ? inf.value : [inf.value];
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    n++;
  }
  if (!n) return null;
  let best = null;
  for (const [factor, count] of counts) {
    if (!best || count > best.count) best = { factor, count };
  }
  return best ? { factor: best.factor, rate: best.count / n, n } : null;
}

function confidenceFor({ sufficient, marginPts, corroboration }) {
  if (!sufficient) return "low";
  if (marginPts >= 15 && corroboration) return "high";
  if (marginPts >= 8) return "moderate";
  if (marginPts >= 3) return "low-moderate";
  return "low";
}

/**
 * Generates the researcher-facing interpretation for one experiment: what
 * happened, relationships worth noting (associational, not causal), and a
 * decision recommendation whose confidence is tied to sample size and
 * effect size. `locale` (ru/kk/en) controls the generated sentences --
 * this is plain data generation, not a component, so it takes an explicit
 * locale rather than a hook; callers pass their useLocale() value.
 */
export function generateInsights(experiment, allParticipants, locale = "ru") {
  const t = (key, vars) => translate(locale, key, vars);
  const participants = allParticipants.filter((p) => p.experimentId === experiment.id);
  const completed = completedParticipants(participants);
  const sample = sampleSizeCheck(completed.length);
  const whatHappened = [];
  const whyMightHaveHappened = [];

  const selQ = primarySelectionQuestion(experiment);
  if (!selQ || completed.length === 0) {
    return {
      whatHappened: [t("insightsGen.noDataYet")],
      whyMightHaveHappened: [],
      recommendation: { text: t("insightsGen.noDataRecommendation"), confidence: "none" },
      sample,
      disclaimer: t("insightsGen.disclaimer"),
    };
  }

  const choice = choiceStatsForQuestion(experiment, completed, selQ.id);
  const [top, runnerUp] = choice.rows;
  const marginPts = runnerUp ? (top.rate - runnerUp.rate) * 100 : top.rate * 100;

  if (!sample.sufficient) {
    whatHappened.push(t("insightsGen.insufficientLeadIn", { n: sample.n, min: MIN_RELIABLE_SAMPLE }));
  }

  whatHappened.push(t("insightsGen.topRate", { top: variantName(top, t), rate: pct(top.rate), ciLow: pct(top.ci[0]), ciHigh: pct(top.ci[1]), n: choice.n }));
  if (runnerUp) {
    whatHappened.push(t("insightsGen.edgedOut", { runnerUp: variantName(runnerUp, t), rate: pct(runnerUp.rate), margin: pts(marginPts) }));
  }

  let corroboration = false;

  const premiumQ = findQuestionByRole(experiment, "premium") ?? experiment.questions.find((q) => q.type === "rating" && q.appliesTo === "variants");
  let premiumLeaderIsTop = false;
  if (premiumQ) {
    const res = statsForQuestion(experiment, completed, premiumQ);
    if (res.kind === "choice" && res.data.rows[0]) {
      const leader = res.data.rows[0];
      premiumLeaderIsTop = leader.variantId === top.variantId;
      whatHappened.push(t("insightsGen.premiumChoiceLeader", { leader: variantName(leader, t), rate: pct(leader.rate) }));
    } else if (res.kind === "rating") {
      const sorted = res.data.slice().sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));
      const leader = sorted[0];
      if (leader && leader.mean != null) {
        premiumLeaderIsTop = leader.variantId === top.variantId;
        whatHappened.push(t("insightsGen.premiumRatingLeader", { leader: variantName(leader, t), mean: leader.mean.toFixed(2), n: leader.n }));
      }
    }
  }

  const recallQ = findQuestionByRole(experiment, "recall") ?? experiment.questions.find((q) => q.type === "recall");
  let recallLeaderIsTop = false;
  if (recallQ) {
    const res = statsForQuestion(experiment, completed, recallQ);
    if (res.kind === "choice" && res.data.rows[0]) {
      const leader = res.data.rows[0];
      recallLeaderIsTop = leader.variantId === top.variantId;
      whatHappened.push(t("insightsGen.recallLeader", { leader: variantName(leader, t), rate: pct(leader.rate) }));
    }
  }

  // Associational "why" narratives -- always phrased as observed links in
  // this sample, never as proven causes.
  if (premiumQ && premiumQ.appliesTo === "variants" && premiumQ.type !== "rating") {
    const aligned = alignmentRate(experiment, completed, selQ.id, premiumQ, top.variantId);
    const base = baselineRate(experiment, completed, selQ.id, premiumQ, top.variantId);
    if (aligned.n >= 5 && base.rate != null && aligned.rate != null && base.rate > 0) {
      const lift = aligned.rate / base.rate;
      if (lift > 1.2) {
        corroboration = true;
        whyMightHaveHappened.push(t("insightsGen.premiumAlignment", {
          top: variantName(top, t), lift: lift.toFixed(1), alignedRate: pct(aligned.rate), baseRate: pct(base.rate), n: aligned.n,
        }));
      }
    }
  } else if (premiumLeaderIsTop) {
    corroboration = true;
    whyMightHaveHappened.push(t("insightsGen.premiumLeaderMatch", { top: variantName(top, t) }));
  }

  if (recallLeaderIsTop) {
    corroboration = true;
    whyMightHaveHappened.push(t("insightsGen.recallLeaderMatch", { top: variantName(top, t) }));
  }

  const influenceQ = findQuestionByRole(experiment, "influence");
  if (influenceQ) {
    const topFactor = topInfluenceFactor(completed, influenceQ.id, selQ.id, top.variantId);
    const runnerFactor = runnerUp ? topInfluenceFactor(completed, influenceQ.id, selQ.id, runnerUp.variantId) : null;
    if (topFactor && topFactor.n >= 5) {
      let line = t("insightsGen.influenceFactor", { top: variantName(top, t), rate: pct(topFactor.rate), factor: topFactor.factor, n: topFactor.n });
      if (runnerFactor && runnerFactor.n >= 5 && runnerFactor.factor !== topFactor.factor) {
        line += t("insightsGen.influenceFactorRunnerUp", { runnerUp: variantName(runnerUp, t), factor: runnerFactor.factor, rate: pct(runnerFactor.rate), n: runnerFactor.n });
      }
      whyMightHaveHappened.push(line);
    }
  }

  if (whyMightHaveHappened.length === 0) {
    whyMightHaveHappened.push(t("insightsGen.noSecondaryPattern"));
  }

  const confidence = confidenceFor({ sufficient: sample.sufficient, marginPts, corroboration });
  let recText;
  if (!sample.sufficient) {
    const needed = Math.max(0, MIN_RELIABLE_SAMPLE - sample.n);
    recText = t("insightsGen.recInsufficient", { top: variantName(top, t), needed });
  } else if (confidence === "high") {
    recText = t("insightsGen.recHigh", { top: variantName(top, t), margin: pts(marginPts) });
  } else if (confidence === "moderate") {
    recText = t("insightsGen.recModerate", { top: variantName(top, t), margin: pts(marginPts) });
  } else {
    recText = t("insightsGen.recLow", { top: variantName(top, t), margin: pts(marginPts) });
  }

  return {
    whatHappened,
    whyMightHaveHappened,
    recommendation: { text: recText, confidence, marginPts, topVariantId: top.variantId },
    sample,
    disclaimer: t("insightsGen.disclaimer"),
  };
}
