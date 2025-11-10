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
  const [productForm, setProductForm] = useState({
    slaughterId: null,
    batch_id: '',
    packaged_quantity: '',
    product_type: 'meat',
    newType: '',
    creationOption: '',
    wholeWeights: [{ weight: '', quantity: '' }]
  });
  const [showQuickView, setShowQuickView] = useState(false);
  const [quickViewBatchId, setQuickViewBatchId] = useState('');
  const [quickViewList, setQuickViewList] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Delete slaughter record handler (must be inside component for hooks)
  const handleDeleteSlaughter = async (id) => {
    if (!window.confirm('Delete this slaughter record? This cannot be undone.')) return;
    try {
      await api.delete(`/slaughtered/${id}`);
      setSuccess('Slaughter record deleted');
      setTimeout(() => setSuccess(''), 2500);
      fetchSlaughters();
    } catch (err) {
      setError(err?.response?.data?.message || 'Error deleting slaughter record');
    }
  };

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
  setProductForm({
    slaughterId: s.id,
    batch_id: s.batch_id,
    packaged_quantity: String(s.quantity || ''),
    product_type: '',
    newType: '',
    creationOption: '',
    wholeWeights: [{ weight: '', quantity: '' }],
    minceWeights: [
      { type: 'chicken mince', weight: '', quantity: '' },
      { type: 'chicken wings', weight: '', quantity: '' }
    ],
    partsWeights: [
      { type: 'chicken thighs', weight: '', quantity: '' },
      { type: 'chicken steak', weight: '', quantity: '' },
      { type: 'chicken wings', weight: '', quantity: '' }
    ]
  });
  setShowProductModal(true);
};

