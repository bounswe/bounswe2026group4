/**
 * EDTF (Extended Date/Time Format) helpers for story temporal coverage.
 *
 * Mirrors backend/apps/stories/temporal.py — keep both in sync.
 *
 * EDTF examples:
 *   exact_year:       "1965"   (negative year = BC, e.g. -44 = 44 BC)
 *   approximate_year: "1965~"
 *   decade:           "196X"          (year=1960 → "196X")
 *   year_range:       "1950/1975"
 *   exact_date:       "1965-04-12" or "1965-04-12T14:30"
 *
 * ISO 8601 (lossy) for JSON-LD / Schema.org:
 *   approximate_year: "1965"
 *   decade:           "1960/1969"
 *   exact_date:       same as EDTF (already ISO-compatible)
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function decadeBase(year) {
  return Math.floor(Number(year) / 10) * 10;
}

export function toEDTF({
  time_type,
  year,
  year_start,
  year_end,
  date_value,
  time_value,
} = {}) {
  switch (time_type) {
    case "exact_year":
      return year != null && year !== "" ? String(year) : undefined;
    case "approximate_year":
      return year != null && year !== "" ? `${year}~` : undefined;
    case "decade":
      if (year == null || year === "") return undefined;
      return `${Math.floor(Number(year) / 10)}X`;
    case "year_range":
      if (year_start == null || year_start === "") return undefined;
      if (year_end == null || year_end === "") return undefined;
      return `${year_start}/${year_end}`;
    case "exact_date": {
      if (!date_value) return undefined;
      const base = formatDate(date_value);
      if (!base) return undefined;
      const t = formatTime(time_value);
      return t ? `${base}T${t}` : base;
    }
    default:
      return undefined;
  }
}

export function toISO8601({
  time_type,
  year,
  year_start,
  year_end,
  date_value,
  time_value,
} = {}) {
  switch (time_type) {
    case "exact_year":
    case "approximate_year":
      return year != null && year !== "" ? String(year) : undefined;
    case "decade": {
      if (year == null || year === "") return undefined;
      const base = decadeBase(year);
      return `${base}/${base + 9}`;
    }
    case "year_range":
      if (year_start == null || year_start === "") return undefined;
      if (year_end == null || year_end === "") return undefined;
      return `${year_start}/${year_end}`;
    case "exact_date": {
      if (!date_value) return undefined;
      const base = formatDate(date_value);
      if (!base) return undefined;
      const t = formatTime(time_value);
      return t ? `${base}T${t}` : base;
    }
    default:
      return undefined;
  }
}

function formatDate(value) {
  if (!value) return undefined;
  if (typeof value === "string") {
    // Already ISO-like (YYYY-MM-DD); take first 10 chars.
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  return undefined;
}

function formatTime(value) {
  if (!value) return undefined;
  if (typeof value === "string") {
    const m = value.match(/^(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : undefined;
  }
  return undefined;
}
