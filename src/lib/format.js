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
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function relativeDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function shortDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
