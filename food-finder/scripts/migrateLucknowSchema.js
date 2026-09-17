const pool = require('../db');

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName],
  );
  return rows.length > 0;
}

async function constraintExists(tableName, constraintName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName],
  );
  return rows.length > 0;
}

async function addColumn(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) return;
  await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  console.log(`Added ${tableName}.${columnName}`);
}

async function addIndex(tableName, indexName, columns, unique = false) {
  if (await indexExists(tableName, indexName)) return;
  const keyword = unique ? 'UNIQUE INDEX' : 'INDEX';
  await pool.query(
    `ALTER TABLE \`${tableName}\` ADD ${keyword} \`${indexName}\` (${columns})`,
  );
  console.log(`Added ${indexName}`);
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS price_history (
      history_id INT AUTO_INCREMENT PRIMARY KEY,
      item_id INT NOT NULL,
      price_inr INT NOT NULL,
      recorded_date DATE NOT NULL,
      INDEX idx_price_history_item_date (item_id, recorded_date),
      FOREIGN KEY (item_id) REFERENCES menu_items(item_id) ON DELETE CASCADE
    )
  `);

  await addColumn(
    'restaurants',
    'data_source',
    "ENUM('mock','swiggy_live','zomato_simulated') NOT NULL DEFAULT 'mock'",
  );
  await addColumn('restaurants', 'is_live', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await addColumn('restaurants', 'fetched_at', 'DATETIME NULL');
  await addColumn('restaurants', 'source_restaurant_id', 'VARCHAR(191) NULL');
  await addColumn('restaurants', 'latitude', 'DECIMAL(10,7) NULL');
  await addColumn('restaurants', 'longitude', 'DECIMAL(10,7) NULL');

  await addColumn(
    'menu_items',
    'data_source',
    "ENUM('mock','swiggy_live','zomato_simulated') NOT NULL DEFAULT 'mock'",
  );
  await addColumn('menu_items', 'is_live', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await addColumn('menu_items', 'fetched_at', 'DATETIME NULL');
  await addColumn('menu_items', 'source_item_id', 'INT NULL');
  await addColumn('menu_items', 'price_offset_percent', 'DECIMAL(5,2) NULL');
  await addColumn('menu_items', 'external_item_id', 'VARCHAR(191) NULL');

  await addIndex(
    'restaurants',
    'uq_restaurant_live_area',
    '`data_source`, `source_restaurant_id`, `area`',
    true,
  );
  await addIndex(
    'menu_items',
    'uq_menu_live_item',
    '`data_source`, `restaurant_id`, `external_item_id`',
    true,
  );
  await addIndex(
    'menu_items',
    'uq_menu_simulated_source',
    '`data_source`, `source_item_id`',
    true,
  );
  await addIndex('menu_items', 'idx_menu_source_item', '`source_item_id`');
  await addIndex('restaurants', 'idx_restaurant_city_area', '`city`, `area`');

  if (!(await constraintExists('menu_items', 'fk_menu_source_item'))) {
    await pool.query(`
      ALTER TABLE menu_items
      ADD CONSTRAINT fk_menu_source_item
      FOREIGN KEY (source_item_id) REFERENCES menu_items(item_id)
      ON DELETE CASCADE
    `);
    console.log('Added fk_menu_source_item');
  }

  console.log('Lucknow live-data schema migration complete.');
}

migrate()
  .catch((error) => {
    console.error('Lucknow schema migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
