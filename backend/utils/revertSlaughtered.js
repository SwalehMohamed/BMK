const db = require('../config/db');

// Utility to increment slaughtered quantity when a product is deleted
async function revertSlaughteredQuantityOnProductDelete(productId) {
  // Get the product to find its batch and quantity
  const [[product]] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) return;
  // Find the slaughtered record for this batch (if any)
  if (product.batch_id) {
    // Find the latest slaughtered record for this batch
    const [[slaughtered]] = await db.query('SELECT * FROM slaughtered WHERE batch_id = ? ORDER BY date DESC, id DESC LIMIT 1', [product.batch_id]);
    if (slaughtered) {
      // Increment the quantity by the product's packaged_quantity
      const newQty = Number(slaughtered.quantity) + Number(product.packaged_quantity || 0);
      await db.query('UPDATE slaughtered SET quantity = ? WHERE id = ?', [newQty, slaughtered.id]);
    }
  }
}

module.exports = { revertSlaughteredQuantityOnProductDelete };
