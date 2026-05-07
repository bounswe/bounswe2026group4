export function truncateAtWord(text, maxChars = 80) {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatExactDate(dateValue, timeValue) {
  if (typeof dateValue !== "string") return "";
  const m = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const year = m[1];
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  const month = MONTHS[monthIdx] ?? m[2];
  const base = `${month}\u00a0${day},\u00a0${year}`;
  if (typeof timeValue === "string") {
    const t = timeValue.match(/^(\d{2}):(\d{2})/);
    if (t) return `${base}\u00a0${t[1]}:${t[2]}`;
  }
  return base;
}

export function formatTimePeriod(story) {
  const { time_type, year, year_start, year_end, date_value, time_value } = story;
  switch (time_type) {
    case "exact_year":
      return String(year);
    case "approximate_year":
      return `c.\u00a0${year}`;
    case "decade":
      return `${Math.floor(year / 10) * 10}s`;
    case "year_range":
      if (year_start == null || year_end == null) return "";
      return `${year_start}\u2013${year_end}`;
    case "exact_date":
      return formatExactDate(date_value, time_value);
    default:
      return "";
  }
}
