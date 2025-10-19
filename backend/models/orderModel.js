const db = require('../config/db');

class OrderModel {
  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [id]);
    return rows[0] || null;
  }
  static async findAll() {
    const [rows] = await db.query(`
      SELECT o.*, p.type AS product_type_resolved,
             (SELECT COALESCE(SUM(d.quantity_delivered), 0)
                FROM deliveries d
               WHERE d.order_id = o.id) AS delivered_sum
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
       ORDER BY o.order_date DESC, o.id DESC`);
    return rows;
  }

  static async create(order) {
    const payload = {
      order_date: order.order_date,
      customer_name: order.customer_name,
      product_type: order.product_type ?? null,
      product_id: order.product_id ?? null,
      quantity: Number(order.quantity),
      unit_price: Number(order.unit_price ?? 0),
      total_amount: Number(order.total_amount ?? (Number(order.quantity) * Number(order.unit_price || 0))),
      status: order.status || 'pending',
      notes: order.notes ?? null,
      created_by: order.created_by ?? null
    };
    const [result] = await db.query('INSERT INTO orders SET ?', payload);
    return { id: result.insertId, ...payload };
  }

  static async update(id, order) {
    const payload = {
      order_date: order.order_date,
      customer_name: order.customer_name,
      product_type: order.product_type ?? null,
      product_id: order.product_id ?? null,
      quantity: Number(order.quantity),
      unit_price: Number(order.unit_price ?? 0),
      total_amount: Number(order.total_amount ?? (Number(order.quantity) * Number(order.unit_price || 0))),
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
