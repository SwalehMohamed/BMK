import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Alert, Spinner, Card } from 'react-bootstrap';
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
  const [chicks, setChicks] = useState([]);
  const [batchName, setBatchName] = useState('');
  const [breed, setBreed] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [initialCount, setInitialCount] = useState('');
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
    fetchChicks();
    // Also fetch total deaths for a simple stat header
    api.get('/dashboard')
      .then(res => {
        setTotalDeaths(res?.data?.total_dead ?? null);
        setTotalChicks(res?.data?.total_chicks ?? null);
      })
      .catch(() => { setTotalDeaths(null); setTotalChicks(null); });
  }, []);

  const fetchChicks = async () => {
    setLoading(true);
  try {
      const response = await api.get('/chicks');
      // Handle paginated response - extract the data array
      setChicks(response.data.data || []);
      setError('');
    } catch (error) {
      setError('Error fetching chicks');
      console.error('Error fetching chicks:', error);
      // Set empty array as fallback
      setChicks([]);
    }
    setLoading(false);
  };

  const fetchBatchFeedHistory = async (batchId) => {
    try {
      const res = await api.get(`/chicks/${batchId}/feed-usage`);
      setFeedHistory((prev) => ({ ...prev, [batchId]: res.data.data || [] }));
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
      // Fetch all slaughters and filter client-side by batch_id
      const res = await api.get('/slaughtered');
      const list = (res.data || []).filter(s => Number(s.batch_id) === Number(batchId));
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
      fetchChicks(); // Refresh the list
      setSuccess('Chick added successfully');
      setTimeout(() => setSuccess(''), 3000);
      clearForm();
      setError('');
    } catch (error) {
      setError('Error adding chick');
      console.error('Error adding chick:', error);
    }
  };

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
        <div className="d-flex gap-2">
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
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="form-group">
          <label>Batch Name</label>
          <input
            type="text"
            className="form-control"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Breed</label>
          <input
            type="text"
            className="form-control"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Arrival Date</label>
          <input
            type="date"
            className="form-control"
            value={arrivalDate}
            onChange={(e) => setArrivalDate(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Supplier</label>
          <input
            type="text"
            className="form-control"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Initial Count</label>
          <input
            type="number"
            className="form-control"
            value={initialCount}
            onChange={(e) => setInitialCount(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">Add Chick</button>
      </form>

      <h3>Existing Chicks</h3>
      <ul className="list-group">
        {Array.isArray(chicks) && chicks.map((chick) => (
          <li key={chick.id} className="list-group-item">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <strong>{chick.batch_name}</strong> - {chick.breed} - {new Date(chick.arrival_date).toLocaleDateString()} - {chick.supplier} - Initial: {chick.initial_count} | Deaths: {chick.total_deaths ?? 0} | Current: {chick.current_count ?? (chick.initial_count - (chick.total_deaths||0))}
              </div>
              <button className="btn btn-sm btn-outline-primary" onClick={() => toggleExpand(chick.id)}>
                {expandedBatchId === chick.id ? 'Hide Details' : 'View Details'}
              </button>
            </div>

            {expandedBatchId === chick.id && (
              <div className="mt-3">
                <div className="row">
                  <div className="col-lg-6">
                    <h5>Feed History</h5>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered">
                        <thead>
                          <tr>
                            <th>Date Used</th>
                            <th>Feed Type</th>
                            <th>Quantity Used (kg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(feedHistory[chick.id] || []).length === 0 ? (
                            <tr><td colSpan="3" className="text-center text-muted">No feed usage recorded for this batch.</td></tr>
                          ) : (
                            (feedHistory[chick.id] || []).map((fh) => (
                              <tr key={fh.id}>
                                <td>{fh.date_used ? new Date(fh.date_used).toLocaleDateString() : new Date(fh.used_at).toLocaleString()}</td>
                                <td className="text-capitalize">{fh.type}</td>
                                <td>{fh.quantity_used ?? fh.amount_used}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="col-lg-3">
                    <h5>Record Mortality</h5>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Date</label>
                        <input type="date" className="form-control" value={(mortalityForm[chick.id]?.date) || ''}
                          onChange={(e) => setMortalityForm((prev) => ({ ...prev, [chick.id]: { ...(prev[chick.id]||{}), date: e.target.value } }))}/>
                      </div>
                      <div className="form-group">
                        <label>Number Dead</label>
                        <input type="number" min="1" className="form-control" value={(mortalityForm[chick.id]?.number_dead) || ''}
                          onChange={(e) => setMortalityForm((prev) => ({ ...prev, [chick.id]: { ...(prev[chick.id]||{}), number_dead: e.target.value } }))}/>
                      </div>
                      <div className="form-group">
                        <label>Reason (optional)</label>
                        <input type="text" className="form-control" value={(mortalityForm[chick.id]?.reason) || ''}
                          onChange={(e) => setMortalityForm((prev) => ({ ...prev, [chick.id]: { ...(prev[chick.id]||{}), reason: e.target.value } }))}/>
                      </div>
                      <button className="btn btn-danger mt-2" onClick={() => submitMortality(chick.id)} disabled={!mortalityForm[chick.id]?.date || !mortalityForm[chick.id]?.number_dead}>
                        Save Mortality
                      </button>
                    </div>
                  </div>
                  <div className="col-lg-3">
                    <h5>Add to Slaughter</h5>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Date</label>
                        <input type="date" className="form-control" value={(slaughterForm[chick.id]?.date) || ''}
                          onChange={(e) => setSlaughterForm((prev) => ({ ...prev, [chick.id]: { ...(prev[chick.id]||{}), date: e.target.value } }))}/>
                      </div>
                      <div className="form-group">
                        <label>Quantity (max {chick.current_count ?? (chick.initial_count - (chick.total_deaths||0) - (chick.total_slaughtered||0))})</label>
                        <input type="number" min="1" className="form-control" value={(slaughterForm[chick.id]?.quantity) || ''}
                          onChange={(e) => setSlaughterForm((prev) => ({ ...prev, [chick.id]: { ...(prev[chick.id]||{}), quantity: e.target.value } }))}/>
                      </div>
                      <div className="form-group">
                        <label>Avg Weight (kg, optional)</label>
                        <input type="number" min="0" step="0.01" className="form-control" value={(slaughterForm[chick.id]?.avg_weight) || ''}
                          onChange={(e) => setSlaughterForm((prev) => ({ ...prev, [chick.id]: { ...(prev[chick.id]||{}), avg_weight: e.target.value } }))}/>
                      </div>
                      <div className="form-group">
                        <label>Notes (optional)</label>
                        <input type="text" className="form-control" value={(slaughterForm[chick.id]?.notes) || ''}
                          onChange={(e) => setSlaughterForm((prev) => ({ ...prev, [chick.id]: { ...(prev[chick.id]||{}), notes: e.target.value } }))}/>
                      </div>
                      <button className="btn btn-success mt-2"
                        onClick={() => submitSlaughter(chick.id, chick.current_count ?? (chick.initial_count - (chick.total_deaths||0) - (chick.total_slaughtered||0)))}
                        disabled={!slaughterForm[chick.id]?.date || !slaughterForm[chick.id]?.quantity}>
                        Save Slaughter
                      </button>
                    </div>
                  </div>
                </div>
                <div className="row mt-3">
                  <div className="col-lg-6">
                    <h6>Recent Mortalities</h6>
                    <ul className="list-group">
                      {(mortalities[chick.id] || []).length === 0 ? (
                        <li className="list-group-item text-muted">No mortalities recorded.</li>
                      ) : (
                        (mortalities[chick.id] || []).map((m) => (
                          <li key={m.id} className="list-group-item d-flex justify-content-between">
                            <span>
                              {new Date(m.date).toLocaleDateString()} - {m.number_dead} dead {m.reason ? `(${m.reason})` : ''}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div className="col-lg-6">
                    <h6>Recent Slaughters</h6>
                    <ul className="list-group">
                      {(slaughtersByBatch[chick.id] || []).length === 0 ? (
                        <li className="list-group-item text-muted">No slaughters recorded.</li>
                      ) : (
                        (slaughtersByBatch[chick.id] || []).slice(0,5).map(s => (
                          <li key={s.id} className="list-group-item d-flex justify-content-between">
                            <span>{s.date ? new Date(s.date).toLocaleDateString() : '-'} — Qty: {s.quantity} {s.avg_weight ? `(avg wt ${s.avg_weight} kg)` : ''}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
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
