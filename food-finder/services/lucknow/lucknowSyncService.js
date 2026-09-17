const crypto = require('crypto');
const pool = require('../../db');
const { searchRestaurants, getRestaurantMenu } = require('../swiggy/swiggyAdapter');
const { getAuthStatus } = require('../swiggy/swiggyOAuth');
const {
  LUCKNOW_AREAS,
  getConfiguredAddressIds,
} = require('../../config/lucknowAreas');

const DEFAULT_SEARCH_TERMS = [
  'biryani',
  'pizza',
  'burger',
  'north indian',
  'south indian',
  'chinese',
  'dessert',
];

let syncInProgress = false;

function boundedPositiveInteger(raw, fallback, maximum) {
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function stableId(prefix, ...parts) {
  const digest = crypto.createHash('sha256').update(parts.join('|')).digest('hex');
  return `${prefix}${digest.slice(0, 9)}`;
}

function deterministicOffset(sourceKey) {
  const byte = crypto.createHash('sha256').update(sourceKey).digest()[0];
  return -8 + (byte % 21); // stable range: -8% to +12%
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRateLimitRetry(operation, label, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error?.statusCode !== 429 || attempt === maxAttempts) throw error;

      const retryAfterSeconds = Number(
        String(error.message || '').match(/Retry after (\d+)/i)?.[1] || 60,
      );
      const cooldownMs = Math.max(1, retryAfterSeconds) * 1000 + 1000;
      console.warn(
        `[Lucknow Sync] Rate limited during ${label}; retrying in ${Math.round(cooldownMs / 1000)}s `
        + `(attempt ${attempt + 1}/${maxAttempts}).`,
      );
      await sleep(cooldownMs);
    }
  }

  throw new Error(`Unable to complete ${label}.`);
}

async function upsertRestaurant(connection, restaurant, area, fetchedAt) {
  const restaurantId = stableId('L', area.slug, restaurant.id);
  const cuisines = Array.isArray(restaurant.cuisines)
    ? restaurant.cuisines.join(', ')
    : String(restaurant.cuisines || '');

  await connection.query(
    `INSERT INTO restaurants (
       restaurant_id, name, city, area, cuisines, restaurant_rating,
       data_source, is_live, fetched_at, source_restaurant_id, latitude, longitude
     ) VALUES (?, ?, 'Lucknow', ?, ?, ?, 'swiggy_live', TRUE, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), cuisines = VALUES(cuisines),
       restaurant_rating = VALUES(restaurant_rating), is_live = TRUE,
       fetched_at = VALUES(fetched_at), latitude = VALUES(latitude),
       longitude = VALUES(longitude)`,
    [
      restaurantId,
      restaurant.name,
      area.name,
      cuisines,
      restaurant.avg_rating,
      fetchedAt,
      restaurant.id,
      area.latitude,
      area.longitude,
    ],
  );

  return restaurantId;
}

async function upsertLiveItem(connection, restaurantId, restaurant, item, fetchedAt) {
  const [result] = await connection.query(
    `INSERT INTO menu_items (
       restaurant_id, platform, item_name, veg_or_non_veg, price_inr,
       item_rating, delivery_time_mins, image_url, data_source, is_live,
       fetched_at, external_item_id
     ) VALUES (?, 'Swiggy', ?, ?, ?, ?, ?, ?, 'swiggy_live', TRUE, ?, ?)
     ON DUPLICATE KEY UPDATE
       item_id = LAST_INSERT_ID(item_id), item_name = VALUES(item_name),
       veg_or_non_veg = VALUES(veg_or_non_veg), price_inr = VALUES(price_inr),
       item_rating = VALUES(item_rating), delivery_time_mins = VALUES(delivery_time_mins),
       image_url = COALESCE(VALUES(image_url), image_url), is_live = TRUE,
       fetched_at = VALUES(fetched_at)`,
    [
      restaurantId,
      item.item_name,
      item.is_veg ? 'Veg' : 'Non-Veg',
      Math.round(item.price),
      item.rating ?? restaurant.avg_rating,
      restaurant.delivery_time_mins || 30,
      item.image_url,
      fetchedAt,
      item.item_id,
    ],
  );

  if (result.insertId) return Number(result.insertId);

  const [rows] = await connection.query(
    `SELECT item_id FROM menu_items
     WHERE data_source = 'swiggy_live' AND restaurant_id = ? AND external_item_id = ?
     LIMIT 1`,
    [restaurantId, item.item_id],
  );
  return rows.length ? Number(rows[0].item_id) : null;
}

async function upsertSimulatedItem(connection, sourceItemId, item, restaurant, fetchedAt) {
  const offset = deterministicOffset(String(item.item_id));
  const simulatedPrice = Math.max(1, Math.round(item.price * (1 + offset / 100)));

  await connection.query(
    `INSERT INTO menu_items (
       restaurant_id, platform, item_name, veg_or_non_veg, price_inr,
       item_rating, delivery_time_mins, image_url, data_source, is_live,
       fetched_at, source_item_id, price_offset_percent
     )
     SELECT restaurant_id, 'Zomato', item_name, veg_or_non_veg, ?,
            item_rating, delivery_time_mins, image_url,
            'zomato_simulated', FALSE, ?, item_id, ?
     FROM menu_items WHERE item_id = ?
     ON DUPLICATE KEY UPDATE
       item_name = VALUES(item_name), veg_or_non_veg = VALUES(veg_or_non_veg),
       price_inr = VALUES(price_inr), item_rating = VALUES(item_rating),
       delivery_time_mins = VALUES(delivery_time_mins),
       image_url = VALUES(image_url), is_live = FALSE,
       fetched_at = VALUES(fetched_at), price_offset_percent = VALUES(price_offset_percent)`,
    [simulatedPrice, fetchedAt, offset, sourceItemId],
  );
}

