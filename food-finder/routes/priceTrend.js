const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * GET /api/price-trend/:itemId
 * Returns 30-day historical prices and a 7-day predicted price using linear regression.
 */
router.get('/:itemId', async (req, res, next) => {
  try {
    const rawItemId = req.params.itemId ? req.params.itemId.trim() : '';

    // 1. Validate itemId is a positive integer
    if (!/^\d+$/.test(rawItemId)) {
      return res.status(400).json({
        error: 'Invalid itemId. Must be a positive integer.',
      });
    }

    const itemId = parseInt(rawItemId, 10);
    if (itemId <= 0) {
      return res.status(400).json({
        error: 'Invalid itemId. Must be a positive integer.',
      });
    }

    // 2. Fetch item name for context
    const [itemRows] = await pool.query(
      `SELECT item_id, item_name, data_source, source_item_id, price_offset_percent
       FROM menu_items WHERE item_id = ?`,
      [itemId]
    );

    if (!itemRows || itemRows.length === 0) {
      return res.status(404).json({
        error: 'No price history found for this item',
      });
    }

    // 3. Query price_history ordered by recorded_date ASC
    const item = itemRows[0];
    const historyItemId = item.data_source === 'zomato_simulated' && item.source_item_id
      ? Number(item.source_item_id)
      : itemId;
    const offset = item.data_source === 'zomato_simulated'
      ? Number(item.price_offset_percent || 0)
      : 0;

    const [historyRows] = await pool.query(
      `SELECT price_inr, DATE_FORMAT(recorded_date, '%Y-%m-%d') AS date
       FROM price_history
       WHERE item_id = ?
       ORDER BY recorded_date ASC`,
      [historyItemId]
    );

    if (!historyRows || historyRows.length === 0) {
      return res.status(404).json({
        error: 'No price history found for this item',
      });
    }

    // 4. Simple Linear Regression over the history points
    const n = historyRows.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    const history = historyRows.map((row, i) => {
      const price = Math.max(1, Math.round(Number(row.price_inr) * (1 + offset / 100)));
      sumX += i;
      sumY += price;
      sumXY += i * price;
      sumX2 += i * i;
      return {
        date: row.date,
        price_inr: price,
      };
    });

    const denominator = (n * sumX2 - sumX * sumX);
    let slope = 0;
    let intercept = 0;

    if (denominator === 0) {
      slope = 0;
      intercept = sumY / n;
    } else {
      slope = (n * sumXY - sumX * sumY) / denominator;
      intercept = (sumY - slope * sumX) / n;
    }

    // 5. Predict price 7 days beyond the last recorded day
    const futureX = (n - 1) + 7;
    const predicted_price_next_week = Math.max(1, Math.round(slope * futureX + intercept));

    // 6. Compute percent change vs. most recent actual price and classify trend
    const lastActualPrice = history[history.length - 1].price_inr;
    let percentChange = 0;
    if (lastActualPrice > 0) {
      percentChange = ((predicted_price_next_week - lastActualPrice) / lastActualPrice) * 100;
    }

    let trend = 'stable';
    if (percentChange > 3) {
      trend = 'rising';
    } else if (percentChange < -3) {
      trend = 'falling';
    }

    return res.status(200).json({
      item_id: itemId,
      item_name: itemRows[0].item_name,
      history,
      predicted_price_next_week,
      trend,
      data_source: item.data_source || 'mock',
      is_live: item.data_source === 'swiggy_live',
      source_item_id: item.source_item_id ? Number(item.source_item_id) : null,
    });
  } catch (error) {
    console.error('Error fetching price trend:', error);
    return next(error);
  }
});

module.exports = router;
