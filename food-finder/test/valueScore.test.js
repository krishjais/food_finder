const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeValueScores,
  WEIGHT_RATING,
  WEIGHT_PRICE,
  WEIGHT_DELIVERY,
} = require('../utils/valueScore');

test('Best Value Score weights add up to one', () => {
  assert.equal(WEIGHT_RATING + WEIGHT_PRICE + WEIGHT_DELIVERY, 1);
});

test('computeValueScores ranks the strongest combined value first', () => {
  const rows = [
    { item_id: 1, item_rating: 5, price_inr: 500, delivery_time_mins: 50 },
    { item_id: 2, item_rating: 4.5, price_inr: 200, delivery_time_mins: 20 },
    { item_id: 3, item_rating: 3.5, price_inr: 100, delivery_time_mins: 35 },
  ];

  const result = computeValueScores(rows);

  assert.equal(result[0].item_id, 2);
  assert.ok(result[0].value_score > result[1].value_score);
  assert.deepEqual(rows[0], {
    item_id: 1,
    item_rating: 5,
    price_inr: 500,
    delivery_time_mins: 50,
  });
});

test('identical price and delivery ranges remain finite and deterministic', () => {
  const result = computeValueScores([
    { item_id: 1, item_rating: 4, price_inr: 250, delivery_time_mins: 30 },
    { item_id: 2, item_rating: 5, price_inr: 250, delivery_time_mins: 30 },
  ]);

  assert.equal(result[0].item_id, 2);
  assert.ok(result.every((row) => Number.isFinite(row.value_score)));
});

test('empty and invalid inputs return an empty list', () => {
  assert.deepEqual(computeValueScores([]), []);
  assert.deepEqual(computeValueScores(null), []);
});
