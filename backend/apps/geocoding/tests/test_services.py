"""Isolated unit tests for geocoding service functions."""

import requests as requests_lib
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from apps.geocoding.services import (
    _parse_bbox,
    geocode_reverse,
    geocode_search,
    geocode_suggestions,
)


@pytest.fixture(autouse=True)
def clear_geocoding_cache():
    cache.clear()
    yield
    cache.clear()


def _mock_response(json_data, status_code=200):
    mock = MagicMock()
    mock.ok = status_code < 400
    mock.status_code = status_code
    mock.json.return_value = json_data
    return mock


def _search_result(place_id=1, name='Istanbul', display_name='Istanbul, Turkey', boundingbox=None):
    return {
        'place_id': place_id,
        'display_name': display_name,
        'name': name,
        'lat': '41.0',
        'lon': '28.9',
        'boundingbox': boundingbox or ['40.8', '41.2', '28.6', '29.4'],
    }


# ── _parse_bbox ───────────────────────────────────────────────────────────────

class TestParseBbox:
    def test_returns_correct_dict(self):
        result = _parse_bbox(['40.8', '41.2', '28.6', '29.4'])
        assert result == {'lat_min': 40.8, 'lat_max': 41.2, 'lng_min': 28.6, 'lng_max': 29.4}

    def test_normalises_swapped_min_max(self):
        result = _parse_bbox(['41.2', '40.8', '29.4', '28.6'])
        assert result['lat_min'] < result['lat_max']
        assert result['lng_min'] < result['lng_max']

    def test_returns_none_for_short_list(self):
        assert _parse_bbox(['40.8', '41.2', '28.6']) is None

    def test_returns_none_for_non_numeric_values(self):
        assert _parse_bbox(['40.8', 'abc', '28.6', '29.4']) is None

    def test_returns_none_for_none(self):
        assert _parse_bbox(None) is None

    def test_returns_none_for_non_sequence(self):
        assert _parse_bbox('not a list') is None


# ── geocode_search ────────────────────────────────────────────────────────────

class TestGeocodeSearch:
    def test_returns_none_for_empty_query(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            result = geocode_search('')
        assert result is None
        mock_get.assert_not_called()

    def test_returns_none_for_blank_query(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            result = geocode_search('   ')
        assert result is None
        mock_get.assert_not_called()

    def test_returns_bbox_for_valid_result(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([_search_result()])
            result = geocode_search('Istanbul')
        assert result == {'lat_min': 40.8, 'lat_max': 41.2, 'lng_min': 28.6, 'lng_max': 29.4}

    def test_returns_none_when_nominatim_returns_empty_list(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([])
            result = geocode_search('xyzzy')
        assert result is None

    def test_caches_result_on_second_call(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([_search_result()])
            geocode_search('istanbul')
            geocode_search('istanbul')
        assert mock_get.call_count == 1

    def test_caches_none_result_as_sentinel(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([])
            geocode_search('xyzzy')
            geocode_search('xyzzy')
        assert mock_get.call_count == 1

    def test_lowercases_query_for_cache_key(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([_search_result()])
            geocode_search('Istanbul')
            geocode_search('ISTANBUL')
        assert mock_get.call_count == 1

    def test_does_not_request_addressdetails(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([_search_result()])
            geocode_search('Istanbul')
        _, kwargs = mock_get.call_args
        assert 'addressdetails' not in kwargs.get('params', {})


# ── geocode_suggestions ───────────────────────────────────────────────────────

class TestGeocodeSuggestions:
    def test_returns_empty_for_short_query(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            result = geocode_suggestions('Is')
        assert result == []
        mock_get.assert_not_called()

    def test_returns_empty_for_empty_query(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            result = geocode_suggestions('')
        assert result == []
        mock_get.assert_not_called()

    def test_returns_suggestion_with_correct_shape(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([_search_result()])
            result = geocode_suggestions('Istanbul')
        assert len(result) == 1
        assert set(result[0].keys()) == {'id', 'title', 'subtitle', 'bbox'}

    def test_title_falls_back_to_first_display_name_part(self):
        item = _search_result(name='', display_name='Unnamed District, Turkey')
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([item])
            result = geocode_suggestions('unm')
        assert result[0]['title'] == 'Unnamed District'
        assert result[0]['subtitle'] == 'Turkey'

    def test_skips_items_with_no_resolvable_title(self):
        item = _search_result(name='', display_name='')
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([item])
            result = geocode_suggestions('xyz')
        assert result == []

    def test_caches_result_on_second_call(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response([_search_result()])
            geocode_suggestions('istanbul')
            geocode_suggestions('istanbul')
        assert mock_get.call_count == 1

    def test_raises_nominatim_unavailable_on_connection_error(self):
        from apps.geocoding.services import NominatimUnavailable
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.side_effect = requests_lib.exceptions.ConnectionError('unreachable')
            with pytest.raises(NominatimUnavailable):
                geocode_suggestions('istanbul')


# ── geocode_reverse ───────────────────────────────────────────────────────────

class TestGeocodeReverse:
    def test_returns_none_for_none_lat(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            result = geocode_reverse(None, '28.9')
        assert result is None
        mock_get.assert_not_called()

    def test_returns_none_for_none_lng(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            result = geocode_reverse('41.0', None)
        assert result is None
        mock_get.assert_not_called()

    def test_returns_none_for_non_numeric_coords(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            result = geocode_reverse('abc', 'xyz')
        assert result is None
        mock_get.assert_not_called()

    def test_returns_none_for_out_of_range_lat(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            result = geocode_reverse('91', '28.9')
        assert result is None
        mock_get.assert_not_called()

    def test_returns_none_for_out_of_range_lng(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            result = geocode_reverse('41.0', '181')
        assert result is None
        mock_get.assert_not_called()

    def test_returns_place_name_for_valid_coords(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response({'display_name': 'Istanbul, Fatih, Turkey'})
            result = geocode_reverse('41.0', '28.9')
        assert result == 'Istanbul, Fatih, Turkey'

    def test_returns_none_for_empty_display_name(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response({'display_name': ''})
            result = geocode_reverse('0.0', '0.0')
        assert result is None

    def test_caches_result_on_second_call(self):
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response({'display_name': 'Istanbul'})
            geocode_reverse('41.0', '28.9')
            geocode_reverse('41.0', '28.9')
        assert mock_get.call_count == 1

    def test_normalises_coordinates_for_cache_key(self):
        """Equivalent coords expressed with different precision share the same cache entry."""
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.return_value = _mock_response({'display_name': 'Istanbul'})
            geocode_reverse('41.0', '28.9')
            geocode_reverse('41.00000', '28.90000')
        assert mock_get.call_count == 1

    def test_raises_nominatim_unavailable_on_connection_error(self):
        from apps.geocoding.services import NominatimUnavailable
        with patch('apps.geocoding.services.requests.get') as mock_get:
            mock_get.side_effect = requests_lib.exceptions.ConnectionError('unreachable')
            with pytest.raises(NominatimUnavailable):
                geocode_reverse('41.0', '28.9')
