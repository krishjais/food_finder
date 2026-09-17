const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const pool = require('../db');

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const configuredLimit = Number(process.env.TOP_PICK_IMAGE_LIMIT || 100);
const TOP_N = Number.isSafeInteger(configuredLimit) && configuredLimit > 0
  ? Math.min(configuredLimit, 500)
  : 100;

if (!ACCESS_KEY) {
  console.error('Missing UNSPLASH_ACCESS_KEY in .env — add it and try again.');
  process.exit(1);
}

/**
 * Fetches the same set of items /api/top-picks would return
 * (best-rated dish per restaurant), including item_id so we can
 * target the exact row to update.
 */
async function getTopPickItems(limit) {
  const query = `
    WITH ranked AS (
      SELECT
        m.item_id,
        m.item_name,
        m.restaurant_id,
        m.item_rating,
        m.price_inr,
        m.image_url,
        ROW_NUMBER() OVER (
          PARTITION BY m.restaurant_id
          ORDER BY m.item_rating DESC, m.price_inr ASC
        ) AS rn
      FROM menu_items m
    )
    SELECT item_id, item_name
    FROM ranked
    WHERE rn = 1
      AND (image_url IS NULL OR image_url = '')
    ORDER BY item_rating DESC, price_inr ASC
    LIMIT ?
  `;
  const [rows] = await pool.query(query, [limit]);
  return rows;
}

/**
 * Searches Unsplash for one photo matching the dish name.
 * Strips parenthetical text like "(Serves 4-5)" since that's not
 * useful for image search relevance.
 */
async function searchUnsplashImage(rawQuery) {
  let cleaned = rawQuery.replace(/\(.*?\)/g, '').trim();
  // Normalize spelling typos and specific dish prefixes for better Unsplash match
  cleaned = cleaned.replace(/chessy/i, 'cheesy');
  if (/biryani/i.test(cleaned)) {
    cleaned = 'dum biryani';
  }
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
    cleaned
  )}&per_page=1&orientation=squarish`;

  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  });

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    return null;
  }
  return data.results[0].urls.regular;
}

async function main() {
  console.log(`Fetching up to ${TOP_N} top-pick items that still need images...`);
  const items = await getTopPickItems(TOP_N);
  console.log(`Found ${items.length} items. Searching Unsplash for images...\n`);

  for (const item of items) {
    try {
      const imageUrl = await searchUnsplashImage(item.item_name);
      if (imageUrl) {
        await pool.query('UPDATE menu_items SET image_url = ? WHERE item_id = ?', [
          imageUrl,
          item.item_id,
        ]);
        console.log(`✓ ${item.item_name}\n  -> ${imageUrl}\n`);
      } else {
        console.log(`✗ No image found for: ${item.item_name}\n`);
      }
    } catch (err) {
      console.error(`✗ Error fetching image for "${item.item_name}": ${err.message}\n`);
    }
  }

  console.log('Done. Restart the server and hit /api/top-picks to see the image_url field.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
