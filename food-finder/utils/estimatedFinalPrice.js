const AREA_DELIVERY_BASE = Object.freeze({
  rajajipuram: 12,
  uttardhona: 14,
  'uttardhona (bbd)': 14,
  'manas nagar': 13,
  'anora kala': 16,
  aliganj: 10,
  'gomti nagar': 8,
  hazratganj: 8,
  'indira nagar': 9,
  aminabad: 8,
  chowk: 9,
});

function normalizedArea(area) {
  return String(area || '').trim().toLowerCase();
}

function deliveryBaseForArea(area) {
  return AREA_DELIVERY_BASE[normalizedArea(area)] || 12;
}

function estimateDeliveryFee(subtotal, area, seed) {
  const baseDelivery = Number(subtotal) >= 149 ? 0 : deliveryBaseForArea(area);
  return baseDelivery ? baseDelivery + (Math.abs(Number(seed) || 0) % 5) : 0;
}

function buildBreakdown(platform, subtotal, area, seed, targetTotal = null) {
  // Catalog restaurants were fetched for the selected fixed area, so they are
  // nearby rather than cross-city deliveries. Use a small local-order estimate
  // and stop adding delivery above the common low-order threshold.
  const platformFee = platform === 'Swiggy' ? 6 + (seed % 3) : 7 + (seed % 3);
  const taxesAndCharges = Math.max(5, Math.round(subtotal * 0.05));
  const deliveryFee = estimateDeliveryFee(subtotal, area, seed);
  let otherCharges = 0;
  let discount = 0;
  let total = subtotal + deliveryFee + platformFee + taxesAndCharges;

  if (Number.isFinite(targetTotal)) {
    const safeTarget = Math.max(subtotal, Math.round(targetTotal));
    if (total > safeTarget) discount = total - safeTarget;
    if (total < safeTarget) otherCharges = safeTarget - total;
    total = safeTarget;
  }

  return {
    platform,
    estimated: true,
    subtotal,
    delivery_fee: deliveryFee,
    platform_fee: platformFee,
    taxes_and_charges: taxesAndCharges,
    other_charges: otherCharges,
    discount,
    coupon_code: null,
    coupon_status: 'Coupon not applicable',
    total,
  };
}

function estimateFinalPricePair(item, areaOverride) {
  const ownPlatform = String(item.platform || '').toLowerCase();
  const ownPrice = Number(item.price_inr);
  const comparisonPrice = Number(item.comparison_price_inr);
  if (!Number.isFinite(ownPrice) || !Number.isFinite(comparisonPrice)) return null;

  const swiggySubtotal = ownPlatform === 'swiggy' ? ownPrice : comparisonPrice;
  const zomatoSubtotal = ownPlatform === 'zomato' ? ownPrice : comparisonPrice;
  const area = areaOverride || item.area || '';
  const seed = Math.abs(Number(item.source_item_id || item.item_id) || 1);
  const swiggy = buildBreakdown('Swiggy', swiggySubtotal, area, seed);
  const menuWinner = swiggySubtotal === zomatoSubtotal
    ? 'Same price'
    : (swiggySubtotal < zomatoSubtotal ? 'Swiggy' : 'Zomato');
  const gapPercent = 3 + (seed % 7);
  let zomatoTarget = swiggy.total;
  if (menuWinner === 'Swiggy') zomatoTarget = Math.ceil(swiggy.total * (1 + gapPercent / 100));
  if (menuWinner === 'Zomato') zomatoTarget = Math.floor(swiggy.total / (1 + gapPercent / 100));
  const zomato = buildBreakdown('Zomato', zomatoSubtotal, area, seed + 1, zomatoTarget);
  const cheaperPlatform = swiggy.total === zomato.total
    ? 'Same price'
    : (swiggy.total < zomato.total ? 'Swiggy' : 'Zomato');

  return {
    type: 'location_based_estimate',
    area: area || null,
    swiggy,
    zomato,
    cheaper_platform: cheaperPlatform,
    savings: Math.abs(swiggy.total - zomato.total),
    lowest_total: Math.min(swiggy.total, zomato.total),
    disclaimer: 'Estimated payable total for budget planning. Fees can change at checkout; coupons are not assumed.',
  };
}

module.exports = { estimateFinalPricePair, deliveryBaseForArea, estimateDeliveryFee };
