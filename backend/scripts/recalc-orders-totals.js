#!/usr/bin/env node
/**
 * Recalculate orders.total_amount using weight-based pricing.
 * Formula: total_amount = quantity * unit_weight_kg * price_per_kg
 *   unit_weight_kg := COALESCE(orders.manual_unit_weight_kg, products.weight, slaughtered.avg_weight, 1)
 *   price_per_kg   := COALESCE(orders.unit_price, products.base_unit_price, product_types.price, 0)
 *
 * Usage:
 *   node scripts/recalc-orders-totals.js           # dry-run (shows summary and sample changes, no writes)
 *   node scripts/recalc-orders-totals.js --apply   # apply UPDATE to all rows
 */
const db = require('../config/db');

(async () => {
  const apply = process.argv.includes('--apply');
  try {
    console.log(`[recalc-orders-totals] Starting in ${apply ? 'APPLY' : 'DRY-RUN'} mode...`);

    // Ensure manual_unit_weight_kg column exists (script can be run before server init)
    try {
      const [cols] = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders'`);
      const names = cols.map(c => c.column_name);
      if (!names.includes('manual_unit_weight_kg')) {
        console.log('[recalc-orders-totals] Column manual_unit_weight_kg missing on orders; adding it...');
        try {
          await db.query(`ALTER TABLE orders ADD COLUMN manual_unit_weight_kg DECIMAL(10,2) NULL AFTER quantity`);
          console.log('[recalc-orders-totals] Column manual_unit_weight_kg added.');
        } catch (e2) {
          console.warn('[recalc-orders-totals] Failed to add manual_unit_weight_kg column:', e2.message);
        }
      }
    } catch (e) {
      console.warn('[recalc-orders-totals] Could not verify/add manual_unit_weight_kg column:', e.message);
    }

    // Show how many orders and a quick sample of recalculated totals
    const [sample] = await db.query(`
      SELECT o.id,
             o.quantity,
             o.unit_price,
             o.total_amount AS old_total,
             o.manual_unit_weight_kg,
             p.weight AS product_weight,
             s.avg_weight AS avg_weight,
             p.base_unit_price,
             t.price AS type_price,
             (o.quantity
               * COALESCE(o.manual_unit_weight_kg, p.weight, s.avg_weight, 1)
               * COALESCE(o.unit_price, p.base_unit_price, t.price, 0)
             ) AS new_total
        FROM orders o
        LEFT JOIN products p ON p.id = o.product_id
        LEFT JOIN slaughtered s ON s.id = p.slaughtered_id
        LEFT JOIN product_types t ON t.name = LCASE(COALESCE(o.product_type, p.type))
       ORDER BY o.id DESC
       LIMIT 10`);

    const [[{ cnt }]] = await db.query('SELECT COUNT(*) AS cnt FROM orders');
    console.log(`[recalc-orders-totals] Orders found: ${cnt}`);
    if (sample.length) {
      console.log('[recalc-orders-totals] Sample (10 rows):');
      for (const row of sample) {
        console.log(` - #${row.id}: qty=${row.quantity}, unit_price(kg)=${row.unit_price}, unit_wt_kg=${row.manual_unit_weight_kg ?? row.product_weight ?? row.avg_weight ?? 1}, old_total=${Number(row.old_total||0).toFixed(2)} => new_total=${Number(row.new_total||0).toFixed(2)}`);
      }
    }

    if (!apply) {
      console.log('\nDry-run complete. To apply updates, run:\n  npm run recalc:orders');
      return;
    }

    const [res] = await db.query(`
      UPDATE orders o
      LEFT JOIN products p ON p.id = o.product_id
      LEFT JOIN slaughtered s ON s.id = p.slaughtered_id
      LEFT JOIN product_types t ON t.name = LCASE(COALESCE(o.product_type, p.type))
         SET o.total_amount = (o.quantity
                               * COALESCE(o.manual_unit_weight_kg, p.weight, s.avg_weight, 1)
                               * COALESCE(o.unit_price, p.base_unit_price, t.price, 0))`);
    console.log(`[recalc-orders-totals] Rows matched: ${res.affectedRows}, changed: ${res.changedRows}`);
    console.log('[recalc-orders-totals] Done.');
  } catch (err) {
    console.error('[recalc-orders-totals] Error:', err.message);
    process.exitCode = 1;
  } finally {
    try { await db.end(); } catch (_) {}
  }
})();
