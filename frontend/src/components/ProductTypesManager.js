import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Alert, Spinner } from 'react-bootstrap';

const ProductTypesManager = () => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('0.00');

  const fetchTypes = async () => {
    try {
      const res = await api.get('/product-types');
      setTypes(res.data || []);
    } catch (err) {
      console.error('Error fetching product types', err);
      setError(err?.response?.data?.message || 'Error fetching product types');
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTypes().finally(() => setLoading(false));
  }, []);

  const [editPrice, setEditPrice] = useState('0.00');
  const startEdit = (t) => { setEditingId(t.id); setEditName(t.name); setEditPrice(t.price != null ? String(Number(t.price).toFixed(2)) : '0.00'); };
  const cancelEdit = () => { setEditingId(null); setEditName(''); setEditPrice('0.00'); };

  const saveEdit = async (id) => {
    try {
      const name = String(editName || '').trim();
      const price = Number(editPrice || 0);
      if (!name) return setError('Name is required');
      await api.put(`/product-types/${id}`, { name, price });
      setSuccess('Type updated');
      setTimeout(() => setSuccess(''), 2500);
      await fetchTypes();
      cancelEdit();
    } catch (err) {
      console.error('Error updating type', err);
      setError(err?.response?.data?.message || 'Error updating type');
    }
  };

  const removeType = async (id) => {
    if (!window.confirm('Delete this product type?')) return;
    try {
      await api.delete(`/product-types/${id}`);
      setSuccess('Type deleted');
      setTimeout(() => setSuccess(''), 2500);
      await fetchTypes();
    } catch (err) {
      console.error('Error deleting type', err);
      setError(err?.response?.data?.message || 'Error deleting type');
    }
  };

  const addType = async (e) => {
    e.preventDefault();
    try {
      const name = String(newName || '').trim();
      const price = Number(newPrice || 0);
      if (!name) return setError('Name is required');
      if (!Number.isFinite(price) || price < 0) return setError('Price must be a non-negative number');
      await api.post('/product-types', { name, price });
      setNewName('');
      setNewPrice('0.00');
      await fetchTypes();
      setSuccess('Type added');
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      console.error('Error adding type', err);
      setError(err?.response?.data?.message || 'Error adding type');
    }
  };

  return (
    <div className="container mt-5">
      <h2>Product Types</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      {loading ? (
        <div className="d-flex justify-content-center my-4">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : (
        <>
          <form className="mb-3" onSubmit={addType}>
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label">Add New Type</label>
                <input className="form-control" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., smoked" />
              </div>
              <div className="col-md-3">
                <label className="form-label">Price</label>
                <input className="form-control" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div className="col-md-2">
                <button className="btn btn-success w-100" type="submit">Add</button>
              </div>
            </div>
          </form>

          <div className="table-responsive">
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>ID</th>
                      <th>Name</th>
                      <th>Price</th>
                  <th>Created</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(types || []).length === 0 ? (
                  <tr><td colSpan="5" className="text-center text-muted">No product types.</td></tr>
                ) : (
                  (types || []).map(t => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>
                        {editingId === t.id ? (
                          <div className="d-flex g-2">
                            <input className="form-control form-control-sm me-2" value={editName} onChange={(e)=>setEditName(e.target.value)} />
                            <input className="form-control form-control-sm" value={editPrice} onChange={(e)=>setEditPrice(e.target.value)} />
                          </div>
                        ) : (
                          t.name
                        )}
                      </td>
                      <td>{t.price != null ? Number(t.price).toFixed(2) : '0.00'}</td>
                      <td>{t.created_at ? new Date(t.created_at).toLocaleString() : '-'}</td>
                      <td className="text-end">
                        {editingId === t.id ? (
                          <>
                            <button className="btn btn-sm btn-success me-2" onClick={() => saveEdit(t.id)}>Save</button>
                            <button className="btn btn-sm btn-secondary" onClick={cancelEdit}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => startEdit(t)}>Rename</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => removeType(t.id)}>Delete</button>
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

export default ProductTypesManager;
