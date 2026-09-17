const express = require('express');
const pool = require('../db');
const { computeValueScores } = require('../utils/valueScore');
const { estimateFinalPricePair } = require('../utils/estimatedFinalPrice');

const router = express.Router();
const DEFAULT_RESULT_LIMIT = 8;
const MAX_RESULT_LIMIT = 8;
const DEALS_PER_BRACKET = 2;
const PRICE_BRACKETS = Object.freeze([
  { id: 'under-200', label: 'Under ₹200', min: 80, max: 200 },
  { id: 'under-400', label: '₹201–₹400', min: 201, max: 400 },
  { id: 'under-800', label: '₹401–₹800', min: 401, max: 800 },
  { id: 'under-1000', label: '₹801–₹1000', min: 801, max: 1000 },
]);

const SIDE_ITEM_PATTERN = /\b(?:roti|naan|chapati|rumali|kulcha|paratha|bread|sauce|dip|chutney|ketchup|mayo(?:nnaise)?|water|coke|pepsi|sprite|thums\s*up|soda|juice|shake|lassi|tea|coffee|beverage|drink|extra|add[\s-]?on|cutlery)\b/i;

function parsePositiveInteger(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isUsefulDeal(itemName) {
  return typeof itemName === 'string'
    && itemName.trim().length >= 4
    && !SIDE_ITEM_PATTERN.test(itemName);
}

router.get('/', async (req, res, next) => {
  try {
    const { limit, city, area } = req.query;
    let resultLimit = DEFAULT_RESULT_LIMIT;

    if (limit !== undefined && limit !== '') {
      const parsed = parsePositiveInteger(limit);
      if (parsed === null) return res.status(400).json({ error: 'limit must be a positive integer' });
      resultLimit = Math.min(parsed, MAX_RESULT_LIMIT);
    }

    const conditions = [
      "live.data_source = 'swiggy_live'",
      "simulated.data_source = 'zomato_simulated'",
      'live.price_inr > 0',
      'live.price_inr <= 1100',
      'COALESCE(live.image_url, simulated.image_url) IS NOT NULL',
    ];
    const params = [];

    if (city !== undefined && typeof city === 'string' && city.trim()) {
      conditions.push('r.city = ?');
      params.push(city.trim());
    }
    if (area !== undefined && typeof area === 'string' && area.trim()) {
      if (area.trim().length > 100) return res.status(400).json({ error: 'area must be 100 characters or fewer' });
      conditions.push('r.area = ?');
      params.push(area.trim());
    }

    const query = `
      SELECT
        CASE WHEN ROUND(live.price_inr * (1 + simulated.price_offset_percent / 100)) < live.price_inr
          THEN simulated.item_id ELSE live.item_id END AS item_id,
        r.restaurant_id,
        r.name AS restaurant_name,
        r.city,
        r.area,
        live.item_name,
        CASE WHEN ROUND(live.price_inr * (1 + simulated.price_offset_percent / 100)) < live.price_inr
          THEN 'Zomato' ELSE 'Swiggy' END AS platform,
        LEAST(live.price_inr, ROUND(live.price_inr * (1 + simulated.price_offset_percent / 100))) AS price_inr,
        live.item_rating,
        live.delivery_time_mins,
        COALESCE(live.image_url, simulated.image_url) AS image_url,
        CASE WHEN ROUND(live.price_inr * (1 + simulated.price_offset_percent / 100)) < live.price_inr
          THEN 'zomato_simulated' ELSE 'swiggy_live' END AS data_source,
        CASE WHEN ROUND(live.price_inr * (1 + simulated.price_offset_percent / 100)) < live.price_inr
          THEN FALSE ELSE TRUE END AS is_live,
        GREATEST(live.fetched_at, simulated.fetched_at) AS fetched_at,
        CASE WHEN ROUND(live.price_inr * (1 + simulated.price_offset_percent / 100)) < live.price_inr
          THEN live.item_id ELSE NULL END AS source_item_id,
        simulated.price_offset_percent,
        CASE WHEN ROUND(live.price_inr * (1 + simulated.price_offset_percent / 100)) < live.price_inr
          THEN live.item_id ELSE simulated.item_id END AS comparison_item_id,
        CASE WHEN ROUND(live.price_inr * (1 + simulated.price_offset_percent / 100)) < live.price_inr
          THEN 'Swiggy' ELSE 'Zomato' END AS comparison_platform,
        GREATEST(live.price_inr, ROUND(live.price_inr * (1 + simulated.price_offset_percent / 100))) AS comparison_price_inr
      FROM menu_items live
      INNER JOIN restaurants r ON r.restaurant_id = live.restaurant_id
      INNER JOIN menu_items simulated ON simulated.source_item_id = live.item_id
      WHERE ${conditions.join(' AND ')}
    `;

    const [rows] = await pool.query(query, params);
    const usefulRows = rows
      .filter((row) => isUsefulDeal(row.item_name))
      .map((row) => {
        const estimatedFinalPrice = estimateFinalPricePair(row, area);
        return {
          ...row,
          estimated_final_price: estimatedFinalPrice,
          ranking_price_inr: estimatedFinalPrice?.lowest_total ?? Number(row.price_inr),
        };
      });
    const scoredRows = computeValueScores(usefulRows);
    const selected = [];
    const usedRestaurants = new Set();
    const usedDishes = new Set();

    for (const bracket of PRICE_BRACKETS) {
      const candidates = scoredRows.filter((row) => {
        const price = Number(row.ranking_price_inr);
        return price >= bracket.min && price <= bracket.max;
      });
      const bracketDeals = [];
      for (const row of candidates) {
        const restaurantKey = String(row.restaurant_name || '').trim().toLowerCase();
        const dishKey = String(row.item_name || '').trim().toLowerCase();
        if (usedRestaurants.has(restaurantKey) || usedDishes.has(dishKey)) continue;
        bracketDeals.push(row);
        usedRestaurants.add(restaurantKey);
        usedDishes.add(dishKey);
        if (bracketDeals.length === DEALS_PER_BRACKET) break;
      }

      for (const row of bracketDeals) {
        selected.push({ ...row, price_bracket: bracket });
      }
    }

    const results = selected.slice(0, resultLimit).map((row, index) => ({
      item_id: Number(row.item_id),
      restaurant_name: row.restaurant_name,
      city: row.city,
      area: row.area,
      item_name: row.item_name,
      platform: row.platform,
      price_inr: Number(row.price_inr),
      item_rating: Number(row.item_rating),
      delivery_time_mins: Number(row.delivery_time_mins),
      image_url: row.image_url,
      value_score: Number(row.value_score),
      is_best_match: index === 0,
      data_source: row.data_source,
      is_live: Boolean(row.is_live),
      fetched_at: row.fetched_at || null,
      source_item_id: row.source_item_id == null ? null : Number(row.source_item_id),
      price_offset_percent: Number(row.price_offset_percent),
      comparison_item_id: Number(row.comparison_item_id),
      comparison_platform: row.comparison_platform,
      comparison_price_inr: Number(row.comparison_price_inr),
      estimated_final_price: row.estimated_final_price,
      price_bracket: row.price_bracket,
    }));

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error executing must-grab deals query:', error);
    return next(error);
  }
});

module.exports = router;
module.exports.isUsefulDeal = isUsefulDeal;
