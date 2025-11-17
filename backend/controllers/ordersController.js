const OrderModel = require('../models/orderModel');
const db = require('../config/db');
const { AppError } = require('../utils/errors');

exports.getAll = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const customer = req.query.customer || '';
    const status = req.query.status || '';
    const productType = req.query.product_type || '';
    const productId = req.query.product_id || '';
    const dateFrom = req.query.date_from || '';
    const dateTo = req.query.date_to || '';
    const [data, total] = await Promise.all([
      OrderModel.findPaged({ offset, limit, customer, status, productType, productId, dateFrom, dateTo }),
      OrderModel.count({ customer, status, productType, productId, dateFrom, dateTo })
    ]);
    res.json({ data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { order_date, customer_name, product_type, product_id, quantity, unit_price, manual_unit_weight_kg, total_amount, status, notes } = req.body;
    if (!order_date) throw new AppError('order_date is required', 400);
    if (!customer_name) throw new AppError('customer_name is required', 400);
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) throw new AppError('quantity must be a positive integer', 400);
    const price = Number(unit_price ?? 0);
    if (!Number.isFinite(price) || price < 0) throw new AppError('unit_price must be a non-negative number', 400);
    const manualWt = manual_unit_weight_kg != null ? Number(manual_unit_weight_kg) : null;
    if (manualWt != null && (!Number.isFinite(manualWt) || manualWt < 0)) throw new AppError('manual_unit_weight_kg must be a non-negative number', 400);
    if (product_id != null) {
      const [prow] = await db.query('SELECT * FROM products WHERE id = ?', [product_id]);
      if (prow.length === 0) throw new AppError('product_id does not reference an existing product', 400);
      const [[{ reserved = 0 }]] = await db.query(
        `SELECT COALESCE(SUM(GREATEST(o.quantity - (
            SELECT COALESCE(SUM(d.quantity_delivered),0)
              FROM deliveries d
             WHERE d.order_id = o.id
          ), 0)), 0) AS reserved
           FROM orders o
          WHERE o.product_id = ? AND o.status IN ('pending','confirmed')`,
        [product_id]
      );
      const available = Number(prow[0].packaged_quantity || 0) - Number(reserved || 0);
      if (qty > available) {
        throw new AppError(`Not enough available quantity for this product to reserve (available: ${available})`, 400);
      }
    }
    const created = await OrderModel.create({
      order_date,
      customer_name,
      product_type,
      product_id,
      quantity: qty,
      unit_price: price,
      manual_unit_weight_kg: manualWt,
      total_amount,
      status,
      notes,
      created_by: req.userId || null
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { order_date, customer_name, product_type, product_id, quantity, unit_price, manual_unit_weight_kg, total_amount, status, notes } = req.body;
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) throw new AppError('quantity must be a positive integer', 400);
    const price = Number(unit_price ?? 0);
    if (!Number.isFinite(price) || price < 0) throw new AppError('unit_price must be a non-negative number', 400);
    const manualWt2 = manual_unit_weight_kg != null ? Number(manual_unit_weight_kg) : null;
    if (manualWt2 != null && (!Number.isFinite(manualWt2) || manualWt2 < 0)) throw new AppError('manual_unit_weight_kg must be a non-negative number', 400);
    if (product_id != null) {
      const [prow] = await db.query('SELECT * FROM products WHERE id = ?', [product_id]);
      if (prow.length === 0) throw new AppError('product_id does not reference an existing product', 400);
      const [[{ reserved = 0 }]] = await db.query(
        `SELECT COALESCE(SUM(GREATEST(o.quantity - (
            SELECT COALESCE(SUM(d.quantity_delivered),0)
              FROM deliveries d
             WHERE d.order_id = o.id
          ), 0)), 0) AS reserved
           FROM orders o
          WHERE o.product_id = ? AND o.status IN ('pending','confirmed') AND o.id <> ?`,
        [product_id, id]
      );
      const available = Number(prow[0].packaged_quantity || 0) - Number(reserved || 0);
      if (qty > available) {
        throw new AppError(`Not enough available quantity for this product to reserve (available: ${available})`, 400);
      }
    }
    const updated = await OrderModel.update(id, {
      order_date,
      customer_name,
      product_type,
      product_id,
      quantity: qty,
      unit_price: price,
      manual_unit_weight_kg: manualWt2,
      total_amount,
      status,
      notes
    });
    res.json({ message: 'Order updated successfully', updated });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Only admin can delete orders' });
    }
    await OrderModel.delete(id);
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    next(err);
  }
};
