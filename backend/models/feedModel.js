const db = require('../config/db');

class FeedModel {
  static async findById(id) {
    const [results] = await db.query('SELECT * FROM feeds WHERE id = ?', [id]);
    return results[0] || null;
  }
  static async findAll() {
    const [results] = await db.query('SELECT * FROM feeds');
    return results;
  }

  static async create(feed) {
    const [result] = await db.query('INSERT INTO feeds SET ?', feed);
    return { id: result.insertId, ...feed };
  }

  static async update(id, feed) {
    await db.query('UPDATE feeds SET ? WHERE id = ?', [feed, id]);
    return { id, ...feed };
  }

  static async delete(id) {
    await db.query('DELETE FROM feeds WHERE id = ?', [id]);
  }

  static async recordUsage(feed_id, quantity_used) {
    // Ensure there is enough quantity available before subtracting
    const [currentRows] = await db.query('SELECT quantity_kg FROM feeds WHERE id = ?', [feed_id]);
    const current = currentRows[0];
    if (!current) {
      const err = new Error('Feed not found');
      err.statusCode = 404;
      throw err;
    }
    if (Number(quantity_used) > Number(current.quantity_kg)) {
      const err = new Error('Insufficient feed available');
      err.statusCode = 400;
      throw err;
    }
    // Subtract quantity_used from the feed's quantity_kg
    await db.query('UPDATE feeds SET quantity_kg = quantity_kg - ? WHERE id = ?', [quantity_used, feed_id]);
    // Return the updated feed
    const [results] = await db.query('SELECT * FROM feeds WHERE id = ?', [feed_id]);
    return results[0];
  }

