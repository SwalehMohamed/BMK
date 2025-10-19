import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Row, Col, Alert, Spinner } from 'react-bootstrap';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import api from '../services/api';

function SlaughterManager() {
  const navigate = useNavigate();
  const [slaughters, setSlaughters] = useState([]);
  const [products, setProducts] = useState([]);
  // Removed products table from this page
  const [showModal, setShowModal] = useState(false);
  const [slaughterData, setSlaughterData] = useState({
    batch_id: '',
    date: '',
    quantity: '',
    avg_weight: ''
  });
  // Removed product modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState({ slaughterId: null, batch_id: '', packaged_quantity: '', product_type: 'meat', newType: '' });
  const [productTypes, setProductTypes] = useState([]);
  const [showQuickView, setShowQuickView] = useState(false);
  const [quickViewBatchId, setQuickViewBatchId] = useState('');
  const [quickViewList, setQuickViewList] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

useEffect(() => {
  fetchSlaughters();
  fetchProducts();
}, []);

const fetchSlaughters = async () => {
  setLoading(true);
  try {
    const response = await api.get('/slaughtered');
    setSlaughters(response.data || []);
    setError('');
  } catch (error) {
    setError('Error fetching chicken slaughters');
    console.error('Error fetching chicken slaughters:', error);
    setSlaughters([]);
  }
  setLoading(false);
};

const fetchProductTypes = async () => {
  try {
    const res = await api.get('/product-types');
    setProductTypes(res.data || []);
  } catch (e) {
    // Fallback to a couple defaults if endpoint missing
    setProductTypes([{ id: 'meat', type: 'meat' }, { id: 'fresh', type: 'fresh' }, { id: 'frozen', type: 'frozen' }]);
  }
};

const fetchProducts = async () => {
  try {
    const res = await api.get('/products');
    setProducts(res.data || []);
  } catch (e) {
    // Keep products empty on failure
    setProducts([]);
  }
};

const handleSlaughterSubmit = async (e) => {
  e.preventDefault();
  try {
    await api.post('/slaughtered', slaughterData);
    fetchSlaughters();
    setShowModal(false);
    setSlaughterData({
      batch_id: '',
      date: '',
      quantity: '',
      avg_weight: ''
    });
    setSuccess('Slaughter record added successfully');
    setTimeout(() => setSuccess(''), 3000);
    setError('');
  } catch (error) {
    setError('Error adding chicken slaughter');
    console.error('Error adding chicken slaughter:', error);
  }
};

// Removed product submit handler
const openCreateProduct = async (s) => {
  setProductForm({ slaughterId: s.id, batch_id: s.batch_id, packaged_quantity: String(s.quantity || ''), product_type: 'meat', newType: '' });
  await fetchProductTypes();
  setShowProductModal(true);
};

const saveProduct = async (e) => {
  e.preventDefault();
  try {
    const type = productForm.product_type === '__add_new__' ? (productForm.newType || '').trim() : productForm.product_type;
    if (!type) {
      return setError('Please select or enter a product type');
    }
    const qty = Number(productForm.packaged_quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      return setError('Packaged quantity must be a non-negative number');
    }
    await api.post('/products', { type, packaged_quantity: qty, batch_id: productForm.batch_id });
    setSuccess('Product created from slaughter');
    setTimeout(() => setSuccess(''), 2500);
    setShowProductModal(false);
    setError('');

    // Quick-view products for this batch to confirm visibility
    try {
      const resp = await api.get('/products');
      const list = (resp.data || []).filter(p => String(p.batch_id || '') === String(productForm.batch_id || ''));
      setQuickViewBatchId(productForm.batch_id || '');
      setQuickViewList(list);
      setShowQuickView(true);
    } catch (_) {}
  } catch (err) {
    console.error('Error creating product', err);
    setError(err?.response?.data?.message || 'Error creating product');
  }
};

  return (
    <>
      <div className="container mt-4">
        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}
        {loading ? (
          <div className="d-flex justify-content-center my-4">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : (
          <Row>
            <Col md={12}>
              <h4>Slaughter Records</h4>
              <Button variant="primary" onClick={() => setShowModal(true)}>Add Slaughter</Button>
              <div className="row g-2 mt-2">
                <div className="col-md-2">
                  <label className="form-label small">From</label>
                  <input type="date" className="form-control form-control-sm" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small">To</label>
                  <input type="date" className="form-control form-control-sm" value={toDate} onChange={(e)=>setToDate(e.target.value)} />
                </div>
              </div>
              <div className="card mt-3 mb-3">
                <div className="card-body">
                  <h6 className="mb-2">Slaughtered per Batch</h6>
                  <div style={{width:'100%', height:300}}>
                    <ResponsiveContainer>
                      <BarChart data={aggregatePerBatch(slaughters, fromDate, toDate)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="batch" interval={0} angle={-30} textAnchor="end" height={60} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="quantity" name="Quantity" fill="#2ca02c" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="card mt-3 mb-3">
                <div className="card-body">
                  <h6 className="mb-2">Products per Batch (packaged)</h6>
                  <div style={{width:'100%', height:260}}>
                    <ResponsiveContainer>
                      <BarChart data={aggregateProductsPerBatch(products)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="batch" interval={0} angle={-30} textAnchor="end" height={60} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="packaged" name="Packaged Qty" fill="#1f77b4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <Table striped bordered hover responsive className="mt-3">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Date</th>
                    <th>Quantity</th>
                    <th>Avg Weight</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(slaughters) && slaughters.map((s) => (
                    <tr key={s.id}>
                      <td>{s.batch_name || `Batch #${s.batch_id}`}</td>
                      <td>{new Date(s.date).toLocaleDateString()}</td>
                      <td>{s.quantity}</td>
                      <td>{s.avg_weight ?? '-'}</td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <Button variant="outline-success" onClick={() => openCreateProduct(s)}>Create Product</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Col>
          </Row>
        )}

        <Modal show={showModal} onHide={() => setShowModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Add Slaughter Record</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form onSubmit={handleSlaughterSubmit}>
              <Form.Group className="mb-3" controlId="batch_id">
                <Form.Label>Batch ID</Form.Label>
                <Form.Control
                  type="text"
                  value={slaughterData.batch_id}
                  onChange={(e) =>
                    setSlaughterData({ ...slaughterData, batch_id: e.target.value })
                  }
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="date">
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="date"
                  value={slaughterData.date}
                  onChange={(e) =>
                    setSlaughterData({ ...slaughterData, date: e.target.value })
                  }
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="quantity">
                <Form.Label>Quantity</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  value={slaughterData.quantity}
                  onChange={(e) =>
                    setSlaughterData({ ...slaughterData, quantity: e.target.value })
                  }
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="avg_weight">
                <Form.Label>Average Weight (kg)</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={slaughterData.avg_weight}
                  onChange={(e) =>
                    setSlaughterData({ ...slaughterData, avg_weight: e.target.value })
                  }
                  required
                />
              </Form.Group>
              <Button variant="primary" type="submit">
                Save
              </Button>
            </Form>
          </Modal.Body>
        </Modal>

        {/* Products UI removed from this page */}
        <Modal show={showProductModal} onHide={() => setShowProductModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Create Product from Slaughter</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form onSubmit={saveProduct}>
              <Form.Group className="mb-2">
                <Form.Label>Batch</Form.Label>
                <Form.Control value={productForm.batch_id || ''} disabled />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label>Product Type</Form.Label>
                <Form.Select value={productForm.product_type} onChange={(e)=>setProductForm(prev=>({...prev, product_type: e.target.value}))}>
                  {(productTypes||[]).map(pt => (
                    <option key={pt.id || pt.type} value={pt.type}>{pt.type}</option>
                  ))}
                  <option value="__add_new__">+ Add new type…</option>
                </Form.Select>
                {productForm.product_type === '__add_new__' && (
                  <Form.Control className="mt-2" placeholder="Enter new product type" value={productForm.newType}
                    onChange={(e)=>setProductForm(prev=>({...prev, newType: e.target.value}))} />
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Packaged Quantity</Form.Label>
                <Form.Control type="number" min={0} value={productForm.packaged_quantity}
                  onChange={(e)=>setProductForm(prev=>({...prev, packaged_quantity: e.target.value}))} />
                <Form.Text className="text-muted">Defaulted to the slaughtered quantity; adjust as needed.</Form.Text>
              </Form.Group>
              <div className="text-end">
                <Button variant="secondary" className="me-2" onClick={()=>setShowProductModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Save Product</Button>
              </div>
            </Form>
          </Modal.Body>
        </Modal>

        <Modal show={showQuickView} onHide={() => setShowQuickView(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Products for Batch {quickViewBatchId || '-'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {quickViewList.length === 0 ? (
              <div className="text-muted">No products linked to this batch yet.</div>
            ) : (
              <div className="table-responsive">
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Packaged Qty</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quickViewList.map(p => (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td className="text-capitalize">{p.type}</td>
                        <td>{p.packaged_quantity}</td>
                        <td>{p.created_at ? new Date(p.created_at).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowQuickView(false)}>Close</Button>
            <Button variant="primary" disabled={!quickViewBatchId} onClick={() => { setShowQuickView(false); if (quickViewBatchId) navigate(`/products?batchId=${quickViewBatchId}`); }}>View in Products</Button>
          </Modal.Footer>
        </Modal>
      </div>
    </>
  );
}

export default SlaughterManager;

function aggregatePerBatch(rows, fromDate, toDate) {
  const map = new Map();
  const df = fromDate ? new Date(fromDate) : null;
  const dt = toDate ? new Date(toDate) : null;
  (rows || []).forEach(r => {
    const d = r.date ? new Date(r.date) : null;
    if (df && (!d || d < df)) return;
    if (dt && (!d || d > dt)) return;
    const key = r.batch_name || `#${r.batch_id}`;
    map.set(key, (map.get(key) || 0) + Number(r.quantity || 0));
  });
  return Array.from(map.entries()).map(([batch, quantity]) => ({ batch, quantity }));
}

function aggregateProductsPerBatch(products) {
  const map = new Map();
  (products || []).forEach(p => {
    const key = p.batch_name || (p.batch_id ? `#${p.batch_id}` : 'Unlinked');
    map.set(key, (map.get(key) || 0) + Number(p.packaged_quantity || 0));
  });
  return Array.from(map.entries()).map(([batch, packaged]) => ({ batch, packaged }));
}
