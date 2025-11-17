const db = require('./db');

async function ensureTables() {
  // Create tables used by routes if they don't already exist
  const queries = [
    // Mortality logs (safety, matches schema.sql)
    `CREATE TABLE IF NOT EXISTS mortality_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chick_batch_id INT NOT NULL,
      date DATE NOT NULL,
      number_dead INT NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_mortality_batch FOREIGN KEY (chick_batch_id) REFERENCES chicks(id) ON DELETE CASCADE,
      INDEX idx_mortality_date (date)
    )`,
    // Feed usage log (new schema). Legacy instances may lack some columns; we patch below.
    `CREATE TABLE IF NOT EXISTS feed_usage (
      id INT AUTO_INCREMENT PRIMARY KEY,
      feed_id INT NOT NULL,
      user_id INT NULL,
      batch_id INT NULL,
      quantity_used DECIMAL(10,2) NULL,
      date_used DATE NULL,
      used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_feed_usage_feed FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
      CONSTRAINT fk_feed_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_feed_usage_batch FOREIGN KEY (batch_id) REFERENCES chicks(id) ON DELETE SET NULL,
      INDEX idx_feed_usage_feed (feed_id),
      INDEX idx_feed_usage_date (date_used)
    )`,
    // Products (linkable to batch via batch_id)
    `CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(100) NOT NULL,
      packaged_quantity INT NOT NULL DEFAULT 0,
      batch_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_products_batch FOREIGN KEY (batch_id) REFERENCES chicks(id) ON DELETE SET NULL,
      INDEX idx_products_batch (batch_id)
    )`,
    // Sales
    `CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      quantity_sold INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sales_date (date)
    )`
  ];

  for (const sql of queries) {
    try {
      await db.query(sql);
    } catch (err) {
      console.error('DB init error for query:', sql.split('\n')[0], err.message);
    }
  }

  // Patch legacy feed_usage table to ensure required columns exist (batch_id, quantity_used, date_used)
  try {
    const [cols] = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'feed_usage'`);
    const names = cols.map(c => c.column_name);
    const hasBatchId = names.includes('batch_id');
    const hasQuantityUsed = names.includes('quantity_used');
    const hasDateUsed = names.includes('date_used');
    // Add missing columns with NULL default to avoid failing legacy inserts
    if (!hasBatchId) {
      try { await db.query(`ALTER TABLE feed_usage ADD COLUMN batch_id INT NULL AFTER user_id`); } catch(e) {}
      try { await db.query(`CREATE INDEX idx_feed_usage_batch ON feed_usage(batch_id)`); } catch(e) {}
      try { await db.query(`ALTER TABLE feed_usage ADD CONSTRAINT fk_feed_usage_batch FOREIGN KEY (batch_id) REFERENCES chicks(id) ON DELETE SET NULL`); } catch(e) {}
    }
    if (!hasQuantityUsed) {
      try { await db.query(`ALTER TABLE feed_usage ADD COLUMN quantity_used DECIMAL(10,2) NULL AFTER batch_id`); } catch(e) {}
    }
    if (!hasDateUsed) {
      try { await db.query(`ALTER TABLE feed_usage ADD COLUMN date_used DATE NULL AFTER quantity_used`); } catch(e) {}
    }
  } catch (err) {
    console.error('DB init error patching feed_usage columns:', err.message);
  }

  // Ensure orders table exists
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_date DATE NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      product_type VARCHAR(100) NULL,
      product_id INT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_orders_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      CONSTRAINT fk_orders_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_orders_date (order_date),
      INDEX idx_orders_status (status)
    )`);
  } catch (err) {
    console.error('DB init error creating orders table:', err.message);
  }

  // Ensure deliveries table exists
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS deliveries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NULL,
      delivery_date DATE NOT NULL,
      recipient_name VARCHAR(255) NOT NULL,
      address VARCHAR(500) NULL,
      quantity_delivered INT NOT NULL,
      notes TEXT,
      delivered_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_deliveries_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
      CONSTRAINT fk_deliveries_user FOREIGN KEY (delivered_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_deliveries_date (delivery_date)
    )`);
  } catch (err) {
    console.error('DB init error creating deliveries table:', err.message);
  }

  // Ensure slaughtered table exists and has avg_weight column
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS slaughtered (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batch_id INT NOT NULL,
      date DATE NOT NULL,
      quantity INT NOT NULL,
      avg_weight DECIMAL(10,2) NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_slaughtered_batch FOREIGN KEY (batch_id) REFERENCES chicks(id) ON DELETE CASCADE,
      INDEX idx_slaughtered_date (date)
    )`);
  } catch (err) {
    console.error('DB init error creating slaughtered table:', err.message);
  }
  try {
    await db.query(`ALTER TABLE slaughtered ADD COLUMN IF NOT EXISTS avg_weight DECIMAL(10,2) NULL AFTER quantity`);
  } catch (err) {
    // Some MySQL variants (pre-8.0) don't support IF NOT EXISTS; fallback: check and add
    try {
      const [rows] = await db.query(`SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'slaughtered' AND column_name = 'avg_weight'`);
      if ((rows?.[0]?.cnt || 0) === 0) {
        await db.query(`ALTER TABLE slaughtered ADD COLUMN avg_weight DECIMAL(10,2) NULL AFTER quantity`);
      }
    } catch (e2) {
      console.error('DB init error ensuring avg_weight column:', e2.message);
    }
  }

  // Ensure products has batch_id column and FK/index if upgrading from legacy schema
  try {
    const [cols] = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'batch_id'`);
    const hasBatchId = (cols?.length || 0) > 0;
    if (!hasBatchId) {
      await db.query(`ALTER TABLE products ADD COLUMN batch_id INT NULL AFTER packaged_quantity`);
      // Add index
      await db.query(`CREATE INDEX idx_products_batch ON products(batch_id)`);
      // Add FK (guard in case it already exists)
      try {
        await db.query(`ALTER TABLE products ADD CONSTRAINT fk_products_batch FOREIGN KEY (batch_id) REFERENCES chicks(id) ON DELETE SET NULL`);
      } catch (e2) {
        // ignore if constraint already exists
      }
    }
  } catch (err) {
    console.error('DB init error ensuring products.batch_id:', err.message);
  }

  // Ensure product_types table exists
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS product_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_product_types_name (name)
    )`);
  } catch (err) {
    console.error('DB init error creating product_types:', err.message);
  }
  // Ensure product_types has price column for upgrades
  try {
    await db.query(`ALTER TABLE product_types ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER name`);
  } catch (err) {
    try {
      const [rows] = await db.query(`SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_types' AND column_name = 'price'`);
      if ((rows?.[0]?.cnt || 0) === 0) {
        await db.query(`ALTER TABLE product_types ADD COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER name`);
      }
    } catch (e2) {
      console.error('DB init error ensuring product_types.price column:', e2.message);
    }
  }
}

module.exports = { ensureTables };
