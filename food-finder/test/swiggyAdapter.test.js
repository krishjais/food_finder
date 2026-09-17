const test = require('node:test');
const assert = require('node:assert/strict');

const { parseRestaurantMenuText } = require('../services/swiggy/swiggyAdapter');

test('parses and deduplicates category-based Swiggy restaurant menus', () => {
  const input = `Menu for Test Kitchen (ID: 123) [image: https://example.com/restaurant.jpg]
## Recommended
  - Paneer Roll — ₹160 | Veg [image: https://example.com/paneer.jpg] (ID: item-1)
  - Chicken Roll — ₹1,250 | Non-Veg, Bestseller (ID: item-2)
## Rolls
  - Paneer Roll — ₹160 | Veg (ID: item-1)`;

  const parsed = parseRestaurantMenuText(input);

  assert.deepEqual(parsed.restaurant, { id: '123', name: 'Test Kitchen' });
  assert.equal(parsed.items.length, 2);
  assert.deepEqual(parsed.items[0], {
    id: 'item-1',
    name: 'Paneer Roll',
    price: 160,
    isVeg: true,
    inStock: 1,
    imageUrl: 'https://example.com/paneer.jpg',
    hasAddons: false,
  });
  assert.equal(parsed.items[1].price, 1250);
  assert.equal(parsed.items[1].isVeg, false);
});
