/*
  Backfill script: populate feed_usage.batch_id for legacy rows.

  Strategy: For each feed_usage row with batch_id IS NULL, find the chick batch
  whose arrival_date is the most recent date on or before the usage date
  (usage date = COALESCE(date_used, DATE(used_at))). If found, set batch_id.

  Usage (PowerShell):
    node backfill-feed-usage-batch.js              # Dry-run (default)
    node backfill-feed-usage-batch.js --commit     # Apply updates
    node backfill-feed-usage-batch.js --from 2024-01-01 --to 2024-12-31 --commit

  Notes:
    - Safe to run multiple times; only processes rows with batch_id IS NULL.
    - If feed_usage.date_used column doesn't exist, the script falls back to used_at.
    - Rows without a matching prior batch are skipped and reported.
*/

require('dotenv').config();
const db = require('./config/db');
const { ensureTables } = require('./config/dbInit');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { commit: false, from: null, to: null, list: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--commit') opts.commit = true;
    else if (a === '--from') { opts.from = args[i + 1]; i++; }
    else if (a === '--to') { opts.to = args[i + 1]; i++; }
    else if (a === '--list') { opts.list = true; }
  }
  return opts;
}

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return (rows?.[0]?.cnt || 0) > 0;
}

async function loadBatches() {
  const [rows] = await db.query(
    `SELECT id, batch_name, arrival_date FROM chicks ORDER BY arrival_date ASC, id ASC`
  );
  // Filter out rows without arrival_date just in case
  return rows.filter(r => r.arrival_date);
}

function findBatchIdForDate(batches, usageDate) {
  // batches sorted by arrival_date asc; find last batch with arrival_date <= usageDate
  let lo = 0, hi = batches.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = new Date(batches[mid].arrival_date);
    if (d <= usageDate) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans >= 0 ? batches[ans].id : null;
}

async function main() {
  const { commit, from, to, list } = parseArgs();
  console.log(`[feed-usage backfill] Starting (commit=${commit ? 'YES' : 'NO'}, from=${from || '-'}, to=${to || '-'}, list=${list ? 'YES' : 'NO'})`);
  // Basic env sanity check
  const requiredEnv = ['DB_HOST','DB_USER','DB_NAME'];
  const missing = requiredEnv.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('Missing required DB env vars:', missing.join(', '));
    console.error('Create a .env file (backend/.env) with DB_HOST, DB_USER, DB_PASSWORD, DB_NAME before running.');
    process.exit(1);
  }

  // Ensure tables exist (in case running standalone before server boot)
  try { await ensureTables(); } catch (e) { console.warn('ensureTables warning:', e.message); }

  // Pre-flight: ensure feed_usage has batch_id column
  const hasBatchId = await columnExists('feed_usage', 'batch_id');
  if (!hasBatchId) {
    console.error('feed_usage.batch_id does not exist. Please run the app once to let dbInit add it, then retry.');
    process.exit(1);
  }

  const hasDateUsed = await columnExists('feed_usage', 'date_used');

  const batches = await loadBatches();
  if (!batches.length) {
    console.log('No chick batches with arrival_date found. Nothing to do.');
    process.exit(0);
  }
  console.log(`Loaded ${batches.length} batches for matching.`);

  // Build WHERE for feed_usage selection
  const filters = ['batch_id IS NULL'];
  const params = [];
  if (from && to) {
    if (hasDateUsed) {
      filters.push('(date_used BETWEEN ? AND ?)');
      params.push(from, to);
    } else {
      filters.push('(DATE(used_at) BETWEEN ? AND ?)');
      params.push(from, to);
    }
  }
  const where = `WHERE ${filters.join(' AND ')}`;

  // Fetch candidate usage rows
  const selectDate = hasDateUsed ? 'date_used' : 'NULL AS date_used';
  const [usageRows] = await db.query(
    `SELECT id, ${selectDate}, used_at FROM feed_usage ${where} ORDER BY used_at ASC, id ASC`,
    params
  );
  if (!usageRows.length) {
    console.log('No feed_usage rows need backfill. All done.');
    process.exit(0);
  }
  console.log(`Evaluating ${usageRows.length} feed_usage rows without batch_id...`);

  let matched = 0, skipped = 0;
  const updates = [];
  for (const row of usageRows) {
    const usageDate = new Date(row.date_used || row.used_at);
    if (isNaN(usageDate.getTime())) { skipped++; continue; }
    const batchId = findBatchIdForDate(batches, usageDate);
    if (batchId) {
      updates.push({ id: row.id, batch_id: batchId });
      matched++;
    } else {
      skipped++;
    }
  }

  console.log(`Matched ${matched} rows to a batch; ${skipped} rows had no prior batch and were skipped.`);
  if (updates.length) {
    if (list) {
      console.log('Matched IDs (id -> batch_id):');
      for (const u of updates) {
        console.log(`${u.id} -> ${u.batch_id}`);
      }
    } else {
      const sample = updates.slice(0, 20).map(u => `${u.id} -> ${u.batch_id}`);
      console.log(`Sample matches (showing up to 20): ${sample.join(', ')}`);
    }
  }
  if (!commit) {
    console.log('Dry-run complete. Re-run with --commit to apply updates.');
    process.exit(0);
  }

  if (!updates.length) {
    console.log('Nothing to update. Exiting.');
    process.exit(0);
  }

  // Apply updates in a transaction
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const u of updates) {
      await conn.query('UPDATE feed_usage SET batch_id = ? WHERE id = ?', [u.batch_id, u.id]);
    }
    await conn.commit();
    console.log(`Applied ${updates.length} updates successfully.`);
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('Failed to apply updates, rolled back:', err.message);
    process.exit(1);
  } finally {
    conn.release();
  }

  console.log('Backfill completed.');
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
