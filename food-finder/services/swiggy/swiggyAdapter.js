const { callTool, SwiggyMcpError } = require('./swiggyMcpClient');

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no', ''].includes(normalized)) return false;
  }
  return Boolean(value);
}

/**
 * Parses text-based search_menu output if not returned as raw JSON
 */
function parseMenuTextOutput(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split('\n');
  const items = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^\d+\./.test(trimmed)) continue;

    // Pattern handles both: with rating (| 4.4★ |) and without rating (| Restaurant)
    const match = trimmed.match(
      /^\d+\.\s*(.+?)\s*—\s*₹(\d+)\s*\|\s*([^\|]+?)(?:\s*\|\s*([\d\.]+)★)?\s*\|\s*(.+?)\s*\(restaurantId:\s*([^)]+)\)\s*\(ID:\s*([^)]+)\)/i
    );

    if (match) {
      items.push({
        name: match[1].trim(),
        price: Number(match[2]),
        isVeg: match[3].includes('Veg'),
        rating: match[4] ? Number(match[4]) : null,
        restaurant_name: match[5].trim(),
        restaurant_id: match[6].trim(),
        menu_item_id: match[7].trim(),
        inStock: 1,
      });
    }
  }

  return items;
}

/**
 * Parses the category-based text returned by get_restaurant_menu.
 * Repeated items (for example in "Recommended" and a category) are deduplicated.
 */
function parseRestaurantMenuText(text, fallbackRestaurantId) {
  if (!text || typeof text !== 'string') {
    return { restaurant: {}, items: [] };
  }

  const header = text.match(/^Menu for (.+?) \(ID:\s*([^)]+)\)/m);
  const restaurant = {
    id: header?.[2]?.trim() || String(fallbackRestaurantId || ''),
    name: header?.[1]?.trim() || '',
  };
  const deduplicated = new Map();

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) continue;

    const match = trimmed.match(
      /^-\s+(.+?)\s+—\s+₹([\d,.]+)\s*\|\s*(.+?)\s*(?:\[image:\s*(https?:\/\/[^\]]+)\]\s*)?\(ID:\s*([^)]+)\)\s*$/i,
    );
    if (!match) continue;

    const attributes = match[3].trim();
    const itemId = match[5].trim();
    if (deduplicated.has(itemId)) continue;

    deduplicated.set(itemId, {
      id: itemId,
      name: match[1].trim(),
      price: Number(match[2].replace(/,/g, '')),
      isVeg: !/\bnon[-\s]?veg\b/i.test(attributes) && /\bveg\b/i.test(attributes),
      inStock: 1,
      imageUrl: match[4] || null,
      hasAddons: /\bcustomi[sz]able\b/i.test(attributes),
    });
  }

  return { restaurant, items: [...deduplicated.values()] };
}

/**
 * Normalizes a single Swiggy menu item into Bhook's unified internal schema
 */
function normalizeItem(raw, context = {}) {
  const restaurantId = String(raw.restaurant_id || raw.restaurantId || context.restaurantId || '');
  const restaurantName = raw.restaurant_name || raw.restaurantName || context.restaurantName || '';
  const itemId = String(raw.menu_item_id || raw.menuItemId || raw.id || '');
  const itemName = raw.name || raw.item_name || '';
  const price = Number(raw.price ?? raw.price_inr ?? 0);

  // inStock: 1 / 0 or boolean
  let availability = true;
  if (raw.inStock !== undefined) {
    availability = toBoolean(raw.inStock, true);
  }

  return {
    platform: 'swiggy',
    restaurant_id: restaurantId,
    restaurant_name: restaurantName,
    item_id: itemId,
    item_name: itemName,
    price: price,
    availability: availability,
    is_veg: toBoolean(raw.isVeg ?? raw.veg),
    rating: raw.rating != null ? Number(raw.rating) : (raw.restaurantRating != null ? Number(raw.restaurantRating) : null),
    image_url: raw.imageUrl || raw.image_url || null,
    has_customizations: Boolean(
      raw.hasAddons
      || (Array.isArray(raw.addons) && raw.addons.length)
      || (Array.isArray(raw.variations) && raw.variations.length)
      || (Array.isArray(raw.variantsV2) && raw.variantsV2.length)
    ),
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Fetch saved delivery addresses for the authenticated user
 */
async function getAddresses({ page = 1, pageSize = 10 } = {}) {
  const raw = await callTool('get_addresses', { page, pageSize });

  // If already structured
  if (raw && typeof raw === 'object' && Array.isArray(raw.addresses)) {
    return raw;
  }

  // If text output, extract addresses
  const text = String(raw || '');
  const addresses = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\d+\.\s*(?:\[(.*?)\])?\s*(.*?)\s*\(ID:\s*([^)]+)\)/i);
    if (match) {
      addresses.push({
        id: match[3].trim(),
        addressTag: match[1] || 'Saved',
        addressLine: match[2].trim(),
      });
    }
  }

  return {
    addresses,
    raw_text: text,
  };
}

/**
 * Helper: Resolve an addressId (use provided or auto-pick first saved address)
 */
