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
