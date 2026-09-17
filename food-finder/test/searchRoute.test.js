const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const pool = require('../db');

function makeRow(itemId, itemName) {
  return {
    item_id: itemId,
    restaurant_name: `Restaurant ${itemId}`,
    city: 'Delhi',
    area: 'Test Area',
    item_name: itemName,
    platform: 'Swiggy',
    price_inr: 200,
    item_rating: 4.2,
    delivery_time_mins: 30,
  };
}

test('search supports dish-only, price-only, and combined filtering', async (t) => {
  const originalQuery = pool.query;
  const rows = Array.from({ length: 150 }, (_, index) => makeRow(index + 1, `Unrelated dish ${index + 1}`));
  rows.push(makeRow(151, 'Hyderabadi Biryani'));

  let capturedSql = '';
  let capturedParams = [];
  pool.query = async (sql, params = []) => {
    capturedSql = sql;
    capturedParams = params;
    return [rows];
  };

  const searchRouter = require('../routes/search');
  const app = express();
  app.use('/api/search', searchRouter);
  const server = app.listen(0);

  t.after(async () => {
    pool.query = originalQuery;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  const matchResponse = await fetch(`http://127.0.0.1:${port}/api/search?dish=biryani`);
  assert.equal(matchResponse.status, 200);
  const matchBody = await matchResponse.json();
  assert.equal(matchBody.query, 'biryani');
  assert.equal(matchBody.results.length, 1);
  assert.equal(matchBody.results[0].item_id, 151);
  assert.equal(matchBody.results[0].is_best_match, true);
  assert.doesNotMatch(capturedSql, /\bLIMIT\b/i);

  const priceOnlyResponse = await fetch(`http://127.0.0.1:${port}/api/search?max_price=300&limit=2`);
  assert.equal(priceOnlyResponse.status, 200);
  const priceOnlyBody = await priceOnlyResponse.json();
  assert.equal(priceOnlyBody.query, '');
  assert.equal(priceOnlyBody.results.length, 2);
  assert.deepEqual(capturedParams, [300]);
  assert.match(capturedSql, /<= \?/);

  const combinedResponse = await fetch(`http://127.0.0.1:${port}/api/search?dish=biryani&max_price=300`);
  assert.equal(combinedResponse.status, 200);
  const combinedBody = await combinedResponse.json();
  assert.equal(combinedBody.results.length, 1);
  assert.equal(combinedBody.results[0].item_id, 151);
  assert.deepEqual(capturedParams, [300]);

  pool.query = async () => [[]];
  const emptyResponse = await fetch(`http://127.0.0.1:${port}/api/search?dish=missing`);
  assert.deepEqual(await emptyResponse.json(), {
    query: 'missing',
    results: [],
    pagination: { limit: 10, offset: 0, total: 0, has_more: false, next_offset: null },
  });

  const invalidResponse = await fetch(`http://127.0.0.1:${port}/api/search?dish=pizza&limit=5oops`);
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await invalidResponse.json(), { error: 'limit must be a positive integer' });

  const missingSearchResponse = await fetch(`http://127.0.0.1:${port}/api/search`);
  assert.equal(missingSearchResponse.status, 400);
  assert.deepEqual(await missingSearchResponse.json(), {
    error: 'dish or max_price query parameter is required',
  });
});

test('paired Swiggy and Zomato rows become one comparison card', () => {
  const { dedupePlatformPairs } = require('../routes/search');
  const rows = [
    { item_id: 10, data_source: 'swiggy_live', platform: 'Swiggy', price_inr: 200 },
    { item_id: 11, data_source: 'zomato_simulated', platform: 'Zomato', price_inr: 190, source_item_id: 10 },
    { item_id: 20, data_source: 'mock', platform: 'Mock', price_inr: 150 },
  ];

  const result = dedupePlatformPairs(rows);
  assert.equal(result.length, 2);
  assert.equal(result[0].item_id, 11);
  assert.equal(result[1].item_id, 20);
});