const saveProduct = async (e) => {
  e.preventDefault();
  try {
    const { creationOption, slaughterId, wholeWeights, minceWeights, partsWeights } = productForm;
    let payload = { slaughteredId: slaughterId, option: creationOption };
    if (creationOption === 'whole') {
      // Validate and send array of {weight, quantity}
      if (!wholeWeights || !wholeWeights.length) return setError('Please add at least one weight group');
      const valid = wholeWeights.every(wq => Number(wq.weight) > 0 && Number(wq.quantity) > 0);
      if (!valid) return setError('All weights and quantities must be positive');
      payload.weights = wholeWeights.map(wq => ({ weight: Number(wq.weight), quantity: Number(wq.quantity) }));
    } else if (creationOption === 'mince') {
      if (!minceWeights || !minceWeights.length) return setError('Please add at least one mince group');
      const valid = minceWeights.every(wq => wq.type && Number(wq.weight) > 0 && Number(wq.quantity) > 0);
      if (!valid) return setError('All weights and quantities must be positive');
      payload.weights = minceWeights.map(wq => ({ type: wq.type, weight: Number(wq.weight), quantity: Number(wq.quantity) }));
    } else if (creationOption === 'parts') {
      if (!partsWeights || !partsWeights.length) return setError('Please add at least one part group');
      const valid = partsWeights.every(wq => wq.type && Number(wq.weight) > 0 && Number(wq.quantity) > 0);
      if (!valid) return setError('All weights and quantities must be positive');
      payload.weights = partsWeights.map(wq => ({ type: wq.type, weight: Number(wq.weight), quantity: Number(wq.quantity) }));
    } else {
      return setError('Invalid product creation option');
    }
    // Call new backend endpoint
    await api.post('/slaughtered/create-products', payload);
    setSuccess('Products created from slaughter');
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
    // Refresh slaughtered records to show updated quantity
    fetchSlaughters();
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
                          <Button variant="outline-danger" onClick={() => handleDeleteSlaughter(s.id)}>Delete</Button>
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
              <Form.Group className="mb-3">
                <Form.Label>Product Creation Option</Form.Label>
                <Form.Select value={productForm.creationOption || ''} onChange={e => setProductForm(prev => ({ ...prev, creationOption: e.target.value, product_type: '', newType: '' }))} required>
                  <option value="">Select option...</option>
                  <option value="whole">Use Whole Chicken</option>
                  <option value="mince">Mince</option>
                  <option value="parts">Use Parts</option>
                </Form.Select>
              </Form.Group>


              {/* Whole Chicken Option - Multiple Weights */}
              {productForm.creationOption === 'whole' && (
                <div className="mb-3">
                  <Form.Label>Whole Chicken Weights & Quantities</Form.Label>
                  {(productForm.wholeWeights || []).map((row, idx) => (
                    <div key={idx} className="d-flex align-items-center mb-2 gap-2">
                      <Form.Control
                        type="number"
                        min={0.1}
                        step={0.01}
                        placeholder="Weight (kg)"
                        value={row.weight}
                        onChange={e => {
                          const val = e.target.value;
                          setProductForm(prev => {
                            const arr = [...prev.wholeWeights];
                            arr[idx] = { ...arr[idx], weight: val };
                            return { ...prev, wholeWeights: arr };
                          });
                        }}
                        required
                        style={{ maxWidth: 120 }}
                      />
                      <Form.Control
                        type="number"
                        min={1}
                        placeholder="Quantity"
                        value={row.quantity}
                        onChange={e => {
                          const val = e.target.value;
                          setProductForm(prev => {
                            const arr = [...prev.wholeWeights];
                            arr[idx] = { ...arr[idx], quantity: val };
                            return { ...prev, wholeWeights: arr };
                          });
                        }}
                        required
                        style={{ maxWidth: 120 }}
                      />
                      <Button variant="outline-danger" size="sm" onClick={() => {
                        setProductForm(prev => ({
                          ...prev,
                          wholeWeights: prev.wholeWeights.filter((_, i) => i !== idx)
                        }));
                      }} disabled={productForm.wholeWeights.length === 1}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="outline-primary" size="sm" onClick={() => setProductForm(prev => ({ ...prev, wholeWeights: [...prev.wholeWeights, { weight: '', quantity: '' }] }))}>
                    + Add Row
                  </Button>
                  <Form.Text className="text-muted d-block mt-1">Specify the number of chickens for each weight group.</Form.Text>
                </div>
              )}


              {/* Mince Option - Multiple Weights */}
              {productForm.creationOption === 'mince' && (
                <div className="mb-3">
                  <Form.Label>Chicken Mince & Wings Weights/Quantities</Form.Label>
                  {(productForm.minceWeights || [{ type: 'chicken mince', weight: '', quantity: '' }, { type: 'chicken wings', weight: '', quantity: '' }]).map((row, idx) => (
                    <div key={idx} className="d-flex align-items-center mb-2 gap-2">
                      <Form.Select
                        value={row.type}
                        onChange={e => {
                          const val = e.target.value;
                          setProductForm(prev => {
                            const arr = [...(prev.minceWeights || [])];
                            arr[idx] = { ...arr[idx], type: val };
                            return { ...prev, minceWeights: arr };
                          });
                        }}
                        style={{ maxWidth: 150 }}
                        required
                      >
                        <option value="chicken mince">Chicken Mince</option>
                        <option value="chicken wings">Chicken Wings</option>
                      </Form.Select>
                      <Form.Control
                        type="number"
                        min={0.1}
                        step={0.01}
                        placeholder="Weight (kg)"
                        value={row.weight}
                        onChange={e => {
                          const val = e.target.value;
                          setProductForm(prev => {
                            const arr = [...(prev.minceWeights || [])];
                            arr[idx] = { ...arr[idx], weight: val };
                            return { ...prev, minceWeights: arr };
                          });
                        }}
                        required
                        style={{ maxWidth: 120 }}
                      />
                      <Form.Control
                        type="number"
                        min={1}
                        placeholder="Quantity"
                        value={row.quantity}
                        onChange={e => {
                          const val = e.target.value;
                          setProductForm(prev => {
                            const arr = [...(prev.minceWeights || [])];
                            arr[idx] = { ...arr[idx], quantity: val };
                            return { ...prev, minceWeights: arr };
                          });
                        }}
                        required
                        style={{ maxWidth: 120 }}
                      />
                      <Button variant="outline-danger" size="sm" onClick={() => {
                        setProductForm(prev => ({
                          ...prev,
                          minceWeights: (prev.minceWeights || []).filter((_, i) => i !== idx)
                        }));
                      }} disabled={(productForm.minceWeights || []).length <= 2}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="outline-primary" size="sm" onClick={() => setProductForm(prev => ({ ...prev, minceWeights: [...(prev.minceWeights || []), { type: 'chicken mince', weight: '', quantity: '' }] }))}>
                    + Add Row
                  </Button>
                  <Form.Text className="text-muted d-block mt-1">Specify the number and weight for each mince or wings group.</Form.Text>
                </div>
              )}

              {/* Parts Option - Multiple Weights */}
              {productForm.creationOption === 'parts' && (
                <div className="mb-3">
                  <Form.Label>Parts Weights & Quantities</Form.Label>
                  {(productForm.partsWeights || [
                    { type: 'chicken thighs', weight: '', quantity: '' },
                    { type: 'chicken steak', weight: '', quantity: '' },
                    { type: 'chicken wings', weight: '', quantity: '' }
                  ]).map((row, idx) => (
                    <div key={idx} className="d-flex align-items-center mb-2 gap-2">
                      <Form.Select
                        value={row.type}
                        onChange={e => {
                          const val = e.target.value;
                          setProductForm(prev => {
                            const arr = [...(prev.partsWeights || [])];
                            arr[idx] = { ...arr[idx], type: val };
                            return { ...prev, partsWeights: arr };
                          });
                        }}
                        style={{ maxWidth: 150 }}
                        required
                      >
                        <option value="chicken thighs">Chicken Thighs</option>
                        <option value="chicken steak">Chicken Steak</option>
                        <option value="chicken wings">Chicken Wings</option>
                      </Form.Select>
                      <Form.Control
                        type="number"
                        min={0.1}
                        step={0.01}
                        placeholder="Weight (kg)"
                        value={row.weight}
                        onChange={e => {
                          const val = e.target.value;
                          setProductForm(prev => {
                            const arr = [...(prev.partsWeights || [])];
                            arr[idx] = { ...arr[idx], weight: val };
                            return { ...prev, partsWeights: arr };
                          });
                        }}
                        required
                        style={{ maxWidth: 120 }}
                      />
                      <Form.Control
                        type="number"
                        min={1}
                        placeholder="Quantity"
                        value={row.quantity}
                        onChange={e => {
                          const val = e.target.value;
                          setProductForm(prev => {
                            const arr = [...(prev.partsWeights || [])];
                            arr[idx] = { ...arr[idx], quantity: val };
                            return { ...prev, partsWeights: arr };
                          });
                        }}
                        required
                        style={{ maxWidth: 120 }}
                      />
                      <Button variant="outline-danger" size="sm" onClick={() => {
                        setProductForm(prev => ({
                          ...prev,
                          partsWeights: (prev.partsWeights || []).filter((_, i) => i !== idx)
                        }));
                      }} disabled={(productForm.partsWeights || []).length <= 3}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="outline-primary" size="sm" onClick={() => setProductForm(prev => ({ ...prev, partsWeights: [...(prev.partsWeights || []), { type: 'chicken thighs', weight: '', quantity: '' }] }))}>
                    + Add Row
                  </Button>
                  <Form.Text className="text-muted d-block mt-1">Specify the number and weight for each part group.</Form.Text>
                </div>
              )}

              <div className="text-end">
                <Button variant="secondary" className="me-2" onClick={()=>setShowProductModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Save Product(s)</Button>
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
