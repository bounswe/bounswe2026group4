import math

import pytest

from common.utils.geo import BoundingBox, bounding_box, haversine_km

# Istanbul and Ankara coordinates for a real-world distance check
ISTANBUL_LAT, ISTANBUL_LNG = 41.015137, 28.979530
ANKARA_LAT, ANKARA_LNG = 39.925533, 32.866287
ISTANBUL_ANKARA_KM = 351.0  # approximate great-circle distance


class TestHaversineKm:
    def test_same_point_returns_zero(self):
        assert haversine_km(41.0, 28.9, 41.0, 28.9) == 0.0

    def test_known_distance_istanbul_to_ankara(self):
        distance = haversine_km(ISTANBUL_LAT, ISTANBUL_LNG, ANKARA_LAT, ANKARA_LNG)
        assert distance == pytest.approx(ISTANBUL_ANKARA_KM, rel=0.01)

    def test_symmetry(self):
        d1 = haversine_km(ISTANBUL_LAT, ISTANBUL_LNG, ANKARA_LAT, ANKARA_LNG)
        d2 = haversine_km(ANKARA_LAT, ANKARA_LNG, ISTANBUL_LAT, ISTANBUL_LNG)
        assert d1 == pytest.approx(d2)

    def test_returns_positive_value_for_distinct_points(self):
        assert haversine_km(0.0, 0.0, 1.0, 1.0) > 0.0

    def test_one_degree_latitude_is_approximately_111km(self):
        # One degree of latitude is ~111.32 km at any longitude
        distance = haversine_km(0.0, 0.0, 1.0, 0.0)
        assert distance == pytest.approx(111.195, rel=0.005)

    def test_equator_crossing(self):
        # Crossing the equator should work without sign errors
        distance = haversine_km(-0.5, 0.0, 0.5, 0.0)
        assert distance == pytest.approx(111.195, rel=0.01)


class TestBoundingBox:
    CENTER_LAT = 41.015137
    CENTER_LNG = 28.979530
    RADIUS_KM = 5.0

    def _box(self, radius_km=None):
        return bounding_box(self.CENTER_LAT, self.CENTER_LNG, radius_km or self.RADIUS_KM)

    def test_returns_bounding_box_namedtuple(self):
        result = self._box()
        assert isinstance(result, BoundingBox)

    def test_lat_min_less_than_lat_max(self):
        box = self._box()
        assert box.lat_min < box.lat_max

    def test_lng_min_less_than_lng_max(self):
        box = self._box()
        assert box.lng_min < box.lng_max

    def test_center_point_is_within_box(self):
        box = self._box()
        assert box.lat_min <= self.CENTER_LAT <= box.lat_max
        assert box.lng_min <= self.CENTER_LNG <= box.lng_max

    def test_larger_radius_produces_larger_box(self):
        box_1km = bounding_box(self.CENTER_LAT, self.CENTER_LNG, 1.0)
        box_10km = bounding_box(self.CENTER_LAT, self.CENTER_LNG, 10.0)
        assert (box_10km.lat_max - box_10km.lat_min) > (box_1km.lat_max - box_1km.lat_min)
        assert (box_10km.lng_max - box_10km.lng_min) > (box_1km.lng_max - box_1km.lng_min)

    def test_near_north_pole_does_not_raise(self):
        # Should not raise ZeroDivisionError even near the pole
        box = bounding_box(89.9, 0.0, 1.0)
        assert box.lat_min <= 89.9 <= box.lat_max

    def test_near_south_pole_does_not_raise(self):
        box = bounding_box(-89.9, 0.0, 1.0)
        assert box.lat_min <= -89.9 <= box.lat_max

    def test_lat_clamped_to_90(self):
        # A very large radius should not produce lat values beyond ±90
        box = bounding_box(89.0, 0.0, 5000.0)
        assert box.lat_max <= 90.0
        assert box.lat_min >= -90.0

    def test_lng_clamped_to_180(self):
        # A point near the antimeridian with a large radius should clamp to ±180
        box = bounding_box(0.0, 179.0, 500.0)
        assert box.lng_max <= 180.0

    def test_lng_clamped_to_minus_180(self):
        box = bounding_box(0.0, -179.0, 500.0)
        assert box.lng_min >= -180.0

    def test_points_within_radius_are_inside_box(self):
        # The bounding box is an over-approximation: every point truly inside the
        # circle must lie within the box (but not vice-versa).
        center_lat, center_lng, radius_km = 41.0, 29.0, 2.0
        box = bounding_box(center_lat, center_lng, radius_km)

        # Generate a grid of points known to be inside the radius
        # by computing offsets slightly smaller than radius_km
        step_km = 0.4
        for dlat_km in range(-4, 5):
            for dlng_km in range(-4, 5):
                dlat = math.degrees(dlat_km * step_km / 6371.0)
                dlng = math.degrees(dlng_km * step_km / (6371.0 * math.cos(math.radians(center_lat))))
                pt_lat = center_lat + dlat
                pt_lng = center_lng + dlng
                if haversine_km(center_lat, center_lng, pt_lat, pt_lng) <= radius_km:
                    assert box.lat_min <= pt_lat <= box.lat_max, (
                        f"Point ({pt_lat}, {pt_lng}) inside radius but outside bounding box lat"
                    )
                    assert box.lng_min <= pt_lng <= box.lng_max, (
                        f"Point ({pt_lat}, {pt_lng}) inside radius but outside bounding box lng"
                    )
