const ChickModel = require('../models/chickModel');
const { ensureTables } = require('../config/dbInit');

exports.getAllChicks = async (req, res, next) => {
  try {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const chicks = await ChickModel.findAll(page, limit);
    res.json(chicks);
  } catch (err) {
    next(err);
  }
};

exports.addChick = async (req, res, next) => {
  try {
    const chick = await ChickModel.create(req.body);
    res.status(201).json(chick);
  } catch (err) {
    next(err);
  }
};

exports.updateChick = async (req, res, next) => {
  try {
    const { id } = req.params;
    // You need to implement updateChick in your model
    const updatedChick = await ChickModel.update(id, req.body);
    res.json({ message: 'Chick updated successfully', updatedChick });
  } catch (err) {
    next(err);
  }
};

exports.deleteChick = async (req, res, next) => {
  try {
    const { id } = req.params;
    // You need to implement delete in your model
    await ChickModel.delete(id);
    res.json({ message: 'Chick deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Record mortality for a batch
exports.recordMortality = async (req, res, next) => {
  try {
    const { id } = req.params; // batch id
    const { date, number_dead, reason } = req.body;
    const result = await ChickModel.recordMortality(id, { date, number_dead, reason });
    res.status(201).json({ message: 'Mortality recorded', id: result.id });
  } catch (err) {
    next(err);
  }
};

// List mortalities for a batch
exports.getMortalities = async (req, res, next) => {
  try {
    const { id } = req.params; // batch id
    const rows = await ChickModel.getMortalities(id);
    res.json({ data: rows });
  } catch (err) {
    // Auto-create table if missing, then retry once
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      try {
        await ensureTables();
        const rows = await ChickModel.getMortalities(req.params.id);
        return res.json({ data: rows });
      } catch (e2) {
        return next(e2);
      }
    }
    next(err);
  }
};

// Get feed usage history for a batch
exports.getBatchFeedUsage = async (req, res, next) => {
  try {
    const { id } = req.params; // batch id
    // Query feed_usage by batch_id and join with feeds
    const db = require('../config/db');
    // Detect columns
    const [cols] = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'feed_usage'`
    );
    const colSet = new Set(cols.map(c => c.column_name));
    const hasQuantityUsed = colSet.has('quantity_used');
    const hasDateUsed = colSet.has('date_used');
    const hasBatchId = colSet.has('batch_id');

    if (!hasBatchId) {
      // Legacy schema has no batch_id, cannot map usage to a batch
      return res.json({ data: [] });
    }

    const quantityExpr = hasQuantityUsed ? 'fu.quantity_used' : (colSet.has('amount_used') ? 'fu.amount_used' : 'NULL');
    const dateExpr = hasDateUsed ? 'fu.date_used' : 'NULL';

    const [rows] = await db.query(
      `SELECT fu.id, fu.feed_id, f.type, ${quantityExpr} AS quantity_used, ${dateExpr} AS date_used, fu.used_at
         FROM feed_usage fu
         JOIN feeds f ON fu.feed_id = f.id
        WHERE fu.batch_id = ?
        ORDER BY COALESCE(${dateExpr}, fu.used_at) DESC, fu.id DESC`,
      [id]
    );
    return res.json({ data: rows });
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      try {
        await ensureTables();
        const db = require('../config/db');
        // re-run with detection
        const [cols] = await db.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'feed_usage'`
        );
        const colSet = new Set(cols.map(c => c.column_name));
        const hasQuantityUsed = colSet.has('quantity_used');
        const hasDateUsed = colSet.has('date_used');
        const hasBatchId = colSet.has('batch_id');
        if (!hasBatchId) {
          return res.json({ data: [] });
        }
        const quantityExpr = hasQuantityUsed ? 'fu.quantity_used' : (colSet.has('amount_used') ? 'fu.amount_used' : 'NULL');
        const dateExpr = hasDateUsed ? 'fu.date_used' : 'NULL';
        const [rows] = await db.query(
          `SELECT fu.id, fu.feed_id, f.type, ${quantityExpr} AS quantity_used, ${dateExpr} AS date_used, fu.used_at
             FROM feed_usage fu
             JOIN feeds f ON fu.feed_id = f.id
            WHERE fu.batch_id = ?
            ORDER BY COALESCE(${dateExpr}, fu.used_at) DESC, fu.id DESC`,
          [req.params.id]
        );
        return res.json({ data: rows });
      } catch (e2) {
        return next(e2);
      }
    }
    next(err);
  }
};