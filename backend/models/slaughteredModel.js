const db = require('../config/db');

class SlaughteredModel {
  static async findAll() {
    const [results] = await db.query(`
      SELECT s.*, c.batch_name
        FROM slaughtered s
        JOIN chicks c ON s.batch_id = c.id
        ORDER BY s.date DESC, s.id DESC
    `);
    return results;
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