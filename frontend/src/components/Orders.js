import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table, Badge } from 'react-bootstrap';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function Orders() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    order_date: new Date().toISOString().slice(0,10),
    customer_name: '',
    product_type: '',
    product_id: '',
    quantity: '',
    unit_price: '',
    status: 'pending',
    notes: ''
  });
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filters, setFilters] = useState({ status: '', customer: '', dateFrom: '', dateTo: '' });

  const productOptions = useMemo(() => (products || []).map(p => ({ value: p.id, label: `${p.type} (Batch ${p.batch_id ?? '-'}) • Avail: ${p.available_qty ?? p.packaged_quantity}` })), [products]);

  const fetchOrders = async (page = meta.page, limit = meta.limit) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (filters.status) params.set('status', filters.status);
      if (filters.customer) params.set('customer', filters.customer);
      if (filters.dateFrom) params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params.set('date_to', filters.dateTo);
      const oRes = await api.get(`/orders?${params.toString()}`);
      if (oRes.data?.data) {
        setOrders(oRes.data.data);
        if (oRes.data.meta) setMeta(oRes.data.meta);
      } else {
        setOrders(oRes.data || []);
        setMeta(m => ({ ...m, total: (oRes.data || []).length, pages: 1 }));
      }
      setError('');
    } catch (err) {
      console.error('Error fetching orders', err);
      setError(err?.response?.data?.message || 'Error fetching orders');
    }
  };

  const fetchProducts = async () => {
    try {
      const pRes = await api.get('/products');
      setProducts(pRes.data || []);
    } catch (err) {
      console.error('Error fetching products', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchProducts(), fetchOrders(1, meta.limit)])
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // refetch on filter changes, reset to page 1
    fetchOrders(1, meta.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.customer, filters.dateFrom, filters.dateTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        product_id: form.product_id ? Number(form.product_id) : null,
        quantity: Number(form.quantity),
        unit_price: Number(form.unit_price)
      };
      await api.post('/orders', payload);
      setSuccess('Order created');
      setTimeout(() => setSuccess(''), 2500);
      setShowModal(false);
      setForm({ order_date: new Date().toISOString().slice(0,10), customer_name: '', product_type: '', product_id: '', quantity: '', unit_price: '', status: 'pending', notes: '' });
      await fetchOrders(1, meta.limit);
    } catch (err) {
      console.error('Error creating order', err);
      setError(err?.response?.data?.message || 'Error creating order');
    }
  };

  const openEdit = (o) => {
    setEditId(o.id);
    setEditForm({
      order_date: o.order_date ? o.order_date.substring(0,10) : new Date().toISOString().slice(0,10),
      customer_name: o.customer_name || '',
      product_type: o.product_type || '',
      product_id: o.product_id || '',
      quantity: o.quantity || 0,
      unit_price: o.unit_price || 0,
      status: o.status || 'pending',
      notes: o.notes || ''
    });
    setShowEdit(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...editForm,
        product_id: editForm.product_id ? Number(editForm.product_id) : null,
        quantity: Number(editForm.quantity),
        unit_price: Number(editForm.unit_price)
      };
      await api.put(`/orders/${editId}`, payload);
      setSuccess('Order updated');
      setTimeout(() => setSuccess(''), 2000);
      setShowEdit(false);
      setEditId(null);
      await fetchOrders(meta.page, meta.limit);
    } catch (err) {
      console.error('Error updating order', err);
      setError(err?.response?.data?.message || 'Error updating order');
    }
  };

  const removeOrder = async (id) => {
    if (!window.confirm('Delete this order?')) return;
    try {
      await api.delete(`/orders/${id}`);
      setSuccess('Order deleted');
      setTimeout(() => setSuccess(''), 2000);
      await fetchOrders(meta.page, meta.limit);
    } catch (err) {
      console.error('Error deleting order', err);
      setError(err?.response?.data?.message || 'Error deleting order');
    }
  };

  const filtered = orders; // server-side filtered/paginated

  const summary = useMemo(() => {
    const count = filtered.length;
    const qty = filtered.reduce((a, o) => a + Number(o.quantity || 0), 0);
    const delivered = filtered.reduce((a, o) => a + Number(o.delivered_sum || 0), 0);
    const totalValue = filtered.reduce((a, o) => a + Number(o.total_amount || (o.quantity * o.unit_price) || 0), 0);
    const deliveredValue = filtered.reduce((a, o) => a + (Math.min(Number(o.delivered_sum || 0), Number(o.quantity || 0)) * Number(o.unit_price || 0)), 0);
    return { count, qty, delivered, totalValue, deliveredValue };
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

  const exportRowPDF = async (o) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Bin Masud Kuku', 14, 14);
    doc.setFontSize(10);
    doc.text(`Order #${o.id}`, 14, 20);
    const details = [
      ['ID', o.id],
      ['Date', o.order_date ? new Date(o.order_date).toLocaleDateString() : '-'],
      ['Customer', o.customer_name],
      ['Product', o.product_type || o.product_type_resolved || '-'],
      ['Quantity', o.quantity],
      ['Delivered (sum)', Number(o.delivered_sum||0)],
      ['Unit Price', Number(o.unit_price||0).toFixed(2)],
      ['Total', Number(o.total_amount|| (o.quantity * o.unit_price) || 0).toFixed(2)],
      ['Status', o.status],
      ['Notes', o.notes || ''],
    ];
    // @ts-ignore
    doc.autoTable({ startY: 28, head: [['Field','Value']], body: details, styles: { fontSize: 10 } });
    // Deliveries breakdown for this order
    try {
      const dRes = await api.get('/deliveries');
      const list = (dRes.data || []).filter(d => Number(d.order_id) === Number(o.id));
      if (list.length) {
        const head = [['Date','Recipient','Qty','Address','Notes']];
        const body = list.map(d => [
          d.delivery_date ? new Date(d.delivery_date).toLocaleDateString() : '-',
          d.recipient_name || '-',
          d.quantity_delivered || 0,
          d.address || '-',
          d.notes || ''
        ]);
        // @ts-ignore
        doc.autoTable({ startY: doc.lastAutoTable.finalY + 8, head, body, styles: { fontSize: 9 }, headStyles: { fillColor: [31,119,180] } });
      }
    } catch (_) {}
    addFooter(doc, currentUser?.name || currentUser?.email, new Date().toLocaleString());
    doc.save(`order-${o.id}.pdf`);
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Orders</h2>
        <Button onClick={() => setShowModal(true)} disabled={loading}>Add Order</Button>
      </div>
      {/* Stat chips */}
      <div className="d-flex flex-wrap gap-3 mb-3 small text-muted">
        <div className="badge bg-secondary">Orders: {summary.count}</div>
        <div className="badge bg-info">Qty: {summary.qty}</div>
        <div className="badge bg-primary">Delivered: {summary.delivered}</div>
        <div className="badge bg-success">Value: {summary.totalValue.toFixed(2)}</div>
        <div className="badge bg-dark">Delivered Value: {summary.deliveredValue.toFixed(2)}</div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      <div className="mb-3">
        <div className="row g-2">
          <div className="col-md-2">
            <Form.Label className="small mb-1">Status</Form.Label>
            <Form.Select value={filters.status} onChange={(e)=>setFilters(prev=>({...prev,status:e.target.value}))}>
              <option value="">All</option>
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
              <option value="fulfilled">fulfilled</option>
              <option value="cancelled">cancelled</option>
            </Form.Select>
          </div>
          <div className="col-md-3">
            <Form.Label className="small mb-1">Customer</Form.Label>
            <Form.Control placeholder="search by name" value={filters.customer} onChange={(e)=>setFilters(prev=>({...prev,customer:e.target.value}))} />
          </div>
          <div className="col-md-2">
            <Form.Label className="small mb-1">From</Form.Label>
            <Form.Control type="date" value={filters.dateFrom} onChange={(e)=>setFilters(prev=>({...prev,dateFrom:e.target.value}))} />
          </div>
          <div className="col-md-2">
            <Form.Label className="small mb-1">To</Form.Label>
            <Form.Control type="date" value={filters.dateTo} onChange={(e)=>setFilters(prev=>({...prev,dateTo:e.target.value}))} />
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <div className="w-100 text-end">
              <div className="small text-muted">Orders: {summary.count} • Qty: {summary.qty} • Delivered: {summary.delivered}</div>
              <div className="small text-muted">Value: {summary.totalValue.toFixed(2)} • Delivered Value: {summary.deliveredValue.toFixed(2)}</div>
            </div>
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
                <th>Customer</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Delivered</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th>Status</th>
                <th>Notes</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(filtered || []).length === 0 ? (
                <tr><td colSpan={10} className="text-center text-muted">No orders found.</td></tr>
              ) : (
                (filtered || []).map(o => (
                  <tr key={o.id}>
                    <td>{o.order_date ? new Date(o.order_date).toLocaleDateString() : '-'}</td>
                    <td>{o.customer_name}</td>
                    <td className="text-capitalize">{o.product_type || o.product_type_resolved || '-'}</td>
                    <td>{o.quantity}</td>
                    <td>
                      <Badge bg={Number(o.delivered_sum||0) >= Number(o.quantity||0) ? 'success':'secondary'}>
                        {Number(o.delivered_sum||0)}
                      </Badge>
                    </td>
                    <td>{Number(o.unit_price).toFixed(2)}</td>
                    <td>{Number(o.total_amount).toFixed(2)}</td>
                    <td className="text-capitalize">{o.status}</td>
                    <td>{o.notes || ''}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Button variant="outline-secondary" onClick={()=>exportRowPDF(o)}>PDF</Button>
                        <Button variant="outline-primary" onClick={()=>openEdit(o)}>Edit</Button>
                        {currentUser?.role === 'admin' && (
                          <Button variant="outline-danger" onClick={()=>removeOrder(o.id)}>Delete</Button>
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

      {/* Pagination controls */}
      {!loading && (
        <div className="d-flex justify-content-between align-items-center mt-2">
          <div className="small text-muted">Page {meta.page} of {meta.pages} | Total {meta.total} orders</div>
          <div className="d-flex gap-2 align-items-center">
            <Form.Select size="sm" value={meta.limit} onChange={(e)=>{ const lim = Number(e.target.value); setMeta(m=>({...m, limit: lim })); fetchOrders(1, lim); }}>
              {[10,20,50,100].map(sz => <option key={sz} value={sz}>{sz}/page</option>)}
            </Form.Select>
            <Button variant="outline-secondary" size="sm" disabled={meta.page<=1} onClick={()=>fetchOrders(meta.page-1, meta.limit)}>Prev</Button>
            <Button variant="outline-secondary" size="sm" disabled={meta.page>=meta.pages} onClick={()=>fetchOrders(meta.page+1, meta.limit)}>Next</Button>
          </div>
        </div>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Order</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-2">
              <Form.Label>Date</Form.Label>
              <Form.Control type="date" value={form.order_date} onChange={(e) => setForm(prev => ({...prev, order_date: e.target.value}))} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Customer Name</Form.Label>
              <Form.Control value={form.customer_name} onChange={(e) => setForm(prev => ({...prev, customer_name: e.target.value}))} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Product</Form.Label>
              <Form.Select value={form.product_id} onChange={(e) => setForm(prev => ({...prev, product_id: e.target.value}))}>
                <option value="">Unspecified</option>
                {productOptions.map(po => (
                  <option key={po.value} value={po.value}>{po.label}</option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">Optionally link to a specific product batch.</Form.Text>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Product Type (label)</Form.Label>
              <Form.Control value={form.product_type} onChange={(e) => setForm(prev => ({...prev, product_type: e.target.value}))} placeholder="e.g., fresh, frozen" />
            </Form.Group>
            <div className="row">
              <div className="col">
                <Form.Group className="mb-2">
                  <Form.Label>Quantity</Form.Label>
                  <Form.Control type="number" min={1} value={form.quantity} onChange={(e) => setForm(prev => ({...prev, quantity: e.target.value}))} required />
                </Form.Group>
              </div>
              <div className="col">
                <Form.Group className="mb-2">
                  <Form.Label>Unit Price</Form.Label>
                  <Form.Control type="number" min={0} step={0.01} value={form.unit_price} onChange={(e) => setForm(prev => ({...prev, unit_price: e.target.value}))} required />
                </Form.Group>
              </div>
            </div>
            <Form.Group className="mb-2">
              <Form.Label>Status</Form.Label>
              <Form.Select value={form.status} onChange={(e) => setForm(prev => ({...prev, status: e.target.value}))}>
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="fulfilled">fulfilled</option>
                <option value="cancelled">cancelled</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm(prev => ({...prev, notes: e.target.value}))} />
            </Form.Group>
            <Button type="submit">Save</Button>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={showEdit} onHide={()=>setShowEdit(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Order</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={saveEdit}>
            <Form.Group className="mb-2">
              <Form.Label>Date</Form.Label>
              <Form.Control type="date" value={editForm.order_date || ''} onChange={(e)=>setEditForm(prev=>({...prev,order_date:e.target.value}))} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Customer Name</Form.Label>
              <Form.Control value={editForm.customer_name || ''} onChange={(e)=>setEditForm(prev=>({...prev,customer_name:e.target.value}))} required />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Product</Form.Label>
              <Form.Select value={editForm.product_id || ''} onChange={(e)=>setEditForm(prev=>({...prev,product_id:e.target.value}))}>
                <option value="">Unspecified</option>
                {productOptions.map(po => (
                  <option key={po.value} value={po.value}>{po.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Product Type (label)</Form.Label>
              <Form.Control value={editForm.product_type || ''} onChange={(e)=>setEditForm(prev=>({...prev,product_type:e.target.value}))} />
            </Form.Group>
            <div className="row">
              <div className="col">
                <Form.Group className="mb-2">
                  <Form.Label>Quantity</Form.Label>
                  <Form.Control type="number" min={1} value={editForm.quantity || ''} onChange={(e)=>setEditForm(prev=>({...prev,quantity:e.target.value}))} required />
                </Form.Group>
              </div>
              <div className="col">
                <Form.Group className="mb-2">
                  <Form.Label>Unit Price</Form.Label>
                  <Form.Control type="number" min={0} step={0.01} value={editForm.unit_price || ''} onChange={(e)=>setEditForm(prev=>({...prev,unit_price:e.target.value}))} required />
                </Form.Group>
              </div>
            </div>
            <Form.Group className="mb-2">
              <Form.Label>Status</Form.Label>
              <Form.Select value={editForm.status || 'pending'} onChange={(e)=>setEditForm(prev=>({...prev,status:e.target.value}))}>
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="fulfilled">fulfilled</option>
                <option value="cancelled">cancelled</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={editForm.notes || ''} onChange={(e)=>setEditForm(prev=>({...prev,notes:e.target.value}))} />
            </Form.Group>
            <Button type="submit">Save</Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default Orders;
