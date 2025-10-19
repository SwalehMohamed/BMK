import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { Alert, Spinner } from 'react-bootstrap';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [productTypesApi, setProductTypesApi] = useState([]);
  const [filters, setFilters] = useState({ type: '', batchId: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ type: '', packaged_quantity: '', batch_id: '' });
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    batch_id: '',
    product_type: 'meat',
    packaged_quantity: '',
    slaughter_quantity: '',
    date: new Date().toISOString().slice(0, 10),
    avg_weight: ''
  });
  const [newType, setNewType] = useState('');

  const batchMap = useMemo(() => {
    const map = new Map();
    (batches || []).forEach(b => map.set(b.id, b));
    return map;
  }, [batches]);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data || []);
    } catch (err) {
      console.error('Error fetching products', err);
      setError(err?.response?.data?.message || 'Error fetching products');
    }
  };

  const productTypes = useMemo(() => {
    const defaults = ['meat', 'frozen', 'fresh', 'other'];
    const types = new Set(defaults);
    (productTypesApi || []).forEach(t => { if (t?.name) types.add(String(t.name)); });
    (products || []).forEach(p => { if (p?.type) types.add(String(p.type)); });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [products, productTypesApi]);

  const fetchBatches = async () => {
    try {
      const res = await api.get('/chicks?limit=1000');
      setBatches(res.data?.data || []);
    } catch (err) {
      console.error('Error fetching batches', err);
      setError(err?.response?.data?.message || 'Error fetching batches');
    }
  };

  const fetchProductTypes = async () => {
    try {
      const res = await api.get('/product-types');
      setProductTypesApi(res.data || []);
    } catch (err) {
      console.error('Error fetching product types', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchProducts(), fetchBatches(), fetchProductTypes()]).finally(() => setLoading(false));
  }, []);

  const filteredProducts = useMemo(() => {
    return (products || []).filter(p => {
      const typeOk = filters.type ? String(p.type || '').toLowerCase().includes(filters.type.toLowerCase()) : true;
      const batchOk = filters.batchId ? String(p.batch_id || '').trim() === String(filters.batchId).trim() : true;
      return typeOk && batchOk;
    });
  }, [products, filters]);

  const summary = useMemo(() => {
    const count = (filteredProducts || []).length;
    const qty = (filteredProducts || []).reduce((a, p) => a + Number(p.packaged_quantity || 0), 0);
    return { count, qty };
  }, [filteredProducts]);

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({ type: p.type || '', packaged_quantity: p.packaged_quantity ?? 0, batch_id: p.batch_id ?? '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ type: '', packaged_quantity: '', batch_id: '' });
  };

  const saveEdit = async (id) => {
    try {
      const chosenType = editForm.type === '__add_new__' ? (editForm.newType || '').trim() : (editForm.type || '').trim();
      const payload = {
        type: chosenType,
        packaged_quantity: Number(editForm.packaged_quantity),
        batch_id: editForm.batch_id ? Number(editForm.batch_id) : null
      };
      if (!payload.type) return setError('Type is required');
      if (!Number.isFinite(payload.packaged_quantity) || payload.packaged_quantity < 0) return setError('Packaged quantity must be non-negative');
  try { await api.post('/product-types', { name: payload.type }); } catch (_) {}
  await api.put(`/products/${id}`, payload);
      setSuccess('Product updated');
      setTimeout(() => setSuccess(''), 2500);
  await Promise.all([fetchProducts(), fetchProductTypes()]);
      cancelEdit();
    } catch (err) {
      console.error('Error updating product', err);
      setError(err?.response?.data?.message || 'Error updating product');
    }
  };

  const removeProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      setSuccess('Product deleted');
      setTimeout(() => setSuccess(''), 2500);
      await fetchProducts();
    } catch (err) {
      console.error('Error deleting product', err);
      setError(err?.response?.data?.message || 'Error deleting product');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const batchId = Number(form.batch_id);
      if (!batchId) return setError('Please select a batch');
      const selected = batchMap.get(batchId);
      if (!selected) return setError('Invalid batch selected');
      const selectedType = form.product_type === '__add_new__' ? newType : form.product_type;
      const type = (selectedType || '').trim();
      if (!type) return setError('Please enter a product type');
      const slaughterQty = Number(form.slaughter_quantity);
      if (!Number.isInteger(slaughterQty) || slaughterQty < 1) {
        return setError('Slaughter quantity must be a positive integer');
      }
      const available = Number(selected.current_count ?? (selected.initial_count - (selected.total_deaths || 0) - (selected.total_slaughtered || 0)));
      if (slaughterQty > available) {
        return setError(`Quantity exceeds available live birds for this batch (available: ${available})`);
      }
      const packagedQty = Number(form.packaged_quantity);
      if (!Number.isFinite(packagedQty) || packagedQty < 0) {
        return setError('Packaged quantity must be a non-negative number');
      }

  // Ensure type exists in catalog (best-effort)
  try { await api.post('/product-types', { name: type }); } catch (_) {}

  // 1) Record slaughter
      await api.post('/slaughtered', {
        batch_id: batchId,
        date: form.date,
        quantity: slaughterQty,
        avg_weight: form.avg_weight ? Number(form.avg_weight) : undefined,
        notes: `Added to products as ${form.product_type}`
      });

      // 2) Create product entry linked to batch
      await api.post('/products', {
        type,
        packaged_quantity: packagedQty,
        batch_id: batchId
      });

      setSuccess('Product created and slaughter recorded');
      setTimeout(() => setSuccess(''), 3000);
  await Promise.all([fetchProducts(), fetchBatches(), fetchProductTypes()]);
      setForm({
        batch_id: '',
        product_type: 'meat',
        packaged_quantity: '',
        slaughter_quantity: '',
        date: new Date().toISOString().slice(0, 10),
        avg_weight: ''
      });
      setNewType('');
    } catch (err) {
      console.error('Error creating product from batch', err);
      setError(err?.response?.data?.message || 'Error creating product from batch');
    }
  };

  return (
    <div className="container mt-5">
      <h2>Products</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      {loading ? (
        <div className="d-flex justify-content-center my-4">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : (
        <>
          <div className="d-flex flex-wrap gap-3 mb-3 small text-muted">
            <div className="badge bg-secondary">Products: {summary.count}</div>
            <div className="badge bg-info">Total Packaged Qty: {summary.qty}</div>
          </div>
          <div className="card mb-4">
            <div className="card-body">
              <h5 className="card-title">Add Product from Batch</h5>
              <form onSubmit={handleSubmit}>
                <div className="row g-3 align-items-end">
                  <div className="col-md-4">
                    <label className="form-label">Batch</label>
                    <select
                      className="form-select"
                      value={form.batch_id}
                      onChange={(e) => setForm(prev => ({ ...prev, batch_id: e.target.value }))}
                    >
                      <option value="">Select a batch…</option>
                      {(batches || []).map(b => (
                        <option key={b.id} value={b.id}>
                          {b.batch_name} — Live: {b.current_count ?? (b.initial_count - (b.total_deaths||0) - (b.total_slaughtered||0))}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Slaughter Qty (birds)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      value={form.slaughter_quantity}
                      onChange={(e) => setForm(prev => ({ ...prev, slaughter_quantity: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Avg Weight (kg)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      step="0.01"
                      value={form.avg_weight}
                      onChange={(e) => setForm(prev => ({ ...prev, avg_weight: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.date}
                      onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Product Type</label>
                    <select
                      className="form-select"
                      value={form.product_type}
                      onChange={(e) => setForm(prev => ({ ...prev, product_type: e.target.value }))}
                    >
                      {productTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      <option value="__add_new__">+ Add new type…</option>
                    </select>
                    {form.product_type === '__add_new__' && (
                      <input
                        className="form-control mt-2"
                        type="text"
                        placeholder="Enter new product type"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Packaged Quantity</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={form.packaged_quantity}
                      onChange={(e) => setForm(prev => ({ ...prev, packaged_quantity: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <button className="btn btn-success w-100" type="submit">Add</button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div className="d-flex align-items-end justify-content-between mb-2">
            <h5 className="mb-0">Existing Products</h5>
            <div className="d-flex gap-2">
              <div>
                <label className="form-label mb-0 small">Filter by Type</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="type contains…"
                  value={filters.type}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label mb-0 small">Filter by Batch</label>
                <select
                  className="form-select form-select-sm"
                  value={filters.batchId}
                  onChange={(e) => setFilters(prev => ({ ...prev, batchId: e.target.value }))}
                >
                  <option value="">All</option>
                  {(batches || []).map(b => (
                    <option key={b.id} value={b.id}>{b.batch_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Packaged Quantity</th>
                  <th>Batch</th>
                  <th>Created</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredProducts || []).length === 0 ? (
                  <tr><td colSpan="6" className="text-center text-muted">No products yet.</td></tr>
                ) : (
                  (filteredProducts || []).map(p => (
                    <tr key={p.id}>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default Products;
