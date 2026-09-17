import { API_BASE_URL, DEFAULT_SEARCH_LIMIT, TOP_PICKS_LIMIT } from '../config';

/**
 * Check backend server and database connectivity
 * GET /api/health
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message || 'Cannot reach backend server' };
  }
}

export async function fetchAppConfig() {
  const res = await fetch(`${API_BASE_URL}/api/config`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error('Unable to load app configuration');
  const data = await res.json();
  return {
    livePriceCheck: data?.capabilities?.live_price_check === true,
  };
}

/**
 * Fetch Top Picks for homepage
 * GET /api/top-picks?limit=8&city=...
 */
export async function fetchTopPicks({ limit = TOP_PICKS_LIMIT, city, area } = {}) {
  const params = new URLSearchParams();
  if (limit) params.append('limit', String(limit));
  if (city) params.append('city', city);
  if (area) params.append('area', area);

  const url = `${API_BASE_URL}/api/top-picks?${params.toString()}`;
  
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      let errDetail = 'Failed to load top picks';
      try {
        const errJson = await res.json();
        if (errJson.error) errDetail = errJson.error;
      } catch {
        // use fallback error message
      }
      throw new Error(`Server returned ${res.status}: ${errDetail}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Error fetching top picks:', err);
    throw err;
  }
}

/**
 * Search dishes across platforms
 * GET /api/search?dish=...&max_price=...&city=...&limit=...
 */
export async function searchDishes({ dish, max_price, city, area, limit = DEFAULT_SEARCH_LIMIT, offset = 0 } = {}) {
  const normalizedDish = typeof dish === 'string' ? dish.trim() : '';
  const hasMaxPrice = max_price !== undefined && max_price !== '' && Number(max_price) > 0;
  if (!normalizedDish && !hasMaxPrice) {
    throw new Error('Enter a dish name, a budget, or both');
  }

  const params = new URLSearchParams();
  if (normalizedDish) params.append('dish', normalizedDish);

  if (hasMaxPrice) {
    params.append('max_price', String(Math.floor(Number(max_price))));
  }

  if (city) {
    params.append('city', city.trim());
  }

  if (area) {
    params.append('area', area.trim());
  }

  if (limit) {
    params.append('limit', String(limit));
  }
  if (Number(offset) > 0) {
    params.append('offset', String(Math.floor(Number(offset))));
  }

  const url = `${API_BASE_URL}/api/search?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      let errDetail = 'Search request failed';
      try {
        const errJson = await res.json();
        if (errJson.error) errDetail = errJson.error;
      } catch {
        // use fallback error message
      }
      throw new Error(errDetail);
    }

    const data = await res.json();
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.results)) {
      throw new Error('Backend returned an invalid search response');
    }
    return {
      query: typeof data.query === 'string' ? data.query : normalizedDish,
      results: data.results,
      pagination: data.pagination && typeof data.pagination === 'object'
        ? data.pagination
        : { limit, offset, total: data.results.length, has_more: false, next_offset: null },
    };
  } catch (err) {
    console.error('Error searching dishes:', err);
    throw err;
  }
}

export async function fetchLucknowAreas() {
  const res = await fetch(`${API_BASE_URL}/api/locations/lucknow-areas`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error('Unable to load Lucknow coverage areas');
  const data = await res.json();
  return {
    maximumDistanceKm: Number(data.maximum_distance_km) || 15,
    areas: Array.isArray(data.areas) ? data.areas : [],
  };
}

export async function checkFinalPrice(itemId, { area } = {}) {
  const res = await fetch(`${API_BASE_URL}/api/final-price/${itemId}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ area: area || '' }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Unable to check final price');
    error.code = data.code;
    throw error;
  }
  return data;
}

export async function fetchPriceTrend(itemId) {
  const res = await fetch(`${API_BASE_URL}/api/price-trend/${itemId}`, {
    headers: { 'Accept': 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Price outlook is unavailable');
  return data;
}
