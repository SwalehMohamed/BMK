import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { Alert, Spinner, Form, Button, Toast, ToastContainer } from 'react-bootstrap';
import { buildCsv, downloadCsv, exportPdfTable, fetchAllForExport } from '../utils/export';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filters, setFilters] = useState({ type: '', batchId: '', dateFrom: '', dateTo: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ type: '', packaged_quantity: '', batch_id: '', base_unit_price: '' });
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({}); // productId -> boolean
  const [pendingOrders, setPendingOrders] = useState({}); // productId -> array
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revertToast, setRevertToast] = useState({ show: false, body: '' });
  const [typeList, setTypeList] = useState([]); // product types from backend
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInputs, setBulkInputs] = useState({}); // type -> new price string



  const fetchProducts = async (page = meta.page, limit = meta.limit) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (filters.type) {
        // use search for partial match on type
        params.set('search', filters.type);
        // also send exact type param for backend exact filter if implemented
        params.set('type', filters.type);
      }
      if (filters.batchId) params.set('batch_id', filters.batchId);
      if (filters.dateFrom) params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params.set('date_to', filters.dateTo);
      const res = await api.get(`/products?${params.toString()}`);
      if (res.data?.data) {
        setProducts(res.data.data);
        if (res.data.meta) setMeta(res.data.meta);
      } else {
        // fallback if not paginated
        const arr = res.data || [];
        setProducts(arr);
        setMeta(m => ({ ...m, total: arr.length, pages: 1 }));
      }
    } catch (err) {
      console.error('Error fetching products', err);
      setError(err?.response?.data?.message || 'Error fetching products');
      setProducts([]);
    }
  };

  const fetchPendingOrders = async (productId) => {
    try {
      const res = await api.get(`/orders?product_id=${productId}&limit=200`);
      const raw = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      const list = (raw || []).filter(o => ['pending','confirmed'].includes(String(o.status).toLowerCase()));
      setPendingOrders(prev => ({ ...prev, [productId]: list }));
    } catch (err) {
      console.error('Error fetching pending/confirmed orders for product', productId, err);
      setPendingOrders(prev => ({ ...prev, [productId]: [] }));
    }
  };

  const toggleExpand = (productId) => {
    setExpanded(prev => {
      const next = { ...prev, [productId]: !prev[productId] };
      if (!prev[productId]) {
        // just expanded; fetch pending orders
        fetchPendingOrders(productId);
      }
      return next;
    });
  };

  // Only count unique product types that exist in the products list
  const productTypes = useMemo(() => {
    const types = new Set();
    (products || []).forEach(p => { if (p?.type) types.add(String(p.type).toLowerCase()); });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const fetchBatches = async () => {
    try {
      const res = await api.get('/chicks?limit=1000');
      setBatches(res.data?.data || []);
    } catch (err) {
      console.error('Error fetching batches', err);
      setError(err?.response?.data?.message || 'Error fetching batches');
    }
  };

  const fetchTypes = async () => {
    try {
      const res = await api.get('/product-types');
      setTypeList(res.data || []);
    } catch (err) {
      console.error('Error fetching product types', err);
    }
  };


  useEffect(() => {
    setLoading(true);
    Promise.all([fetchProducts(1, meta.limit), fetchBatches(), fetchTypes()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // refetch on filter change
    fetchProducts(1, meta.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.batchId, filters.dateFrom, filters.dateTo]);

  const summary = useMemo(() => {
    // Summary for current page (not entire filtered dataset unless backend adds aggregates)
    const count = (products || []).length;
    const qty = (products || []).reduce((a, p) => a + Number(p.packaged_quantity || 0), 0);
    const byType = {};
    (products || []).forEach(p => {
      const type = (p.type || 'Unknown').toLowerCase();
      byType[type] = (byType[type] || 0) + Number(p.packaged_quantity || 0);
    });
    return { count, qty, byType };
  }, [products]);

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({ type: p.type || '', packaged_quantity: p.packaged_quantity ?? 0, batch_id: p.batch_id ?? '', base_unit_price: p.base_unit_price ?? '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ type: '', packaged_quantity: '', batch_id: '', base_unit_price: '' });
  };

  const saveEdit = async (id) => {
    try {
      const chosenType = editForm.type === '__add_new__' ? (editForm.newType || '').trim() : (editForm.type || '').trim();
      const payload = {
        type: chosenType,
        packaged_quantity: Number(editForm.packaged_quantity),
        batch_id: editForm.batch_id ? Number(editForm.batch_id) : null,
        base_unit_price: editForm.base_unit_price !== '' ? Number(editForm.base_unit_price) : null
      };
      if (!payload.type) return setError('Type is required');
      if (!Number.isFinite(payload.packaged_quantity) || payload.packaged_quantity < 0) return setError('Packaged quantity must be non-negative');
  try { await api.post('/product-types', { name: payload.type }); } catch (_) {}
  await api.put(`/products/${id}`, payload);
      setSuccess('Product updated');
      setTimeout(() => setSuccess(''), 2500);
  await fetchProducts(meta.page, meta.limit);
      cancelEdit();
    } catch (err) {
      console.error('Error updating product', err);
      setError(err?.response?.data?.message || 'Error updating product');
    }
  };

  const removeProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      const res = await api.delete(`/products/${id}`);
      setSuccess('Product deleted');
      setTimeout(() => setSuccess(''), 2500);
      await fetchProducts(meta.page, meta.limit);
      // Surface revert info if present
      if (res.data?.revert) {
        const r = res.data.revert;
        let msg = '';
        if (r.performed) {
          msg = `Restored ${r.restoreAmount} to slaughter #${r.slaughteredId}. New qty: ${r.newQty}`;
        } else {
          if (r.reason === 'downstream_consumption_detected') {
            msg = 'Revert skipped: product has downstream orders/deliveries.';
          } else if (r.reason === 'no_slaughter_reference') {
            msg = 'Revert skipped: no slaughter record reference.';
          } else if (r.reason === 'slaughter_record_missing') {
            msg = 'Revert skipped: slaughter record missing.';
          } else if (r.reason === 'product_not_found') {
            msg = 'Revert skipped: product not found.';
          } else {
            msg = 'Revert skipped.';
          }
        }
        if (msg) setRevertToast({ show: true, body: msg });
      }
    } catch (err) {
      console.error('Error deleting product', err);
      setError(err?.response?.data?.message || 'Error deleting product');
    }
  };

  // Export helpers
  const exportProductsCSV = async () => {
    try {
      const rows = await fetchAllForExport('/products', {
        search: filters.type,
        type: filters.type,
        batch_id: filters.batchId,
        date_from: filters.dateFrom,
        date_to: filters.dateTo
      });
      const header = ['ID','Type','Packaged Qty','Weight','Batch','Created'];
      const body = rows.map(p => [
        p.id,
        p.type,
        p.packaged_quantity,
        p.weight ?? '',
        p.batch_name || (p.batch_id ? `Batch #${p.batch_id}` : ''),
        p.created_at ? new Date(p.created_at).toISOString() : ''
      ]);
      const csv = buildCsv(header, body);
      downloadCsv(csv, 'products');
    } catch (err) { setError('Error exporting products CSV'); }
  };

  const exportProductsPDF = async () => {
    try {
      const rows = await fetchAllForExport('/products', {
        search: filters.type,
        type: filters.type,
        batch_id: filters.batchId,
        date_from: filters.dateFrom,
        date_to: filters.dateTo
      });
      const head = [['ID','Type','Packaged Qty','Weight','Batch','Created']];
      const body = rows.map(p => [
        p.id,
        p.type,
        p.packaged_quantity,
        p.weight ?? '-',
        p.batch_name || (p.batch_id ? `Batch #${p.batch_id}` : 'Unlinked'),
        p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'
      ]);
      exportPdfTable({ title: 'Products', head, body, fileName: 'products' });
    } catch (err) { setError('Error exporting products PDF'); }
  };

  const averageBasePriceByType = useMemo(() => {
    const map = {};
    (products||[]).forEach(p => {
      const t = String(p.type||'').toLowerCase();
      if (!map[t]) map[t] = { sum:0, count:0 };
      if (p.base_unit_price != null) { map[t].sum += Number(p.base_unit_price); map[t].count += 1; }
    });
    const out = {};
    Object.entries(map).forEach(([t, v]) => { if (v.count>0) out[t] = v.sum / v.count; });
    return out;
  }, [products]);

  const openBulkModal = () => {
    const init = {};
    typeList.forEach(t => { init[String(t.name).toLowerCase()] = ''; });
    setBulkInputs(init);
    setShowBulkModal(true);
  };

  const applyBulkPrices = async () => {
    try {
      for (const t of typeList) {
        const key = String(t.name).toLowerCase();
        const valStr = bulkInputs[key];
        if (valStr === undefined || valStr === '') continue; // skip untouched
        const newPrice = Number(valStr);
        if (!Number.isFinite(newPrice) || newPrice < 0) continue;
        // Update product type price (optional sync)
        try { await api.put(`/product-types/${t.id}`, { name: key, price: newPrice }); } catch (_) {}
        // Update all products of that type
        const targets = (products||[]).filter(p => String(p.type).toLowerCase() === key);
        for (const p of targets) {
          await api.put(`/products/${p.id}`, {
            type: p.type,
            packaged_quantity: p.packaged_quantity,
            batch_id: p.batch_id ?? null,
            base_unit_price: newPrice
          });
        }
      }
      setSuccess('Bulk price update complete');
      setTimeout(()=>setSuccess(''), 3000);
      setShowBulkModal(false);
      await fetchProducts(meta.page, meta.limit);
      await fetchTypes();
    } catch (err) {
      console.error('Bulk price update error', err);
      setError(err?.response?.data?.message || 'Bulk price update failed');
    }
  };


  return (
    <>
      <div className="container mt-5">
      <h2>Products</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      <ToastContainer position="top-end" className="p-3">
        <Toast bg="info" onClose={() => setRevertToast({ show: false, body: '' })} show={revertToast.show} delay={5000} autohide>
          <Toast.Header>
            <strong className="me-auto">Revert</strong>
          </Toast.Header>
          <Toast.Body className="text-white">{revertToast.body}</Toast.Body>
        </Toast>
      </ToastContainer>
      {loading ? (
        <div className="d-flex justify-content-center my-4">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : (
        <>
          {/* Totals Cards */}
          <div className="row mb-4">
            <div className="col-md-3 mb-2">
              <div className="card text-center shadow-sm">
                <div className="card-body">
                  <h6 className="card-title text-muted">Total Products</h6>
                  <h3 className="card-text">{summary.count}</h3>
                  <div className="small text-muted">Filtered total: {meta.total}</div>
                </div>
              </div>
            </div>
            <div className="col-md-3 mb-2">
              <div className="card text-center shadow-sm">
                <div className="card-body">
                  <h6 className="card-title text-muted">Total Packaged Quantity</h6>
                  <h3 className="card-text">{summary.qty}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-3 mb-2">
              <div className="card text-center shadow-sm">
                <div className="card-body">
                  <h6 className="card-title text-muted">Unique Product Types</h6>
                  <h3 className="card-text">{productTypes.length}</h3>
                </div>
              </div>
            </div>
            {/* Totals by product type */}
            <div className="col-md-12 mt-3">
              <div className="card shadow-sm">
                <div className="card-body">
                  <h6 className="card-title text-muted mb-2">Totals by Product Type</h6>
                  <div className="d-flex flex-wrap gap-3">
                    {Object.entries(summary.byType).length === 0 ? (
                      <span className="text-muted">No products</span>
                    ) : (
                      Object.entries(summary.byType).map(([type, qty]) => (
                        <div key={type} className="border rounded px-3 py-2 bg-light">
                          <span className="fw-bold text-capitalize">{type}</span>: {qty}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Filters */}
          <Form className="mb-3">
            <div className="row g-2">
              <div className="col-md-3">
                <Form.Label className="small mb-1">Search / Type</Form.Label>
                <Form.Control value={filters.type} placeholder="type contains…" onChange={(e)=>setFilters(f=>({...f,type:e.target.value}))} />
              </div>
              <div className="col-md-2">
                <Form.Label className="small mb-1">Batch</Form.Label>
                <Form.Select value={filters.batchId} onChange={(e)=>setFilters(f=>({...f,batchId:e.target.value}))}>
                  <option value="">All</option>
                  {(batches||[]).map(b => <option key={b.id} value={b.id}>{b.batch_name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-2">
                <Form.Label className="small mb-1">From</Form.Label>
                <Form.Control type="date" value={filters.dateFrom} onChange={(e)=>setFilters(f=>({...f,dateFrom:e.target.value}))} />
              </div>
              <div className="col-md-2">
                <Form.Label className="small mb-1">To</Form.Label>
                <Form.Control type="date" value={filters.dateTo} onChange={(e)=>setFilters(f=>({...f,dateTo:e.target.value}))} />
              </div>
              <div className="col-md-1 d-flex align-items-end">
                <Button size="sm" variant="secondary" className="w-100" onClick={()=>setFilters({ type:'', batchId:'', dateFrom:'', dateTo:'' })}>Reset</Button>
              </div>
              <div className="col-md-2 d-flex align-items-end gap-2">
                <Button size="sm" variant="outline-primary" className="w-100" onClick={exportProductsCSV}>CSV</Button>
                <Button size="sm" variant="outline-primary" className="w-100" onClick={exportProductsPDF}>PDF</Button>
              </div>
            </div>
          </Form>
          <h5 className="mb-2">Existing Products</h5>
          <div className="mb-3">
            <Button size="sm" variant="outline-secondary" onClick={openBulkModal}>Bulk Price Update</Button>
          </div>
          <div className="table-responsive">
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th></th>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Packaged Qty</th>
                  <th>Weight</th>
                  <th>Base Price</th>
                  <th>Batch</th>
                  <th>Created</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(products || []).length === 0 ? (
                  <tr><td colSpan="7" className="text-center text-muted">No products yet.</td></tr>
                ) : (
                  (products || []).map(p => (
                    <React.Fragment key={p.id}>
                      <tr className={expanded[p.id] ? 'table-active' : ''}>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => toggleExpand(p.id)}
                          >{expanded[p.id] ? '−' : '+'}</button>
                        </td>
                        <td>{p.id}</td>
                        <td>
                        {editingId === p.id ? (
                          <>
                            <select
                              className="form-select form-select-sm"
                              value={editForm.type === '__add_new__' ? '__add_new__' : editForm.type}
                              onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                            >
                              {productTypes.map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                              <option value="__add_new__">+ Add new type…</option>
                            </select>
                            {editForm.type === '__add_new__' && (
                              <input
                                type="text"
                                className="form-control form-control-sm mt-2"
                                placeholder="Enter new product type"
                                value={editForm.newType || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, newType: e.target.value }))}
                              />
                            )}
                          </>
                        ) : (
                          <span className="text-capitalize">{p.type}</span>
                        )}
                        </td>
                        <td>
                        {editingId === p.id ? (
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            min="0"
                            value={editForm.packaged_quantity}
                            onChange={(e) => setEditForm(prev => ({ ...prev, packaged_quantity: e.target.value }))}
                          />
                        ) : (
                          p.packaged_quantity
                        )}
                        </td>
                        <td>
                        {p.weight !== undefined && p.weight !== null ? p.weight : '-'}
                        </td>
                        <td>
                          {editingId === p.id ? (
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              min="0"
                              step="0.01"
                              value={editForm.base_unit_price}
                              onChange={(e)=>setEditForm(prev=>({...prev, base_unit_price: e.target.value}))}
                              placeholder="e.g. 370"
                            />
                          ) : (
                            <div className="d-flex flex-column">
                              <span>{p.base_unit_price != null ? Number(p.base_unit_price).toFixed(2) : '—'}</span>
                              {p.reserved_qty != null && p.available_qty != null && (
                                <small className="text-muted">Res {p.reserved_qty} / Avail {p.available_qty}</small>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                        {editingId === p.id ? (
                          <select
                            className="form-select form-select-sm"
                            value={editForm.batch_id}
                            onChange={(e) => setEditForm(prev => ({ ...prev, batch_id: e.target.value }))}
                          >
                            <option value="">Unlinked</option>
                            {(batches || []).map(b => (
                              <option key={b.id} value={b.id}>{b.batch_name}</option>
                            ))}
                          </select>
                        ) : (
                          p.batch_name || (p.batch_id ? `Batch #${p.batch_id}` : '-')
                        )}
                        </td>
                        <td>{p.created_at ? new Date(p.created_at).toLocaleString() : '-'}</td>
                        <td className="text-end">
                        {editingId === p.id ? (
                          <>
                            <button className="btn btn-sm btn-success me-2" onClick={() => saveEdit(p.id)}>Save</button>
                            <button className="btn btn-sm btn-secondary" onClick={cancelEdit}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => startEdit(p)}>Edit</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => removeProduct(p.id)}>Delete</button>
                          </>
                        )}
                        </td>
                      </tr>
                      {expanded[p.id] && (
                        <tr>
                          <td colSpan={9} className="bg-light">
                            <h6 className="mb-2">Pending / Confirmed Orders</h6>
                            {pendingOrders[p.id] && pendingOrders[p.id].length > 0 ? (
                              <div className="table-responsive">
                                <table className="table table-sm table-bordered mb-0">
                                  <thead>
                                    <tr>
                                      <th>Order ID</th>
                                      <th>Date</th>
                                      <th>Customer</th>
                                      <th>Qty</th>
                                      <th>Delivered</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pendingOrders[p.id].map(o => (
                                      <tr key={o.id}>
                                        <td>{o.id}</td>
                                        <td>{o.order_date ? new Date(o.order_date).toLocaleDateString() : '-'}</td>
                                        <td>{o.customer_name}</td>
                                        <td>{o.quantity}</td>
                                        <td>{Number(o.delivered_sum || 0)}</td>
                                        <td className="text-capitalize">{o.status}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-muted small">No pending / confirmed orders for this product.</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div className="small text-muted">Page {meta.page} of {meta.pages} | Total {meta.total}</div>
            <div className="d-flex gap-2 align-items-center">
              <Form.Select size="sm" value={meta.limit} onChange={(e)=>{ const lim = Number(e.target.value); setMeta(m=>({...m,limit:lim})); fetchProducts(1, lim); }}>
                {[10,20,50,100].map(sz => <option key={sz} value={sz}>{sz}/page</option>)}
              </Form.Select>
              <Button size="sm" variant="outline-secondary" disabled={meta.page<=1} onClick={()=>fetchProducts(meta.page-1, meta.limit)}>Prev</Button>
              <Button size="sm" variant="outline-secondary" disabled={meta.page>=meta.pages} onClick={()=>fetchProducts(meta.page+1, meta.limit)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
    {showBulkModal && (
      <div className="modal d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Bulk Price Update</h5>
              <button type="button" className="btn-close" onClick={()=>setShowBulkModal(false)} />
            </div>
            <div className="modal-body">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Current Type Price</th>
                    <th>Avg Base Price (Products)</th>
                    <th>New Base Price</th>
                  </tr>
                </thead>
                <tbody>
                  {typeList.map(t => {
                    const key = String(t.name).toLowerCase();
                    return (
                      <tr key={t.id}>
                        <td className="text-capitalize">{t.name}</td>
                        <td>{Number(t.price).toFixed(2)}</td>
                        <td>{averageBasePriceByType[key] != null ? averageBasePriceByType[key].toFixed(2) : '—'}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control form-control-sm"
                            value={bulkInputs[key] ?? ''}
                            onChange={(e)=>setBulkInputs(prev=>({...prev, [key]: e.target.value}))}
                            placeholder="Leave blank to skip"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <small className="text-muted">Only filled values will be applied. Product type price is also updated when provided.</small>
            </div>
            <div className="modal-footer">
              <Button size="sm" variant="secondary" onClick={()=>setShowBulkModal(false)}>Close</Button>
              <Button size="sm" variant="primary" onClick={applyBulkPrices}>Apply Updates</Button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
);
};

export default Products;