async function resolveAddressId(providedAddressId) {
  if (providedAddressId && typeof providedAddressId === 'string' && providedAddressId.trim()) {
    return providedAddressId.trim();
  }

  const raw = await callTool('get_addresses', { page: 1, pageSize: 5 });

  // 1. If structured
  if (raw && typeof raw === 'object' && Array.isArray(raw.addresses) && raw.addresses.length > 0) {
    return raw.addresses[0].id;
  }

  // 2. If text-based response
  const text = String(raw || '');
  const suggestedMatch = text.match(/Suggested\/preselected address ID:\s*([^\s\.]+)/i);
  if (suggestedMatch) {
    return suggestedMatch[1].trim();
  }

  const idMatch = text.match(/\(ID:\s*([^)]+)\)/i);
  if (idMatch) {
    return idMatch[1].trim();
  }

  throw new SwiggyMcpError(
    'No saved addresses found in your Swiggy account. An address is required by Swiggy Food tools.',
    400,
    'NO_ADDRESS_FOUND'
  );
}

/**
 * Search dishes across restaurants via Swiggy Food MCP
 * Tool: search_menu
 */
async function searchMenu({ query, addressId, restaurantIdOfAddedItem, vegFilter, offset = 0 }) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new SwiggyMcpError('Query string "q" is required for search', 400, 'INVALID_QUERY');
  }

  const resolvedAddressId = await resolveAddressId(addressId);

  const args = {
    addressId: resolvedAddressId,
    query: query.trim(),
    offset: Number(offset) || 0,
  };

  if (restaurantIdOfAddedItem) {
    args.restaurantIdOfAddedItem = String(restaurantIdOfAddedItem);
  }

  if (vegFilter !== undefined && (vegFilter === 0 || vegFilter === 1 || vegFilter === '0' || vegFilter === '1')) {
    args.vegFilter = Number(vegFilter);
  }

  const rawData = await callTool('search_menu', args);

  let items = [];
  if (rawData && typeof rawData === 'object' && Array.isArray(rawData.items)) {
    items = rawData.items;
  } else if (typeof rawData === 'string') {
    items = parseMenuTextOutput(rawData);
  }

  const normalized = items.map((item) => normalizeItem(item));

  return {
    query: query.trim(),
    address_id: resolvedAddressId,
    count: normalized.length,
    has_more: toBoolean(rawData?.hasMore),
    next_offset: rawData?.nextOffset || null,
    items: normalized,
  };
}

/**
 * Search restaurants via Swiggy Food MCP
 * Tool: search_restaurants
 */
async function searchRestaurants({ query, addressId, collection, offset = 0 }) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new SwiggyMcpError('Query string is required', 400, 'INVALID_QUERY');
  }

  const resolvedAddressId = await resolveAddressId(addressId);

  const args = {
    addressId: resolvedAddressId,
    query: query.trim(),
    offset: Number(offset) || 0,
  };

  if (collection && ['EATRIGHT', 'BOLT', 'STORE_99'].includes(collection)) {
    args.collection = collection;
  }

  const rawData = await callTool('search_restaurants', args);
  let restaurants = [];
  let dishes = [];

  if (rawData && typeof rawData === 'object') {
    restaurants = rawData.restaurants || [];
    dishes = rawData.dishes || [];
  }

  const normalizedDishes = dishes.map((dish) => normalizeItem(dish));

  return {
    query: query.trim(),
    address_id: resolvedAddressId,
    restaurants: restaurants.map((r) => ({
      id: String(r.id || ''),
      name: r.name || '',
      cuisines: r.cuisines || [],
      avg_rating: r.avgRating != null ? Number(r.avgRating) : null,
      area_name: r.areaName || '',
      delivery_time_mins: r.deliveryTimeMinutes != null ? Number(r.deliveryTimeMinutes) : null,
      distance_km: r.distanceKm != null ? Number(r.distanceKm) : null,
      availability_status: r.availabilityStatus || 'UNKNOWN',
      image_url: r.imageUrl || null,
    })),
    dishes: normalizedDishes,
    has_more: toBoolean(rawData?.hasMore),
    next_offset: rawData?.nextOffset || null,
  };
}

/**
 * Get restaurant menu via Swiggy Food MCP
 * Tool: get_restaurant_menu
 */
async function getRestaurantMenu({ restaurantId, addressId }) {
  if (!restaurantId || typeof restaurantId !== 'string' || !restaurantId.trim()) {
    throw new SwiggyMcpError('restaurantId is required', 400, 'INVALID_RESTAURANT_ID');
  }

  const resolvedAddressId = await resolveAddressId(addressId);

  const args = {
    addressId: resolvedAddressId,
    restaurantId: restaurantId.trim(),
  };

  const rawData = await callTool('get_restaurant_menu', args);
  let restaurant = {};
  let items = [];

  if (rawData && typeof rawData === 'object') {
    restaurant = rawData.restaurant || {};
    items = rawData.items || [];
  } else if (typeof rawData === 'string') {
    const parsed = parseRestaurantMenuText(rawData, restaurantId);
    restaurant = parsed.restaurant;
    items = parsed.items;
  }

  const normalizedItems = items.map((item) =>
    normalizeItem(item, {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
    })
  );

  return {
    restaurant: {
      id: String(restaurant.id || ''),
      name: restaurant.name || '',
      city: restaurant.city || '',
      area_name: restaurant.areaName || '',
      avg_rating: restaurant.avgRating != null ? Number(restaurant.avgRating) : null,
      is_open: toBoolean(restaurant.isOpen),
      cuisines: restaurant.cuisines || [],
    },
    total_items: rawData?.totalItems || normalizedItems.length,
    items: normalizedItems,
  };
}

module.exports = {
  normalizeItem,
  parseRestaurantMenuText,
  getAddresses,
  resolveAddressId,
  searchMenu,
  searchRestaurants,
  getRestaurantMenu,
};
