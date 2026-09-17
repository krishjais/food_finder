/**
 * BHOOK Best Value Score Ranking Algorithm
 * 
 * Blends item rating, price, and delivery speed into a single unified score:
 * value_score = (0.50 ? rating_norm) + (0.35 ? price_norm) + (0.15 ? delivery_norm)
 */

// Weight constants for transparency and easy tuning
const WEIGHT_RATING = 0.50;
const WEIGHT_PRICE = 0.35;
const WEIGHT_DELIVERY = 0.15;

/**
 * Computes value scores for candidate rows and sorts them descending.
 * 
 * @param {Array<Object>} rows - Array of menu items containing item_rating, price_inr, delivery_time_mins
 * @returns {Array<Object>} Array of rows sorted descending by value_score, with value_score field added
 */
function computeValueScores(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  // Find min and max for price and delivery time across the candidate set
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const row of rows) {
    const price = Number(row.ranking_price_inr ?? row.price_inr);
    const time = Number(row.delivery_time_mins);

    if (price < minPrice) minPrice = price;
    if (price > maxPrice) maxPrice = price;
    if (time < minTime) minTime = time;
    if (time > maxTime) maxTime = time;
  }

  const priceDiff = maxPrice - minPrice;
  const timeDiff = maxTime - minTime;

  // Compute normalized scores and weighted value_score for each row
  const scoredRows = rows.map((row) => {
    const rating = Number(row.item_rating);
    const price = Number(row.ranking_price_inr ?? row.price_inr);
    const deliveryTime = Number(row.delivery_time_mins);

    // Step 1: Rating norm on a fixed 0-5 star scale
    const ratingNorm = Math.min(Math.max(rating / 5, 0), 1);

    // Step 2: Price norm (relative min-max, cheaper is better)
    // Guard against division by zero if all candidate prices are identical
    const priceNorm = priceDiff === 0 ? 1 : (maxPrice - price) / priceDiff;

    // Step 3: Delivery time norm (relative min-max, faster is better)
    // Guard against division by zero if all candidate delivery times are identical
    const deliveryNorm = timeDiff === 0 ? 1 : (maxTime - deliveryTime) / timeDiff;

    // Step 4: Calculate weighted arithmetic value score rounded to 3 decimal places
    const rawScore =
      (WEIGHT_RATING * ratingNorm) +
      (WEIGHT_PRICE * priceNorm) +
      (WEIGHT_DELIVERY * deliveryNorm);

    const valueScore = Number(rawScore.toFixed(3));

    return {
      ...row,
      value_score: valueScore,
    };
  });

  // Sort descending by value_score
  // Tiebreaker: lowest price, then highest rating
  scoredRows.sort((a, b) => {
    if (b.value_score !== a.value_score) {
      return b.value_score - a.value_score;
    }
    const aPrice = Number(a.ranking_price_inr ?? a.price_inr);
    const bPrice = Number(b.ranking_price_inr ?? b.price_inr);
    if (aPrice !== bPrice) {
      return aPrice - bPrice;
    }
    return Number(b.item_rating) - Number(a.item_rating);
  });

  return scoredRows;
}

module.exports = {
  computeValueScores,
  WEIGHT_RATING,
  WEIGHT_PRICE,
  WEIGHT_DELIVERY,
};
