const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildFinalPriceComparison,
  parseCartResponse,
  simulatedFinalPrice,
} = require('../services/finalPriceService');
const { estimateFinalPricePair } = require('../utils/estimatedFinalPrice');

test('parses Swiggy text cart totals', () => {
  const cart = parseCartResponse(`Items (1):
  - Mughlai Biryani Rice — ₹130 (ID: 23810006)

Item total: ₹130
Delivery: FREE
Taxes & charges: ₹34.98
TO PAY: ₹165`);

  assert.equal(cart.is_empty, false);
  assert.deepEqual(cart.pricing, {
    item_total: 130,
    delivery_charge: 0,
    taxes_and_charges: 34.98,
    to_pay: 165,
  });
});

test('recognizes an explicitly empty text cart', () => {
  const cart = parseCartResponse('Cart is empty.\n\nCart widget is displayed.');
  assert.equal(cart.is_empty, true);
  assert.deepEqual(cart.items, []);
});

test('leaves unrecognized cart state unknown for safe callers', () => {
  assert.equal(parseCartResponse('Unexpected response').is_empty, null);
});

test('parses nested object cart totals and formatted money values', () => {
  const cart = parseCartResponse({
    data: {
      cart: {
        cartItems: [{ id: 'dish-1' }],
        checkout: {
          pricing: {
            itemTotal: { displayValue: '₹130' },
            deliveryFee: 'FREE',
            taxesAndCharges: '₹34.98',
            payableAmount: '₹165',
          },
        },
      },
    },
  });

  assert.equal(cart.is_empty, false);
  assert.equal(cart.pricing.item_total, 130);
  assert.equal(cart.pricing.delivery_charge, 0);
  assert.equal(cart.pricing.taxes_and_charges, 34.98);
  assert.equal(cart.pricing.to_pay, 165);
});

test('derives payable total from returned cart components when total is omitted', () => {
  const cart = parseCartResponse({
    cart: {
      items: [{ id: 'dish-1' }],
      pricing: {
        item_total: 116,
        delivery_charge: 20,
        platform_fee: 7,
        taxes_and_charges: 39.53,
        coupon_discount: 10,
      },
    },
  });

  assert.equal(cart.is_empty, false);
  assert.equal(cart.pricing.to_pay, 173);
});

test('builds a two-platform final price comparison with savings', () => {
  const comparison = buildFinalPriceComparison(
    { platform: 'Swiggy', total: 165 },
    { platform: 'Zomato', total: 179 },
  );
  assert.equal(comparison.cheaper_platform, 'Swiggy');
  assert.equal(comparison.savings, 14);
  assert.equal(comparison.swiggy.total, 165);
  assert.equal(comparison.zomato.total, 179);
});

test('keeps estimated final prices close and preserves the menu-price winner', () => {
  const item = { item_id: 11, source_item_id: 10, display_price: 180, area: 'Uttardhona (BBD)' };
  const swiggy = { total: 220 };
  const zomatoWinner = simulatedFinalPrice(item, swiggy, 'Zomato');
  const swiggyWinner = simulatedFinalPrice(item, swiggy, 'Swiggy');

  assert.ok(zomatoWinner.total < swiggy.total);
  assert.ok(swiggyWinner.total > swiggy.total);
  assert.ok(Math.abs(swiggy.total - zomatoWinner.total) / zomatoWinner.total <= 0.1);
  assert.ok(Math.abs(swiggyWinner.total - swiggy.total) / swiggy.total <= 0.1);
});

test('checked comparison reuses the card delivery estimate within ten percent', () => {
  const item = {
    item_id: 11,
    source_item_id: 10,
    display_price: 90,
    area: 'Uttardhona (BBD)',
  };
  const cardEstimate = estimateFinalPricePair({
    item_id: 11,
    source_item_id: 10,
    platform: 'Zomato',
    price_inr: 90,
    comparison_price_inr: 100,
    area: item.area,
  });
  const checkedEstimate = simulatedFinalPrice(item, { total: 130 }, 'Zomato');
  const difference = Math.abs(
    checkedEstimate.delivery_fee - cardEstimate.zomato.delivery_fee,
  );
  const denominator = Math.max(1, cardEstimate.zomato.delivery_fee);

  assert.ok(difference / denominator <= 0.1);
  assert.equal(checkedEstimate.delivery_fee, cardEstimate.zomato.delivery_fee);
});
