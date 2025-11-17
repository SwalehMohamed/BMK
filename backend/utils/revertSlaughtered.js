const db = require('../config/db');

// Enhanced revert utility: restores slaughtered quantity ONLY if product has no downstream consumption.
// Returns a structured result for response surfaces.
async function revertSlaughteredQuantityOnProductDelete(productId) {
  const [[product]] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) return { performed: false, reason: 'product_not_found' };

  // Safeguard: if product has any orders or deliveries referencing it, skip restoration.
  // (Sales are already blocked at controller level before deletion.)
  const [[orderCountRow]] = await db.query('SELECT COUNT(*) AS cnt FROM orders WHERE product_id = ?', [productId]);
  const orderCount = orderCountRow?.cnt || 0;
  let deliveredCount = 0;
  if (orderCount > 0) {
    const [[deliveryAgg]] = await db.query(`SELECT COALESCE(SUM(d.quantity_delivered),0) AS delivered_sum
                                             FROM deliveries d
                                             JOIN orders o ON o.id = d.order_id
                                            WHERE o.product_id = ?`, [productId]);
    deliveredCount = deliveryAgg?.delivered_sum || 0;
  }
  if (orderCount > 0 || deliveredCount > 0) {
    return { performed: false, reason: 'downstream_consumption_detected', orderCount, deliveredCount };
  }

  // Design change: products no longer deduct from slaughtered.quantity, so no restoration is needed.
  return { performed: false, reason: 'no_op_design' };
}

module.exports = { revertSlaughteredQuantityOnProductDelete };