async function recordLivePrice(connection, itemId, price) {
  const [rows] = await connection.query(
    `SELECT history_id FROM price_history
     WHERE item_id = ? AND recorded_date = CURRENT_DATE()
     ORDER BY history_id ASC LIMIT 1`,
    [itemId],
  );

  if (rows.length) {
    await connection.query(
      'UPDATE price_history SET price_inr = ? WHERE history_id = ?',
      [Math.round(price), rows[0].history_id],
    );
    return;
  }

  await connection.query(
    'INSERT INTO price_history (item_id, price_inr, recorded_date) VALUES (?, ?, CURRENT_DATE())',
    [itemId, Math.round(price)],
  );
}

async function syncArea(area, addressId, options) {
  const discovered = new Map();

  for (const query of options.searchTerms) {
    const result = await withRateLimitRetry(
      () => searchRestaurants({ query, addressId, offset: 0 }),
      `restaurant search for ${area.name}`,
    );
    for (const restaurant of result.restaurants || []) {
      const rating = Number(restaurant.avg_rating);
      if (rating >= 3.5 && restaurant.id && !discovered.has(restaurant.id)) {
        discovered.set(restaurant.id, restaurant);
      }
    }
    await sleep(options.delayMs);
  }

  const restaurants = [...discovered.values()].slice(0, options.maxRestaurants);
  let itemCount = 0;

  for (const restaurant of restaurants) {
    const menu = await withRateLimitRetry(
      () => getRestaurantMenu({ restaurantId: restaurant.id, addressId }),
      `menu fetch for ${restaurant.name || restaurant.id}`,
    );
    const items = (menu.items || [])
      .filter((item) => (
        item.availability
        && !item.has_customizations
        && item.item_id
        && Number(item.price) > 0
      ))
      .slice(0, options.maxItems);
    const fetchedAt = new Date();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const restaurantId = await upsertRestaurant(connection, restaurant, area, fetchedAt);

      for (const item of items) {
        const sourceItemId = await upsertLiveItem(
          connection,
          restaurantId,
          restaurant,
          item,
          fetchedAt,
        );
        if (!sourceItemId) continue;
        await upsertSimulatedItem(connection, sourceItemId, item, restaurant, fetchedAt);
        await recordLivePrice(connection, sourceItemId, item.price);
        itemCount += 1;
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await sleep(options.delayMs);
  }

  return { area: area.name, restaurants: restaurants.length, live_items: itemCount };
}

async function syncLucknowCatalog() {
  if (syncInProgress) {
    return { skipped: true, reason: 'A Lucknow sync is already running.' };
  }

  if (!getAuthStatus().authenticated) {
    throw new Error('Swiggy OAuth authentication is required before Lucknow sync.');
  }

  const addressIds = getConfiguredAddressIds();
  const configuredAreas = LUCKNOW_AREAS.filter((area) => addressIds[area.slug]);
  if (!configuredAreas.length) {
    throw new Error('No Lucknow area address IDs are configured.');
  }

  const searchTerms = String(
    process.env.LUCKNOW_SYNC_SEARCH_TERMS || DEFAULT_SEARCH_TERMS.join(','),
  )
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 20);

  const options = {
    searchTerms,
    delayMs: boundedPositiveInteger(process.env.LUCKNOW_SYNC_DELAY_MS, 750, 10000),
    maxRestaurants: boundedPositiveInteger(
      process.env.LUCKNOW_MAX_RESTAURANTS_PER_AREA,
      20,
      100,
    ),
    maxItems: boundedPositiveInteger(
      process.env.LUCKNOW_MAX_ITEMS_PER_RESTAURANT,
      80,
      200,
    ),
  };

  syncInProgress = true;
  const startedAt = new Date().toISOString();
  const areas = [];

  try {
    for (const area of configuredAreas) {
      console.log(`[Lucknow Sync] Starting ${area.name}`);
      areas.push(await syncArea(area, addressIds[area.slug], options));
    }

    return {
      skipped: false,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      areas,
      live_items: areas.reduce((sum, area) => sum + area.live_items, 0),
    };
  } finally {
    syncInProgress = false;
  }
}

function startLucknowSyncScheduler() {
  if (process.env.LUCKNOW_SYNC_ENABLED !== 'true') return null;

  const intervalHours = boundedPositiveInteger(
    process.env.LUCKNOW_SYNC_INTERVAL_HOURS,
    12,
    168,
  );
  const run = () => {
    syncLucknowCatalog()
      .then((result) => console.log('[Lucknow Sync] Complete:', result))
      .catch((error) => console.error('[Lucknow Sync] Failed:', error.message));
  };

  const timer = setInterval(run, intervalHours * 60 * 60 * 1000);
  timer.unref();

  if (process.env.LUCKNOW_SYNC_ON_START === 'true') {
    const initialTimer = setTimeout(run, 3000);
    initialTimer.unref();
  }

  return timer;
}

module.exports = {
  deterministicOffset,
  syncLucknowCatalog,
  startLucknowSyncScheduler,
};
