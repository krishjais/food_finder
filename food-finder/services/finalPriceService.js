const pool = require('../db');
const { callTool, SwiggyMcpError } = require('./swiggy/swiggyMcpClient');
const { getAreaAddressId, getLucknowArea } = require('../config/lucknowAreas');
const { estimateDeliveryFee } = require('../utils/estimatedFinalPrice');

const WRITE_LIMIT = 30;
const WRITE_WINDOW_MS = 60 * 1000;
const writeTimestamps = [];
let livePriceCheckInProgress = false;

function serviceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function reserveWriteBudget(count) {
  const cutoff = Date.now() - WRITE_WINDOW_MS;
  while (writeTimestamps.length && writeTimestamps[0] <= cutoff) {
    writeTimestamps.shift();
  }
  if (writeTimestamps.length + count > WRITE_LIMIT) {
    throw serviceError(
      'Swiggy final-price rate limit reached. Please retry in about a minute.',
      429,
      'FINAL_PRICE_RATE_LIMITED',
    );
  }
  const now = Date.now();
  for (let index = 0; index < count; index += 1) writeTimestamps.push(now);
}

function unwrapData(raw) {
  if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object') {
    return raw.data;
  }
  return raw && typeof raw === 'object' ? raw : {};
}

function parseMoney(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && /^\s*free\s*$/i.test(value)) return 0;
  if (typeof value === 'object') {
    const nestedValue = value.amount
      ?? value.value
      ?? value.displayValue
      ?? value.display_value
      ?? value.text;
    return nestedValue === undefined ? null : parseMoney(nestedValue);
  }
  const normalized = String(value).replace(/[^\d.-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function findValueByKeys(source, aliases, depth = 0) {
  if (!source || typeof source !== 'object' || depth > 6) return null;
  const aliasSet = new Set(aliases.map((key) => key.replace(/[^a-z0-9]/gi, '').toLowerCase()));

  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (aliasSet.has(normalizedKey)) {
      const amount = parseMoney(value);
      if (amount !== null) return amount;
    }
  }

  for (const value of Object.values(source)) {
    if (value && typeof value === 'object') {
      const match = findValueByKeys(value, aliases, depth + 1);
      if (match !== null) return match;
    }
  }
  return null;
}

function findArrayByKeys(source, aliases, depth = 0) {
  if (!source || typeof source !== 'object' || depth > 6) return null;
  const aliasSet = new Set(aliases.map((key) => key.replace(/[^a-z0-9]/gi, '').toLowerCase()));

  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (aliasSet.has(normalizedKey) && Array.isArray(value)) return value;
  }
  for (const value of Object.values(source)) {
    if (value && typeof value === 'object') {
      const match = findArrayByKeys(value, aliases, depth + 1);
      if (match) return match;
    }
  }
  return null;
}

function payableFromComponents(pricing) {
  const itemTotal = parseMoney(pricing.item_total);
  if (itemTotal === null) return null;
  const delivery = parseMoney(pricing.delivery_charge) || 0;
  const taxes = parseMoney(pricing.taxes_and_charges) || 0;
  const platformFee = parseMoney(pricing.platform_fee) || 0;
  const discount = parseMoney(pricing.discount) || 0;
  return Math.round(itemTotal + delivery + taxes + platformFee - discount);
}

