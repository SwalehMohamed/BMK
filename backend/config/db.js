const mysql = require('mysql2/promise');
const path = require('path');
// Load env from backend/.env reliably regardless of CWD
require('dotenv').config({ path: process.env.ENV_PATH || path.resolve(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;