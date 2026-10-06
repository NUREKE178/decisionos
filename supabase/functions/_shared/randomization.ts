// Server-side port of src/lib/randomization.js. Kept in lockstep deliberately
// (same algorithm, same cycling-through-permutations approach) so behavior
// documented for researchers is identical regardless of where it runs.
// This is the ONLY copy that matters in production: order assignment here
// happens when the session row is created, server-side, before the
// participant's browser ever sees the variant list.

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) result.push([arr[i], ...p]);
  }
  return result;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function counterbalancedOrder<T extends string>(ids: T[], participantIndex: number): T[] {
  if (ids.length <= 1) return ids.slice();
  if (ids.length <= 4) {
    const perms = permutations(ids);
    return perms[participantIndex % perms.length].slice();
  }
  const rand = mulberry32(hashStringToSeed(`order-${ids.join(",")}-${participantIndex}`));
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
