const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const host = process.env.IMPORT_DB_HOST;
const port = Number.parseInt(process.env.IMPORT_DB_PORT || '4000', 10);
const user = process.env.IMPORT_DB_USER;
const password = process.env.IMPORT_DB_PASSWORD;
const database = process.env.IMPORT_DB_NAME || 'bhook';
const confirmation = process.env.IMPORT_DB_CONFIRM;

function requireValue(name, value) {
  if (!value) throw new Error(`${name} is required.`);
}

async function main() {
  requireValue('IMPORT_DB_HOST', host);
  requireValue('IMPORT_DB_USER', user);
  requireValue('IMPORT_DB_PASSWORD', password);

  if (!/^[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error('IMPORT_DB_NAME may contain only letters, numbers, and underscores.');
  }
  if (confirmation !== database) {
    throw new Error(`Set IMPORT_DB_CONFIRM=${database} to confirm replacing tables in that database.`);
  }

  const dumpPath = path.join(__dirname, '..', 'database', 'bhook.sql');
  const sql = fs.readFileSync(dumpPath, 'utf8');
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    multipleStatements: true,
    connectTimeout: 15000,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4`);
    await connection.query(`USE \`${database}\``);
    console.log(`Importing BHOOK catalog into ${database}...`);
    await connection.query(sql);
    const [[restaurants]] = await connection.query('SELECT COUNT(*) AS count FROM restaurants');
    const [[items]] = await connection.query('SELECT COUNT(*) AS count FROM menu_items');
    const [[history]] = await connection.query('SELECT COUNT(*) AS count FROM price_history');
    console.log('BHOOK database import complete.');
    console.log(`Restaurants: ${restaurants.count}`);
    console.log(`Menu items: ${items.count}`);
    console.log(`Price history rows: ${history.count}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Database import failed: ${error.message}`);
  process.exitCode = 1;
});
