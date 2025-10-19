const db = require('../config/db');

class ProductTypeModel {
  static async findAll() {
    const [rows] = await db.query('SELECT id, name, price, created_at FROM product_types ORDER BY name ASC');
    return rows;
  }

  static async create(name, price = 0) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) throw new Error('Product type name required');
    const p = Number(price || 0);
    if (!Number.isFinite(p) || p < 0) throw new Error('price must be a non-negative number');
    const [res] = await db.query('INSERT INTO product_types (name, price) VALUES (?, ?)', [n, p]);
    return { id: res.insertId, name: n, price: p };
  }

  static async update(id, name, price) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) throw new Error('Product type name required');
    const p = Number(price || 0);
    if (!Number.isFinite(p) || p < 0) throw new Error('price must be a non-negative number');
    await db.query('UPDATE product_types SET name = ?, price = ? WHERE id = ?', [n, p, id]);
    return { id, name: n, price: p };
  }
}

module.exports = ProductTypeModel;