  static async logUsageEvent({ feed_id, user_id, batch_id = null, quantity_used, date_used }) {
    // Detect feed_usage columns to insert the best possible row (supports legacy and new schema)
    const [cols] = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'feed_usage'`
    );
    const hasBatchId = cols.some(c => c.column_name === 'batch_id');
    const hasQuantityUsed = cols.some(c => c.column_name === 'quantity_used');
    const hasDateUsed = cols.some(c => c.column_name === 'date_used');

    if (hasQuantityUsed) {
      // Newer schema path
      const fields = ['feed_id', 'user_id'];
      const values = [feed_id, user_id || null];
      if (hasBatchId) { fields.push('batch_id'); values.push(batch_id || null); }
      fields.push('quantity_used'); values.push(quantity_used);
      if (hasDateUsed) { fields.push('date_used'); values.push(date_used || null); }
      const placeholders = fields.map(() => '?').join(', ');
      await db.query(`INSERT INTO feed_usage (${fields.join(', ')}) VALUES (${placeholders})`, values);
    } else {
      // Legacy schema path (amount_used only)
      await db.query(
        'INSERT INTO feed_usage (feed_id, user_id, amount_used) VALUES (?, ?, ?)',
        [feed_id, user_id || null, quantity_used]
      );
    }
  }

  static async getUsageEvents(feed_id) {
    // Try new schema first
    try {
      const [results] = await db.query(
        `SELECT fu.id, fu.feed_id, fu.batch_id, fu.quantity_used AS amount_used, fu.date_used, fu.used_at,
                COALESCE(u.name, 'Unknown') AS user_name
           FROM feed_usage fu
           LEFT JOIN users u ON fu.user_id = u.id
          WHERE fu.feed_id = ?
          ORDER BY fu.used_at DESC`,
        [feed_id]
      );
      return results;
    } catch (err) {
      // Fallback to legacy schema (amount_used exists, no date_used column)
      const [results] = await db.query(
        `SELECT fu.id, fu.feed_id, NULL AS batch_id, fu.amount_used AS amount_used, NULL AS date_used, fu.used_at,
                COALESCE(u.name, 'Unknown') AS user_name
           FROM feed_usage fu
           LEFT JOIN users u ON fu.user_id = u.id
          WHERE fu.feed_id = ?
          ORDER BY fu.used_at DESC`,
        [feed_id]
      );
      return results;
    }
  }

  static async getUsageEventsPaged({ feed_id, offset = 0, limit = 10, q = '', start_date = null, end_date = null }) {
    // Build dynamic filters
    const hasSearch = q && String(q).trim() !== '';
    const filtersNew = ['fu.feed_id = ?'];
    const paramsNew = [feed_id];
    const filtersLegacy = ['fu.feed_id = ?'];
    const paramsLegacy = [feed_id];

    if (hasSearch) {
      filtersNew.push('(u.name LIKE ?)');
      paramsNew.push(`%${q}%`);
      filtersLegacy.push('(u.name LIKE ?)');
      paramsLegacy.push(`%${q}%`);
    }
    if (start_date && end_date) {
      // For new schema prefer explicit date_used; legacy uses DATE(used_at)
      filtersNew.push('(fu.date_used BETWEEN ? AND ?)');
      paramsNew.push(start_date, end_date);
      filtersLegacy.push('(DATE(fu.used_at) BETWEEN ? AND ?)');
      paramsLegacy.push(start_date, end_date);
    }

    const whereNew = filtersNew.length ? `WHERE ${filtersNew.join(' AND ')}` : '';
    const whereLegacy = filtersLegacy.length ? `WHERE ${filtersLegacy.join(' AND ')}` : '';

    try {
      const [rows] = await db.query(
        `SELECT fu.id, fu.feed_id, fu.batch_id, fu.quantity_used AS amount_used, fu.date_used, fu.used_at,
                COALESCE(u.name, 'Unknown') AS user_name
           FROM feed_usage fu
           LEFT JOIN users u ON fu.user_id = u.id
           ${whereNew}
           ORDER BY fu.used_at DESC
           LIMIT ? OFFSET ?`,
        [...paramsNew, Number(limit), Number(offset)]
      );
      return rows;
    } catch (err) {
      const [rows] = await db.query(
        `SELECT fu.id, fu.feed_id, NULL AS batch_id, fu.amount_used AS amount_used, NULL AS date_used, fu.used_at,
                COALESCE(u.name, 'Unknown') AS user_name
           FROM feed_usage fu
           LEFT JOIN users u ON fu.user_id = u.id
           ${whereLegacy}
           ORDER BY fu.used_at DESC
           LIMIT ? OFFSET ?`,
        [...paramsLegacy, Number(limit), Number(offset)]
      );
      return rows;
    }
  }

  static async countUsageEvents({ feed_id, q = '', start_date = null, end_date = null }) {
    const hasSearch = q && String(q).trim() !== '';
    const filtersNew = ['fu.feed_id = ?'];
    const paramsNew = [feed_id];
    const filtersLegacy = ['fu.feed_id = ?'];
    const paramsLegacy = [feed_id];

    if (hasSearch) {
      filtersNew.push('(u.name LIKE ?)');
      paramsNew.push(`%${q}%`);
      filtersLegacy.push('(u.name LIKE ?)');
      paramsLegacy.push(`%${q}%`);
    }
    if (start_date && end_date) {
      filtersNew.push('(fu.date_used BETWEEN ? AND ?)');
      paramsNew.push(start_date, end_date);
      filtersLegacy.push('(DATE(fu.used_at) BETWEEN ? AND ?)');
      paramsLegacy.push(start_date, end_date);
    }
    const whereNew = filtersNew.length ? `WHERE ${filtersNew.join(' AND ')}` : '';
    const whereLegacy = filtersLegacy.length ? `WHERE ${filtersLegacy.join(' AND ')}` : '';

    try {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS cnt
           FROM feed_usage fu
           LEFT JOIN users u ON fu.user_id = u.id
           ${whereNew}`,
        paramsNew
      );
      return rows[0]?.cnt || 0;
    } catch (err) {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS cnt
           FROM feed_usage fu
           LEFT JOIN users u ON fu.user_id = u.id
           ${whereLegacy}`,
        paramsLegacy
      );
      return rows[0]?.cnt || 0;
    }
  }

  static async getUsageEventById(id) {
    const [rows] = await db.query('SELECT * FROM feed_usage WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async updateUsageEventQuantity(id, newQuantity) {
    const event = await this.getUsageEventById(id);
    if (!event) return null;
    const feed_id = event.feed_id;
    const oldQuantity = Number(event.quantity_used ?? event.amount_used ?? 0);
    const diff = Number(newQuantity) - oldQuantity; // positive means increasing usage
    // Check availability if increasing usage
    if (diff > 0) {
      const feed = await this.findById(feed_id);
      if (!feed) {
        const err = new Error('Feed not found');
        err.statusCode = 404;
        throw err;
      }
      if (diff > Number(feed.quantity_kg)) {
        const err = new Error('Insufficient feed available for the increase');
        err.statusCode = 400;
        throw err;
      }
    }
    // Adjust feed remaining stock
    if (diff !== 0) {
      await db.query('UPDATE feeds SET quantity_kg = quantity_kg - ? WHERE id = ?', [diff, feed_id]);
    }
    // Update usage event (handle new vs legacy schema)
    try {
      await db.query('UPDATE feed_usage SET quantity_used = ? WHERE id = ?', [newQuantity, id]);
    } catch (err) {
      await db.query('UPDATE feed_usage SET amount_used = ? WHERE id = ?', [newQuantity, id]);
    }
    return await this.getUsageEventById(id);
  }

  static async deleteUsageEvent(id) {
    const event = await this.getUsageEventById(id);
    if (!event) return false;
    const feed_id = event.feed_id;
    const usedQty = Number(event.quantity_used ?? event.amount_used ?? 0);
    // Return used quantity to stock
    await db.query('UPDATE feeds SET quantity_kg = quantity_kg + ? WHERE id = ?', [usedQty, feed_id]);
    await db.query('DELETE FROM feed_usage WHERE id = ?', [id]);
    return true;
  }

  static async getUsageTotalsAll() {
    try {
      const [rows] = await db.query(
        'SELECT feed_id, SUM(quantity_used) AS total_used FROM feed_usage GROUP BY feed_id'
      );
      return rows;
    } catch (err) {
      const [rows] = await db.query(
        'SELECT feed_id, SUM(amount_used) AS total_used FROM feed_usage GROUP BY feed_id'
      );
      return rows;
    }
  }

  static async countUsageForFeed(feed_id) {
    const [rows] = await db.query('SELECT COUNT(*) AS cnt FROM feed_usage WHERE feed_id = ?', [feed_id]);
    return rows[0]?.cnt || 0;
  }
}

module.exports = FeedModel;
