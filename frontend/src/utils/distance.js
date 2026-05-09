/**
 * Format a kilometre distance for human-readable display: values below 1 km
 * are rounded to whole metres, otherwise the kilometre value is shown as-is.
 */
export function formatDistanceKm(radiusKm) {
  if (radiusKm < 1) return `${Math.round(radiusKm * 1000)} m`;
  return `${radiusKm} km`;
}
