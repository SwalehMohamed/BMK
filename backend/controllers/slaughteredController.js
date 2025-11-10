// Batch product creation from slaughtered record
const ProductModel = require('../models/productModel');

exports.createProductsFromSlaughter = async (req, res, next) => {
  try {
    const { slaughteredId, option, weights } = req.body;
    if (!slaughteredId || !option || !Array.isArray(weights) || weights.length === 0) {
      throw new AppError('Missing or invalid parameters', 400);
    }
    // Get slaughtered record
    const db = require('../config/db');
    const [[slaughtered]] = await db.query('SELECT * FROM slaughtered WHERE id = ?', [slaughteredId]);
    if (!slaughtered) throw new AppError('Slaughtered record not found', 404);

    // Calculate total quantity to deduct
    let totalQty = 0;
    let productsToCreate = [];
    if (option === 'whole') {
      for (const wq of weights) {
        if (!wq.weight || !wq.quantity) throw new AppError('Invalid weight/quantity', 400);
        totalQty += Number(wq.quantity);
        productsToCreate.push({ type: 'whole chicken', packaged_quantity: Number(wq.quantity), batch_id: slaughtered.batch_id, weight: Number(wq.weight) });
      }
    } else if (option === 'mince' || option === 'parts') {
      for (const wq of weights) {
        if (!wq.type || !wq.weight || !wq.quantity) throw new AppError('Invalid type/weight/quantity', 400);
        totalQty += Number(wq.quantity);
        productsToCreate.push({ type: wq.type, packaged_quantity: Number(wq.quantity), batch_id: slaughtered.batch_id, weight: Number(wq.weight) });
      }
    } else {
      throw new AppError('Invalid product creation option', 400);
    }
    if (slaughtered.quantity < totalQty) throw new AppError('Not enough slaughtered quantity available', 400);

    // Create products
    const createdProducts = [];
    for (const prod of productsToCreate) {
      const created = await ProductModel.create(prod);
      createdProducts.push(created);
    }

    // Reduce slaughtered quantity
    const newQty = slaughtered.quantity - totalQty;
    await db.query('UPDATE slaughtered SET quantity = ? WHERE id = ?', [newQty, slaughteredId]);

    res.status(201).json({ message: 'Products created and slaughtered quantity updated', products: createdProducts, slaughteredId, newQty });
  } catch (err) {
    next(err);
  }
};
const SlaughteredModel = require('../models/slaughteredModel');
const ChickModel = require('../models/chickModel');
const { AppError } = require('../utils/errors');

exports.getAllSlaughtered = async (req, res, next) => {
  try {
    const slaughtered = await SlaughteredModel.findAll();
    res.json(slaughtered);
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