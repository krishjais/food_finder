const pool = require('../db');
const { syncLucknowCatalog } = require('../services/lucknow/lucknowSyncService');

syncLucknowCatalog()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error('Lucknow catalog sync failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
