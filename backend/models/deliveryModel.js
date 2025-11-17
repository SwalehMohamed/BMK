const db = require('../config/db');

class DeliveryModel {
  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM deliveries WHERE id = ?', [id]);
    return rows[0] || null;
  }
  static async findAll() {
    const [rows] = await db.query(`
      SELECT d.*, o.customer_name, o.product_type, o.quantity AS order_quantity
        FROM deliveries d
        LEFT JOIN orders o ON d.order_id = o.id
       ORDER BY d.delivery_date DESC, d.id DESC`);
    return rows;
  }

  static async findPaged({ offset = 0, limit = 10, orderId = null, recipient = '', dateFrom = null, dateTo = null }) {
    const filters = [];
    const params = [];
    if (orderId) { filters.push('d.order_id = ?'); params.push(Number(orderId)); }
    if (recipient && String(recipient).trim() !== '') { filters.push('d.recipient_name LIKE ?'); params.push(`%${recipient}%`); }
    if (dateFrom) { filters.push('d.delivery_date >= ?'); params.push(dateFrom); }
    if (dateTo) { filters.push('d.delivery_date <= ?'); params.push(dateTo); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [rows] = await db.query(`
      SELECT d.*, o.customer_name, o.product_type, o.quantity AS order_quantity
        FROM deliveries d
        LEFT JOIN orders o ON d.order_id = o.id
        ${where}
       ORDER BY d.delivery_date DESC, d.id DESC
       LIMIT ? OFFSET ?`, [...params, Number(limit), Number(offset)]);
    return rows;
  }

  static async count({ orderId = null, recipient = '', dateFrom = null, dateTo = null }) {
    const filters = [];
    const params = [];
    if (orderId) { filters.push('d.order_id = ?'); params.push(Number(orderId)); }
    if (recipient && String(recipient).trim() !== '') { filters.push('d.recipient_name LIKE ?'); params.push(`%${recipient}%`); }
    if (dateFrom) { filters.push('d.delivery_date >= ?'); params.push(dateFrom); }
    if (dateTo) { filters.push('d.delivery_date <= ?'); params.push(dateTo); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [[row]] = await db.query(`SELECT COUNT(*) AS cnt FROM deliveries d ${where}`, params);
    return row?.cnt || 0;
  }

  static async create(delivery) {
    const payload = {
      order_id: delivery.order_id ?? null,
      delivery_date: delivery.delivery_date,
      recipient_name: delivery.recipient_name,
      address: delivery.address ?? null,
      quantity_delivered: Number(delivery.quantity_delivered),
      notes: delivery.notes ?? null,
      delivered_by: delivery.delivered_by ?? null
    };
    const [result] = await db.query('INSERT INTO deliveries SET ?', payload);
    return { id: result.insertId, ...payload };
  }

  static async update(id, delivery) {
    const payload = {
      order_id: delivery.order_id ?? null,
      delivery_date: delivery.delivery_date,
      recipient_name: delivery.recipient_name,
      address: delivery.address ?? null,
      quantity_delivered: Number(delivery.quantity_delivered),
      notes: delivery.notes ?? null
    };
    await db.query('UPDATE deliveries SET ? WHERE id = ?', [payload, id]);
    return { id, ...payload };
  }

  static async delete(id) {
    await db.query('DELETE FROM deliveries WHERE id = ?', [id]);
  }
}

module.exports = DeliveryModel;
