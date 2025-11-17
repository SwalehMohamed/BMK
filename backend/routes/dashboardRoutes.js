const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Dashboard stats route
router.get('/', async (req, res, next) => {
  try {
    // Mortality period params: prefer months, fallback days. Defaults: 3 months.
    const mortalityMonths = Number(req.query.mortalityMonths || 3);
    const mortalityDays = Number(req.query.mortalityDays || 0);
    const useMonths = Number.isFinite(mortalityMonths) && mortalityMonths > 0 && !Number.isFinite(mortalityDays);
    // Build period start date expression
    const periodStartExpr = useMonths
      ? `DATE_SUB(CURDATE(), INTERVAL ${Math.floor(mortalityMonths)} MONTH)`
      : (Number.isFinite(mortalityDays) && mortalityDays > 0
          ? `DATE_SUB(CURDATE(), INTERVAL ${Math.floor(mortalityDays)} DAY)`
          : `DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`);
    // 1-3. Core flock metrics (initial, deaths, slaughtered)
    let total_initial = 0;
    let total_dead = 0;
    let total_slaughtered = 0;
    try {
      const [chickRows] = await db.query('SELECT IFNULL(SUM(initial_count),0) AS total_initial FROM chicks');
      total_initial = chickRows?.[0]?.total_initial || 0;
    } catch { /* table may not exist yet */ }
    try {
      const [deathRows] = await db.query('SELECT IFNULL(SUM(number_dead),0) AS total_dead FROM mortality_logs');
      total_dead = deathRows?.[0]?.total_dead || 0;
    } catch {}
    try {
      const [slaughterRows] = await db.query('SELECT IFNULL(SUM(quantity),0) AS total_slaughtered FROM slaughtered');
      total_slaughtered = slaughterRows?.[0]?.total_slaughtered || 0;
    } catch {}

    // Alive chicks (requested as "Total Chicks"): not dead and not slaughtered
    const alive_chicks = Math.max(0, Number(total_initial) - Number(total_dead) - Number(total_slaughtered));

    // 4. Current stock: remaining products (packaged minus delivered)
    let current_stock = 0;
    try {
      const [[{ total_products = 0 } = {}]] = await db.query(`SELECT IFNULL(SUM(packaged_quantity),0) AS total_products FROM products`);
      const [[{ total_delivered_units = 0 } = {}]] = await db.query(`
        SELECT IFNULL(SUM(d.quantity_delivered),0) AS total_delivered_units
          FROM deliveries d
          JOIN orders o ON o.id = d.order_id
         WHERE o.product_id IS NOT NULL
      `);
      current_stock = Math.max(0, Number(total_products) - Number(total_delivered_units));
    } catch {}

    // 5. Mortality rate (overall): total_dead / total_initial
    let mortality_rate = 0;
    try {
      mortality_rate = Number(total_initial) > 0
        ? Number(((Number(total_dead) / Number(total_initial)) * 100).toFixed(2))
        : 0;
    } catch {}

    // 6. Monthly sales revenue (this month): weight-based = delivered_qty * unit_weight(kg) * price_per_kg
    let monthly_sales = 0;
    let monthly_delivered_weight = 0;
    try {
      const [salesRows] = await db.query(`
        SELECT IFNULL(SUM(
                 d.quantity_delivered
                 * COALESCE(o.manual_unit_weight_kg, p.weight, s.avg_weight, 1)
                 * COALESCE(p.base_unit_price, t.price, o.unit_price, 0)
               ), 0) AS revenue
             , IFNULL(SUM(d.quantity_delivered * COALESCE(o.manual_unit_weight_kg, p.weight, s.avg_weight, 1)),0) AS delivered_weight
          FROM deliveries d
          LEFT JOIN orders o ON o.id = d.order_id
          LEFT JOIN products p ON p.id = o.product_id
          LEFT JOIN slaughtered s ON s.id = p.slaughtered_id
          LEFT JOIN product_types t ON t.name = LCASE(COALESCE(o.product_type, p.type))
         WHERE MONTH(d.delivery_date) = MONTH(CURDATE())
           AND YEAR(d.delivery_date) = YEAR(CURDATE())
      `);
      monthly_sales = Number(salesRows?.[0]?.revenue || 0);
      monthly_delivered_weight = Number(salesRows?.[0]?.delivered_weight || 0);
    } catch {}

    // 6b. Total sales revenue (all time): weight-based
    let total_sales = 0;
    let total_delivered_weight = 0;
    try {
      const [totSalesRows] = await db.query(`
        SELECT IFNULL(SUM(
                 d.quantity_delivered
                 * COALESCE(o.manual_unit_weight_kg, p.weight, s.avg_weight, 1)
                 * COALESCE(p.base_unit_price, t.price, o.unit_price, 0)
               ), 0) AS revenue
             , IFNULL(SUM(d.quantity_delivered * COALESCE(o.manual_unit_weight_kg, p.weight, s.avg_weight, 1)),0) AS delivered_weight
          FROM deliveries d
          LEFT JOIN orders o ON o.id = d.order_id
          LEFT JOIN products p ON p.id = o.product_id
          LEFT JOIN slaughtered s ON s.id = p.slaughtered_id
          LEFT JOIN product_types t ON t.name = LCASE(COALESCE(o.product_type, p.type))
      `);
      total_sales = Number(totSalesRows?.[0]?.revenue || 0);
      total_delivered_weight = Number(totSalesRows?.[0]?.delivered_weight || 0);
    } catch {}

    // 7. Feed consumption (last 6 months): union of used and purchased per month
    let feedUsedRows = [];
    let feedPurchasedRows = [];
    try {
      const [u] = await db.query(`
        SELECT DATE_FORMAT(date_used, '%Y-%m') AS ym, DATE_FORMAT(date_used, '%b') AS month, SUM(quantity_used) AS used
          FROM feed_usage
         WHERE date_used >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY ym, month
         ORDER BY ym ASC
      `);
      feedUsedRows = u;
    } catch {}
    try {
      const [p] = await db.query(`
        SELECT DATE_FORMAT(purchase_date, '%Y-%m') AS ym, DATE_FORMAT(purchase_date, '%b') AS month, SUM(quantity_kg) AS purchased
          FROM feeds
         WHERE purchase_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY ym, month
         ORDER BY ym ASC
      `);
      feedPurchasedRows = p;
    } catch {}
    // Merge both sets using ym as key
    const monthMap = new Map();
    for (const r of (feedUsedRows || [])) {
      monthMap.set(r.ym, { month: r.month, used: Number(r.used) || 0, purchased: 0 });
    }
    for (const r of (feedPurchasedRows || [])) {
      const existing = monthMap.get(r.ym) || { month: r.month, used: 0, purchased: 0 };
      existing.month = existing.month || r.month;
      existing.purchased = Number((existing.purchased || 0) + (Number(r.purchased) || 0));
      monthMap.set(r.ym, existing);
    }
    // Build array sorted by ym, and keep last 6 entries
    const feed_consumption = Array.from(monthMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-6)
      .map(([, v]) => ({ month: v.month, used: v.used || 0, purchased: v.purchased || 0 }));

    // 8. Product distribution
    let productRows = [];
    try {
      const [pr] = await db.query(`
        SELECT type AS name, IFNULL(SUM(packaged_quantity),0) AS value
        FROM products
        GROUP BY type
      `);
      productRows = pr;
    } catch {}

    // 8b. Breed distribution (for pie chart)
    let breedRows = [];
    try {
      const [br] = await db.query(`
        SELECT breed AS name, COUNT(*) AS value
        FROM chicks
        GROUP BY breed
      `);
      breedRows = br;
    } catch {}

    // 9. Recent activity (last 5 mortality logs, feed usage, or slaughters)
    let activityRows = [];
    try {
      const [ar] = await db.query(`
        SELECT date AS date, 'Mortality' AS type, CONCAT(number_dead, ' dead') AS details
        FROM mortality_logs
        UNION ALL
        SELECT date_used AS date, 'Feed Used' AS type, CONCAT(quantity_used, 'kg used') AS details
        FROM feed_usage
        UNION ALL
        SELECT date AS date, 'Slaughtered' AS type, CONCAT(quantity, ' slaughtered') AS details
        FROM slaughtered
        ORDER BY date DESC
        LIMIT 5
      `);
      activityRows = ar;
    } catch {}

    // Compose stats object
    const avg_unit_weight = total_delivered_weight > 0 ? Number((total_delivered_weight / Math.max(1, total_delivered_weight / (total_sales > 0 ? (total_sales / (total_sales/total_delivered_weight)) : 1))).toFixed(2)) : null; // placeholder logic if needed
    const monthly_revenue_per_kg = monthly_delivered_weight > 0 ? Number((monthly_sales / monthly_delivered_weight).toFixed(2)) : 0;
    const total_revenue_per_kg = total_delivered_weight > 0 ? Number((total_sales / total_delivered_weight).toFixed(2)) : 0;

    const stats = {
      total_chicks: alive_chicks,
      total_dead,
      current_stock,
      mortality_rate,
      monthly_sales,
      monthly_delivered_weight,
      monthly_revenue_per_kg,
      total_sales,
      total_delivered_weight,
      total_revenue_per_kg,
      feed_consumption,
      product_distribution: productRows,
      breed_distribution: breedRows,
      recent_activity: activityRows
    };

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;