const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

function sslOptions() {
  if (process.env.DB_SSL !== 'true') return undefined;
  const options = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  };
  if (process.env.DB_CA_PATH) {
    options.ca = fs.readFileSync(process.env.DB_CA_PATH, 'utf8');
  }
  return options;
}

// Create a MySQL connection pool using environment variables
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'app',
  ssl: sslOptions(),
  // Preserve DATE/DATETIME values exactly across local MySQL and hosted TiDB;
  // converting midnight values through JavaScript Date can shift calendar days.
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: Math.max(1, Number.parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 5),
  queueLimit: 0,
});

module.exports = pool;
