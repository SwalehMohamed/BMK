const db = require('../config/db');
const { AppError } = require('../utils/errors');
const ChickModel = require('../models/chickModel');

// List mortalities with optional filters and pagination
exports.getAll = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, batch_id } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    if (dateFrom) { conditions.push('m.date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('m.date <= ?'); params.push(dateTo); }
    if (batch_id) { conditions.push('m.chick_batch_id = ?'); params.push(Number(batch_id)); }
    const where = conditions.length ? ('WHERE ' + conditions.join(' AND ')) : '';
    const [rows] = await db.query(
      `SELECT m.id, m.chick_batch_id, c.batch_name, c.breed, m.date, m.number_dead, m.reason
         FROM mortality_logs m
         JOIN chicks c ON c.id = m.chick_batch_id
        ${where}
        ORDER BY m.date DESC, m.id DESC
        LIMIT ? OFFSET ?`
      , [...params, limit, offset]
    );
    const [[count]] = await db.query(
      `SELECT COUNT(*) AS cnt FROM mortality_logs m ${where.replaceAll('m.', '')}`,
      params
    );
    res.json({ data: rows, meta: { page, limit, total: count.cnt || 0, pages: Math.ceil((count.cnt || 0) / limit) } });
  } catch (err) { next(err); }
};

// Create mortality (standalone; reuses model validation)
exports.create = async (req, res, next) => {
  try {
    const { chick_batch_id, date, number_dead, reason } = req.body;
    if (!chick_batch_id) throw new AppError('chick_batch_id is required', 400);
    const result = await ChickModel.recordMortality(Number(chick_batch_id), { date, number_dead: Number(number_dead), reason });
    res.status(201).json({ message: 'Mortality recorded', id: result.id });
  } catch (err) { next(err); }
};

// Update mortality record with constraint on available birds
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { chick_batch_id, date, number_dead, reason } = req.body;
    const [[existing]] = await db.query('SELECT * FROM mortality_logs WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ message: 'Mortality record not found' });
    const newBatchId = chick_batch_id ?? existing.chick_batch_id;
    const newNumberDead = Number(number_dead ?? existing.number_dead);
    // available including reverting old value for the batch if unchanged
    let available = await ChickModel.getCurrentCount(newBatchId);
    if (newBatchId === existing.chick_batch_id) {
      available += Number(existing.number_dead || 0);
    }
    if (newNumberDead > available) {
      throw new AppError(`Number dead (${newNumberDead}) exceeds available live birds (${available}) for this batch`, 400);
    }
    const payload = {
      chick_batch_id: newBatchId,
      date: date ?? existing.date,
      number_dead: newNumberDead,
      reason: reason ?? existing.reason
    };
    await db.query('UPDATE mortality_logs SET ? WHERE id = ?', [payload, id]);
    res.json({ message: 'Mortality updated', updated: { id: Number(id), ...payload } });
  } catch (err) { next(err); }
};

// Delete mortality (admin only)
exports.remove = async (req, res, next) => {
  try {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Only admin can delete mortality records' });
    const { id } = req.params;
    await db.query('DELETE FROM mortality_logs WHERE id = ?', [id]);
    res.json({ message: 'Mortality record deleted' });
  } catch (err) { next(err); }
};
