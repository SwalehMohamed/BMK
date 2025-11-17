import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Alert, Spinner, Card, Form, Button, Modal, Table } from 'react-bootstrap';
// Export utilities centralized
import { buildCsv, downloadCsv, exportPdfTable, fetchAllForExport } from '../utils/export';
import { useAuth } from '../context/AuthContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const ChickManager = () => {
  const { currentUser } = useAuth();
  const [chicks, setChicks] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filters, setFilters] = useState({ search: '', breed: '', supplier: '', dateFrom: '', dateTo: '' });
  const [batchName, setBatchName] = useState('');
  const [breed, setBreed] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [initialCount, setInitialCount] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  // UI state for expanded batch details
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [feedHistory, setFeedHistory] = useState({}); // { [batchId]: [...] }
  const [mortalities, setMortalities] = useState({}); // { [batchId]: [...] }
  const [mortalityForm, setMortalityForm] = useState({}); // { [batchId]: { date, number_dead, reason } }
  const [slaughterForm, setSlaughterForm] = useState({}); // { [batchId]: { date, quantity, avg_weight, notes } }
  const [slaughtersByBatch, setSlaughtersByBatch] = useState({}); // { [batchId]: [...] }
  const [totalDeaths, setTotalDeaths] = useState(null);
  const [totalChicks, setTotalChicks] = useState(null);

  useEffect(() => {
    fetchChicks(1, meta.limit);
    // Also fetch total deaths for a simple stat header
    api.get('/dashboard')
      .then(res => {
        setTotalDeaths(res?.data?.total_dead ?? null);
        setTotalChicks(res?.data?.total_chicks ?? null);
      })
      .catch(() => { setTotalDeaths(null); setTotalChicks(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // refetch when filters change
    fetchChicks(1, meta.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.breed, filters.supplier, filters.dateFrom, filters.dateTo]);

  const fetchChicks = async (page = meta.page, limit = meta.limit) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (filters.search) params.set('search', filters.search);
      if (filters.breed) params.set('breed', filters.breed);
      if (filters.supplier) params.set('supplier', filters.supplier);
      if (filters.dateFrom) params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params.set('date_to', filters.dateTo);
      const response = await api.get(`/chicks?${params.toString()}`);
      if (response.data?.data) {
        setChicks(response.data.data);
        if (response.data.meta) setMeta(response.data.meta);
      } else {
        setChicks(response.data || []);
        setMeta(m => ({ ...m, total: (response.data || []).length, pages: 1 }));
      }
      setError('');
    } catch (error) {
      setError(error?.response?.data?.message || 'Error fetching chicks');
      console.error('Error fetching chicks:', error);
      setChicks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchFeedHistory = async (batchId) => {
    try {
      const res = await api.get(`/chicks/${batchId}/feed-usage`);
      const rows = res.data?.data || [];
      // Sort client-side as added safeguard (backend already sorts)
      rows.sort((a,b)=>{
        const da = a.date_used ? new Date(a.date_used) : (a.used_at ? new Date(a.used_at) : 0);
        const db = b.date_used ? new Date(b.date_used) : (b.used_at ? new Date(b.used_at) : 0);
        return db - da; // desc
      });
      setFeedHistory((prev) => ({ ...prev, [batchId]: rows }));
    } catch (err) {
      console.error('Error fetching feed history:', err);
      setFeedHistory((prev) => ({ ...prev, [batchId]: [] }));
    }
  };

  const fetchBatchMortalities = async (batchId) => {
    try {
      const res = await api.get(`/chicks/${batchId}/mortalities`);
      setMortalities((prev) => ({ ...prev, [batchId]: res.data.data || [] }));
    } catch (err) {
      console.error('Error fetching mortalities:', err);
      setMortalities((prev) => ({ ...prev, [batchId]: [] }));
    }
  };

  const fetchBatchSlaughters = async (batchId) => {
    try {
      // Fetch slaughters for a batch using server-side filter
      const res = await api.get(`/slaughtered?batch_id=${encodeURIComponent(batchId)}&page=1&limit=1000`);
      const list = res.data?.data || res.data || [];
      setSlaughtersByBatch(prev => ({ ...prev, [batchId]: list }));
    } catch (err) {
      console.error('Error fetching slaughters:', err);
      setSlaughtersByBatch(prev => ({ ...prev, [batchId]: [] }));
    }
  };

  const toggleExpand = async (batchId) => {
    const newId = expandedBatchId === batchId ? null : batchId;
    setExpandedBatchId(newId);
    if (newId) {
      await Promise.all([
        fetchBatchFeedHistory(newId),
        fetchBatchMortalities(newId),
        fetchBatchSlaughters(newId)
      ]);
      if (!mortalityForm[newId]) {
        setMortalityForm((prev) => ({ ...prev, [newId]: { date: '', number_dead: '', reason: '' } }));
      }
      if (!slaughterForm[newId]) {
        setSlaughterForm((prev) => ({ ...prev, [newId]: { date: '', quantity: '', avg_weight: '', notes: '' } }));
      }
    }
  };

  const submitMortality = async (batchId) => {
    const form = mortalityForm[batchId] || {};
    try {
      await api.post(`/chicks/${batchId}/mortalities`, {
        date: form.date,
        number_dead: Number(form.number_dead),
        reason: form.reason || ''
      });
      setSuccess('Mortality recorded');
      setTimeout(() => setSuccess(''), 3000);
      // refresh batch details and main list
      await Promise.all([fetchBatchMortalities(batchId), fetchChicks()]);
      setError('');
      setMortalityForm((prev) => ({ ...prev, [batchId]: { date: '', number_dead: '', reason: '' } }));
    } catch (err) {
      console.error('Error recording mortality:', err);
      setError(err?.response?.data?.message || 'Error recording mortality');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const newChick = {
        batch_name: batchName,
        breed,
        arrival_date: arrivalDate,
        supplier,
        initial_count: initialCount,
      };
      await api.post('/chicks', newChick);
      fetchChicks(1, meta.limit); // Refresh the list starting page
      setSuccess('Chick added successfully');
      setTimeout(() => setSuccess(''), 3000);
      clearForm();
      setShowAdd(false);
      setError('');
    } catch (error) {
      setError('Error adding chick');
      console.error('Error adding chick:', error);
    }
  };

  // Editing state
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const openEdit = (batch) => {
    setEditId(batch.id);
    setEditForm({
      batch_name: batch.batch_name || '',
      breed: batch.breed || '',
      arrival_date: batch.arrival_date ? batch.arrival_date.substring(0,10) : '',
      supplier: batch.supplier || '',
      initial_count: batch.initial_count || ''
    });
    setShowEdit(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...editForm, initial_count: Number(editForm.initial_count) };
      await api.put(`/chicks/${editId}`, payload);
      setSuccess('Batch updated');
      setTimeout(() => setSuccess(''), 2500);
      setShowEdit(false); setEditId(null);
      await fetchChicks(meta.page, meta.limit);
    } catch (err) {
      console.error('Error updating batch', err);
      setError(err?.response?.data?.message || 'Error updating batch');
    }
  };

  const deleteBatch = async (id) => {
    if (!window.confirm('Delete this chick batch? This is irreversible.')) return;
    try {
      await api.delete(`/chicks/${id}`);
      setSuccess('Batch deleted');
      setTimeout(() => setSuccess(''), 2500);
      if (expandedBatchId === id) setExpandedBatchId(null);
      const targetPage = (chicks.length === 1 && meta.page > 1) ? meta.page - 1 : meta.page;
      await fetchChicks(targetPage, meta.limit);
    } catch (err) {
      console.error('Error deleting batch', err);
      setError(err?.response?.data?.message || 'Error deleting batch');
    }
  };

  // Export helpers
  const exportChicksCSV = async () => {
    try {
      const rows = await fetchAllForExport('/chicks', {
        search: filters.search,
        breed: filters.breed,
        supplier: filters.supplier,
        date_from: filters.dateFrom,
        date_to: filters.dateTo
      });
      const header = ['Arrival Date','Batch','Breed','Supplier','Initial','Deaths','Slaughtered','Current'];
      const body = rows.map(r => [
        r.arrival_date ? new Date(r.arrival_date).toISOString().slice(0,10) : '',
        r.batch_name,
        r.breed,
        r.supplier,
        r.initial_count,
        r.total_deaths ?? 0,
        r.total_slaughtered ?? 0,
        (r.current_count ?? (r.initial_count - (r.total_deaths||0) - (r.total_slaughtered||0)))
      ]);
      const csv = buildCsv(header, body);
      downloadCsv(csv, 'chicks-export');
    } catch (err) { setError('Error exporting CSV'); }
  };

  const exportChicksPDF = async () => {
    try {
      const rows = await fetchAllForExport('/chicks', {
        search: filters.search,
        breed: filters.breed,
        supplier: filters.supplier,
        date_from: filters.dateFrom,
        date_to: filters.dateTo
      });
      const head = [['Arrival','Batch','Breed','Supplier','Initial','Deaths','Slaught.','Current']];
      const body = rows.map(r => [
        r.arrival_date ? new Date(r.arrival_date).toLocaleDateString() : '-',
        r.batch_name,
        r.breed,
        r.supplier,
        r.initial_count,
        r.total_deaths ?? 0,
        r.total_slaughtered ?? 0,
        (r.current_count ?? (r.initial_count - (r.total_deaths||0) - (r.total_slaughtered||0)))
      ]);
      exportPdfTable({ title: 'Chick Batches', head, body, fileName: 'chicks-export' });
    } catch (err) { setError('Error exporting PDF'); }
  };

  // escapeCsv now provided by shared utils (used indirectly in buildCsv)

  const clearForm = () => {
    setBatchName('');
    setBreed('');
    setArrivalDate('');
    setSupplier('');
    setInitialCount('');
  };

  const submitSlaughter = async (batchId, availableCount) => {
    const form = slaughterForm[batchId] || {};
    try {
      const qty = Number(form.quantity);
      if (!qty || qty < 1) {
        return setError('Quantity must be at least 1');
      }
      if (qty > Number(availableCount || 0)) {
        return setError('Quantity exceeds available live birds for this batch');
      }
      await api.post(`/slaughtered`, {
        batch_id: batchId,
        date: form.date,
        quantity: qty,
        avg_weight: form.avg_weight ? Number(form.avg_weight) : undefined,
        notes: form.notes || ''
      });
      setSuccess('Slaughter recorded');
      setTimeout(() => setSuccess(''), 3000);
      await fetchChicks();
      await fetchBatchSlaughters(batchId);
      setSlaughterForm((prev) => ({ ...prev, [batchId]: { date: '', quantity: '', avg_weight: '', notes: '' } }));
      setError('');
    } catch (err) {
      console.error('Error recording slaughter:', err);
      setError(err?.response?.data?.message || 'Error recording slaughter');
    }
  };

  return (
    <div className="container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Chick Manager</h2>
        <div className="d-flex gap-2 align-items-center">
          <Button size="sm" onClick={()=>setShowAdd(true)}>Add Chick</Button>
          {totalChicks != null && (
            <div className="badge bg-primary" title="Total chicks (all time)">Total Chicks: {totalChicks}</div>
          )}
          {totalDeaths != null && (
            <div className="badge bg-danger" title="Total deaths (all time)">Total Deaths: {totalDeaths}</div>
          )}
        </div>
      </div>

      {/* Charts: Breed Distribution and Batch Age */}
      <div className="row g-3 mb-4">
        <div className="col-lg-6">
          <Card className="card-modern h-100">
            <Card.Header className="card-header-modern">Breed Distribution</Card.Header>
            <Card.Body>
              <div style={{width:'100%', height:300}}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={computeBreedDistribution(chicks)} dataKey="value" nameKey="name" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100}>
                      {computeBreedDistribution(chicks).map((entry, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card className="card-modern h-100">
            <Card.Header className="card-header-modern">Age Distribution (days, buckets)</Card.Header>
            <Card.Body>
              <div style={{width:'100%', height:300}}>
                <ResponsiveContainer>
                  <BarChart data={computeAgeBuckets(chicks)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Batches" fill="#1f77b4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      {loading ? (
        <div className="d-flex justify-content-center my-4">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : (
        <>
      {/* Filters */}
      <Form className="mb-3">
        <div className="row g-2">
          <div className="col-md-3">
            <Form.Label className="small mb-1">Search</Form.Label>
            <Form.Control placeholder="batch, breed, supplier" value={filters.search} onChange={(e)=>setFilters(f=>({...f,search:e.target.value}))} />
          </div>
          <div className="col-md-2">
            <Form.Label className="small mb-1">Breed</Form.Label>
            <Form.Control value={filters.breed} onChange={(e)=>setFilters(f=>({...f,breed:e.target.value}))} />
          </div>
            <div className="col-md-2">
            <Form.Label className="small mb-1">Supplier</Form.Label>
            <Form.Control value={filters.supplier} onChange={(e)=>setFilters(f=>({...f,supplier:e.target.value}))} />
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
            <Button size="sm" variant="secondary" className="w-100" onClick={()=>setFilters({search:'',breed:'',supplier:'',dateFrom:'',dateTo:''})}>Reset</Button>
          </div>
          <div className="col-md-2 d-flex align-items-end gap-2">
            <Button size="sm" variant="outline-primary" className="w-100" onClick={exportChicksCSV}>Export CSV</Button>
            <Button size="sm" variant="outline-primary" className="w-100" onClick={exportChicksPDF}>Export PDF</Button>
          </div>
        </div>
      </Form>

      {/* Add Chick Modal */}
      <Modal show={showAdd} onHide={()=>setShowAdd(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Chick Batch</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-2">
              <Form.Label>Batch Name</Form.Label>
              <Form.Control value={batchName} onChange={(e)=>setBatchName(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Breed</Form.Label>
              <Form.Control value={breed} onChange={(e)=>setBreed(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Arrival Date</Form.Label>
              <Form.Control type="date" value={arrivalDate} onChange={(e)=>setArrivalDate(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Supplier</Form.Label>
              <Form.Control value={supplier} onChange={(e)=>setSupplier(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Initial Count</Form.Label>
              <Form.Control type="number" min={1} value={initialCount} onChange={(e)=>setInitialCount(e.target.value)} required />
            </Form.Group>
            <div className="text-end">
              <Button variant="secondary" className="me-2" onClick={()=>setShowAdd(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      <h3>Chick Batches</h3>
      <div className="table-responsive">
        <Table bordered size="sm" className="align-middle">
          <thead>
            <tr>
              <th>Arrival Date</th>
              <th>Batch</th>
              <th>Breed</th>
              <th>Supplier</th>
              <th>Initial</th>
              <th>Deaths</th>
              <th>Slaughtered</th>
              <th>Current</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {chicks.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-muted">No batches found.</td></tr>
            ) : chicks.map(chick => (
              <tr key={chick.id} className={expandedBatchId === chick.id ? 'table-active' : ''}>
                <td>{chick.arrival_date ? new Date(chick.arrival_date).toLocaleDateString() : '-'}</td>
                <td>{chick.batch_name}</td>
                <td>{chick.breed}</td>
                <td>{chick.supplier}</td>
                <td>{chick.initial_count}</td>
                <td>{chick.total_deaths ?? 0}</td>
                <td>{chick.total_slaughtered ?? 0}</td>
                <td>{chick.current_count ?? (chick.initial_count - (chick.total_deaths||0) - (chick.total_slaughtered||0))}</td>
                <td className="text-end">
                  <div className="btn-group btn-group-sm">
                    <Button variant="outline-secondary" onClick={()=>toggleExpand(chick.id)}>{expandedBatchId === chick.id ? 'Hide' : 'Details'}</Button>
                    <Button variant="outline-primary" onClick={()=>openEdit(chick)}>Edit</Button>
                    {currentUser?.role === 'admin' && <Button variant="outline-danger" onClick={()=>deleteBatch(chick.id)}>Delete</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {/* Pagination Controls */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="small text-muted">Page {meta.page} of {meta.pages} | Total {meta.total} batches</div>
        <div className="d-flex gap-2 align-items-center">
          <Form.Select size="sm" value={meta.limit} onChange={(e)=>{ const lim = Number(e.target.value); setMeta(m=>({...m, limit: lim })); fetchChicks(1, lim); }}>
            {[10,20,50,100].map(sz => <option key={sz} value={sz}>{sz}/page</option>)}
          </Form.Select>
          <Button size="sm" variant="outline-secondary" disabled={meta.page<=1} onClick={()=>fetchChicks(meta.page-1, meta.limit)}>Prev</Button>
          <Button size="sm" variant="outline-secondary" disabled={meta.page>=meta.pages} onClick={()=>fetchChicks(meta.page+1, meta.limit)}>Next</Button>
        </div>
      </div>

      {/* Expanded row details */}
      {expandedBatchId && (
        <div className="border rounded p-3 mb-4 bg-white">
          {(() => {
            const chick = chicks.find(c=>c.id===expandedBatchId);
            if (!chick) return null;
            return (
              <>
                <h5 className="mb-3">Batch Details – {chick.batch_name}</h5>
                <div className="row">
                  <div className="col-lg-6">
                    <h6>Feed History</h6>
                    <div className="table-responsive">
                      <Table size="sm" bordered>
                        <thead><tr><th>Date Used</th><th>Feed</th><th>Qty (kg)</th></tr></thead>
                        <tbody>
                          {(feedHistory[chick.id]||[]).length===0 ? (
                            <tr><td colSpan={3} className="text-center text-muted">No feed usage for this batch.</td></tr>
                          ) : (
                            (feedHistory[chick.id]||[]).map(fh => (
                              <tr key={fh.id}>
                                <td>{fh.date_used ? new Date(fh.date_used).toLocaleDateString() : (fh.used_at ? new Date(fh.used_at).toLocaleString() : '-')}</td>
                                <td className="text-capitalize">{fh.type || '-'}</td>
                                <td>{(fh.quantity_used ?? fh.amount_used ?? '-')}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                  <div className="col-lg-3">
                    <h6>Record Mortality</h6>
                    <Form className="small" onSubmit={(e)=>{e.preventDefault(); submitMortality(chick.id);}}>
                      <Form.Group className="mb-1">
                        <Form.Label>Date</Form.Label>
                        <Form.Control type="date" value={(mortalityForm[chick.id]?.date)||''} onChange={(e)=>setMortalityForm(p=>({...p,[chick.id]:{...(p[chick.id]||{}),date:e.target.value}}))} />
                      </Form.Group>
                      <Form.Group className="mb-1">
                        <Form.Label>Number Dead</Form.Label>
                        <Form.Control type="number" min={1} value={(mortalityForm[chick.id]?.number_dead)||''} onChange={(e)=>setMortalityForm(p=>({...p,[chick.id]:{...(p[chick.id]||{}),number_dead:e.target.value}}))} />
                      </Form.Group>
                      <Form.Group className="mb-2">
                        <Form.Label>Reason</Form.Label>
                        <Form.Control value={(mortalityForm[chick.id]?.reason)||''} onChange={(e)=>setMortalityForm(p=>({...p,[chick.id]:{...(p[chick.id]||{}),reason:e.target.value}}))} />
                      </Form.Group>
                      <Button size="sm" type="submit" variant="danger" disabled={!mortalityForm[chick.id]?.date || !mortalityForm[chick.id]?.number_dead}>Save</Button>
                    </Form>
                  </div>
                  <div className="col-lg-3">
                    <h6>Add Slaughter</h6>
                    <Form className="small" onSubmit={(e)=>{e.preventDefault(); submitSlaughter(chick.id, chick.current_count ?? (chick.initial_count - (chick.total_deaths||0) - (chick.total_slaughtered||0)));}}>
                      <Form.Group className="mb-1">
                        <Form.Label>Date</Form.Label>
                        <Form.Control type="date" value={(slaughterForm[chick.id]?.date)||''} onChange={(e)=>setSlaughterForm(p=>({...p,[chick.id]:{...(p[chick.id]||{}),date:e.target.value}}))} />
                      </Form.Group>
                      <Form.Group className="mb-1">
                        <Form.Label>Quantity (max {chick.current_count ?? (chick.initial_count - (chick.total_deaths||0) - (chick.total_slaughtered||0))})</Form.Label>
                        <Form.Control type="number" min={1} value={(slaughterForm[chick.id]?.quantity)||''} onChange={(e)=>setSlaughterForm(p=>({...p,[chick.id]:{...(p[chick.id]||{}),quantity:e.target.value}}))} />
                      </Form.Group>
                      <Form.Group className="mb-1">
                        <Form.Label>Avg Weight (kg)</Form.Label>
                        <Form.Control type="number" min={0} step={0.01} value={(slaughterForm[chick.id]?.avg_weight)||''} onChange={(e)=>setSlaughterForm(p=>({...p,[chick.id]:{...(p[chick.id]||{}),avg_weight:e.target.value}}))} />
                      </Form.Group>
                      <Form.Group className="mb-2">
                        <Form.Label>Notes</Form.Label>
                        <Form.Control value={(slaughterForm[chick.id]?.notes)||''} onChange={(e)=>setSlaughterForm(p=>({...p,[chick.id]:{...(p[chick.id]||{}),notes:e.target.value}}))} />
                      </Form.Group>
                      <Button size="sm" type="submit" variant="success" disabled={!slaughterForm[chick.id]?.date || !slaughterForm[chick.id]?.quantity}>Save</Button>
                    </Form>
                  </div>
                </div>
                <div className="row mt-3">
                  <div className="col-lg-6">
                    <h6>Recent Mortalities</h6>
                    <ul className="list-group small">
                      {(mortalities[chick.id]||[]).length===0 ? <li className="list-group-item text-muted">No mortalities recorded.</li> : (mortalities[chick.id]||[]).map(m => (
                        <li key={m.id} className="list-group-item d-flex justify-content-between"><span>{new Date(m.date).toLocaleDateString()} - {m.number_dead} dead {m.reason?`(${m.reason})`:''}</span></li>
                      ))}
                    </ul>
                  </div>
                  <div className="col-lg-6">
                    <h6>Recent Slaughters</h6>
                    <ul className="list-group small">
                      {(slaughtersByBatch[chick.id]||[]).length===0 ? <li className="list-group-item text-muted">No slaughters recorded.</li> : (slaughtersByBatch[chick.id]||[]).slice(0,5).map(s => (
                        <li key={s.id} className="list-group-item d-flex justify-content-between"><span>{s.date ? new Date(s.date).toLocaleDateString() : '-'} — Qty: {s.quantity} {s.avg_weight ? `(avg wt ${s.avg_weight} kg)` : ''}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
      {/* Edit Modal */}
      <Modal show={showEdit} onHide={()=>setShowEdit(false)}>
        <Modal.Header closeButton><Modal.Title>Edit Chick Batch</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form onSubmit={saveEdit}>
            <Form.Group className="mb-2">
              <Form.Label>Batch Name</Form.Label>
              <Form.Control value={editForm.batch_name||''} onChange={(e)=>setEditForm(f=>({...f,batch_name:e.target.value}))} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Breed</Form.Label>
              <Form.Control value={editForm.breed||''} onChange={(e)=>setEditForm(f=>({...f,breed:e.target.value}))} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Arrival Date</Form.Label>
              <Form.Control type="date" value={editForm.arrival_date||''} onChange={(e)=>setEditForm(f=>({...f,arrival_date:e.target.value}))} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Supplier</Form.Label>
              <Form.Control value={editForm.supplier||''} onChange={(e)=>setEditForm(f=>({...f,supplier:e.target.value}))} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Initial Count</Form.Label>
              <Form.Control type="number" min={1} value={editForm.initial_count||''} onChange={(e)=>setEditForm(f=>({...f,initial_count:e.target.value}))} required />
            </Form.Group>
            <Button type="submit">Save</Button>
          </Form>
        </Modal.Body>
      </Modal>
      </>
      )}
    </div>
  );
};

export default ChickManager;

// Helpers for charts
const PIE_COLORS = ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];

function computeBreedDistribution(chicks) {
  const map = new Map();
  (chicks?.data || chicks || []).forEach(c => {
    const b = (c.breed || 'Unknown').trim();
    map.set(b, (map.get(b) || 0) + 1);
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function computeAgeBuckets(chicks) {
  const now = new Date();
  const buckets = [
    { label: '0-7', min: 0, max: 7 },
    { label: '8-14', min: 8, max: 14 },
    { label: '15-21', min: 15, max: 21 },
    { label: '22-28', min: 22, max: 28 },
    { label: '29-60', min: 29, max: 60 },
    { label: '61-90', min: 61, max: 90 },
    { label: '90+', min: 91, max: Infinity },
  ];
  const counts = new Map(buckets.map(b => [b.label, 0]));
  (chicks?.data || chicks || []).forEach(c => {
    const d = c.arrival_date ? new Date(c.arrival_date) : now;
    const age = Math.max(0, Math.floor((now - d) / (1000*60*60*24)));
    const bucket = buckets.find(b => age >= b.min && age <= b.max) || buckets[buckets.length - 1];
    counts.set(bucket.label, (counts.get(bucket.label) || 0) + 1);
  });
  return buckets.map(b => ({ bucket: b.label, count: counts.get(b.label) || 0 }));
}
