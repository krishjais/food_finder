const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateFinalPricePair } = require('../utils/estimatedFinalPrice');

test('estimated payable total includes fees and preserves the cheaper menu platform', () => {
  const estimate = estimateFinalPricePair({
    item_id: 101,
    platform: 'Swiggy',
    price_inr: 100,
    comparison_price_inr: 106,
    area: 'Uttardhona (BBD)',
  });

  assert.ok(estimate.swiggy.total > estimate.swiggy.subtotal);
  assert.equal(estimate.cheaper_platform, 'Swiggy');
  assert.ok(estimate.savings / estimate.swiggy.total <= 0.1);
  assert.equal(estimate.swiggy.coupon_status, 'Coupon not applicable');
  assert.equal(estimate.lowest_total, estimate.swiggy.total);
});

test('estimated payable total uses the selected area', () => {
  const item = {
    item_id: 12,
    platform: 'Zomato',
    price_inr: 90,
    comparison_price_inr: 100,
  };
  const central = estimateFinalPricePair(item, 'Hazratganj');
  const outer = estimateFinalPricePair(item, 'Anora Kala');

  assert.equal(central.area, 'Hazratganj');
  assert.ok(outer.swiggy.delivery_fee > central.swiggy.delivery_fee);
  assert.equal(outer.cheaper_platform, 'Zomato');
});

test('nearby orders at or above the low-order threshold do not add estimated delivery', () => {
  const estimate = estimateFinalPricePair({
    item_id: 25,
    platform: 'Swiggy',
    price_inr: 149,
    comparison_price_inr: 155,
    area: 'Uttardhona (BBD)',
  });

  assert.equal(estimate.swiggy.delivery_fee, 0);
});
