/**
 * Display helpers for historical years. Negative numbers represent BC
 * (a year of -44 = 44 BC); non-negative values render bare so the
 * existing AD-only UX stays unchanged.
 */

const EN_DASH = "–";

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatYearWithEra(n) {
  return n < 0 ? `${Math.abs(n)} BC` : `${n} AD`;
}

export function formatHistoricalYear(year) {
  const n = toFiniteNumber(year);
  if (n === null) return "";
  if (n < 0) return `${Math.abs(n)} BC`;
  return String(n);
}

/**
 * Format a closed range. Collapses the era suffix to one side when both
 * ends share an era; emits both when the range crosses the BC/AD line.
 *
 *   (1400, 1500)   → "1400–1500"
 *   (-300, -100)   → "300–100 BC"
 *   (-100, 50)     → "100 BC – 50 AD"
 */
export function formatHistoricalYearRange(start, end) {
  const s = toFiniteNumber(start);
  const e = toFiniteNumber(end);
  if (s === null || e === null) return "";
  if (s < 0 && e < 0) return `${Math.abs(s)}${EN_DASH}${Math.abs(e)} BC`;
  if (s >= 0 && e >= 0) return `${s}${EN_DASH}${e}`;
  return `${formatYearWithEra(s)} ${EN_DASH} ${formatYearWithEra(e)}`;
}

/**
 * Format a decade label from any year inside the decade. For BC the base
 * is the numerically smaller year (e.g. -50 covers 59 BC – 50 BC),
 * matching how the backend stores `year` for `time_type='decade'`.
 */
export function formatHistoricalDecade(year) {
  const n = toFiniteNumber(year);
  if (n === null) return "";
  const base = Math.floor(n / 10) * 10;
  if (base < 0) return `${Math.abs(base)}s BC`;
  return `${base}s`;
}