function parseCartResponse(raw) {
  if (raw && typeof raw === 'object') {
    const data = unwrapData(raw);
    const cart = data.cart && typeof data.cart === 'object' ? data.cart : data;
    const items = findArrayByKeys(cart, ['items', 'cartItems', 'orderItems']);
    const pricing = {
      item_total: findValueByKeys(cart, ['item_total', 'itemTotal', 'subtotal', 'subTotal']),
      delivery_charge: findValueByKeys(cart, [
        'delivery_charge', 'deliveryCharge', 'deliveryFee', 'delivery_fee',
      ]),
      delivery_charge_strikeoff: findValueByKeys(cart, [
        'delivery_charge_strikeoff', 'deliveryChargeStrikeoff', 'deliveryFeeStrikeoff',
      ]),
      taxes_and_charges: findValueByKeys(cart, [
        'taxes_and_charges', 'taxesAndCharges', 'taxes', 'charges',
      ]),
      platform_fee: findValueByKeys(cart, ['platform_fee', 'platformFee']),
      discount: findValueByKeys(cart, [
        'coupon_discount', 'couponDiscount', 'discount', 'discountAmount',
      ]),
      to_pay: findValueByKeys(cart, [
        'to_pay', 'toPay', 'totalPayable', 'payableAmount', 'grandTotal', 'finalTotal',
      ]),
    };
    const hasCartPricing = pricing.item_total !== null || pricing.to_pay !== null;
    if (pricing.to_pay === null && hasCartPricing) {
      pricing.to_pay = payableFromComponents(pricing);
    }
    return {
      is_empty: items
        ? items.length === 0
        : (hasCartPricing ? false : (cart.is_empty === true ? true : null)),
      items: items || [],
      pricing,
      offers: cart.offers || {},
    };
  }

  const text = typeof raw === 'string' ? raw : '';
  if (/^\s*Cart is empty\./i.test(text)) {
    return { is_empty: true, items: [], pricing: {}, offers: {} };
  }

  const itemLines = text.match(/^\s*-\s+.+?\(ID:\s*[^)]+\)\s*$/gmi) || [];
  const itemTotal = parseMoney(text.match(/Item total:\s*₹?([\d,.]+)/i)?.[1]);
  const deliveryText = text.match(/Delivery:\s*(FREE|₹?[\d,.]+)/i)?.[1];
  const deliveryCharge = /^FREE$/i.test(deliveryText || '') ? 0 : parseMoney(deliveryText);
  const taxes = parseMoney(text.match(/Taxes\s*&\s*charges:\s*₹?([\d,.]+)/i)?.[1]);
  let toPay = parseMoney(text.match(
    /^\s*(?:TO PAY|TOTAL TO PAY|GRAND TOTAL|TOTAL PAYABLE|PAYABLE AMOUNT):\s*₹?([\d,.]+)/im,
  )?.[1]);
  const couponDiscount = parseMoney(
    text.match(/(?:Coupon discount|Discount):\s*-?\s*₹?([\d,.]+)/i)?.[1],
  );
  const couponApplied = text.match(/Coupon(?: applied)?:\s*([A-Z0-9_-]+)/i)?.[1] || null;
  const hasCartDetails = itemLines.length > 0 || toPay !== null || itemTotal !== null;
  if (toPay === null && itemTotal !== null && deliveryCharge !== null && taxes !== null) {
    toPay = Math.round(itemTotal + deliveryCharge + taxes - (couponDiscount || 0));
  }

  return {
    is_empty: hasCartDetails ? false : null,
    items: itemLines,
    pricing: {
      item_total: itemTotal,
      delivery_charge: deliveryCharge,
      taxes_and_charges: taxes,
      to_pay: toPay,
    },
    offers: {
      coupon_discount: couponDiscount,
      coupon_applied: couponApplied,
    },
  };
}

function findBestCoupon(raw) {
  const data = unwrapData(raw);
  const sections = Array.isArray(data.coupon_sections) ? data.coupon_sections : [];
  const coupons = sections.flatMap((section) => (
    Array.isArray(section.coupons) ? section.coupons : []
  ));

  return coupons.find((coupon) => {
    const applicable = coupon.applicable === true
      || coupon.applicabilityStatus === 'APPLICABLE';
    const text = JSON.stringify(coupon).toLowerCase();
    const onlineOnly = /(online|card|upi).{0,20}only|only.{0,20}(online|card|upi)/i.test(text);
    return applicable && coupon.id && !onlineOnly;
  }) || null;
}

function simulatedFinalPrice(item, swiggyFinal, preferredPlatform) {
  const subtotal = Number(item.display_price);
  const seed = Number(item.source_item_id || item.item_id);
  const gapPercent = 3 + (seed % 7); // deterministic 3–9% checkout gap
  const swiggyTotal = Number(swiggyFinal.total);
  let targetTotal = swiggyTotal;

  if (preferredPlatform === 'Swiggy') {
    targetTotal = Math.max(swiggyTotal + 1, Math.ceil(swiggyTotal * (1 + gapPercent / 100)));
  } else if (preferredPlatform === 'Zomato') {
    targetTotal = Math.max(1, Math.min(swiggyTotal - 1, Math.floor(swiggyTotal / (1 + gapPercent / 100))));
  }

  const deliveryFee = estimateDeliveryFee(subtotal, item.area, seed + 1);
  const platformFee = 7 + ((seed + 1) % 3);
  const taxes = Math.max(5, Math.round(subtotal * 0.05));
  let otherCharges = 0;
  const beforeDiscount = subtotal + deliveryFee + platformFee + taxes;
  if (beforeDiscount < targetTotal) {
    otherCharges = targetTotal - beforeDiscount;
  }
  const discount = Math.max(0, beforeDiscount - targetTotal);
  return {
    item_id: Number(item.item_id),
    platform: 'Zomato',
    data_source: 'zomato_simulated',
    is_live: false,
    simulated: true,
    subtotal,
    delivery_fee: deliveryFee,
    platform_fee: platformFee,
    taxes_and_charges: taxes,
    other_charges: otherCharges,
    discount,
    comparison_gap_percent: gapPercent,
    coupon_code: null,
    coupon_status: 'Coupon not applicable',
    offer_label: 'Estimated platform offer',
    total: targetTotal,
    disclaimer: 'Zomato estimate for portfolio comparison; not a real checkout quote.',
  };
}

