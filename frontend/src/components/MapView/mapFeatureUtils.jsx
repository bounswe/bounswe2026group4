import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";

import StoryPopup from "./StoryPopup";

function featureToStory(feature) {
  const props = feature.properties ?? {};
  return {
    id: feature.id,
    title: props.title,
    location_name: props.location_name,
    time_type: props.time_type,
    year: props.year,
    year_start: props.year_start,
    year_end: props.year_end,
  };
}

export const pointToLayer = (_feature, latlng) => L.marker(latlng);

// XSS trust boundary: Leaflet's bindPopup treats this string as innerHTML.
// renderToStaticMarkup escapes every React child/attribute, so feature
// properties coming from our trusted API render safely. Any future change
// that embeds user-controlled HTML into StoryPopup must keep that escaping
// in place (or sanitize explicitly) to prevent XSS at this seam.
export const onEachFeature = (feature, layer) => {
  const html = renderToStaticMarkup(
    <StoryPopup story={featureToStory(feature)} />,
  );
  layer.bindPopup(html);
};
