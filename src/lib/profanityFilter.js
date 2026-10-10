// Lightweight, good-faith profanity guard for post bodies (RU/KK/EN common
// strong profanity). Stem-based, not an exhaustive dictionary: matches a
// word root plus any trailing letters, so inflected/declined forms (very
// common in Russian/Kazakh) are still caught without listing every form by
// hand. This is a client-side UX guard, not a hard security boundary -- a
// request sent directly to the API (bypassing the UI) isn't checked here.
//
// Moderation policy (moderatePost): zero matches -> post as-is. Exactly one
// -> censor that one word and let the post through (an incidental slip in
// an otherwise fine post, e.g. about marketing, shouldn't be killed
// entirely). Two or more -> block the whole post; that pattern reads as
// abuse rather than a slip.
//
// Stems below are written post-normalization (ё already folded to е), since
// the matching functions normalize before matching -- no need for a
// separate ё-spelled copy of each one.
const STEMS = [
  // Russian
  "хуй", "хуе", "хую", "хуя",
  "пизд",
  "еба", "ебат", "ебан", "ебн", "долбоеб",
  "мудак", "мудил",
  "бля",
  "сука", "сучк",
  "гандон",
  "пидор", "пидар",
  "залуп",
  // Kazakh
  "қотақ",
  "сіктір", "сігіл",
  "боқтаған", "боқмия",
  // English
  "fuck", "shit", "bitch", "asshole", "cunt",
];

const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(${STEMS.join("|")})[\\p{L}]*`, "giu");

/** Match offsets/text are against the ё-normalized string, but since that
 * substitution is 1-for-1 (never changes string length), the same offsets
 * are valid against the original, unnormalized text too. */
export function findProfanityMatches(text) {
  if (!text) return [];
  const normalized = text.replace(/ё/gi, "е");
  const re = new RegExp(PATTERN);
  const matches = [];
  let m;
  while ((m = re.exec(normalized))) matches.push({ index: m.index, length: m[0].length });
  return matches;
}

export function containsProfanity(text) {
  return findProfanityMatches(text).length > 0;
}

function maskWord(word) {
  return word.length <= 1 ? "*" : word[0] + "*".repeat(word.length - 1);
}

/** Replaces each matched span in the ORIGINAL text with asterisks (first
 * letter kept, so it reads as censorship rather than gibberish), preserving
 * everything else exactly as typed. */
export function censorProfanity(text) {
  const matches = findProfanityMatches(text);
  if (!matches.length) return text;
  let result = "";
  let last = 0;
  for (const m of matches) {
    result += text.slice(last, m.index);
    result += maskWord(text.slice(m.index, m.index + m.length));
    last = m.index + m.length;
  }
  return result + text.slice(last);
}

export function moderatePost(text) {
  const matches = findProfanityMatches(text);
  if (matches.length === 0) return { action: "clean", text };
  if (matches.length === 1) return { action: "censor", text: censorProfanity(text) };
  return { action: "block", text };
}