async function getItem(itemId) {
  const [rows] = await pool.query(
    `SELECT
       m.item_id, m.platform, m.data_source, m.is_live, m.price_inr,
       m.source_item_id, m.price_offset_percent, m.external_item_id,
       m.item_name, r.name AS restaurant_name,
       r.source_restaurant_id, r.area,
       CASE
         WHEN m.data_source = 'zomato_simulated' AND source.price_inr IS NOT NULL
           THEN ROUND(source.price_inr * (1 + m.price_offset_percent / 100))
         ELSE m.price_inr
       END AS display_price,
       CASE
         WHEN m.data_source = 'zomato_simulated' THEN source.external_item_id
         ELSE m.external_item_id
       END AS swiggy_item_id
     FROM menu_items m
     INNER JOIN restaurants r ON r.restaurant_id = m.restaurant_id
     LEFT JOIN menu_items source ON source.item_id = m.source_item_id
     WHERE m.item_id = ?
     LIMIT 1`,
    [itemId],
  );
  return rows[0] || null;
}

async function checkLiveSwiggyPrice(item, areaSlug) {
  if (livePriceCheckInProgress) {
    throw serviceError(
      'Another Swiggy price check is in progress. Please retry shortly.',
      409,
      'FINAL_PRICE_BUSY',
    );
  }

  const area = getLucknowArea(areaSlug);
  const addressId = getAreaAddressId(areaSlug);
  if (!area || !addressId) {
    throw serviceError(
      'This Lucknow area is not configured for final-price comparisons.',
      400,
      'AREA_NOT_CONFIGURED',
    );
  }
  if (!item.source_restaurant_id || !item.swiggy_item_id) {
    throw serviceError('Stored Swiggy source identifiers are incomplete.', 409, 'SOURCE_ID_MISSING');
  }

  reserveWriteBudget(3); // add item, optionally apply coupon, always flush
  livePriceCheckInProgress = true;
  let cartTouched = false;

  try {
    const existingRaw = await callTool('get_food_cart', { addressId });
    const existing = parseCartResponse(existingRaw);
    if (existing.is_empty === false) {
      throw serviceError(
        'Your Swiggy cart already contains items. Clear it before checking a demo final price.',
        409,
        'CART_NOT_EMPTY',
      );
    }
    if (existing.is_empty !== true) {
      throw serviceError(
        'Could not safely confirm that your Swiggy cart is empty. No cart changes were made.',
        502,
        'CART_STATE_UNKNOWN',
      );
    }

    cartTouched = true;
    await callTool('update_food_cart', {
      restaurantId: String(item.source_restaurant_id),
      restaurantName: item.restaurant_name,
      addressId,
      cartItems: [{ menu_item_id: String(item.swiggy_item_id), quantity: 1 }],
      cutleryOptIn: false,
    });

    const couponsRaw = await callTool('fetch_food_coupons', {
      restaurantId: String(item.source_restaurant_id),
      addressId,
    });
    const bestCoupon = findBestCoupon(couponsRaw);
    if (bestCoupon) {
      try {
        await callTool('apply_food_coupon', {
          couponCode: String(bestCoupon.id),
          addressId,
        });
      } catch (couponError) {
        console.warn('[Final Price] Coupon could not be applied:', couponError.message);
      }
    }

    const cartRaw = await callTool('get_food_cart', {
      addressId,
      restaurantName: item.restaurant_name,
    });
    const cart = parseCartResponse(cartRaw);
    const pricing = cart.pricing;
    const offers = cart.offers;

    if (!Number.isFinite(Number(pricing.to_pay))) {
      if (cart.is_empty === true) {
        throw serviceError(
          'Swiggy could not add this item to the cart. It may be unavailable right now.',
          409,
          'CART_ITEM_UNAVAILABLE',
        );
      }
      throw serviceError(
        'Swiggy returned incomplete checkout pricing. Please retry this item shortly.',
        502,
        'CART_TOTAL_MISSING',
      );
    }

    const couponDiscount = Number(offers.coupon_discount || 0);
    return {
      item_id: Number(item.item_id),
      platform: 'Swiggy',
      data_source: 'swiggy_live',
      is_live: true,
      simulated: false,
      area: area.name,
      subtotal: parseMoney(pricing.item_total) ?? Number(item.display_price),
      delivery_fee: parseMoney(pricing.delivery_charge) || 0,
      delivery_fee_strikeoff: parseMoney(pricing.delivery_charge_strikeoff) || 0,
      taxes_and_charges: parseMoney(pricing.taxes_and_charges) || 0,
      platform_fee: parseMoney(pricing.platform_fee) || 0,
      discount: couponDiscount > 0 ? couponDiscount : 0,
      coupon_code: couponDiscount > 0 ? (offers.coupon_applied || null) : null,
      coupon_status: couponDiscount > 0
        ? `Coupon applied${offers.coupon_applied ? `: ${offers.coupon_applied}` : ''}`
        : 'Coupon not applicable',
      total: Number(pricing.to_pay),
      checked_at: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof SwiggyMcpError || error.statusCode) throw error;
    throw serviceError(error.message || 'Unable to check Swiggy final price.', 502, 'FINAL_PRICE_FAILED');
  } finally {
    if (cartTouched) {
      try {
        await callTool('flush_food_cart', {});
      } catch (flushError) {
        console.error('[Final Price] Swiggy cart cleanup failed:', flushError.message);
      }
    }
    livePriceCheckInProgress = false;
  }
}

