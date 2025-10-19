const db = require('../config/db');

class FeedModel {
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
    // Subtract quantity_used from the feed's quantity_kg
    await db.query('UPDATE feeds SET quantity_kg = quantity_kg - ? WHERE id = ?', [quantity_used, feed_id]);
    // Return the updated feed
    const [results] = await db.query('SELECT * FROM feeds WHERE id = ?', [feed_id]);
    return results[0];
  }

  static async logUsageEvent({ feed_id, user_id, batch_id = null, quantity_used, date_used }) {
    // Try new schema first
    try {
      await db.query(
        'INSERT INTO feed_usage (feed_id, user_id, batch_id, quantity_used, date_used) VALUES (?, ?, ?, ?, ?)',
        [feed_id, user_id || null, batch_id || null, quantity_used, date_used]
      );
    } catch (err) {
      // Fallback to legacy schema (amount_used, used_at default)
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
}

module.exports = FeedModel;
