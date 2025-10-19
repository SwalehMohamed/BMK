const db = require('../config/db');

class ProductModel {
  static async findAll() {
    const [rows] = await db.query(
      `SELECT p.*, c.batch_name,
              (
                SELECT COALESCE(SUM(
                  GREATEST(o.quantity - (
                    SELECT COALESCE(SUM(d.quantity_delivered),0)
                      FROM deliveries d
                     WHERE d.order_id = o.id
                  ), 0)
                ), 0)
                  FROM orders o
                 WHERE o.product_id = p.id AND o.status IN ('pending','confirmed')
              ) AS reserved_qty,
              (p.packaged_quantity - (
                SELECT COALESCE(SUM(
                  GREATEST(o2.quantity - (
                    SELECT COALESCE(SUM(d2.quantity_delivered),0)
                      FROM deliveries d2
                     WHERE d2.order_id = o2.id
                  ), 0)
                ), 0)
                  FROM orders o2
                 WHERE o2.product_id = p.id AND o2.status IN ('pending','confirmed')
              )) AS available_qty
         FROM products p
         LEFT JOIN chicks c ON p.batch_id = c.id
        ORDER BY p.id DESC`
    );
    return rows;
  }

  static async create(product) {
    const payload = {
      type: product.type,
      packaged_quantity: product.packaged_quantity,
      batch_id: product.batch_id ?? null
    };
    const [result] = await db.query('INSERT INTO products SET ?', payload);
    return { id: result.insertId, ...payload };
  }

  static async update(id, product) {
    const payload = {
      type: product.type,
      packaged_quantity: product.packaged_quantity,
      batch_id: product.batch_id ?? null
    };
    await db.query('UPDATE products SET ? WHERE id = ?', [payload, id]);
    return { id, ...payload };
  }

  static async delete(id) {
    await db.query('DELETE FROM products WHERE id = ?', [id]);
  }
}

module.exports = ProductModel;
