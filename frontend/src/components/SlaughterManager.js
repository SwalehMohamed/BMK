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
import { buildCsv, downloadCsv, exportPdfTable, fetchAllForExport } from '../utils/export';
// PDF autotable is imported lazily in export util

function SlaughterManager() {
  const navigate = useNavigate();
  const [slaughters, setSlaughters] = useState([]);
  const [chartSlaughters, setChartSlaughters] = useState([]);
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
    wholeWeights: [{ weight: '', quantity: '' }],
    // For mince/parts options we enforce a single uniform quantity across all rows
    uniformQuantity: ''
  });
  const [showQuickView, setShowQuickView] = useState(false);
  const [quickViewBatchId, setQuickViewBatchId] = useState('');
  const [quickViewList, setQuickViewList] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filters, setFilters] = useState({ search: '', batchId: '', dateFrom: '', dateTo: '' });
  const [batches, setBatches] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ batch_id: '', date: '', quantity: '', avg_weight: '' });

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
  fetchSlaughters(1, meta.limit);
  fetchProducts();
  fetchBatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  // refetch list and chart when filters change
  fetchSlaughters(1, meta.limit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [filters.search, filters.batchId, filters.dateFrom, filters.dateTo]);

const fetchSlaughters = async (page = meta.page, limit = meta.limit) => {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    params.set('page', String(page)); params.set('limit', String(limit));
    if (filters.search) params.set('search', filters.search);
    if (filters.batchId) params.set('batch_id', filters.batchId);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    const response = await api.get(`/slaughtered?${params.toString()}`);
    if (response.data?.data) {
      setSlaughters(response.data.data);
      if (response.data.meta) setMeta(response.data.meta);
    } else {
      const arr = response.data || [];
      setSlaughters(arr);
      setMeta(m => ({ ...m, total: arr.length, pages: 1 }));
    }
    setError('');
    // fetch expanded set for charts (limit 1000)
    try {
      const params2 = new URLSearchParams(params);
      params2.set('page','1'); params2.set('limit','1000');
      const forChart = await api.get(`/slaughtered?${params2.toString()}`);
      setChartSlaughters(forChart.data?.data || forChart.data || []);
    } catch(_) { setChartSlaughters([]); }
  } catch (error) {
    setError('Error fetching chicken slaughters');
    console.error('Error fetching chicken slaughters:', error);
    setSlaughters([]);
  }
  setLoading(false);
};


const fetchProducts = async () => {
  try {
    const res = await api.get('/products?page=1&limit=1000');
    setProducts(res.data?.data || res.data || []);
  } catch (e) {
    // Keep products empty on failure
    setProducts([]);
  }
};

const fetchBatches = async () => {
  try {
    const res = await api.get('/chicks?limit=1000');
    setBatches(res.data?.data || []);
  } catch (e) { setBatches([]); }
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
    ],
    uniformQuantity: String(s.quantity || '')
  });
  setShowProductModal(true);
};

