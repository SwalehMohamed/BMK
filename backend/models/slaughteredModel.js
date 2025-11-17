const db = require('../config/db');

class SlaughteredModel {
  static async findAll() { return this.findPaged({ offset:0, limit:100, batchId:null, dateFrom:null, dateTo:null, search:'' }); }

  static async findPaged({ offset = 0, limit = 20, batchId = null, dateFrom = null, dateTo = null, search = '' }) {
    const filters = [];
    const params = [];
    if (batchId) { filters.push('s.batch_id = ?'); params.push(Number(batchId)); }
    if (dateFrom) { filters.push('s.date >= ?'); params.push(dateFrom); }
    if (dateTo) { filters.push('s.date <= ?'); params.push(dateTo); }
    if (search && String(search).trim() !== '') { filters.push('(c.batch_name LIKE ? OR s.notes LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [rows] = await db.query(`
      SELECT s.*, c.batch_name
        FROM slaughtered s
        JOIN chicks c ON s.batch_id = c.id
        ${where}
        ORDER BY s.date DESC, s.id DESC
        LIMIT ? OFFSET ?`, [...params, Number(limit), Number(offset)]);
    const [[countRow]] = await db.query(`SELECT COUNT(*) AS cnt FROM slaughtered s JOIN chicks c ON s.batch_id = c.id ${where}`, params);
    const total = countRow?.cnt || 0;
    return { data: rows, meta: { page: Math.floor(offset/limit)+1, limit: Number(limit), total, pages: Math.ceil(total/Number(limit)) } };
  }

  static async count(filters) {
    const { batchId = null, dateFrom = null, dateTo = null, search = '' } = filters || {};
    const f = []; const p = [];
    if (batchId) { f.push('batch_id = ?'); p.push(Number(batchId)); }
    if (dateFrom) { f.push('date >= ?'); p.push(dateFrom); }
    if (dateTo) { f.push('date <= ?'); p.push(dateTo); }
    if (search && String(search).trim() !== '') { f.push('(notes LIKE ?)'); p.push(`%${search}%`); }
    const where = f.length ? `WHERE ${f.join(' AND ')}` : '';
    const [[row]] = await db.query(`SELECT COUNT(*) AS cnt FROM slaughtered ${where}`, p);
    return row?.cnt || 0;
  }

  static async create(slaughtered) {
    // whitelist fields to prevent unexpected columns
    const payload = {
      batch_id: slaughtered.batch_id,
      date: slaughtered.date,
      quantity: slaughtered.quantity,
      notes: slaughtered.notes ?? null,
      avg_weight: slaughtered.avg_weight ?? null
    };
    const [result] = await db.query('INSERT INTO slaughtered SET ?', payload);
    return { id: result.insertId, ...slaughtered };
  }

  static async update(id, slaughtered) {
    const payload = {
      batch_id: slaughtered.batch_id,
      date: slaughtered.date,
      quantity: slaughtered.quantity,
      notes: slaughtered.notes ?? null,
      avg_weight: slaughtered.avg_weight ?? null
    };
    await db.query('UPDATE slaughtered SET ? WHERE id = ?', [payload, id]);
    return { id, ...payload };
  }

  static async delete(id) {
    await db.query('DELETE FROM slaughtered WHERE id = ?', [id]);
  }
}

module.exports = SlaughteredModel;