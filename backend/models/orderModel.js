const db = require('../config/db');

class OrderModel {
  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [id]);
    return rows[0] || null;
  }
  static async findAll() {
    const [rows] = await db.query(`
      SELECT o.*, p.type AS product_type_resolved,
             COALESCE(o.manual_unit_weight_kg, p.weight, s.avg_weight, 1) AS effective_unit_weight_kg,
             (COALESCE(o.manual_unit_weight_kg, p.weight, s.avg_weight, 1) * o.unit_price) AS unit_revenue,
             (SELECT COALESCE(SUM(d.quantity_delivered), 0)
                FROM deliveries d
               WHERE d.order_id = o.id) AS delivered_sum
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN slaughtered s ON s.id = p.slaughtered_id
       ORDER BY o.order_date DESC, o.id DESC`);
    return rows;
  }

  static async findPaged({ offset = 0, limit = 10, customer = '', status = '', productType = '', productId = '', dateFrom = null, dateTo = null }) {
    const filters = [];
    const params = [];
    if (customer && String(customer).trim() !== '') { filters.push('o.customer_name LIKE ?'); params.push(`%${customer}%`); }
    if (status && String(status).trim() !== '') { filters.push('o.status = ?'); params.push(status); }
    if (productType && String(productType).trim() !== '') { filters.push('(o.product_type = ? OR p.type = ?)'); params.push(productType, productType); }
    if (productId && String(productId).trim() !== '') { filters.push('o.product_id = ?'); params.push(Number(productId)); }
    if (dateFrom) { filters.push('o.order_date >= ?'); params.push(dateFrom); }
    if (dateTo) { filters.push('o.order_date <= ?'); params.push(dateTo); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
     const [rows] = await db.query(`
      SELECT o.*, p.type AS product_type_resolved,
           COALESCE(o.manual_unit_weight_kg, p.weight, s.avg_weight, 1) AS effective_unit_weight_kg,
           (COALESCE(o.manual_unit_weight_kg, p.weight, s.avg_weight, 1) * o.unit_price) AS unit_revenue,
           (SELECT COALESCE(SUM(d.quantity_delivered), 0)
             FROM deliveries d
            WHERE d.order_id = o.id) AS delivered_sum
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN slaughtered s ON s.id = p.slaughtered_id
        ${where}
       ORDER BY o.order_date DESC, o.id DESC
       LIMIT ? OFFSET ?`, [...params, Number(limit), Number(offset)]);
    return rows;
  }

  static async count({ customer = '', status = '', productType = '', productId = '', dateFrom = null, dateTo = null }) {
    const filters = [];
    const params = [];
    if (customer && String(customer).trim() !== '') { filters.push('customer_name LIKE ?'); params.push(`%${customer}%`); }
    if (status && String(status).trim() !== '') { filters.push('status = ?'); params.push(status); }
    if (productType && String(productType).trim() !== '') { filters.push('(product_type = ? )'); params.push(productType); }
    if (productId && String(productId).trim() !== '') { filters.push('product_id = ?'); params.push(Number(productId)); }
    if (dateFrom) { filters.push('order_date >= ?'); params.push(dateFrom); }
    if (dateTo) { filters.push('order_date <= ?'); params.push(dateTo); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [[row]] = await db.query(`SELECT COUNT(*) AS cnt FROM orders ${where}`, params);
    return row?.cnt || 0;
  }

  static async create(order) {
    const qty = Number(order.quantity);
    const productId = order.product_id ?? null;
    const providedPricePerKg = Number(order.unit_price ?? 0);

    let weightKg = 1; // default if unknown
    let resolvedPricePerKg = providedPricePerKg;

    // Manual override if provided
    if (order.manual_unit_weight_kg != null && Number(order.manual_unit_weight_kg) > 0) {
      weightKg = Number(order.manual_unit_weight_kg);
    }

    if (productId != null) {
      const [prow] = await db.query(`
        SELECT p.type, p.weight, p.base_unit_price, s.avg_weight, t.price AS type_price
          FROM products p
          LEFT JOIN slaughtered s ON s.id = p.slaughtered_id
          LEFT JOIN product_types t ON t.name = LCASE(p.type)
         WHERE p.id = ?
      `, [productId]);
      if (prow && prow.length > 0) {
        const p = prow[0];
        if (!(order.manual_unit_weight_kg != null && Number(order.manual_unit_weight_kg) > 0)) {
          weightKg = Number(p.weight ?? p.avg_weight ?? 1) || 1;
        }
        resolvedPricePerKg = Number(providedPricePerKg || p.base_unit_price || p.type_price || 0);
      }
    } else if (order.product_type) {
      // Use product type price if provided and unit_price not set
      if (!resolvedPricePerKg || resolvedPricePerKg === 0) {
        const [trow] = await db.query(`SELECT price FROM product_types WHERE name = LCASE(?)`, [order.product_type]);
        if (trow && trow.length > 0) {
          resolvedPricePerKg = Number(trow[0].price || 0);
        }
      }
    }

    const computedTotal = Number(order.total_amount ?? (qty * weightKg * resolvedPricePerKg));

    const payload = {
      order_date: order.order_date,
      customer_name: order.customer_name,
      product_type: order.product_type ?? null,
      product_id: productId,
      quantity: qty,
      manual_unit_weight_kg: order.manual_unit_weight_kg != null ? Number(order.manual_unit_weight_kg) : null,
      unit_price: resolvedPricePerKg, // treat as price per kg
      total_amount: computedTotal,
      status: order.status || 'pending',
      notes: order.notes ?? null,
      created_by: order.created_by ?? null
    };
    const [result] = await db.query('INSERT INTO orders SET ?', payload);
    return { id: result.insertId, ...payload };
  }

  static async update(id, order) {
    const qty = Number(order.quantity);
    const productId = order.product_id ?? null;
    const providedPricePerKg = Number(order.unit_price ?? 0);

    let weightKg = 1; // default if unknown
    let resolvedPricePerKg = providedPricePerKg;

    if (order.manual_unit_weight_kg != null && Number(order.manual_unit_weight_kg) > 0) {
      weightKg = Number(order.manual_unit_weight_kg);
    }

    if (productId != null) {
      const [prow] = await db.query(`
        SELECT p.type, p.weight, p.base_unit_price, s.avg_weight, t.price AS type_price
          FROM products p
          LEFT JOIN slaughtered s ON s.id = p.slaughtered_id
          LEFT JOIN product_types t ON t.name = LCASE(p.type)
         WHERE p.id = ?
      `, [productId]);
      if (prow && prow.length > 0) {
        const p = prow[0];
        if (!(order.manual_unit_weight_kg != null && Number(order.manual_unit_weight_kg) > 0)) {
          weightKg = Number(p.weight ?? p.avg_weight ?? 1) || 1;
        }
        resolvedPricePerKg = Number(providedPricePerKg || p.base_unit_price || p.type_price || 0);
      }
    } else if (order.product_type) {
      if (!resolvedPricePerKg || resolvedPricePerKg === 0) {
        const [trow] = await db.query(`SELECT price FROM product_types WHERE name = LCASE(?)`, [order.product_type]);
        if (trow && trow.length > 0) {
          resolvedPricePerKg = Number(trow[0].price || 0);
        }
      }
    }

    const computedTotal = Number(order.total_amount ?? (qty * weightKg * resolvedPricePerKg));

    const payload = {
      order_date: order.order_date,
      customer_name: order.customer_name,
      product_type: order.product_type ?? null,
      product_id: productId,
      quantity: qty,
      manual_unit_weight_kg: order.manual_unit_weight_kg != null ? Number(order.manual_unit_weight_kg) : null,
      unit_price: resolvedPricePerKg, // treat as price per kg
      total_amount: computedTotal,
      status: order.status || 'pending',
      notes: order.notes ?? null
    };
    await db.query('UPDATE orders SET ? WHERE id = ?', [payload, id]);
    return { id, ...payload };
  }

  static async delete(id) {
    await db.query('DELETE FROM orders WHERE id = ?', [id]);
  }
}

module.exports = OrderModel;