const saveProduct = async (e) => {
  e.preventDefault();
  try {
    const { creationOption, slaughterId, wholeWeights, minceWeights, partsWeights } = productForm;
    const payload = { slaughteredId: slaughterId, option: creationOption };
    if (creationOption === 'whole') {
      if (!wholeWeights || !wholeWeights.length) return setError('Please add at least one weight group');
      const isValid = wholeWeights.every(wq => Number(wq.weight) > 0 && Number(wq.quantity) > 0);
      if (!isValid) return setError('All weights and quantities must be positive');
      payload.weights = wholeWeights.map(wq => ({ weight: Number(wq.weight), quantity: Number(wq.quantity) }));
    } else if (creationOption === 'mince') {
      if (!minceWeights || !minceWeights.length) return setError('Please add at least one mince group');
      const uq = Number(productForm.uniformQuantity);
      if (!Number.isFinite(uq) || uq <= 0) return setError('Uniform quantity must be positive');
      const adjusted = minceWeights.map(wq => ({ ...wq, quantity: uq }));
      const isValid = adjusted.every(wq => wq.type && Number(wq.weight) > 0);
      if (!isValid) return setError('All weights must be positive');
      payload.weights = adjusted.map(wq => ({ type: wq.type, weight: Number(wq.weight), quantity: uq }));
    } else if (creationOption === 'parts') {
      if (!partsWeights || !partsWeights.length) return setError('Please add at least one part group');
      const uq = Number(productForm.uniformQuantity);
      if (!Number.isFinite(uq) || uq <= 0) return setError('Uniform quantity must be positive');
      const adjusted = partsWeights.map(wq => ({ ...wq, quantity: uq }));
      const isValid = adjusted.every(wq => wq.type && Number(wq.weight) > 0);
      if (!isValid) return setError('All weights must be positive');
      payload.weights = adjusted.map(wq => ({ type: wq.type, weight: Number(wq.weight), quantity: uq }));
    } else {
      return setError('Invalid product creation option');
    }

    await api.post('/slaughtered/create-products', payload);
    setSuccess('Products created from slaughter');
    setTimeout(() => setSuccess(''), 2500);
    setShowProductModal(false);
    setError('');

    try {
      const resp = await api.get(`/products?batch_id=${encodeURIComponent(productForm.batch_id || '')}&limit=1000`);
      const list = (resp.data?.data || resp.data || []).filter(p => String(p.batch_id || '') === String(productForm.batch_id || ''));
      setQuickViewBatchId(productForm.batch_id || '');
      setQuickViewList(list);
      setShowQuickView(true);
    } catch (_) {}
    fetchSlaughters();
  } catch (err) {
    console.error('Error creating product', err);
    setError(err?.response?.data?.message || 'Error creating product');
  }
};

  // Export helpers (use current filters)
  // CSV escaping handled by shared utils (buildCsv)

  const exportSlaughterCSV = async () => {
    try {
      const rows = await fetchAllForExport('/slaughtered', {
        search: filters.search,
        batch_id: filters.batchId,
        date_from: filters.dateFrom,
        date_to: filters.dateTo
      });
      const header = ['Batch','Date','Quantity','Avg Weight','Notes'];
      const body = rows.map(r => [
        r.batch_name || `#${r.batch_id}`,
        r.date ? new Date(r.date).toISOString().slice(0,10) : '',
        r.quantity,
        (r.avg_weight ?? ''),
        (r.notes || '')
      ]);
      const csv = buildCsv(header, body);
      downloadCsv(csv, 'slaughtered');
    } catch (err) { setError('Error exporting CSV'); }
  };

  const exportSlaughterPDF = async () => {
    try {
      const rows = await fetchAllForExport('/slaughtered', {
        search: filters.search,
        batch_id: filters.batchId,
        date_from: filters.dateFrom,
        date_to: filters.dateTo
      });
      const head = [['Batch','Date','Quantity','Avg Wt','Notes']];
      const body = rows.map(r => [
        r.batch_name || `#${r.batch_id}`,
        r.date ? new Date(r.date).toLocaleDateString() : '-',
        r.quantity,
        r.avg_weight ?? '-',
        (r.notes || '').slice(0,40)
      ]);
      exportPdfTable({ title: 'Slaughter Records', head, body, fileName: 'slaughtered', headColor: [44,160,44] });
    } catch (err) { setError('Error exporting PDF'); }
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
                <div className="col-md-3">
                  <label className="form-label small">Search</label>
                  <input type="text" className="form-control form-control-sm" placeholder="batch or notes…" value={filters.search} onChange={(e)=>setFilters(f=>({...f,search:e.target.value}))} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small">Batch</label>
                  <select className="form-select form-select-sm" value={filters.batchId} onChange={(e)=>setFilters(f=>({...f,batchId:e.target.value}))}>
                    <option value="">All</option>
                    {(batches||[]).map(b => <option key={b.id} value={b.id}>{b.batch_name}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label small">From</label>
                  <input type="date" className="form-control form-control-sm" value={filters.dateFrom} onChange={(e)=>setFilters(f=>({...f,dateFrom:e.target.value}))} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small">To</label>
                  <input type="date" className="form-control form-control-sm" value={filters.dateTo} onChange={(e)=>setFilters(f=>({...f,dateTo:e.target.value}))} />
                </div>
                <div className="col-md-3 d-flex align-items-end gap-2">
                  <Button size="sm" variant="secondary" onClick={()=>setFilters({ search:'', batchId:'', dateFrom:'', dateTo:'' })}>Reset</Button>
                  <Button size="sm" variant="outline-primary" onClick={exportSlaughterCSV}>CSV</Button>
                  <Button size="sm" variant="outline-primary" onClick={exportSlaughterPDF}>PDF</Button>
                </div>
              </div>
              <div className="card mt-3 mb-3">
                <div className="card-body">
                  <h6 className="mb-2">Slaughtered per Batch</h6>
                  <div style={{width:'100%', height:300}}>
                    <ResponsiveContainer>
                      <BarChart data={aggregatePerBatch(chartSlaughters, filters.dateFrom, filters.dateTo)}>
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
                      <BarChart data={aggregateProductsPerBatch(products, filters.dateFrom, filters.dateTo, filters.batchId)}>
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
                      <td>
                        {editingId === s.id ? (
                          <Form.Control value={editForm.batch_id} onChange={(e)=>setEditForm(prev=>({...prev,batch_id:e.target.value}))} />
                        ) : (s.batch_name || `Batch #${s.batch_id}`)}
                      </td>
                      <td>
                        {editingId === s.id ? (
                          <Form.Control type="date" value={editForm.date} onChange={(e)=>setEditForm(prev=>({...prev,date:e.target.value}))} />
                        ) : new Date(s.date).toLocaleDateString()}
                      </td>
                      <td>
                        {editingId === s.id ? (
                          <Form.Control type="number" min={1} value={editForm.quantity} onChange={(e)=>setEditForm(prev=>({...prev,quantity:e.target.value}))} />
                        ) : s.quantity}
                      </td>
                      <td>
                        {editingId === s.id ? (
                          <Form.Control type="number" min={0} step={0.01} value={editForm.avg_weight} onChange={(e)=>setEditForm(prev=>({...prev,avg_weight:e.target.value}))} />
                        ) : (s.avg_weight ?? '-')}
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          {editingId === s.id ? (
                            <>
                              <Button variant="success" onClick={async ()=>{
                                try {
                                  const payload = {
                                    batch_id: editForm.batch_id ? Number(editForm.batch_id) : Number(s.batch_id),
                                    date: editForm.date || s.date,
                                    quantity: Number(editForm.quantity),
                                    avg_weight: editForm.avg_weight ? Number(editForm.avg_weight) : null
                                  };
                                  await api.put(`/slaughtered/${s.id}`, payload);
                                  setSuccess('Slaughter record updated'); setTimeout(()=>setSuccess(''), 2000);
                                  setEditingId(null);
                                  fetchSlaughters();
                                } catch (err) {
                                  setError(err?.response?.data?.message || 'Error updating slaughter record');
                                }
                              }}>Save</Button>
                              <Button variant="secondary" onClick={()=>setEditingId(null)}>Cancel</Button>
                            </>
                          ) : (
                            <>
                              <Button variant="outline-secondary" onClick={() => openCreateProduct(s)}>Create Product</Button>
                              <Button variant="outline-primary" onClick={() => { setEditingId(s.id); setEditForm({ batch_id: s.batch_id || '', date: String(s.date).slice(0,10), quantity: s.quantity, avg_weight: s.avg_weight ?? '' }); }}>Edit</Button>
                              <Button variant="outline-danger" onClick={() => handleDeleteSlaughter(s.id)}>Delete</Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {/* Pagination */}
              <div className="d-flex justify-content-between align-items-center mt-2">
                <div className="small text-muted">Page {meta.page} of {meta.pages} | Total {meta.total}</div>
                <div className="d-flex gap-2 align-items-center">
                  <Form.Select size="sm" value={meta.limit} onChange={(e)=>{ const lim = Number(e.target.value); setMeta(m=>({...m,limit:lim})); fetchSlaughters(1, lim); }}>
                    {[10,20,50,100].map(sz => <option key={sz} value={sz}>{sz}/page</option>)}
                  </Form.Select>
                  <Button size="sm" variant="outline-secondary" disabled={meta.page<=1} onClick={()=>fetchSlaughters(meta.page-1, meta.limit)}>Prev</Button>
                  <Button size="sm" variant="outline-secondary" disabled={meta.page>=meta.pages} onClick={()=>fetchSlaughters(meta.page+1, meta.limit)}>Next</Button>
                </div>
              </div>
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
                  <Form.Label>Whole Chicken Weights</Form.Label>
                  <div className="d-flex align-items-center mb-2 gap-2">
                    <Form.Label className="me-2 mb-0 small text-muted">Uniform Quantity (number of chickens)</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={productForm.uniformQuantity}
                      onChange={e => {
                        const val = e.target.value;
                        setProductForm(prev => ({ ...prev, uniformQuantity: val }));
                      }}
                      required
                      style={{ maxWidth: 160 }}
                    />
                  </div>
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
                        value={productForm.uniformQuantity}
                        disabled
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
                  <Form.Text className="text-muted d-block mt-1">All whole sub-products use the same uniform quantity.</Form.Text>
                </div>
              )}


              {/* Mince Option - Multiple Weights */}
              {productForm.creationOption === 'mince' && (
                <div className="mb-3">
                  <Form.Label>Chicken Mince & Wings Weights/Quantities</Form.Label>
                  <div className="d-flex align-items-center mb-2 gap-2">
                    <Form.Label className="me-2 mb-0 small text-muted">Uniform Quantity (number of chickens)</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={productForm.uniformQuantity}
                      onChange={e => {
                        const val = e.target.value;
                        setProductForm(prev => ({ ...prev, uniformQuantity: val }));
                      }}
                      required
                      style={{ maxWidth: 160 }}
                    />
                  </div>
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
                        value={productForm.uniformQuantity}
                        disabled
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
                  <div className="d-flex align-items-center mb-2 gap-2">
                    <Form.Label className="me-2 mb-0 small text-muted">Uniform Quantity (number of chickens)</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={productForm.uniformQuantity}
                      onChange={e => {
                        const val = e.target.value;
                        setProductForm(prev => ({ ...prev, uniformQuantity: val }));
                      }}
                      required
                      style={{ maxWidth: 160 }}
                    />
                  </div>
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
                        value={productForm.uniformQuantity}
                        disabled
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

function aggregateProductsPerBatch(products, fromDate, toDate, batchFilter) {
  const map = new Map();
  const df = fromDate ? new Date(fromDate) : null;
  const dt = toDate ? new Date(toDate) : null;
  (products || []).forEach(p => {
    // date filter applies to created_at if available
    const d = p.created_at ? new Date(p.created_at) : null;
    if (df && (!d || d < df)) return;
    if (dt && (!d || d > dt)) return;
    if (batchFilter && String(p.batch_id || '') !== String(batchFilter)) return;
    const key = p.batch_name || (p.batch_id ? `#${p.batch_id}` : 'Unlinked');
    map.set(key, (map.get(key) || 0) + Number(p.packaged_quantity || 0));
  });
  return Array.from(map.entries()).map(([batch, packaged]) => ({ batch, packaged }));
}