function buildFinalPriceComparison(swiggy, zomato) {
  const swiggyTotal = Number(swiggy.total);
  const zomatoTotal = Number(zomato.total);
  const cheaperPlatform = swiggyTotal === zomatoTotal
    ? 'Same price'
    : (swiggyTotal < zomatoTotal ? 'Swiggy' : 'Zomato');

  return {
    swiggy,
    zomato,
    cheaper_platform: cheaperPlatform,
    savings: Math.abs(swiggyTotal - zomatoTotal),
    disclaimer: 'Swiggy is a checkout total; Zomato is an estimate because no official Zomato ordering API is available.',
  };
}

async function getPairedItems(item) {
  if (item.data_source === 'swiggy_live') {
    const [rows] = await pool.query(
      `SELECT item_id FROM menu_items
       WHERE source_item_id = ? AND data_source = 'zomato_simulated'
       LIMIT 1`,
      [item.item_id],
    );
    return {
      swiggy: item,
      zomato: rows.length ? await getItem(rows[0].item_id) : null,
    };
  }

  if (item.data_source === 'zomato_simulated') {
    return {
      swiggy: item.source_item_id ? await getItem(item.source_item_id) : null,
      zomato: item,
    };
  }

  return { swiggy: null, zomato: null };
}

async function checkFinalPrice(itemId, areaSlug) {
  const item = await getItem(itemId);
  if (!item) throw serviceError('Menu item not found.', 404, 'ITEM_NOT_FOUND');

  if (['swiggy_live', 'zomato_simulated'].includes(item.data_source)) {
    const pair = await getPairedItems(item);
    if (!pair.swiggy || !pair.zomato) {
      throw serviceError(
        'A matching Swiggy and Zomato price pair is unavailable for this item.',
        409,
        'PRICE_PAIR_MISSING',
      );
    }
    const swiggy = await checkLiveSwiggyPrice(pair.swiggy, areaSlug);
    const swiggyMenuPrice = Number(pair.swiggy.display_price);
    const zomatoMenuPrice = Number(pair.zomato.display_price);
    const preferredPlatform = swiggyMenuPrice === zomatoMenuPrice
      ? 'Same price'
      : (swiggyMenuPrice < zomatoMenuPrice ? 'Swiggy' : 'Zomato');
    const zomato = simulatedFinalPrice(pair.zomato, swiggy, preferredPlatform);
    return {
      item_id: Number(item.item_id),
      comparison: buildFinalPriceComparison(swiggy, zomato),
    };
  }
  throw serviceError(
    'Final-price comparisons are available only for paired Lucknow items.',
    400,
    'FINAL_PRICE_NOT_AVAILABLE',
  );
}

module.exports = {
  checkFinalPrice,
  buildFinalPriceComparison,
  findBestCoupon,
  parseCartResponse,
  simulatedFinalPrice,
};
