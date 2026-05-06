"""Integration tests for the Nominatim geocoding proxy endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient


GEOCODE_URL = '/api/geocode/'
SUGGESTIONS_URL = '/api/geocode/suggestions/'
REVERSE_URL = '/api/geocode/reverse/'


def _nominatim_search_result(
    place_id=123,
    display_name='Istanbul, Turkey',
    name='Istanbul',
    lat='41.0082',
    lon='28.9784',
    boundingbox=None,
):
    return {
        'place_id': place_id,
        'display_name': display_name,
        'name': name,
        'lat': lat,
        'lon': lon,
        'boundingbox': boundingbox or ['40.8', '41.2', '28.6', '29.4'],
    }


def _nominatim_reverse_result(display_name='Istanbul, Fatih, Turkey'):
    return {'display_name': display_name}


def _mock_response(json_data, status_code=200):
    mock = MagicMock()
    mock.ok = status_code < 400
    mock.status_code = status_code
    mock.json.return_value = json_data
    return mock


@pytest.fixture(autouse=True)
def clear_geocoding_cache():
    """Prevent cache pollution between tests — LocMemCache persists within a process."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def client():
    return APIClient()


# ── /api/geocode/ ──────────────────────────────────────────────────────────────

class TestGeocodeView:
    def test_returns_bbox_for_known_place(self, client):
        result = _nominatim_search_result(
            boundingbox=['40.8', '41.2', '28.6', '29.4']
        )
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([result])
            resp = client.get(GEOCODE_URL, {'q': 'Istanbul'})

        assert resp.status_code == 200
        data = resp.json()
        assert data['lat_min'] == pytest.approx(40.8)
        assert data['lat_max'] == pytest.approx(41.2)
        assert data['lng_min'] == pytest.approx(28.6)
        assert data['lng_max'] == pytest.approx(29.4)

    def test_returns_null_when_nominatim_returns_empty(self, client):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([])
            resp = client.get(GEOCODE_URL, {'q': 'xyzzy_nonexistent_place'})

        assert resp.status_code == 200
        assert resp.json() is None

    def test_returns_null_for_missing_query_param(self, client):
        resp = client.get(GEOCODE_URL)
        assert resp.status_code == 200
        assert resp.json() is None

    def test_returns_null_for_blank_query(self, client):
        resp = client.get(GEOCODE_URL, {'q': '   '})
        assert resp.status_code == 200
        assert resp.json() is None

    def test_proxies_with_correct_user_agent(self, client):
        result = _nominatim_search_result()
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([result])
            client.get(GEOCODE_URL, {'q': 'Istanbul'})

        _, kwargs = mock_get.call_args
        headers = kwargs.get('headers', {})
        assert 'User-Agent' in headers
        assert headers['User-Agent']  # non-empty

    def test_second_identical_query_uses_cache(self, client):
        result = _nominatim_search_result()
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([result])
            client.get(GEOCODE_URL, {'q': 'Istanbul'})
            client.get(GEOCODE_URL, {'q': 'Istanbul'})

        assert mock_get.call_count == 1

    def test_normalises_bbox_so_min_is_smaller(self, client):
        # Nominatim sometimes returns bbox with swapped min/max
        result = _nominatim_search_result(boundingbox=['41.2', '40.8', '29.4', '28.6'])
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([result])
            resp = client.get(GEOCODE_URL, {'q': 'Istanbul'})

        data = resp.json()
        assert data['lat_min'] < data['lat_max']
        assert data['lng_min'] < data['lng_max']


# ── /api/geocode/suggestions/ ──────────────────────────────────────────────────

class TestSuggestionsView:
    def test_returns_suggestion_list(self, client):
        results = [
            _nominatim_search_result(place_id=1, name='Istanbul', display_name='Istanbul, Turkey'),
            _nominatim_search_result(place_id=2, name='İstanbul', display_name='İstanbul, Fatih, Turkey'),
        ]
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response(results)
            resp = client.get(SUGGESTIONS_URL, {'q': 'Istanbul'})

        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 2
        first = data[0]
        assert 'id' in first
        assert 'title' in first
        assert 'subtitle' in first
        assert 'bbox' in first

    def test_suggestion_bbox_has_correct_shape(self, client):
        result = _nominatim_search_result(boundingbox=['40.8', '41.2', '28.6', '29.4'])
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([result])
            resp = client.get(SUGGESTIONS_URL, {'q': 'Istanbul'})

        bbox = resp.json()[0]['bbox']
        assert set(bbox.keys()) == {'lat_min', 'lat_max', 'lng_min', 'lng_max'}

    def test_returns_empty_list_for_query_shorter_than_3_chars(self, client):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            resp = client.get(SUGGESTIONS_URL, {'q': 'Is'})

        assert resp.status_code == 200
        assert resp.json() == []
        mock_get.assert_not_called()

    def test_returns_empty_list_for_missing_query(self, client):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            resp = client.get(SUGGESTIONS_URL)

        assert resp.status_code == 200
        assert resp.json() == []
        mock_get.assert_not_called()

    def test_at_most_5_suggestions_returned(self, client):
        results = [_nominatim_search_result(place_id=i) for i in range(10)]
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response(results)
            resp = client.get(SUGGESTIONS_URL, {'q': 'Istanbul'})

        # Nominatim is called with limit=5; we verify our service passes it
        _, kwargs = mock_get.call_args
        params = kwargs.get('params', {})
        assert params.get('limit') == '5'

    def test_second_identical_query_uses_cache(self, client):
        result = _nominatim_search_result()
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([result])
            client.get(SUGGESTIONS_URL, {'q': 'Istanbul'})
            client.get(SUGGESTIONS_URL, {'q': 'Istanbul'})

        assert mock_get.call_count == 1


# ── /api/geocode/reverse/ ──────────────────────────────────────────────────────

class TestReverseView:
    def test_returns_place_name_for_valid_coordinates(self, client):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response(
                _nominatim_reverse_result('Istanbul, Fatih, Turkey')
            )
            resp = client.get(REVERSE_URL, {'lat': '41.0', 'lng': '28.9'})

        assert resp.status_code == 200
        data = resp.json()
        assert data['place_name'] == 'Istanbul, Fatih, Turkey'

    def test_returns_null_place_name_when_nominatim_returns_no_display_name(self, client):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response({})
            resp = client.get(REVERSE_URL, {'lat': '0.0', 'lng': '0.0'})

        assert resp.status_code == 200
        assert resp.json()['place_name'] is None

    def test_returns_null_place_name_for_missing_params(self, client):
        resp = client.get(REVERSE_URL)
        assert resp.status_code == 200
        assert resp.json()['place_name'] is None

    def test_proxies_correct_lat_lon_to_nominatim(self, client):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response(
                _nominatim_reverse_result('Some Place')
            )
            client.get(REVERSE_URL, {'lat': '41.015', 'lng': '28.979'})

        _, kwargs = mock_get.call_args
        params = kwargs.get('params', {})
        assert params.get('lat') == '41.015'
        assert params.get('lon') == '28.979'

    def test_second_identical_query_uses_cache(self, client):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response(
                _nominatim_reverse_result('Istanbul')
            )
            client.get(REVERSE_URL, {'lat': '41.0', 'lng': '28.9'})
            client.get(REVERSE_URL, {'lat': '41.0', 'lng': '28.9'})

        assert mock_get.call_count == 1
