import { mulberry32, hashStringToSeed } from "./prng.js";

// Generates every permutation of an array (fine for the small n we deal with:
// at most 4 variants / handful of questions per experiment).
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) result.push([arr[i], ...p]);
  }
  return result;
}

const permCache = new Map();
function cachedPermutations(ids) {
  const key = ids.join("|");
  if (!permCache.has(key)) permCache.set(key, permutations(ids));
  return permCache.get(key);
}

/**
 * Counterbalanced order assignment: cycles deterministically through every
 * permutation of `ids` so that, across enough participants, each item
 * appears in each position roughly equally often (prevents order bias).
 * `participantIndex` is the 0-based sequence number of the participant
 * within the experiment.
 */
export function counterbalancedOrder(ids, participantIndex) {
  if (ids.length <= 1) return ids.slice();
  if (ids.length <= 4) {
    const perms = cachedPermutations(ids);
    return perms[participantIndex % perms.length].slice();
  }
  // Too many permutations to enumerate (5+ items) -- fall back to a
  // deterministic seeded shuffle per participant, which still distributes
  // positions evenly over a large number of participants.
  const rand = mulberry32(hashStringToSeed(`order-${ids.join(",")}-${participantIndex}`));
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds the randomization assignment for one participant: the variant
 * display order and the question display order, honoring the experiment's
 * randomize toggles. When randomization is off, the stored (authored) order
 * is used for every participant.
 */
export function assignRandomization(experiment, participantIndex) {
  const variantIds = experiment.variants.map((v) => v.id);
  const questionIds = experiment.questions.map((q) => q.id);

  const variantOrder = experiment.settings.randomizeVariantOrder
    ? counterbalancedOrder(variantIds, participantIndex)
    : variantIds.slice();

  const questionOrder = experiment.settings.randomizeQuestionOrder
    ? counterbalancedOrder(questionIds, participantIndex)
    : questionIds.slice();

  return { variantOrder, questionOrder };
}
