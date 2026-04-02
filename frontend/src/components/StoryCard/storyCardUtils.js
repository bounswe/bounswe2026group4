export function truncateAtWord(text, maxChars = 80) {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

export function formatTimePeriod(story) {
  const { time_type, year, year_start, year_end } = story;
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
    default:
      return "";
  }
}
