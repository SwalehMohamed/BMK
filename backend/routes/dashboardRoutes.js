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
    // 1. Total chicks (sum of all initial_count)
    let total_chicks = 0;
    try {
      const [chickRows] = await db.query('SELECT IFNULL(SUM(initial_count),0) AS total_chicks FROM chicks');
      total_chicks = chickRows?.[0]?.total_chicks || 0;
    } catch { /* table may not exist yet */ }

    // 2. Total deaths (sum of all number_dead)
    let total_dead = 0;
    try {
      const [deathRows] = await db.query('SELECT IFNULL(SUM(number_dead),0) AS total_dead FROM mortality_logs');
      total_dead = deathRows?.[0]?.total_dead || 0;
    } catch {}

    // 3. Total slaughtered (sum of all quantity)
    let total_slaughtered = 0;
    try {
      const [slaughterRows] = await db.query('SELECT IFNULL(SUM(quantity),0) AS total_slaughtered FROM slaughtered');
      total_slaughtered = slaughterRows?.[0]?.total_slaughtered || 0;
    } catch {}

    // 4. Current stock
    const current_stock = total_chicks - total_dead - total_slaughtered;

    // 5. Mortality rate (configurable period)
    // Approach: deaths in period divided by stock at risk at start of the period
    // starting_stock = chicks arrived before periodStart - deaths before periodStart - slaughtered before periodStart
    let mortality_rate = 0;
    try {
      const [[{ total_chicks_before = 0 } = {}]] = await db.query(`
        SELECT IFNULL(SUM(initial_count),0) AS total_chicks_before
          FROM chicks
         WHERE arrival_date < ${periodStartExpr}
      `);
      const [[{ total_dead_before = 0 } = {}]] = await db.query(`
        SELECT IFNULL(SUM(number_dead),0) AS total_dead_before
          FROM mortality_logs
         WHERE date < ${periodStartExpr}
      `);
      const [[{ total_slaughtered_before = 0 } = {}]] = await db.query(`
        SELECT IFNULL(SUM(quantity),0) AS total_slaughtered_before
          FROM slaughtered
         WHERE date < ${periodStartExpr}
      `);
      const [[{ period_deaths = 0 } = {}]] = await db.query(`
        SELECT IFNULL(SUM(number_dead),0) AS period_deaths
          FROM mortality_logs
         WHERE date >= ${periodStartExpr}
      `);

      const starting_stock = Math.max(0, Number(total_chicks_before) - Number(total_dead_before) - Number(total_slaughtered_before));
      mortality_rate = starting_stock > 0
        ? Number(((Number(period_deaths) / starting_stock) * 100).toFixed(2))
        : 0;
    } catch {}

    // 6. Monthly sales revenue (this month): Sum of delivered_qty * price
    let monthly_sales = 0;
    try {
      const [salesRows] = await db.query(`
        SELECT IFNULL(SUM(d.quantity_delivered * COALESCE(t.price, o.unit_price, 0)), 0) AS revenue
          FROM deliveries d
          LEFT JOIN orders o ON o.id = d.order_id
          LEFT JOIN products p ON p.id = o.product_id
          LEFT JOIN product_types t ON t.name = LCASE(COALESCE(o.product_type, p.type))
         WHERE MONTH(d.delivery_date) = MONTH(CURDATE())
           AND YEAR(d.delivery_date) = YEAR(CURDATE())
      `);
      monthly_sales = Number(salesRows?.[0]?.revenue || 0);
    } catch {}

    // 6b. Total sales revenue (all time): Sum of delivered_qty * price
    let total_sales = 0;
    try {
      const [totSalesRows] = await db.query(`
        SELECT IFNULL(SUM(d.quantity_delivered * COALESCE(t.price, o.unit_price, 0)), 0) AS revenue
          FROM deliveries d
          LEFT JOIN orders o ON o.id = d.order_id
          LEFT JOIN products p ON p.id = o.product_id
          LEFT JOIN product_types t ON t.name = LCASE(COALESCE(o.product_type, p.type))
      `);
      total_sales = Number(totSalesRows?.[0]?.revenue || 0);
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
    const stats = {
      total_chicks,
      total_dead,
      current_stock,
      mortality_rate,
      monthly_sales,
      total_sales,
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