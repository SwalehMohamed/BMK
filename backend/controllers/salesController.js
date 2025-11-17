const db = require('../config/db');
const OrderModel = require('../models/orderModel');
const { AppError } = require('../utils/errors');

// GET /api/sales - admin only
exports.getAll = async (req, res, next) => {
  try {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Only admin can access sales' });

    // pagination params
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // optional filters
    const customer = req.query.customer || '';
    const statusFilter = req.query.status || '';
    const dateFrom = req.query.date_from || '';
    const dateTo = req.query.date_to || '';

    const filters = [];
    const params = [];
    if (customer && String(customer).trim() !== '') { filters.push('o.customer_name LIKE ?'); params.push(`%${customer}%`); }
    if (statusFilter && String(statusFilter).trim() !== '') { filters.push('o.status = ?'); params.push(statusFilter); }
    if (dateFrom) { filters.push('o.order_date >= ?'); params.push(dateFrom); }
    if (dateTo) { filters.push('o.order_date <= ?'); params.push(dateTo); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    // fetch orders and compute delivered sums and status
    const [rows] = await db.query(`
      SELECT 
        o.id,
        o.order_date,
        o.customer_name,
        o.product_type,
        o.quantity AS order_quantity,
        o.unit_price AS order_unit_price,
        o.total_amount AS order_total_amount,
        COALESCE((SELECT SUM(d.quantity_delivered) FROM deliveries d WHERE d.order_id = o.id), 0) AS delivered_qty,
        (o.quantity - COALESCE((SELECT SUM(d.quantity_delivered) FROM deliveries d WHERE d.order_id = o.id), 0)) AS pending_qty,
        t.price AS type_price,
        p.type AS product_type_resolved
      FROM orders o
      LEFT JOIN products p ON p.id = o.product_id
      LEFT JOIN product_types t ON t.name = LCASE(COALESCE(o.product_type, p.type))
      ${where}
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [[countRow]] = await db.query(`SELECT COUNT(*) AS cnt FROM orders o ${where}`, params);

    // For weight-based revenue we need product weight or avg slaughter weight and price per kg
    // Fetch all needed price/weight info in one go
    const orderIds = rows.map(r => r.id);
    let weightPriceByOrder = new Map();
    if (orderIds.length > 0) {
      const [extra] = await db.query(`
        SELECT o.id AS order_id,
               COALESCE(o.manual_unit_weight_kg, p.weight, s.avg_weight, 1) AS unit_weight_kg,
               COALESCE(p.base_unit_price, t.price, o.unit_price, 0) AS price_per_kg
          FROM orders o
          LEFT JOIN products p ON p.id = o.product_id
          LEFT JOIN slaughtered s ON s.id = p.slaughtered_id
          LEFT JOIN product_types t ON t.name = LCASE(COALESCE(o.product_type, p.type))
         WHERE o.id IN (${orderIds.map(()=>'?').join(',')})
      `, orderIds);
      for (const e of extra) {
        weightPriceByOrder.set(e.order_id, {
          unit_weight_kg: Number(e.unit_weight_kg || 1),
          price_per_kg: Number(e.price_per_kg || 0)
        });
      }
    }

    // map to friendly status and compute sale value based on delivered quantity * unit_weight_kg * price_per_kg
    const mapped = rows.map(r => {
      const delivered = Number(r.delivered_qty || 0);
      const qty = Number(r.order_quantity || 0);
      const status = delivered === 0 ? 'Pending Delivery' : (delivered >= qty ? 'Delivered' : 'Partial');
      const wp = weightPriceByOrder.get(r.id) || { unit_weight_kg: 1, price_per_kg: Number(r.type_price ?? r.order_unit_price ?? 0) };
      const total_amount = delivered * wp.unit_weight_kg * wp.price_per_kg;
      return {
        id: r.id,
        order_date: r.order_date,
        customer_name: r.customer_name,
        product_type: r.product_type || r.product_type_resolved || null,
        order_quantity: qty,
        delivered_qty: delivered,
        pending_qty: Number(r.pending_qty || 0),
        unit_price: wp.price_per_kg,
        unit_weight_kg: wp.unit_weight_kg,
        unit_revenue: wp.unit_weight_kg * wp.price_per_kg,
        total_amount,
        status
      };
    });

    res.json({ data: mapped, meta: { page, limit, total: countRow?.cnt || 0, pages: Math.ceil((countRow?.cnt || 0) / limit) } });
  } catch (err) {
    next(err);
  }
};
