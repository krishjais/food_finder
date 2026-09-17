const express = require('express');
const { checkFinalPrice } = require('../services/finalPriceService');

const router = express.Router();

router.post('/:itemId', async (req, res, next) => {
  try {
    const rawItemId = String(req.params.itemId || '');
    if (!/^\d+$/.test(rawItemId) || Number(rawItemId) <= 0) {
      return res.status(400).json({ error: 'itemId must be a positive integer' });
    }

    const area = typeof req.body?.area === 'string' ? req.body.area.trim() : '';
    const result = await checkFinalPrice(Number(rawItemId), area);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code || 'FINAL_PRICE_ERROR',
      });
    }
    return next(error);
  }
});

module.exports = router;
