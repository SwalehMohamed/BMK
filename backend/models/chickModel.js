const db = require('../config/db');
const { NotFoundError, AppError } = require('../utils/errors');

class ChickModel {
  // Create new chick batch
  static async create(batch) {
    const [result] = await db.query('INSERT INTO chicks SET ?', batch);
    return { id: result.insertId, ...batch };
  }

  // Legacy simple fetch retained for backward compatibility
  static async findAll(page = 1, limit = 10) {
    return this.findPaged({
      offset: (Number(page || 1) - 1) * Number(limit || 10),
      limit: Number(limit || 10),
      search: '', breed: '', supplier: '', dateFrom: null, dateTo: null
    });
  }

  // New paginated & filterable fetch
  static async findPaged({ offset = 0, limit = 10, search = '', breed = '', supplier = '', dateFrom = null, dateTo = null }) {
    const filters = [];
    const params = [];
    if (search && String(search).trim() !== '') {
      filters.push('(c.batch_name LIKE ? OR c.breed LIKE ? OR c.supplier LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (breed && String(breed).trim() !== '') { filters.push('c.breed LIKE ?'); params.push(`%${breed}%`); }
    if (supplier && String(supplier).trim() !== '') { filters.push('c.supplier LIKE ?'); params.push(`%${supplier}%`); }
    if (dateFrom) { filters.push('c.arrival_date >= ?'); params.push(dateFrom); }
    if (dateTo) { filters.push('c.arrival_date <= ?'); params.push(dateTo); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    // aggregated subqueries for deaths & slaughtered
    const [rows] = await db.query(`
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
      ${where}
      ORDER BY c.arrival_date DESC, c.id DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), Number(offset)]);

    const [[countRow]] = await db.query(`SELECT COUNT(*) AS cnt FROM chicks c ${where}`, params);
    const total = countRow?.cnt || 0;
    return {
      data: rows,
      meta: { page: Math.floor(offset / limit) + 1, limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    };
  }

  static async count(filters) { // not used directly but provided for parity
    const { search = '', breed = '', supplier = '', dateFrom = null, dateTo = null } = filters || {};
    const f = []; const p = [];
    if (search && String(search).trim() !== '') { f.push('(batch_name LIKE ? OR breed LIKE ? OR supplier LIKE ?)'); p.push(`%${search}%`,`%${search}%`,`%${search}%`); }
    if (breed && String(breed).trim() !== '') { f.push('breed LIKE ?'); p.push(`%${breed}%`); }
    if (supplier && String(supplier).trim() !== '') { f.push('supplier LIKE ?'); p.push(`%${supplier}%`); }
    if (dateFrom) { f.push('arrival_date >= ?'); p.push(dateFrom); }
    if (dateTo) { f.push('arrival_date <= ?'); p.push(dateTo); }
    const where = f.length ? `WHERE ${f.join(' AND ')}` : '';
    const [[row]] = await db.query(`SELECT COUNT(*) AS cnt FROM chicks ${where}`, p);
    return row?.cnt || 0;
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
    const patch = { ...batch };
    if (patch.initial_count != null) {
      const ic = Number(patch.initial_count);
      if (!Number.isInteger(ic) || ic <= 0) throw new AppError('initial_count must be a positive integer', 400);
      patch.initial_count = ic;
    }
    await db.query('UPDATE chicks SET ? WHERE id = ?', [patch, id]);
    return { id, ...patch };
  }

  static async delete(id) {
    // Prevent deletion if dependent records exist (mortality or slaughtered) to avoid orphan history
    const [[dep1]] = await db.query('SELECT COUNT(*) AS cnt FROM mortality_logs WHERE chick_batch_id = ?', [id]);
    const [[dep2]] = await db.query('SELECT COUNT(*) AS cnt FROM slaughtered WHERE batch_id = ?', [id]);
    if ((dep1?.cnt || 0) > 0 || (dep2?.cnt || 0) > 0) {
      throw new AppError('Cannot delete batch with existing mortality or slaughter records', 400);
    }
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
