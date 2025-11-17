const DeliveryModel = require('../models/deliveryModel');
const OrderModel = require('../models/orderModel');
const db = require('../config/db');
const { AppError } = require('../utils/errors');

async function adjustProductInventory(product_id, delta) {
  if (!product_id || !Number.isInteger(Number(product_id)) || !Number.isInteger(Number(delta))) return;
  const pid = Number(product_id);
  const d = Number(delta);
  const [rows] = await db.query('SELECT packaged_quantity FROM products WHERE id = ?', [pid]);
  if (!rows.length) throw new AppError('Linked product not found for inventory adjustment', 400);
  const current = Number(rows[0].packaged_quantity || 0);
  const next = current + d;
  if (next < 0) {
    throw new AppError('Insufficient product inventory for this delivery operation', 400);
  }
  await db.query('UPDATE products SET packaged_quantity = ? WHERE id = ?', [next, pid]);
}

async function recalcAndUpdateOrderStatus(order_id) {
  if (!order_id) return;
  const oid = Number(order_id);
  const order = await OrderModel.findById(oid);
  if (!order) return;
  if (order.status === 'cancelled') return; // don't override cancelled manually
  const [[{ delivered = 0 }]] = await db.query(
    'SELECT COALESCE(SUM(quantity_delivered),0) AS delivered FROM deliveries WHERE order_id = ?',
    [oid]
  );
  let newStatus = 'pending';
  if (delivered >= Number(order.quantity || 0)) newStatus = 'fulfilled';
  else if (delivered > 0) newStatus = 'confirmed';
  await db.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, oid]);
}

exports.getAll = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const orderId = req.query.order_id || '';
    const recipient = req.query.recipient || '';
    const dateFrom = req.query.date_from || '';
    const dateTo = req.query.date_to || '';

    const [rows, total] = await Promise.all([
      DeliveryModel.findPaged({ offset, limit, orderId, recipient, dateFrom, dateTo }),
      DeliveryModel.count({ orderId, recipient, dateFrom, dateTo })
    ]);
    res.json({ data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { order_id, delivery_date, recipient_name, address, quantity_delivered, notes } = req.body;
    if (!order_id) throw new AppError('order_id is required', 400);
    if (!delivery_date) throw new AppError('delivery_date is required', 400);
    if (!recipient_name) throw new AppError('recipient_name is required', 400);
    const qty = Number(quantity_delivered);
    if (!Number.isInteger(qty) || qty <= 0) throw new AppError('quantity_delivered must be a positive integer', 400);
    const [o] = await db.query('SELECT id FROM orders WHERE id = ?', [order_id]);
    if (o.length === 0) throw new AppError('order_id does not reference an existing order', 400);
    // Over-delivery prevention
    if (order_id) {
      const order = await OrderModel.findById(order_id);
      const [[{ delivered = 0 }]] = await db.query(
        'SELECT COALESCE(SUM(quantity_delivered),0) AS delivered FROM deliveries WHERE order_id = ?',
        [order_id]
      );
      const remaining = Number(order.quantity || 0) - Number(delivered || 0);
      if (qty > remaining) {
        return res.status(400).json({ message: `Delivery exceeds remaining quantity for this order (remaining: ${remaining}).` });
      }
    }

    const created = await DeliveryModel.create({
      order_id,
      delivery_date,
      recipient_name,
      address,
      quantity_delivered: qty,
      notes,
      delivered_by: req.userId || null
    });

    // Inventory adjustment if order is linked to a product
    if (order_id) {
      const order = await OrderModel.findById(order_id);
      if (order?.product_id) {
        await adjustProductInventory(order.product_id, -qty);
      }
      await recalcAndUpdateOrderStatus(order_id);
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { order_id, delivery_date, recipient_name, address, quantity_delivered, notes } = req.body;
    const qty = Number(quantity_delivered);
    if (!Number.isInteger(qty) || qty <= 0) throw new AppError('quantity_delivered must be a positive integer', 400);
    if (order_id != null) {
      const [o] = await db.query('SELECT id FROM orders WHERE id = ?', [order_id]);
      if (o.length === 0) throw new AppError('order_id does not reference an existing order', 400);
    }
    const existing = await DeliveryModel.findById(id);
    if (!existing) throw new AppError('Delivery not found', 404);

    // Prevent removing order linkage if it already exists
    if (existing.order_id && (order_id == null || order_id === '')) {
      throw new AppError('Cannot remove order link from an existing delivery', 400);
    }

    // Over-delivery prevention for update
    if (order_id) {
      const order = await OrderModel.findById(order_id);
      const [[{ delivered = 0 }]] = await db.query(
        'SELECT COALESCE(SUM(quantity_delivered),0) AS delivered FROM deliveries WHERE order_id = ? AND id <> ?',
        [order_id, id]
      );
      const remaining = Number(order.quantity || 0) - Number(delivered || 0);
      if (qty > remaining) {
        return res.status(400).json({ message: `Delivery exceeds remaining quantity for this order (remaining: ${remaining}).` });
      }
    }

    const updated = await DeliveryModel.update(id, {
      order_id,
      delivery_date,
      recipient_name,
      address,
      quantity_delivered: qty,
      notes
    });

    // Inventory adjustments
    const oldOrderId = existing.order_id || null;
    const newOrderId = order_id || null;
    const oldQty = Number(existing.quantity_delivered || 0);
    const newQty = qty;

    if (oldOrderId && newOrderId && Number(oldOrderId) === Number(newOrderId)) {
      // Same order: adjust by delta
      const order = await OrderModel.findById(newOrderId);
      if (order?.product_id) {
        const delta = oldQty - newQty; // positive means add back, negative means consume more
        if (delta !== 0) {
          await adjustProductInventory(order.product_id, delta);
        }
      }
      await recalcAndUpdateOrderStatus(newOrderId);
    } else {
      // Different orders or set/unset
      if (oldOrderId) {
        const oldOrder = await OrderModel.findById(oldOrderId);
        if (oldOrder?.product_id) {
          // add back old quantity
          await adjustProductInventory(oldOrder.product_id, oldQty);
        }
        await recalcAndUpdateOrderStatus(oldOrderId);
      }
      if (newOrderId) {
        const newOrder = await OrderModel.findById(newOrderId);
        if (newOrder?.product_id) {
          // consume new quantity
          await adjustProductInventory(newOrder.product_id, -newQty);
        }
        await recalcAndUpdateOrderStatus(newOrderId);
      }
    }

    res.json({ message: 'Delivery updated successfully', updated });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Only admin can delete deliveries' });
    }
    const existing = await DeliveryModel.findById(id);
    if (!existing) return res.json({ message: 'Delivery deleted successfully' });
    await DeliveryModel.delete(id);
    // add back inventory and recalc status
    if (existing.order_id) {
      const order = await OrderModel.findById(existing.order_id);
      if (order?.product_id) {
        await adjustProductInventory(order.product_id, Number(existing.quantity_delivered || 0));
      }
      await recalcAndUpdateOrderStatus(existing.order_id);
    }
    res.json({ message: 'Delivery deleted successfully' });
  } catch (err) {
    next(err);
  }
};
