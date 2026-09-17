const fs = require('fs');
const path = require('path');
const pool = require('../db');

const TABLES = ['restaurants', 'menu_items', 'price_history'];
const OUTPUT_DIRECTORY = path.join(__dirname, '..', 'database');
const OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, 'bhook.sql');
const INSERT_BATCH_SIZE = 250;

function quoteIdentifier(value) {
  return `\`${String(value).replaceAll('`', '``')}\``;
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) {
    const iso = value.toISOString().slice(0, 19).replace('T', ' ');
    return `'${iso}'`;
  }
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  const escaped = String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('\0', '\\0')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll("'", "''");
  return `'${escaped}'`;
}

function insertStatements(tableName, rows) {
  if (!rows.length) return [];
  const columns = Object.keys(rows[0]);
  const statements = [];
  for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
    const batch = rows.slice(start, start + INSERT_BATCH_SIZE);
    const values = batch.map((row) => (
      `(${columns.map((column) => sqlValue(row[column])).join(', ')})`
    ));
    statements.push(
      `INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')}) VALUES\n${values.join(',\n')};`,
    );
  }
  return statements;
}

async function exportDatabase() {
  const output = [
    '-- BHOOK portable database export',
    `-- Generated ${new Date().toISOString()}`,
    '-- Contains catalog and synthetic price history only; no credentials or OAuth tokens.',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS=0;',
    '',
  ];

  for (const tableName of [...TABLES].reverse()) {
    output.push(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)};`);
  }
  output.push('');

  for (const tableName of TABLES) {
    const [createRows] = await pool.query(`SHOW CREATE TABLE ${quoteIdentifier(tableName)}`);
    const createSql = createRows[0]?.['Create Table'];
    if (!createSql) throw new Error(`Could not read schema for ${tableName}`);
    output.push(`${createSql};`, '');
  }

  for (const tableName of TABLES) {
    const [rows] = await pool.query(`SELECT * FROM ${quoteIdentifier(tableName)}`);
    output.push(`-- ${rows.length} rows from ${tableName}`);
    output.push(...insertStatements(tableName, rows), '');
  }

  output.push('SET FOREIGN_KEY_CHECKS=1;', '');
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, output.join('\n'), 'utf8');
  const sizeMb = fs.statSync(OUTPUT_PATH).size / 1024 / 1024;
  console.log(`Exported ${OUTPUT_PATH} (${sizeMb.toFixed(2)} MB)`);
}

exportDatabase()
  .catch((error) => {
    console.error('Database export failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
