import math
from typing import NamedTuple

EARTH_RADIUS_KM = 6371.0


class BoundingBox(NamedTuple):
    lat_min: float
    lat_max: float
    lng_min: float
    lng_max: float


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return great-circle distance in km between two (lat, lng) points."""
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(a))


def bounding_box(center_lat: float, center_lng: float, radius_km: float) -> BoundingBox:
    """Return a rectangular bounding box (over-approximation) around center point with given radius.

    NOTE: Antimeridian wrap (center near ±180° longitude) is not supported. When the
    box would cross ±180°, it is clamped and stories on the far side of the antimeridian
    are silently excluded. This is acceptable for this project's geographic scope (Turkey).
    """
    lat_delta = math.degrees(radius_km / EARTH_RADIUS_KM)
    # cos(90°) == 0 would cause division by zero; clamp to avoid it near poles
    safe_lat = min(abs(center_lat), 89.9999)
    lng_delta = math.degrees(radius_km / (EARTH_RADIUS_KM * math.cos(math.radians(safe_lat))))
    return BoundingBox(
        lat_min=max(center_lat - lat_delta, -90.0),
        lat_max=min(center_lat + lat_delta, 90.0),
        lng_min=max(center_lng - lng_delta, -180.0),
        lng_max=min(center_lng + lng_delta, 180.0),
    )
