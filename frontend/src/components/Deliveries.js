import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function Deliveries() {
  const { currentUser } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
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

  const orderOptions = useMemo(() => (orders || []).map(o => ({ value: o.id, label: `${o.customer_name} • ${o.product_type || o.product_type_resolved || 'N/A'} (${o.quantity})` })), [orders]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dRes, oRes] = await Promise.all([
        api.get('/deliveries'),
        api.get('/orders'),
      ]);
      setDeliveries(dRes.data || []);
      setOrders(oRes.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching deliveries/orders', err);
      setError(err?.response?.data?.message || 'Error fetching deliveries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

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

  const filtered = useMemo(() => {
    const df = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const dt = filters.dateTo ? new Date(filters.dateTo) : null;
    return (deliveries || []).filter(d => {
      const oOk = filters.orderId ? String(d.order_id || '').trim() === String(filters.orderId).trim() : true;
      const rOk = filters.recipient ? String(d.recipient_name || '').toLowerCase().includes(filters.recipient.toLowerCase()) : true;
      const dd = d.delivery_date ? new Date(d.delivery_date) : null;
      const dfOk = df ? (dd && dd >= df) : true;
      const dtOk = dt ? (dd && dd <= dt) : true;
      return oOk && rOk && dfOk && dtOk;
    });
  }, [deliveries, filters]);

  const summary = useMemo(() => {
    const count = (filtered || []).length;
    const qty = (filtered || []).reduce((a, d) => a + Number(d.quantity_delivered || 0), 0);
    return { count, qty };
  }, [filtered]);

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
        <div className="badge bg-secondary">Deliveries: {summary.count}</div>
        <div className="badge bg-info">Total Delivered: {summary.qty}</div>
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
              {(filtered || []).length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted">No deliveries yet.</td></tr>
              ) : (
                (filtered || []).map(d => (
                  <tr key={d.id}>
                    <td>{d.delivery_date ? new Date(d.delivery_date).toLocaleDateString() : '-'}</td>
                    <td>{d.recipient_name}</td>
                    <td>{d.order_id ? `#${d.order_id} • ${d.customer_name || ''}` : '-'}</td>
                    <td>{d.quantity_delivered}</td>
                    <td>{d.address || ''}</td>
                    <td>{d.notes || ''}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Button variant="outline-secondary" onClick={()=>exportRowPDF(d)}>PDF</Button>
                        {currentUser?.role === 'admin' && (
                          <Button variant="outline-danger" onClick={()=>removeDelivery(d.id)}>Delete</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
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
