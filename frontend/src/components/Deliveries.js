import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function Deliveries() {
  const { currentUser } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    order_id: '',
    delivery_date: new Date().toISOString().slice(0,10),
    recipient_name: '',
    address: '',
    quantity_delivered: '',
    notes: ''
  });
  const [filters, setFilters] = useState({ orderId: '', recipient: '', dateFrom: '', dateTo: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    order_id: '',
    delivery_date: '',
    recipient_name: '',
    address: '',
    quantity_delivered: '',
    notes: ''
  });

  const orderOptions = useMemo(() => (orders || []).map(o => ({ value: o.id, label: `${o.customer_name} • ${o.product_type || o.product_type_resolved || 'N/A'} (${o.quantity})` })), [orders]);

  const fetchAll = async (page = meta.page, limit = meta.limit) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (filters.orderId) params.set('order_id', String(filters.orderId));
      if (filters.recipient) params.set('recipient', filters.recipient);
      if (filters.dateFrom) params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params.set('date_to', filters.dateTo);
      const [dRes, oRes] = await Promise.all([
        api.get(`/deliveries?${params.toString()}`),
        api.get('/orders'),
      ]);
      if (dRes.data?.data) {
        setDeliveries(dRes.data.data);
        if (dRes.data.meta) setMeta(dRes.data.meta);
      } else {
        setDeliveries(dRes.data || []);
        setMeta(m => ({ ...m, total: dRes.data?.length || 0, pages: 1 }));
      }
      setOrders(oRes.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching deliveries/orders', err);
      setError(err?.response?.data?.message || 'Error fetching deliveries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(1, meta.limit); /* reset to page 1 on mount */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Refetch when filters or page size change
  useEffect(() => { fetchAll(1, meta.limit); /* reset page */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.orderId, filters.recipient, filters.dateFrom, filters.dateTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, order_id: form.order_id ? Number(form.order_id) : null, quantity_delivered: Number(form.quantity_delivered) };
      await api.post('/deliveries', payload);
      setSuccess('Delivery recorded');
      setTimeout(() => setSuccess(''), 2500);
      setShowModal(false);
      setForm({ order_id: '', delivery_date: new Date().toISOString().slice(0,10), recipient_name: '', address: '', quantity_delivered: '', notes: '' });
      await fetchAll();
    } catch (err) {
      console.error('Error creating delivery', err);
      setError(err?.response?.data?.message || 'Error creating delivery');
    }
  };

  const removeDelivery = async (id) => {
    if (!window.confirm('Delete this delivery?')) return;
    try {
      await api.delete(`/deliveries/${id}`);
      setSuccess('Delivery deleted');
      setTimeout(() => setSuccess(''), 2000);
      await fetchAll();
    } catch (err) {
      console.error('Error deleting delivery', err);
      setError(err?.response?.data?.message || 'Error deleting delivery');
    }
  };

  const summary = useMemo(() => {
    const count = (deliveries || []).length;
    const qty = (deliveries || []).reduce((a, d) => a + Number(d.quantity_delivered || 0), 0);
    return { count, qty };
  }, [deliveries]);

  const addFooter = (doc, preparedBy, generatedAt) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(9);
      const left = `Prepared by: ${preparedBy || '—'}`;
      const middle = `Generated: ${generatedAt}`;
      const right = `Page ${i} of ${pageCount}`;
      doc.text(left, 14, pageHeight - 10);
      const middleWidth = doc.getTextWidth(middle);
      doc.text(middle, (pageWidth - middleWidth) / 2, pageHeight - 10);
      const rightWidth = doc.getTextWidth(right);
      doc.text(right, pageWidth - 14 - rightWidth, pageHeight - 10);
    }
  };

  const exportRowPDF = (d) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Bin Masud Kuku', 14, 14);
    doc.setFontSize(10);
    doc.text(`Delivery #${d.id}`, 14, 20);
    const details = [
      ['ID', d.id],
      ['Date', d.delivery_date ? new Date(d.delivery_date).toLocaleDateString() : '-'],
      ['Recipient', d.recipient_name],
      ['Order', d.order_id ? `#${d.order_id}` : '-'],
      ['Quantity Delivered', d.quantity_delivered],
      ['Address', d.address || ''],
      ['Notes', d.notes || ''],
    ];
    // @ts-ignore
    doc.autoTable({ startY: 28, head: [['Field','Value']], body: details, styles: { fontSize: 10 } });
    addFooter(doc, currentUser?.name || currentUser?.email, new Date().toLocaleString());
    doc.save(`delivery-${d.id}.pdf`);
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Deliveries</h2>
        <Button onClick={() => setShowModal(true)} disabled={loading}>Add Delivery</Button>
      </div>
      <div className="d-flex flex-wrap gap-3 mb-3 small text-muted">
        <div className="badge bg-secondary">Deliveries (page): {summary.count}</div>
        <div className="badge bg-info">Total Delivered (page): {summary.qty}</div>
        <div className="badge bg-light text-dark">Page {meta.page} of {meta.pages} • Total {meta.total}</div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      <div className="mb-3">
        <div className="row g-2">
          <div className="col-md-2">
            <Form.Label className="small mb-1">Order</Form.Label>
            <Form.Select value={filters.orderId} onChange={(e)=>setFilters(prev=>({...prev,orderId:e.target.value}))}>
              <option value="">All</option>
              {(orders||[]).map(o => (
                <option key={o.id} value={o.id}>#{o.id} • {o.customer_name}</option>
              ))}
            </Form.Select>
          </div>
          <div className="col-md-3">
            <Form.Label className="small mb-1">Recipient</Form.Label>
            <Form.Control placeholder="search by recipient" value={filters.recipient} onChange={(e)=>setFilters(prev=>({...prev,recipient:e.target.value}))} />
          </div>
          <div className="col-md-2">
            <Form.Label className="small mb-1">From</Form.Label>
            <Form.Control type="date" value={filters.dateFrom} onChange={(e)=>setFilters(prev=>({...prev,dateFrom:e.target.value}))} />
          </div>
          <div className="col-md-2">
            <Form.Label className="small mb-1">To</Form.Label>
            <Form.Control type="date" value={filters.dateTo} onChange={(e)=>setFilters(prev=>({...prev,dateTo:e.target.value}))} />
          </div>
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
                <th>Recipient</th>
                <th>Order</th>
                <th>Qty Delivered</th>
                <th>Address</th>
                <th>Notes</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(deliveries || []).length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted">No deliveries yet.</td></tr>
              ) : (
                (deliveries || []).map(d => (
                  <tr key={d.id}>
                    <td>
                      {editingId === d.id ? (
                        <Form.Control type="date" value={editForm.delivery_date} onChange={(e)=>setEditForm(prev=>({...prev, delivery_date:e.target.value}))} />
                      ) : (d.delivery_date ? new Date(d.delivery_date).toLocaleDateString() : '-')}
                    </td>
                    <td>
                      {editingId === d.id ? (
                        <Form.Control value={editForm.recipient_name} onChange={(e)=>setEditForm(prev=>({...prev, recipient_name:e.target.value}))} />
                      ) : d.recipient_name}
                    </td>
                    <td>
                      {editingId === d.id ? (
                        <Form.Select value={editForm.order_id} onChange={(e)=>setEditForm(prev=>({...prev, order_id:e.target.value}))}>
                          <option value="">No order</option>
                          {(orders||[]).map(o => (
                            <option key={o.id} value={o.id}>#{o.id} • {o.customer_name}</option>
                          ))}
                        </Form.Select>
                      ) : (d.order_id ? `#${d.order_id} • ${d.customer_name || ''}` : '-')}
                    </td>
                    <td>
                      {editingId === d.id ? (
                        <Form.Control type="number" min={1} value={editForm.quantity_delivered} onChange={(e)=>setEditForm(prev=>({...prev, quantity_delivered:e.target.value}))} />
                      ) : d.quantity_delivered}
                    </td>
                    <td>
                      {editingId === d.id ? (
                        <Form.Control value={editForm.address} onChange={(e)=>setEditForm(prev=>({...prev, address:e.target.value}))} />
                      ) : (d.address || '')}
                    </td>
                    <td>
                      {editingId === d.id ? (
                        <Form.Control value={editForm.notes} onChange={(e)=>setEditForm(prev=>({...prev, notes:e.target.value}))} />
                      ) : (d.notes || '')}
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        {editingId === d.id ? (
                          <>
                            <Button variant="success" onClick={async ()=>{
                              try {
                                const payload = { ...editForm, order_id: editForm.order_id ? Number(editForm.order_id) : null, quantity_delivered: Number(editForm.quantity_delivered) };
                                await api.put(`/deliveries/${d.id}`, payload);
                                setSuccess('Delivery updated'); setTimeout(()=>setSuccess(''), 2000);
                                setEditingId(null);
                                await fetchAll(meta.page, meta.limit);
                              } catch (err) {
                                console.error('Error updating delivery', err);
                                setError(err?.response?.data?.message || 'Error updating delivery');
                              }
                            }}>Save</Button>
                            <Button variant="secondary" onClick={()=>{ setEditingId(null); }}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline-secondary" onClick={()=>exportRowPDF(d)}>PDF</Button>
                            <Button variant="outline-primary" onClick={()=>{ setEditingId(d.id); setEditForm({
                              order_id: d.order_id || '',
                              delivery_date: d.delivery_date ? String(d.delivery_date).slice(0,10) : new Date().toISOString().slice(0,10),
                              recipient_name: d.recipient_name || '',
                              address: d.address || '',
                              quantity_delivered: d.quantity_delivered || 1,
                              notes: d.notes || ''
                            }); }}>Edit</Button>
                            {currentUser?.role === 'admin' && (
                              <Button variant="outline-danger" onClick={()=>removeDelivery(d.id)}>Delete</Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <div className="small text-muted">Page {meta.page} of {meta.pages} | Total {meta.total} deliveries</div>
            <div className="d-flex gap-2 align-items-center">
              <Form.Select size="sm" value={meta.limit} onChange={(e)=>{ const lim = Number(e.target.value); setMeta(m=>({ ...m, limit: lim })); fetchAll(1, lim); }}>
                {[10,20,50,100].map(sz => <option key={sz} value={sz}>{sz}/page</option>)}
              </Form.Select>
              <Button variant="outline-secondary" size="sm" disabled={meta.page<=1} onClick={()=>fetchAll(meta.page-1, meta.limit)}>Prev</Button>
              <Button variant="outline-secondary" size="sm" disabled={meta.page>=meta.pages} onClick={()=>fetchAll(meta.page+1, meta.limit)}>Next</Button>
            </div>
          </div>
        </div>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Delivery</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-2">
              <Form.Label>Delivery Date</Form.Label>
              <Form.Control type="date" value={form.delivery_date} onChange={(e) => setForm(prev => ({...prev, delivery_date: e.target.value}))} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Recipient Name</Form.Label>
              <Form.Control value={form.recipient_name} onChange={(e) => setForm(prev => ({...prev, recipient_name: e.target.value}))} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Link to Order</Form.Label>
              <Form.Select value={form.order_id} onChange={(e) => setForm(prev => ({...prev, order_id: e.target.value}))}>
                <option value="">No order</option>
                {orderOptions.map(oo => (
                  <option key={oo.value} value={oo.value}>{oo.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="row">
              <div className="col">
                <Form.Group className="mb-2">
                  <Form.Label>Quantity Delivered</Form.Label>
                  <Form.Control type="number" min={1} value={form.quantity_delivered} onChange={(e) => setForm(prev => ({...prev, quantity_delivered: e.target.value}))} required />
                </Form.Group>
              </div>
              <div className="col">
                <Form.Group className="mb-2">
                  <Form.Label>Address (optional)</Form.Label>
                  <Form.Control value={form.address} onChange={(e) => setForm(prev => ({...prev, address: e.target.value}))} />
                </Form.Group>
              </div>
            </div>
            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm(prev => ({...prev, notes: e.target.value}))} />
            </Form.Group>
            <Button type="submit">Save</Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default Deliveries;
