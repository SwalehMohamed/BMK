const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { AppError } = require('../utils/errors');

// Weekly mortality rate report
router.get('/mortality', async (req, res, next) => {
  try {
    const [data] = await db.query(`
      SELECT 
        YEARWEEK(m.date) AS week_identifier,
        c.batch_name,
        c.breed,
        SUM(m.number_dead) AS weekly_deaths,
        ROUND((SUM(m.number_dead) / c.initial_count * 100), 2) AS mortality_rate
      FROM mortality_logs m
      JOIN chicks c ON m.chick_batch_id = c.id
      GROUP BY week_identifier, c.id
      ORDER BY week_identifier DESC
    `);
    
    res.json(data);
  } catch (err) {
    next(new AppError('Failed to generate mortality report', 500));
  }
});

// Feed usage report with costs
router.get('/feed-usage', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Validate dates
    if (!start_date || !end_date) {
      throw new AppError('Start and end dates are required', 400);
    }

    const [data] = await db.query(`
      SELECT 
        f.type,
        f.supplier,
        SUM(fu.quantity_used) AS total_used,
        MIN(fu.date_used) AS first_usage,
        MAX(fu.date_used) AS last_usage
      FROM feed_usage fu
      JOIN feeds f ON fu.feed_id = f.id
      WHERE fu.date_used BETWEEN ? AND ?
      GROUP BY f.type, f.supplier
    `, [start_date, end_date]);
    
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
