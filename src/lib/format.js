export function pct(x, digits = 0) {
  if (x == null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function pts(x, digits = 1) {
  if (x == null || Number.isNaN(x)) return "—";
  return `${x.toFixed(digits)} pts`;
}

export function num(x, digits = 1) {
  if (x == null || Number.isNaN(x)) return "—";
  return x.toFixed(digits);
}

export function money(x, digits = 2) {
  if (x == null || Number.isNaN(x)) return "—";
  return `$${x.toFixed(digits)}`;
}

export function durationFromMs(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m} мин ${s} с` : `${s} с`;
}

export function relativeDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  if (days < 30) return `${days} дн. назад`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} мес. назад`;
  return `${Math.floor(months / 12)} г. назад`;
}

export function shortDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { month: "short", day: "numeric", year: "numeric" });
}
