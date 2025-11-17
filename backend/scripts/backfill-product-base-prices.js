#!/usr/bin/env node
/**
 * Backfill products.base_unit_price from product_types.price where missing.
 * Priority: do not overwrite existing non-null, non-zero base_unit_price.
 */
const db = require('../config/db');

(async () => {
  try {
    console.log('Starting backfill of base_unit_price from product_types.price…');
    const [result] = await db.query(`UPDATE products p
      JOIN product_types t ON LOWER(p.type) = LOWER(t.name)
      SET p.base_unit_price = t.price
      WHERE (p.base_unit_price IS NULL OR p.base_unit_price = 0) AND t.price > 0`);
    console.log(`Rows matched: ${result.affectedRows}, changed: ${result.changedRows}`);
    console.log('Backfill complete.');
  } catch (err) {
    console.error('Backfill error:', err.message);
    process.exitCode = 1;
  } finally {
    try { await db.end(); } catch (_) {}
  }
})();
