const express = require("express");
const router = express.Router();
const pool = require("../db");
const { computeValueScores } = require("../utils/valueScore");
const { estimateFinalPricePair } = require("../utils/estimatedFinalPrice");
const Fuse = require("fuse.js");
const FUZZY_THRESHOLD = 0.4;
const DEFAULT_RESULT_LIMIT = 10;
const MAX_RESULT_LIMIT = 100;
const SEARCH_CACHE_TTL_MS = 30 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 100;
const searchCache = new Map();

function parsePositiveInteger(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
function parseNonNegativeInteger(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function canonicalItemKey(row) {
  if (row.data_source === 'zomato_simulated' && row.source_item_id) {
    return `paired:${row.source_item_id}`;
  }
  if (row.data_source === 'swiggy_live') return `paired:${row.item_id}`;
  return `item:${row.item_id}`;
}

function dedupePlatformPairs(rows) {
  const unique = new Map();
  for (const row of rows) {
    const key = canonicalItemKey(row);
    const existing = unique.get(key);
    const rowPrice = Number(row.price_inr);
    const existingPrice = Number(existing?.price_inr);
    if (!existing
      || rowPrice < existingPrice
      || (rowPrice === existingPrice && String(row.platform).toLowerCase() === 'swiggy')) {
      unique.set(key, row);
    }
  }
  return [...unique.values()];
}

function readCachedRows(key) {
  const cached = searchCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return cached.rows;
}

function cacheRows(key, rows) {
  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    searchCache.delete(searchCache.keys().next().value);
  }
  searchCache.set(key, { createdAt: Date.now(), rows });
}

function formatResult(row, isBestMatch) {
  return {
    item_id: Number(row.item_id),
    restaurant_name: row.restaurant_name,
    city: row.city,
    area: row.area,
    item_name: row.item_name,
    platform: row.platform,
    price_inr: Number(row.price_inr),
    item_rating: Number(row.item_rating),
    delivery_time_mins: Number(row.delivery_time_mins),
    value_score: Number(row.value_score),
    is_best_match: isBestMatch,
    data_source: row.data_source || "mock",
    is_live: Boolean(row.is_live),
    fetched_at: row.fetched_at || null,
    source_item_id: row.source_item_id ? Number(row.source_item_id) : null,
    price_offset_percent: row.price_offset_percent == null
      ? null
      : Number(row.price_offset_percent),
    comparison_item_id: row.comparison_item_id == null
      ? null
      : Number(row.comparison_item_id),
    comparison_platform: row.comparison_platform || null,
    comparison_price_inr: row.comparison_price_inr == null
      ? null
      : Number(row.comparison_price_inr),
    estimated_final_price: row.estimated_final_price,
  };
}

function sendResultPage(res, query, rows, limit, offset) {
  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  const results = page.map((row, index) => formatResult(row, offset === 0 && index === 0));
  const nextOffset = offset + results.length;
  return res.status(200).json({
    query,
    results,
    pagination: {
      limit,
      offset,
      total,
      has_more: nextOffset < total,
      next_offset: nextOffset < total ? nextOffset : null,
    },
  });
}
/**
 * GET /api/search
 * Search menu items across restaurants with filtering and ranking.
 *
 * Query parameters:
 *  - dish (optional, string): Fuzzy match on item_name (case-insensitive)
 *  - max_price (optional, integer): Maximum price in INR (price_inr <= max_price)
 * At least one of dish or max_price is required.
 *  - city (optional, string): Exact match on restaurants.city
 *  - limit (optional, integer, default: 10): Maximum number of results to return
 *  - offset (optional, non-negative integer): Result offset for progressive loading
 */
router.get("/", async (req, res, next) => {
  try {
    const { dish, max_price, city, area, limit, offset } = req.query;

    const normalizedDish = typeof dish === "string" ? dish.trim() : "";
    const hasDish = normalizedDish.length > 0;
    const hasMaxPrice = max_price !== undefined && max_price !== "";

    if (!hasDish && !hasMaxPrice) {
      return res.status(400).json({
        error: "dish or max_price query parameter is required",
      });
    }
    if (dish !== undefined && typeof dish !== "string") {
      return res.status(400).json({ error: "dish must be a string" });
    }
    if (normalizedDish.length > 100) {
      return res.status(400).json({
        error: "dish must be 100 characters or fewer",
      });
    }

    let resultLimit = DEFAULT_RESULT_LIMIT;
    let resultOffset = 0;
    if (limit !== undefined && limit !== "") {
      const parsed = parsePositiveInteger(limit);
      if (parsed === null) {
        return res.status(400).json({
          error: "limit must be a positive integer",
        });
      }
      resultLimit = Math.min(parsed, MAX_RESULT_LIMIT);
    }
    if (offset !== undefined && offset !== "") {
      const parsed = parseNonNegativeInteger(offset);
      if (parsed === null) return res.status(400).json({ error: "offset must be a non-negative integer" });
      resultOffset = parsed;
    }

    // Base query joining menu_items with restaurants
    let query = `
      SELECT 
        m.item_id,
        r.name AS restaurant_name,
        r.city,
        r.area,
        m.item_name,
        m.platform,
        CASE
          WHEN m.data_source = 'zomato_simulated' AND source.price_inr IS NOT NULL
            THEN ROUND(source.price_inr * (1 + m.price_offset_percent / 100))
          ELSE m.price_inr
        END AS price_inr,
        m.item_rating,
        m.delivery_time_mins,
        m.data_source,
        m.is_live,
        m.fetched_at,
        m.source_item_id,
        m.price_offset_percent,
        CASE
          WHEN m.data_source = 'swiggy_live' THEN simulated.item_id
          WHEN m.data_source = 'zomato_simulated' THEN source.item_id
          ELSE NULL
        END AS comparison_item_id,
        CASE
          WHEN m.data_source = 'swiggy_live' AND simulated.item_id IS NOT NULL THEN 'Zomato'
          WHEN m.data_source = 'zomato_simulated' AND source.item_id IS NOT NULL THEN 'Swiggy'
          ELSE NULL
        END AS comparison_platform,
        CASE
          WHEN m.data_source = 'swiggy_live' AND simulated.item_id IS NOT NULL
            THEN ROUND(m.price_inr * (1 + simulated.price_offset_percent / 100))
          WHEN m.data_source = 'zomato_simulated' AND source.item_id IS NOT NULL
            THEN source.price_inr
          ELSE NULL
        END AS comparison_price_inr
      FROM menu_items m
      INNER JOIN restaurants r ON m.restaurant_id = r.restaurant_id
      LEFT JOIN menu_items source ON source.item_id = m.source_item_id
      LEFT JOIN menu_items simulated
        ON simulated.source_item_id = m.item_id
       AND simulated.data_source = 'zomato_simulated'
      WHERE 1=1
    `;
    // Dish filtering is intentionally handled by Fuse after fetching every row that
    // satisfies the structured filters. Applying a SQL LIMIT before fuzzy matching
    // would silently make part of the catalog unsearchable.
    const queryParams = [];
    // Optional filter: max_price
    let parsedMaxPrice = null;
    if (hasMaxPrice) {
      parsedMaxPrice = parsePositiveInteger(max_price);
      if (parsedMaxPrice === null) {
        return res.status(400).json({
          error: "max_price must be a positive integer",
        });
      }
      query += ` AND (
        CASE
          WHEN m.data_source = 'zomato_simulated' AND source.price_inr IS NOT NULL
            THEN ROUND(source.price_inr * (1 + m.price_offset_percent / 100))
          ELSE m.price_inr
        END
      ) <= ?`;
      queryParams.push(parsedMaxPrice);
    }
    // Optional filter: city (exact match)
    if (city !== undefined && typeof city === "string" && city.trim() !== "") {
      if (city.trim().length > 100) {
        return res.status(400).json({
          error: "city must be 100 characters or fewer",
        });
      }
      query += " AND r.city = ?";
      queryParams.push(city.trim());
    }
    if (area !== undefined && typeof area === "string" && area.trim() !== "") {
      if (area.trim().length > 100) {
        return res.status(400).json({ error: "area must be 100 characters or fewer" });
      }
      query += " AND r.area = ?";
      queryParams.push(area.trim());
    }
    const cacheKey = JSON.stringify([
      normalizedDish.toLowerCase(),
      parsedMaxPrice,
      typeof city === 'string' ? city.trim().toLowerCase() : '',
      typeof area === 'string' ? area.trim().toLowerCase() : '',
    ]);
    const cachedRows = readCachedRows(cacheKey);
    if (cachedRows) {
      return sendResultPage(res, normalizedDish, cachedRows, resultLimit, resultOffset);
    }
    // Execute query
    const [rows] = await pool.query(query, queryParams);
    // Keep a stable response contract even when no rows match the filters.
    if (!rows || rows.length === 0) {
      return res.status(200).json({
        query: normalizedDish,
        results: [],
        pagination: { limit: resultLimit, offset: resultOffset, total: 0, has_more: false, next_offset: null },
      });
    }
    // Price-only searches rank every structurally filtered row. When a dish is
    // present, fuzzy matching narrows those rows before Value Score ranking.
    let matchedRows = rows;
    if (hasDish) {
      const fuse = new Fuse(rows, {
        keys: ["item_name"],
        threshold: FUZZY_THRESHOLD,
        ignoreLocation: true,
      });
      matchedRows = fuse.search(normalizedDish).map(result => result.item);
    }
    if (matchedRows.length === 0) {
      return res.status(200).json({
        query: normalizedDish,
        results: [],
        pagination: { limit: resultLimit, offset: resultOffset, total: 0, has_more: false, next_offset: null },
      });
    }
    const estimatedRows = dedupePlatformPairs(matchedRows)
      .map((row) => {
        const estimatedFinalPrice = estimateFinalPricePair(row, area);
        return {
          ...row,
          estimated_final_price: estimatedFinalPrice,
          ranking_price_inr: estimatedFinalPrice?.lowest_total ?? Number(row.price_inr),
        };
      })
      .filter((row) => parsedMaxPrice === null || row.ranking_price_inr <= parsedMaxPrice);
    const scoredRows = computeValueScores(estimatedRows);
    cacheRows(cacheKey, scoredRows);
    return sendResultPage(res, normalizedDish, scoredRows, resultLimit, resultOffset);
  } catch (error) {
    console.error("Error executing food search query:", error);
    return next(error);
  }
});

module.exports = router;
module.exports.dedupePlatformPairs = dedupePlatformPairs;
