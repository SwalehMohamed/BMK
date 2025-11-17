const db = require('../config/db');

class ProductModel {
  static async findAll() { return this.findPaged({ offset:0, limit:100, search:'', type:'', batchId:null, dateFrom:null, dateTo:null }); }

  static async findPaged({ offset = 0, limit = 20, search = '', type = '', batchId = null, dateFrom = null, dateTo = null }) {
    const filters = [];
    const params = [];
    if (search && String(search).trim() !== '') { filters.push('(p.type LIKE ? OR c.batch_name LIKE ? )'); params.push(`%${search}%`, `%${search}%`); }
    if (type && String(type).trim() !== '') { filters.push('p.type LIKE ?'); params.push(`%${type}%`); }
    if (batchId) { filters.push('p.batch_id = ?'); params.push(Number(batchId)); }
    if (dateFrom) { filters.push('p.created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { filters.push('p.created_at <= ?'); params.push(dateTo); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [rows] = await db.query(`
      SELECT p.*, c.batch_name,
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
        ${where}
        ORDER BY p.id DESC
        LIMIT ? OFFSET ?`, [...params, Number(limit), Number(offset)]);
    const [[countRow]] = await db.query(`SELECT COUNT(*) AS cnt FROM products p LEFT JOIN chicks c ON p.batch_id = c.id ${where}`, params);
    const total = countRow?.cnt || 0;
    return { data: rows, meta: { page: Math.floor(offset/limit)+1, limit: Number(limit), total, pages: Math.ceil(total/Number(limit)) } };
  }

  static async count(filters) {
    const { search = '', type = '', batchId = null, dateFrom = null, dateTo = null } = filters || {};
    const f = []; const p = [];
    if (search && String(search).trim() !== '') { f.push('(type LIKE ? )'); p.push(`%${search}%`); }
    if (type && String(type).trim() !== '') { f.push('type LIKE ?'); p.push(`%${type}%`); }
    if (batchId) { f.push('batch_id = ?'); p.push(Number(batchId)); }
    if (dateFrom) { f.push('created_at >= ?'); p.push(dateFrom); }
    if (dateTo) { f.push('created_at <= ?'); p.push(dateTo); }
    const where = f.length ? `WHERE ${f.join(' AND ')}` : '';
    const [[row]] = await db.query(`SELECT COUNT(*) AS cnt FROM products ${where}`, p);
    return row?.cnt || 0;
  }

  static async create(product) {
    const payload = {
      type: product.type,
      packaged_quantity: product.packaged_quantity,
      batch_id: product.batch_id ?? null,
      weight: product.weight ?? null,
      base_unit_price: product.base_unit_price ?? null,
      slaughtered_id: product.slaughtered_id ?? null
    };
    const [result] = await db.query('INSERT INTO products SET ?', payload);
    // Fetch the created row to get created_at
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    return rows[0];
  }

  static async update(id, product) {
    const payload = {
      type: product.type,
      packaged_quantity: product.packaged_quantity,
      batch_id: product.batch_id ?? null,
      weight: product.weight ?? null,
      base_unit_price: product.base_unit_price ?? null,
      slaughtered_id: product.slaughtered_id ?? null
    };
    await db.query('UPDATE products SET ? WHERE id = ?', [payload, id]);
    // Fetch the updated row to get created_at
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    return rows[0];
  }

  static async delete(id) {
    await db.query('DELETE FROM products WHERE id = ?', [id]);
  }
}

module.exports = ProductModel;
