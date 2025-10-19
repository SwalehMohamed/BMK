const ProductModel = require('../models/productModel');
const db = require('../config/db');
const { AppError } = require('../utils/errors');

const normalizeType = (t) => String(t || '').trim().toLowerCase();

exports.getAll = async (req, res, next) => {
  try {
    const rows = await ProductModel.findAll();
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { type, packaged_quantity, batch_id } = req.body;
    if (!type || typeof type !== 'string') {
      throw new AppError('type is required', 400);
    }
    const nType = normalizeType(type);
    const qty = Number(packaged_quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      throw new AppError('packaged_quantity must be a non-negative number', 400);
    }
    if (batch_id != null) {
      // verify batch exists
      const [b] = await db.query('SELECT id FROM chicks WHERE id = ?', [batch_id]);
      if (b.length === 0) {
        throw new AppError('batch_id does not reference an existing batch', 400);
      }
    }
  const created = await ProductModel.create({ type: nType, packaged_quantity: qty, batch_id });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, packaged_quantity, batch_id } = req.body;
    if (!type || typeof type !== 'string') {
      throw new AppError('type is required', 400);
    }
    const nType = normalizeType(type);
    const qty = Number(packaged_quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      throw new AppError('packaged_quantity must be a non-negative number', 400);
    }
    if (batch_id != null) {
      const [b] = await db.query('SELECT id FROM chicks WHERE id = ?', [batch_id]);
      if (b.length === 0) {
        throw new AppError('batch_id does not reference an existing batch', 400);
      }
    }
  const updated = await ProductModel.update(id, { type: nType, packaged_quantity: qty, batch_id });
    res.json({ message: 'Product updated successfully', updated });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    // If a legacy/other schema has sales.product_id FK, prevent delete when in use
    try {
      const [[col]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'sales' AND column_name = 'product_id'`
      );
      if ((col?.cnt || 0) > 0) {
        const [[row]] = await db.query('SELECT COUNT(*) AS cnt FROM sales WHERE product_id = ?', [id]);
        if ((row?.cnt || 0) > 0) {
          throw new AppError('Cannot delete product: it is referenced by one or more sales records. Delete or reassign those sales first.', 409);
        }
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      // otherwise ignore schema probe errors and proceed
    }
    await ProductModel.delete(id);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
};
