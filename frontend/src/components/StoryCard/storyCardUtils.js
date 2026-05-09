import {
  formatHistoricalDecade,
  formatHistoricalYear,
  formatHistoricalYearRange,
} from "@/utils/year";

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
  const base = `${month} ${day}, ${year}`;
  if (typeof timeValue === "string") {
    const t = timeValue.match(/^(\d{2}):(\d{2})/);
    if (t) return `${base} ${t[1]}:${t[2]}`;
  }
  return base;
}

export function formatTimePeriod(story) {
  const { time_type, year, year_start, year_end, date_value, time_value } = story;
  switch (time_type) {
    case "exact_year":
      return formatHistoricalYear(year);
    case "approximate_year": {
      const formatted = formatHistoricalYear(year);
      return formatted ? `c. ${formatted}` : "";
    }
    case "decade":
      return formatHistoricalDecade(year);
    case "year_range":
      return formatHistoricalYearRange(year_start, year_end);
    case "exact_date":
      return formatExactDate(date_value, time_value);
    default:
      return "";
  }
}
