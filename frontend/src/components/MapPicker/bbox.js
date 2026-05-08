/**
 * Returns the geometric centre of a bounding box.
 * Used to drop the map pin at a sensible point inside a Nominatim result.
 */
export function bboxCenter(bbox) {
  return {
    lat: (bbox.latMin + bbox.latMax) / 2,
    lng: (bbox.lngMin + bbox.lngMax) / 2,
  };
}
