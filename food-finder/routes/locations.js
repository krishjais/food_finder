const express = require('express');
const { LUCKNOW_AREAS } = require('../config/lucknowAreas');

const router = express.Router();

router.get('/lucknow-areas', (req, res) => {
  return res.status(200).json({
    city: 'Lucknow',
    maximum_distance_km: 15,
    areas: LUCKNOW_AREAS,
  });
});

module.exports = router;
