import hashlib
import threading
import time

import requests
from django.core.cache import cache

_NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
_USER_AGENT = 'LocalHistoryStoryMap/1.0 (Django proxy; contact: admin@example.com)'
_CACHE_TTL = 86400  # 24 hours
_SENTINEL = object()  # distinguishes "cached as None/[]" from "cache miss"

_rate_lock = threading.Lock()
_last_call_time = 0.0


def _nominatim_get(path, params):
    """Call Nominatim, honouring the 1 req/s server-side rate limit."""
    global _last_call_time
    with _rate_lock:
        now = time.monotonic()
        gap = now - _last_call_time
        if gap < 1.0:
            time.sleep(1.0 - gap)
        _last_call_time = time.monotonic()

    response = requests.get(
        f'{_NOMINATIM_BASE}{path}',
        params=params,
        headers={
            'User-Agent': _USER_AGENT,
            'Accept': 'application/json',
            'Accept-Language': 'en',
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def _cache_key(endpoint, raw_params):
    fingerprint = hashlib.md5(f'{endpoint}:{sorted(raw_params.items())}'.encode()).hexdigest()
    return f'geocode:{endpoint}:{fingerprint}'


def _parse_bbox(boundingbox):
    """Convert Nominatim boundingbox list to dict, ensuring min < max."""
    if not isinstance(boundingbox, (list, tuple)) or len(boundingbox) < 4:
        return None
    try:
        values = [float(v) for v in boundingbox[:4]]
    except (ValueError, TypeError):
        return None
    lat_min, lat_max = min(values[0], values[1]), max(values[0], values[1])
    lng_min, lng_max = min(values[2], values[3]), max(values[2], values[3])
    return {'lat_min': lat_min, 'lat_max': lat_max, 'lng_min': lng_min, 'lng_max': lng_max}


def geocode_search(q):
    """Return { lat_min, lat_max, lng_min, lng_max } for q, or None."""
    q = q.strip()
    if not q:
        return None

    params = {'q': q, 'format': 'jsonv2', 'limit': '1', 'addressdetails': '1'}
    key = _cache_key('search', params)
    cached = cache.get(key, _SENTINEL)
    if cached is not _SENTINEL:
        return cached

    results = _nominatim_get('/search', params)
    if not isinstance(results, list) or not results:
        result = None
    else:
        result = _parse_bbox(results[0].get('boundingbox'))

    cache.set(key, result, _CACHE_TTL)
    return result


def geocode_suggestions(q):
    """Return up to 5 { id, title, subtitle, bbox } suggestions for q."""
    q = q.strip()
    if len(q) < 3:
        return []

    params = {'q': q, 'format': 'jsonv2', 'limit': '5', 'addressdetails': '1'}
    key = _cache_key('suggestions', params)
    cached = cache.get(key, _SENTINEL)
    if cached is not _SENTINEL:
        return cached

    raw = _nominatim_get('/search', params)
    suggestions = []
    if isinstance(raw, list):
        for item in raw:
            lat = item.get('lat')
            lon = item.get('lon')
            display_name = (item.get('display_name') or '').strip()
            parts = [p.strip() for p in display_name.split(',') if p.strip()]
            title = (item.get('name') or '').strip() or (parts[0] if parts else None)
            if not title:
                continue
            subtitle = ', '.join(parts[1:]) if len(parts) > 1 else None
            suggestions.append({
                'id': str(item.get('place_id') or item.get('osm_id') or f'{lat},{lon}'),
                'title': title,
                'subtitle': subtitle,
                'bbox': _parse_bbox(item.get('boundingbox')),
            })

    cache.set(key, suggestions, _CACHE_TTL)
    return suggestions


def geocode_reverse(lat, lng):
    """Return a place-name string for coordinates, or None."""
    if lat is None or lng is None:
        return None

    params = {'lat': lat, 'lon': lng, 'format': 'jsonv2'}
    key = _cache_key('reverse', params)
    cached = cache.get(key, _SENTINEL)
    if cached is not _SENTINEL:
        return cached

    data = _nominatim_get('/reverse', params)
    result = (data.get('display_name') or '').strip() or None

    cache.set(key, result, _CACHE_TTL)
    return result
