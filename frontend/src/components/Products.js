import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { Alert, Spinner } from 'react-bootstrap';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ type: '', batchId: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ type: '', packaged_quantity: '', batch_id: '' });
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');



  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data || []);
    } catch (err) {
      console.error('Error fetching products', err);
      setError(err?.response?.data?.message || 'Error fetching products');
    }
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


  useEffect(() => {
    setLoading(true);
  Promise.all([fetchProducts(), fetchBatches()]).finally(() => setLoading(false));
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
    // Totals per product type
    const byType = {};
    (filteredProducts || []).forEach(p => {
      const type = (p.type || 'Unknown').toLowerCase();
      byType[type] = (byType[type] || 0) + Number(p.packaged_quantity || 0);
    });
    return { count, qty, byType };
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
  await fetchProducts();
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
          {/* Totals Cards */}
          <div className="row mb-4">
            <div className="col-md-3 mb-2">
              <div className="card text-center shadow-sm">
                <div className="card-body">
                  <h6 className="card-title text-muted">Total Products</h6>
                  <h3 className="card-text">{summary.count}</h3>
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
                  <th>Weight</th>
                  <th>Batch</th>
                  <th>Created</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredProducts || []).length === 0 ? (
                  <tr><td colSpan="7" className="text-center text-muted">No products yet.</td></tr>
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
                        {p.weight !== undefined && p.weight !== null ? p.weight : '-'}
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
