const ProductTypeModel = require('../models/productTypeModel');
const db = require('../config/db');
const { AppError } = require('../utils/errors');

const normalizeTypeName = (name) => String(name || '').trim().toLowerCase();

exports.getAll = async (req, res, next) => {
  try {
    const types = await ProductTypeModel.findAll();
    res.json(types);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, price } = req.body;
    const n = normalizeTypeName(name);
    if (!n) throw new AppError('name is required', 400);
    const p = Number(price ?? 0);
    if (!Number.isFinite(p) || p < 0) throw new AppError('price must be a non-negative number', 400);
    const created = await ProductTypeModel.create(n, p);
    res.status(201).json(created);
  } catch (err) {
    // Handle duplicate gracefully
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(200).json({ existed: true, name: normalizeTypeName(req.body.name) });
    }
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, price } = req.body;
    const n = normalizeTypeName(name);
    if (!n) throw new AppError('name is required', 400);
    const p = Number(price ?? 0);
    if (!Number.isFinite(p) || p < 0) throw new AppError('price must be a non-negative number', 400);
    const updated = await ProductTypeModel.update(id, n, p);
    res.json({ message: 'Product type updated', updated });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Duplicate product type after normalization' });
    }
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM product_types WHERE id = ?', [id]);
    res.json({ message: 'Product type deleted' });
  } catch (err) {
    next(err);
  }
};
