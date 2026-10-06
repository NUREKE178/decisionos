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
  "Это статистические оценки, основанные на наблюдаемом поведении участников в данной выборке, а не достоверные факты. " +
  "DecisionOS не читает мысли, не определяет эмоции и не гарантирует будущее поведение потребителей. " +
  "Используйте эти инсайты как один из факторов наряду с собственным суждением и дальнейшими исследованиями.";

function variantName(row) {
  return `Вариант ${row.label} (${row.name})`;
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
      whatHappened: ["Пока нет завершённых ответов. Опубликуйте эксперимент и соберите ответы участников, чтобы сгенерировать инсайты."],
      whyMightHaveHappened: [],
      recommendation: { text: "Пока недостаточно данных, чтобы рекомендовать направление.", confidence: "none" },
      sample,
      disclaimer: AI_DISCLAIMER,
    };
  }

  const choice = choiceStatsForQuestion(experiment, completed, selQ.id);
  const [top, runnerUp] = choice.rows;
  const marginPts = runnerUp ? (top.rate - runnerUp.rate) * 100 : top.rate * 100;

  if (!sample.sufficient) {
    whatHappened.push(
      `Недостаточно данных для надежного вывода (n=${sample.n}, рекомендуемый минимум ${MIN_RELIABLE_SAMPLE}). ` +
      `Направления ниже — лишь ранние сигналы.`
    );
  }

  whatHappened.push(
    `${variantName(top)} имел наивысшую долю выбора — ${pct(top.rate)} участников ` +
    `(95% ДИ ${pct(top.ci[0])}–${pct(top.ci[1])}, n=${choice.n}).`
  );
  if (runnerUp) {
    whatHappened.push(
      `Он опередил следующий по близости вариант, ${variantName(runnerUp)} (${pct(runnerUp.rate)}), на ${pts(marginPts)}.`
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
      whatHappened.push(`${variantName(leader)} был признан самым премиальным вариантом у ${pct(leader.rate)} участников.`);
    } else if (res.kind === "rating") {
      const sorted = res.data.slice().sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));
      const leader = sorted[0];
      if (leader && leader.mean != null) {
        premiumLeaderIsTop = leader.variantId === top.variantId;
        whatHappened.push(`${variantName(leader)} получил наивысшую оценку воспринимаемого качества/премиальности (среднее ${leader.mean.toFixed(2)}, n=${leader.n}).`);
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
      whatHappened.push(`${variantName(leader)} — вариант, который участники запомнили лучше всего, его назвали ${pct(leader.rate)} респондентов.`);
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
          `Участники, выбравшие ${variantName(top)}, также в ${lift.toFixed(1)} раза чаще оценивали его как самый премиальный вариант ` +
          `(${pct(aligned.rate)} против ${pct(base.rate)} среди тех, кто выбрал другое, n=${aligned.n}). ` +
          `Это ассоциация, наблюдаемая в данной выборке, а не доказательство того, что восприятие премиальности повлияло на выбор.`
        );
      }
    }
  } else if (premiumLeaderIsTop) {
    corroboration = true;
    whyMightHaveHappened.push(
      `${variantName(top)} лидировал как по выбору, так и по воспринимаемой премиальности, что может указывать на связь этих факторов для данной аудитории -- ` +
      `хотя данные не позволяют подтвердить, что именно (и влияет ли вообще одно на другое).`
    );
  }

  if (recallLeaderIsTop) {
    corroboration = true;
    whyMightHaveHappened.push(
      `${variantName(top)} также оказался наиболее запоминающимся вариантом, что может говорить о связи запоминаемости и предпочтения -- ` +
      `хотя запоминание и выбор могут просто отражать одну и ту же привлекательность, а не одно быть причиной другого.`
    );
  }

  const influenceQ = findQuestionByRole(experiment, "influence");
  if (influenceQ) {
    const topFactor = topInfluenceFactor(completed, influenceQ.id, selQ.id, top.variantId);
    const runnerFactor = runnerUp ? topInfluenceFactor(completed, influenceQ.id, selQ.id, runnerUp.variantId) : null;
    if (topFactor && topFactor.n >= 5) {
      let line = `Среди участников, выбравших ${variantName(top)}, ${pct(topFactor.rate)} назвали «${topFactor.factor}» главным фактором решения (n=${topFactor.n}).`;
      if (runnerFactor && runnerFactor.n >= 5 && runnerFactor.factor !== topFactor.factor) {
        line += ` Участники, выбравшие ${variantName(runnerUp)}, чаще называли «${runnerFactor.factor}» (${pct(runnerFactor.rate)}, n=${runnerFactor.n}) -- ` +
          `этот паттерн стоит проверить в дополнительном исследовании, прежде чем считать его надёжным фактором.`;
      }
      whyMightHaveHappened.push(line);
    }
  }

  if (whyMightHaveHappened.length === 0) {
    whyMightHaveHappened.push(
      "В этой выборке не обнаружено выраженного вторичного паттерна, кроме самого результата выбора. Рассмотрите возможность добавить " +
      "дополнительный вопрос (например, о воспринимаемом качестве или факторе влияния) в следующем запуске, чтобы лучше понять «почему»."
    );
  }

  const confidence = confidenceFor({ sufficient: sample.sufficient, marginPts, corroboration });
  let recText;
  if (!sample.sufficient) {
    const needed = Math.max(0, MIN_RELIABLE_SAMPLE - sample.n);
    recText = `Рассматривайте раннее лидерство ${variantName(top)} только как направление. Соберите ещё минимум ${needed} завершённых ответов, прежде чем использовать этот результат для принятия решения.`;
  } else if (confidence === "high") {
    recText = `${variantName(top)} — наиболее обоснованный вариант в данной выборке. Разрыв значителен (${pts(marginPts)}) и подтверждён второй метрикой, что снижает вероятность случайности.`;
  } else if (confidence === "moderate") {
    recText = `${variantName(top)} показывает заметное лидерство (${pts(marginPts)}) и является разумным выбором по умолчанию, хотя разрыв недостаточно велик, чтобы считать его окончательным.`;
  } else {
    recText = `${variantName(top)} незначительно впереди (${pts(marginPts)}), но разрыв достаточно мал, чтобы рекомендовать более крупное или дополнительное исследование перед принятием решения.`;
  }

  return {
    whatHappened,
    whyMightHaveHappened,
    recommendation: { text: recText, confidence, marginPts, topVariantId: top.variantId },
    sample,
    disclaimer: AI_DISCLAIMER,
  };
}
