const test = require('node:test');
const assert = require('node:assert/strict');

const { isUsefulDeal } = require('../routes/topPicks');

test('must-grab deals exclude side items and drinks', () => {
  assert.equal(isUsefulDeal('Butter Roti'), false);
  assert.equal(isUsefulDeal('Tomato Ketchup'), false);
  assert.equal(isUsefulDeal('Cold Drink 500ml'), false);
  assert.equal(isUsefulDeal('Chicken Biryani Combo'), true);
  assert.equal(isUsefulDeal('Paneer Tikka Platter'), true);
});
