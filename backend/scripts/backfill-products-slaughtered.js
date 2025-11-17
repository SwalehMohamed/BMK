#!/usr/bin/env node
/*
 Backfill script: populate products.slaughtered_id for legacy rows.
 Modes:
   node backfill-products-slaughtered.js --mode=dry-run    (summary only)
   node backfill-products-slaughtered.js --mode=list       (detailed mapping list)
   node backfill-products-slaughtered.js --mode=commit     (perform updates)
 Optional flags:
   --limit=500   process at most N products (for testing)
   --batch=123   restrict to a single batch id

 Heuristic:
   For each product with NULL/0 slaughtered_id and a batch_id:
     1. Find the slaughter event for same batch with date <= product.created_at (nearest prior) ORDER BY date DESC LIMIT 1.
     2. If none prior, pick the earliest slaughter event for that batch (ORDER BY date ASC LIMIT 1).
   If still none (no slaughter events for batch), product is skipped.

 Output:
   dry-run: counts of candidates, resolvable, unresolved.
   list: one line per product: productId -> slaughteredId (date) | reason if unresolved.
   commit: performs UPDATE and reports totals.
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/db');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { mode: 'dry-run', limit: null, batch: null };
  for (const a of args) {
    const [k, v] = a.split('=');
    if (k === '--mode') opts.mode = v;
    else if (k === '--limit') opts.limit = Number(v);
    else if (k === '--batch') opts.batch = Number(v);
  }
  return opts;
}

async function fetchProducts(opts) {
  const params = [];
  let where = 'WHERE (p.slaughtered_id IS NULL OR p.slaughtered_id = 0) AND p.batch_id IS NOT NULL';
  if (opts.batch) { where += ' AND p.batch_id = ?'; params.push(opts.batch); }
  const limitClause = opts.limit ? ' LIMIT ' + Number(opts.limit) : '';
  const [rows] = await db.query(`SELECT p.id, p.batch_id, p.created_at, p.packaged_quantity FROM products p ${where} ORDER BY p.created_at ASC${limitClause}`, params);
  return rows;
}

async function findSlaughterForProduct(prod) {
  // prod: { id, batch_id, created_at }
  // nearest prior by date
  const [prior] = await db.query(
    'SELECT id, date FROM slaughtered WHERE batch_id = ? AND date <= ? ORDER BY date DESC, id DESC LIMIT 1',
    [prod.batch_id, prod.created_at]
  );
  if (prior.length > 0) return { match: prior[0], strategy: 'prior_or_same' };
  // earliest for batch
  const [any] = await db.query(
    'SELECT id, date FROM slaughtered WHERE batch_id = ? ORDER BY date ASC, id ASC LIMIT 1',
    [prod.batch_id]
  );
  if (any.length > 0) return { match: any[0], strategy: 'earliest_for_batch' };
  return { match: null, strategy: 'none' };
}

async function run() {
  const opts = parseArgs();
  console.log('[Backfill] Mode:', opts.mode);
  const products = await fetchProducts(opts);
  if (products.length === 0) {
    console.log('No legacy products needing backfill found.');
    process.exit(0);
  }
  let resolvable = 0; let unresolved = 0; const mappings = [];
  for (const p of products) {
    const { match, strategy } = await findSlaughterForProduct(p);
    if (match) {
      resolvable++;
      mappings.push({ product_id: p.id, slaughtered_id: match.id, slaughter_date: match.date, strategy, created_at: p.created_at });
    } else {
      unresolved++;
      mappings.push({ product_id: p.id, slaughtered_id: null, slaughter_date: null, strategy: 'unresolved', created_at: p.created_at });
    }
  }
  if (opts.mode === 'dry-run') {
    console.log('Products needing backfill:', products.length);
    console.log('Resolvable:', resolvable);
    console.log('Unresolved (no slaughter events for batch):', unresolved);
    console.log('Use --mode=list to inspect details or --mode=commit to apply.');
    process.exit(0);
  }
  if (opts.mode === 'list') {
    console.log('product_id,slaughtered_id,strategy,slaughter_date,product_created_at');
    for (const m of mappings) {
      console.log(`${m.product_id},${m.slaughtered_id || ''},${m.strategy},${m.slaughter_date || ''},${m.created_at}`);
    }
    process.exit(0);
  }
  if (opts.mode === 'commit') {
    let applied = 0;
    for (const m of mappings) {
      if (m.slaughtered_id) {
        await db.query('UPDATE products SET slaughtered_id = ? WHERE id = ?', [m.slaughtered_id, m.product_id]);
        applied++;
      }
    }
    console.log('Applied updates:', applied);
    console.log('Skipped (unresolved):', unresolved);
    process.exit(0);
  }
  console.error('Unknown mode. Use dry-run, list, or commit.');
  process.exit(1);
}

run().catch(e => { console.error('Backfill error:', e); process.exit(1); });
