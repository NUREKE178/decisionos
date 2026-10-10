// Lightweight, good-faith profanity guard for post bodies (RU/KK/EN common
// strong profanity). Stem-based, not an exhaustive dictionary: matches a
// word root plus any trailing letters, so inflected/declined forms (very
// common in Russian/Kazakh) are still caught without listing every form by
// hand. This is a client-side UX guard, not a hard security boundary -- a
// request sent directly to the API (bypassing the UI) isn't checked here.
// Stems below are written post-normalization (ё already folded to е), since
// containsProfanity() normalizes before matching -- no need for a separate
// ё-spelled copy of each one.
const STEMS = [
  // Russian
  "хуй", "хуе", "хую", "хуя",
  "пизд",
  "еба", "ебат", "ебан", "ебн",
  "мудак", "мудил",
  "бля",
  "сука", "сучк",
  "гандон",
  "пидор", "пидар",
  // Kazakh
  "қотақ",
  "сіктір", "сігіл",
  "боқтаған", "боқмия",
  // English
  "fuck", "shit", "bitch", "asshole",
];

const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(${STEMS.join("|")})[\\p{L}]*`, "giu");

export function containsProfanity(text) {
  if (!text) return false;
  const normalized = text.replace(/ё/gi, "е");
  PATTERN.lastIndex = 0;
  return PATTERN.test(normalized);
}
