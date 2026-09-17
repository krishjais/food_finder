const pool = require('../db');

/**
 * Generates 30 days of synthetic historical prices for every menu item,
 * ending exactly at that item's real, current price_inr.
 */
async function generatePriceHistory() {
  console.log('--- Starting Price History Generation ---');

  // 1. Ensure table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS price_history (
      history_id INT AUTO_INCREMENT PRIMARY KEY,
      item_id INT NOT NULL,
      price_inr INT NOT NULL,
      recorded_date DATE NOT NULL,
      FOREIGN KEY (item_id) REFERENCES menu_items(item_id)
    );
  `);
  console.log('Verified price_history table exists.');

  // 2. Truncate table for safe re-run
  await pool.query('TRUNCATE TABLE price_history;');
  console.log('Truncated price_history table.');

  // 3. Fetch all menu items
  const [items] = await pool.query(
    `SELECT item_id, item_name, price_inr
     FROM menu_items
     WHERE data_source <> 'zomato_simulated'`,
  );
  console.log(`Fetched ${items.length} menu items from database.`);

  if (items.length === 0) {
    console.log('No menu items found. Exiting.');
    await pool.end();
    return;
  }

  // Pre-calculate date strings and weekend flags for 30 days (0 = 29 days ago, 29 = today)
  const days = [];
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    days.push({ index: i, dateStr, isWeekend });
  }

  const batch = [];
  const CHUNK_SIZE = 500;
  let totalRows = 0;

  for (const item of items) {
    const todayPrice = Number(item.price_inr);
    // 2. Pick a random overall drift for the month between -10% and +10%
    const driftPercent = (Math.random() * 0.20) - 0.10;
    // 3. startPrice = todayPrice / (1 + driftPercent)
    const startPrice = todayPrice / (1 + driftPercent);

    for (let i = 0; i < 30; i++) {
      let price;
      if (i === 29) {
        // 5. Force day 29 (today) to exactly equal todayPrice
        price = todayPrice;
      } else {
        // 4. Baseline linear interpolation
        const baseline = startPrice + (todayPrice - startPrice) * (i / 29);
        // dailyNoise = random between -3% and +3% of baseline
        const dailyNoise = (Math.random() * 0.06 - 0.03) * baseline;
        price = Math.round(baseline + dailyNoise);

        // Weekend bump: if Saturday or Sunday, factor between 1.02 and 1.05
        if (days[i].isWeekend) {
          const weekendFactor = 1.02 + Math.random() * 0.03;
          price = Math.round(price * weekendFactor);
        }
      }

      batch.push([item.item_id, price, days[i].dateStr]);
      totalRows++;

      if (batch.length >= CHUNK_SIZE) {
        await pool.query(
          'INSERT INTO price_history (item_id, price_inr, recorded_date) VALUES ?',
          [batch]
        );
        batch.length = 0;
      }
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    await pool.query(
      'INSERT INTO price_history (item_id, price_inr, recorded_date) VALUES ?',
      [batch]
    );
  }

  console.log(`Successfully generated and inserted ${totalRows} historical price rows for ${items.length} items.`);
  await pool.end();
}

generatePriceHistory().catch((err) => {
  console.error('Error generating price history:', err);
  process.exit(1);
});
