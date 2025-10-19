const db = require('../config/db');
const { AppError } = require('../utils/errors');
const ChickModel = require('../models/chickModel');

// List mortalities (optionally filter by date range or batch)
exports.getAll = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, batch_id } = req.query;
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
        ORDER BY m.date DESC, m.id DESC`
      , params
    );
    res.json(rows);
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

// Delete mortality (admin only)
exports.remove = async (req, res, next) => {
  try {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Only admin can delete mortality records' });
    const { id } = req.params;
    await db.query('DELETE FROM mortality_logs WHERE id = ?', [id]);
    res.json({ message: 'Mortality record deleted' });
  } catch (err) { next(err); }
};
