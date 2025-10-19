const db = require('../config/db');
const { NotFoundError, AppError } = require('../utils/errors');

class ChickModel {
  // Create new chick batch
  static async create(batch) {
    const [result] = await db.query('INSERT INTO chicks SET ?', batch);
    return { id: result.insertId, ...batch };
  }

  // Get all chick batches with mortality stats (JOIN query)
  static async findAll(page = 1, limit = 10) {
    const p = Number(page) || 1;
    const l = Number(limit) || 10;
    const offset = (p - 1) * l;
    
    // Use aggregated subqueries to avoid row multiplication when joining multiple child tables
    const [batches] = await db.query(`
      SELECT 
        c.*,
        IFNULL(ml.total_deaths, 0) AS total_deaths,
        IFNULL(sl.total_slaughtered, 0) AS total_slaughtered,
        (c.initial_count - IFNULL(ml.total_deaths, 0) - IFNULL(sl.total_slaughtered, 0)) AS current_count
      FROM chicks c
      LEFT JOIN (
        SELECT chick_batch_id, SUM(number_dead) AS total_deaths
        FROM mortality_logs
        GROUP BY chick_batch_id
      ) ml ON c.id = ml.chick_batch_id
      LEFT JOIN (
        SELECT batch_id, SUM(quantity) AS total_slaughtered
        FROM slaughtered
        GROUP BY batch_id
      ) sl ON c.id = sl.batch_id
      LIMIT ? OFFSET ?
    `, [l, offset]);

    const [count] = await db.query('SELECT COUNT(*) AS total FROM chicks');
    
    return {
      data: batches,
      pagination: {
        page: p,
        limit: l,
        total: count[0].total,
        totalPages: Math.ceil(count[0].total / l)
      }
    };
  }

  // Record chick mortality
  static async recordMortality(batchId, { date, number_dead, reason }) {
    // Verify batch exists first
    const [batch] = await db.query('SELECT * FROM chicks WHERE id = ?', [batchId]);
    if (!batch.length) throw new NotFoundError('Chick batch');

    const currentCount = await this.getCurrentCount(batchId);
    if (number_dead > currentCount) {
      throw new AppError('Number of deaths exceeds current batch count', 400);
    }

    const [result] = await db.query(
      'INSERT INTO mortality_logs SET ?', 
      { chick_batch_id: batchId, date, number_dead, reason }
    );

    return { id: result.insertId };
  }

  static async update(id, batch) {
    await db.query('UPDATE chicks SET ? WHERE id = ?', [batch, id]);
    return { id, ...batch };
  }

  static async delete(id) {
    await db.query('DELETE FROM chicks WHERE id = ?', [id]);
  }

  // Helper to get current live count
  static async getCurrentCount(batchId) {
    const [batch] = await db.query('SELECT initial_count FROM chicks WHERE id = ?', [batchId]);
    if (!batch.length) throw new NotFoundError('Chick batch');

    const [deaths] = await db.query(
      'SELECT SUM(number_dead) as total FROM mortality_logs WHERE chick_batch_id = ?',
      [batchId]
    );

    const [slaughtered] = await db.query(
      'SELECT SUM(quantity) as total FROM slaughtered WHERE batch_id = ?',
      [batchId]
    );

    const initial = batch[0].initial_count || 0;
    const totalDeaths = deaths[0].total || 0;
    const totalSlaughtered = slaughtered[0].total || 0;
    return initial - totalDeaths - totalSlaughtered;
  }

  // List mortalities for a batch
  static async getMortalities(batchId) {
    // verify exists
    const [batch] = await db.query('SELECT id FROM chicks WHERE id = ?', [batchId]);
    if (!batch.length) throw new NotFoundError('Chick batch');

    // Detect whether created_at column exists to avoid ER_BAD_FIELD_ERROR on legacy schemas
    const [colCheck] = await db.query(
      `SELECT COUNT(*) AS cnt
         FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'mortality_logs' AND column_name = 'created_at'`
    );
    const hasCreatedAt = (colCheck?.[0]?.cnt || 0) > 0;

    const selectCreated = hasCreatedAt ? ', created_at' : '';
    const [rows] = await db.query(
      `SELECT id, chick_batch_id, date, number_dead, reason${selectCreated}
         FROM mortality_logs
        WHERE chick_batch_id = ?
        ORDER BY date DESC, id DESC`,
      [batchId]
    );
    return rows;
  }
}

module.exports = ChickModel;
