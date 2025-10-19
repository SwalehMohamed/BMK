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