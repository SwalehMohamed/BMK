// Batch product creation from slaughtered record
const ProductModel = require('../models/productModel');

exports.createProductsFromSlaughter = async (req, res, next) => {
  try {
    const { slaughteredId, option, weights } = req.body;
    if (!slaughteredId || !option || !Array.isArray(weights) || weights.length === 0) {
      throw new AppError('Missing or invalid parameters', 400);
    }
    const db = require('../config/db');
    const [[slaughtered]] = await db.query('SELECT * FROM slaughtered WHERE id = ?', [slaughteredId]);
    if (!slaughtered) throw new AppError('Slaughtered record not found', 404);

    // Uniform quantity logic for mince/parts: all quantities must match
    let productsToCreate = [];
    let totalQty = 0;
    if (option === 'whole' || option === 'mince' || option === 'parts') {
      // Enforce uniform quantity across all rows for ALL options
      const quantities = weights.map(w => Number(w.quantity));
      const uniform = quantities[0];
      if (!Number.isFinite(uniform) || uniform <= 0) throw new AppError('Uniform quantity must be a positive number', 400);
      const allSame = quantities.every(q => q === uniform);
      if (!allSame) throw new AppError('All sub-product quantities must be identical for this option', 400);
      for (const wq of weights) {
        const wt = Number(wq.weight);
        if (!Number.isFinite(wt) || wt <= 0) throw new AppError('Invalid weight value', 400);
        const prodType = option === 'whole' ? 'whole chicken' : (wq.type || null);
        if (option !== 'whole' && !prodType) throw new AppError('Missing product type for sub-product', 400);
        productsToCreate.push({ type: prodType, packaged_quantity: uniform, batch_id: slaughtered.batch_id, weight: wt, slaughtered_id: slaughtered.id });
      }
      // Consumption logic: for mince/parts, chickens are shared across sub-products, so count once.
      // For whole, each row represents a distinct group of whole birds.
      totalQty = (option === 'whole') ? (uniform * weights.length) : uniform;
    } else {
      throw new AppError('Invalid product creation option', 400);
    }

    // Warn if total derived exceeds slaughtered.quantity
    if (totalQty > slaughtered.quantity) {
      throw new AppError(`Derived product quantity (${totalQty}) exceeds slaughtered available (${slaughtered.quantity})`, 400);
    }

    // Create products
    const createdProducts = [];
    for (const prod of productsToCreate) {
      const created = await ProductModel.create(prod);
      createdProducts.push(created);
    }

    // Do NOT deduct from slaughtered.quantity when creating products.
    // Slaughtered quantity represents the total birds slaughtered for the batch and remains immutable here.
    res.status(201).json({ message: 'Products created', products: createdProducts, slaughteredId, remaining_quantity: slaughtered.quantity });
  } catch (err) {
    next(err);
  }
};
const SlaughteredModel = require('../models/slaughteredModel');
const ChickModel = require('../models/chickModel');
const { AppError } = require('../utils/errors');

exports.getAllSlaughtered = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const batchId = req.query.batch_id || '';
    const dateFrom = req.query.date_from || '';
    const dateTo = req.query.date_to || '';
    const search = req.query.search || '';
    const { data, meta } = await SlaughteredModel.findPaged({ offset, limit, batchId, dateFrom, dateTo, search });
    res.json({ data, meta });
  } catch (err) {
    next(err);
  }
};

exports.addSlaughtered = async (req, res, next) => {
  try {
    const { batch_id, quantity } = req.body;
    // ensure batch exists and get available live count
    const available = await ChickModel.getCurrentCount(batch_id);
    if (quantity > available) {
      throw new AppError(`Quantity (${quantity}) exceeds available live birds (${available}) for this batch`, 400);
    }
    const record = await SlaughteredModel.create(req.body);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
};

exports.updateSlaughtered = async (req, res, next) => {
  try {
    const { id } = req.params;
    // When updating, ensure new quantity doesn't exceed available (recompute including excluding this record would be ideal; simplest: compute available + old quantity)
    const db = require('../config/db');
    const [[row]] = await db.query('SELECT batch_id, quantity FROM slaughtered WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ message: 'Slaughtered record not found' });
    const newBatchId = req.body.batch_id ?? row.batch_id;
    const newQuantity = req.body.quantity ?? row.quantity;
    // available including reverting old quantity for that batch
    let available = await ChickModel.getCurrentCount(newBatchId);
    if (newBatchId === row.batch_id) {
      available += row.quantity; // add back previous quantity
    }
    if (newQuantity > available) {
      throw new AppError(`Quantity (${newQuantity}) exceeds available live birds (${available}) for this batch`, 400);
    }
    const updated = await SlaughteredModel.update(id, req.body);
    res.json({ message: 'Slaughtered record updated successfully', updated });
  } catch (err) {
    next(err);
  }
};

exports.deleteSlaughtered = async (req, res, next) => {
  try {
    const { id } = req.params;
    await SlaughteredModel.delete(id);
    res.json({ message: 'Slaughtered record deleted successfully' });
  } catch (err) {
    next(err);
  }
};