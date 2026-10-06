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

export const AI_DISCLAIMER =
  "These are statistical estimates generated from observed participant behavior in this sample, not certainties. " +
  "DecisionOS does not read minds, detect emotions, or guarantee future consumer behavior. " +
  "Use these insights as one input alongside your own judgment and further research.";

function variantName(row) {
  return `Variant ${row.label} (${row.name})`;
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
 * Generates the researcher-facing interpretation for one experiment:
 * what happened, relationships worth noting (associational, not causal),
 * and a decision recommendation whose confidence is tied to sample size
 * and effect size.
 */
export function generateInsights(experiment, allParticipants) {
  const participants = allParticipants.filter((p) => p.experimentId === experiment.id);
  const completed = completedParticipants(participants);
  const sample = sampleSizeCheck(completed.length);
  const whatHappened = [];
  const whyMightHaveHappened = [];

  const selQ = primarySelectionQuestion(experiment);
  if (!selQ || completed.length === 0) {
    return {
      whatHappened: ["No completed responses yet. Publish this experiment and collect participant responses to generate insights."],
      whyMightHaveHappened: [],
      recommendation: { text: "Not enough data to recommend a direction yet.", confidence: "none" },
      sample,
      disclaimer: AI_DISCLAIMER,
    };
  }

  const choice = choiceStatsForQuestion(experiment, completed, selQ.id);
  const [top, runnerUp] = choice.rows;
  const marginPts = runnerUp ? (top.rate - runnerUp.rate) * 100 : top.rate * 100;

  if (!sample.sufficient) {
    whatHappened.push(
      `Insufficient sample size for a reliable conclusion (n=${sample.n}, recommended minimum ${MIN_RELIABLE_SAMPLE}). ` +
      `The directions below are early signals only.`
    );
  }

  whatHappened.push(
    `${variantName(top)} had the highest selection rate at ${pct(top.rate)} of participants ` +
    `(95% CI ${pct(top.ci[0])}–${pct(top.ci[1])}, n=${choice.n}).`
  );
  if (runnerUp) {
    whatHappened.push(
      `It led the next closest option, ${variantName(runnerUp)} (${pct(runnerUp.rate)}), by ${pts(marginPts)}.`
    );
  }

  let corroboration = false;

  const premiumQ = findQuestionByRole(experiment, "premium") ?? experiment.questions.find((q) => q.type === "rating" && q.appliesTo === "variants");
  let premiumLeaderIsTop = false;
  if (premiumQ) {
    const res = statsForQuestion(experiment, completed, premiumQ);
    if (res.kind === "choice" && res.data.rows[0]) {
      const leader = res.data.rows[0];
      premiumLeaderIsTop = leader.variantId === top.variantId;
      whatHappened.push(`${variantName(leader)} was rated the most premium-looking option by ${pct(leader.rate)} of participants.`);
    } else if (res.kind === "rating") {
      const sorted = res.data.slice().sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));
      const leader = sorted[0];
      if (leader && leader.mean != null) {
        premiumLeaderIsTop = leader.variantId === top.variantId;
        whatHappened.push(`${variantName(leader)} scored highest on perceived quality/premium-ness (mean ${leader.mean.toFixed(2)}, n=${leader.n}).`);
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
      whatHappened.push(`${variantName(leader)} was the option participants recalled most, cited by ${pct(leader.rate)} of respondents.`);
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
        whyMightHaveHappened.push(
          `Participants who selected ${variantName(top)} were also ${lift.toFixed(1)}x more likely to rate it the most premium-looking option ` +
          `(${pct(aligned.rate)} vs. ${pct(base.rate)} among those who chose something else, n=${aligned.n}). ` +
          `This is an association observed in this sample, not evidence that premium perception caused the choice.`
        );
      }
    }
  } else if (premiumLeaderIsTop) {
    corroboration = true;
    whyMightHaveHappened.push(
      `${variantName(top)} led on both selection and perceived premium-ness, which may indicate the two are related for this audience -- ` +
      `though the data cannot confirm which, if either, drives the other.`
    );
  }

  if (recallLeaderIsTop) {
    corroboration = true;
    whyMightHaveHappened.push(
      `${variantName(top)} was also the most recalled option, suggesting memorability may be associated with preference here, ` +
      `though recall and choice could both simply reflect the same underlying appeal rather than one causing the other.`
    );
  }

  const influenceQ = findQuestionByRole(experiment, "influence");
  if (influenceQ) {
    const topFactor = topInfluenceFactor(completed, influenceQ.id, selQ.id, top.variantId);
    const runnerFactor = runnerUp ? topInfluenceFactor(completed, influenceQ.id, selQ.id, runnerUp.variantId) : null;
    if (topFactor && topFactor.n >= 5) {
      let line = `Among participants who selected ${variantName(top)}, ${pct(topFactor.rate)} cited "${topFactor.factor}" as the main influence on their decision (n=${topFactor.n}).`;
      if (runnerFactor && runnerFactor.n >= 5 && runnerFactor.factor !== topFactor.factor) {
        line += ` Participants who chose ${variantName(runnerUp)} more often cited "${runnerFactor.factor}" (${pct(runnerFactor.rate)}, n=${runnerFactor.n}) -- ` +
          `a pattern worth validating with follow-up research before treating it as a reliable driver.`;
      }
      whyMightHaveHappened.push(line);
    }
  }

  if (whyMightHaveHappened.length === 0) {
    whyMightHaveHappened.push(
      "No strong secondary pattern was detected in this sample beyond the selection result itself. Consider adding a follow-up question " +
      "(e.g. perceived quality, influence factor) in a future run to better understand the \"why\" behind this result."
    );
  }

  const confidence = confidenceFor({ sufficient: sample.sufficient, marginPts, corroboration });
  let recText;
  if (!sample.sufficient) {
    const needed = Math.max(0, MIN_RELIABLE_SAMPLE - sample.n);
    recText = `Treat ${variantName(top)}'s early lead as directional only. Collect at least ${needed} more completed responses before using this result to make a decision.`;
  } else if (confidence === "high") {
    recText = `${variantName(top)} is the better-supported option in this sample. The lead is both sizeable (${pts(marginPts)}) and corroborated by a second metric, which lowers the chance this is noise.`;
  } else if (confidence === "moderate") {
    recText = `${variantName(top)} shows a meaningful lead (${pts(marginPts)}) and is a reasonable default choice, though the margin is not large enough to treat as certain.`;
  } else {
    recText = `${variantName(top)} is narrowly ahead (${pts(marginPts)}), but the margin is small enough that a larger or follow-up study is recommended before committing to this direction.`;
  }

  return {
    whatHappened,
    whyMightHaveHappened,
    recommendation: { text: recText, confidence, marginPts, topVariantId: top.variantId },
    sample,
    disclaimer: AI_DISCLAIMER,
  };
}
