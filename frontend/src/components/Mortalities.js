import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

function Mortalities() {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ chick_batch_id: '', date: '', number_dead: '', reason: '' });
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ batchId: '', dateFrom: '', dateTo: '' });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ chick_batch_id: '', date: new Date().toISOString().slice(0,10), number_dead: '', reason: '' });
  const [chartBatchId, setChartBatchId] = useState('');

  const fetchAll = async (page = meta.page, limit = meta.limit) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (filters.batchId) params.set('batch_id', filters.batchId);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      const [mRes, bRes] = await Promise.all([
        api.get(`/mortalities?${params.toString()}`),
        api.get('/chicks?limit=1000')
      ]);
      if (mRes.data?.data) {
        setRows(mRes.data.data);
        if (mRes.data.meta) setMeta(mRes.data.meta);
      } else {
        setRows(mRes.data || []);
        setMeta(m => ({ ...m, total: (mRes.data || []).length, pages: 1 }));
      }
      setBatches(bRes.data?.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching mortalities', err);
      setError(err?.response?.data?.message || 'Error fetching mortalities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(1, meta.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { fetchAll(1, meta.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.batchId, filters.dateFrom, filters.dateTo]);
  useEffect(() => { setChartBatchId(filters.batchId || ''); }, [filters.batchId]);

  const filtered = useMemo(() => {
    const df = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const dt = filters.dateTo ? new Date(filters.dateTo) : null;
    return (rows || []).filter(r => {
      const bOk = filters.batchId ? String(r.chick_batch_id || '').trim() === String(filters.batchId).trim() : true;
      const d = r.date ? new Date(r.date) : null;
      const dfOk = df ? (d && d >= df) : true;
      const dtOk = dt ? (d && d <= dt) : true;
      return bOk && dfOk && dtOk;
    });
  }, [rows, filters]);

  const summary = useMemo(() => {
    const count = (rows || []).length;
    const totalDead = (rows || []).reduce((a, r) => a + Number(r.number_dead || 0), 0);
    return { count, totalDead };
  }, [rows]);

  const addMortality = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, chick_batch_id: Number(form.chick_batch_id), number_dead: Number(form.number_dead) };
      await api.post('/mortalities', payload);
      setSuccess('Mortality recorded');
      setTimeout(() => setSuccess(''), 2000);
      setShowModal(false);
      setForm({ chick_batch_id: '', date: new Date().toISOString().slice(0,10), number_dead: '', reason: '' });
      await fetchAll();
    } catch (err) {
      console.error('Error creating mortality', err);
      setError(err?.response?.data?.message || 'Error creating mortality');
    }
  };

  const removeMortality = async (id) => {
    if (!window.confirm('Delete this mortality record?')) return;
    try { await api.delete(`/mortalities/${id}`); await fetchAll(); }
    catch (err) { console.error('Error deleting mortality', err); setError(err?.response?.data?.message || 'Error deleting mortality'); }
  };

  // Build chart data: sum deaths per day for selected chart batch (or all)
  const chartData = useMemo(() => {
    const source = rows || [];
    const filteredByBatch = chartBatchId ? source.filter(r => String(r.chick_batch_id) === String(chartBatchId)) : source;
    const map = new Map();
    for (const r of filteredByBatch) {
      const key = r.date || '';
      if (!key) continue;
      const prev = map.get(key) || 0;
      map.set(key, prev + Number(r.number_dead || 0));
    }
    return Array.from(map.entries())
      .sort((a,b) => (new Date(a[0]) - new Date(b[0])))
      .map(([date, total]) => ({ date, total }));
  }, [rows, chartBatchId]);

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Mortalities</h2>
        <Button onClick={() => setShowModal(true)} disabled={loading}>Record Mortality</Button>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div className="d-flex flex-wrap gap-3 mb-3 small text-muted">
        <div className="badge bg-secondary">Records (page): {summary.count}</div>
        <div className="badge bg-danger">Total Dead (page): {summary.totalDead}</div>
        <div className="badge bg-light text-dark">Page {meta.page} of {meta.pages} • Total {meta.total}</div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-3">
          <Form.Label className="small mb-1">Batch</Form.Label>
          <Form.Select value={filters.batchId} onChange={(e)=>setFilters(prev=>({...prev,batchId:e.target.value}))}>
            <option value="">All</option>
            {(batches||[]).map(b => (
              <option key={b.id} value={b.id}>{b.batch_name}</option>
            ))}
          </Form.Select>
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-1">From</Form.Label>
          <Form.Control type="date" value={filters.dateFrom} onChange={(e)=>setFilters(prev=>({...prev,dateFrom:e.target.value}))} />
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-1">To</Form.Label>
          <Form.Control type="date" value={filters.dateTo} onChange={(e)=>setFilters(prev=>({...prev,dateTo:e.target.value}))} />
        </div>
        <div className="col-md-3">
          <Form.Label className="small mb-1">Chart Batch</Form.Label>
          <Form.Select value={chartBatchId} onChange={(e)=>setChartBatchId(e.target.value)}>
            <option value="">All</option>
            {(batches||[]).map(b => (
              <option key={b.id} value={b.id}>{b.batch_name}</option>
            ))}
          </Form.Select>
        </div>
      </div>

      {/* Mini chart: deaths over time */}
      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0">Deaths Over Time {chartBatchId ? `(Batch ${chartBatchId})` : '(All Batches)'}</h6>
          </div>
          {(chartData || []).length === 0 ? (
            <div className="text-center text-muted py-4">No mortality data for the selected range.</div>
          ) : (
            <div style={{width:'100%', height:250}}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Deaths" stroke="#d62728" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center my-4"><Spinner animation="border"/></div>
      ) : (
        <div className="table-responsive">
          <Table striped bordered hover size="sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Batch</th>
                <th>Breed</th>
                <th>Number Dead</th>
                <th>Reason</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(filtered || []).length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted">No mortality records found.</td></tr>
              ) : (
                (filtered || []).map(m => (
                  <tr key={m.id}>
                    <td>{editingId === m.id ? (
                      <Form.Control type="date" value={editForm.date} onChange={(e)=>setEditForm(prev=>({...prev,date:e.target.value}))} />
                    ) : (m.date ? new Date(m.date).toLocaleDateString() : '-')}</td>
                    <td>{editingId === m.id ? (
                      <Form.Select value={editForm.chick_batch_id} onChange={(e)=>setEditForm(prev=>({...prev,chick_batch_id:e.target.value}))}>
                        {(batches||[]).map(b => <option key={b.id} value={b.id}>{b.batch_name}</option>)}
                      </Form.Select>
                    ) : (m.batch_name || `#${m.chick_batch_id}`)}</td>
                    <td>{m.breed || '-'}</td>
                    <td className="text-danger fw-bold">{editingId === m.id ? (
                      <Form.Control type="number" min={1} value={editForm.number_dead} onChange={(e)=>setEditForm(prev=>({...prev,number_dead:e.target.value}))} />
                    ) : m.number_dead}</td>
                    <td>{editingId === m.id ? (
                      <Form.Control value={editForm.reason} onChange={(e)=>setEditForm(prev=>({...prev,reason:e.target.value}))} />
                    ) : (m.reason || '')}</td>
                    <td className="text-end">
                      {currentUser?.role === 'admin' && (
                        <div className="btn-group btn-group-sm">
                          {editingId === m.id ? (
                            <>
                              <Button variant="success" onClick={async ()=>{
                                try {
                                  const payload = {
                                    chick_batch_id: Number(editForm.chick_batch_id),
                                    date: editForm.date,
                                    number_dead: Number(editForm.number_dead),
                                    reason: editForm.reason
                                  };
                                  await api.put(`/mortalities/${m.id}`, payload);
                                  setSuccess('Mortality updated'); setTimeout(()=>setSuccess(''), 2000);
                                  setEditingId(null);
                                  fetchAll(meta.page, meta.limit);
                                } catch (err) {
                                  console.error('Error updating mortality', err);
                                  setError(err?.response?.data?.message || 'Error updating mortality');
                                }
                              }}>Save</Button>
                              <Button variant="secondary" onClick={()=>setEditingId(null)}>Cancel</Button>
                            </>
                          ) : (
                            <>
                              <Button variant="outline-primary" onClick={()=>{ setEditingId(m.id); setEditForm({ chick_batch_id: m.chick_batch_id, date: m.date, number_dead: m.number_dead, reason: m.reason || '' }); }}>Edit</Button>
                              <Button variant="outline-danger" onClick={()=>removeMortality(m.id)}>Delete</Button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <div className="small text-muted">Page {meta.page} of {meta.pages} | Total {meta.total} mortality records</div>
            <div className="d-flex gap-2 align-items-center">
              <Form.Select size="sm" value={meta.limit} onChange={(e)=>{ const lim = Number(e.target.value); setMeta(m=>({...m, limit: lim })); fetchAll(1, lim); }}>
                {[10,20,50,100].map(sz => <option key={sz} value={sz}>{sz}/page</option>)}
              </Form.Select>
              <Button variant="outline-secondary" size="sm" disabled={meta.page<=1} onClick={()=>fetchAll(meta.page-1, meta.limit)}>Prev</Button>
              <Button variant="outline-secondary" size="sm" disabled={meta.page>=meta.pages} onClick={()=>fetchAll(meta.page+1, meta.limit)}>Next</Button>
            </div>
          </div>
        </div>
      )}

      <Modal show={showModal} onHide={()=>setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Record Mortality</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={addMortality}>
            <Form.Group className="mb-2">
              <Form.Label>Batch</Form.Label>
              <Form.Select value={form.chick_batch_id} onChange={(e)=>setForm(prev=>({...prev, chick_batch_id:e.target.value}))} required>
                <option value="">Select batch…</option>
                {(batches||[]).map(b => (
                  <option key={b.id} value={b.id}>{b.batch_name}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="row">
              <div className="col">
                <Form.Group className="mb-2">
                  <Form.Label>Date</Form.Label>
                  <Form.Control type="date" value={form.date} onChange={(e)=>setForm(prev=>({...prev,date:e.target.value}))} required />
                </Form.Group>
              </div>
              <div className="col">
                <Form.Group className="mb-2">
                  <Form.Label>Number Dead</Form.Label>
                  <Form.Control type="number" min={1} value={form.number_dead} onChange={(e)=>setForm(prev=>({...prev,number_dead:e.target.value}))} required />
                </Form.Group>
              </div>
            </div>
            <Form.Group className="mb-3">
              <Form.Label>Reason (optional)</Form.Label>
              <Form.Control value={form.reason} onChange={(e)=>setForm(prev=>({...prev,reason:e.target.value}))} />
            </Form.Group>
            <Button type="submit">Save</Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default Mortalities;
