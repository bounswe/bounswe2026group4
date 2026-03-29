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
      return `${year_start}\u2013${year_end}`;
    default:
      return "";
  }
}
