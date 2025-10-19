import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { Spinner, Alert, Form, Row, Col, Button, InputGroup } from 'react-bootstrap';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
  const drawHeader = (doc, title) => {
    doc.setFontSize(16);
    doc.text('Bin Masud Kuku', 14, 14);
    doc.setFontSize(10);
    doc.text(title, 14, 20);
  };
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

const Sales = () => {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchSales = async () => {
    try {
      const res = await api.get('/sales');
      setRows(res.data || []);
    } catch (err) {
      console.error('Error fetching sales', err);
      setError(err?.response?.data?.message || 'Error fetching sales');
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchSales().finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    return (rows || []).filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${r.customer_name || ''} ${r.product_type || ''} ${r.id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fromDate) {
        if (new Date(r.order_date) < new Date(fromDate)) return false;
      }
      if (toDate) {
        if (new Date(r.order_date) > new Date(toDate)) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter, fromDate, toDate]);

  const totals = useMemo(() => {
    return filtered.reduce((acc, r) => {
      acc.qty += Number(r.order_quantity || 0);
      acc.delivered += Number(r.delivered_qty || 0);
      acc.pending += Number(r.pending_qty || 0);
      acc.total += Number(r.total_amount || 0);
      return acc;
    }, { qty: 0, delivered: 0, pending: 0, total: 0 });
  }, [filtered]);

  const exportPDF = () => {
  const doc = new jsPDF();
  drawHeader(doc, 'Sales Report');
    const head = [['ID','Date','Customer','Product','Qty','Delivered','Pending','Unit','Total','Status']];
    const body = filtered.map(r => ([r.id, r.order_date, r.customer_name, r.product_type, r.order_quantity, r.delivered_qty, r.pending_qty, Number(r.unit_price || 0).toFixed(2), Number(r.total_amount || 0).toFixed(2), r.status]));
    // add totals row
    body.push(['', '', 'Totals', '', totals.qty, totals.delivered, totals.pending, '', Number(totals.total).toFixed(2), '']);
    // @ts-ignore
    doc.autoTable({ startY: 28, head, body, styles: { fontSize: 10 } });
    addFooter(doc, currentUser?.name || currentUser?.email, new Date().toLocaleString());
    doc.save(`sales-report-${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const exportRowPDF = async (r) => {
  const doc = new jsPDF();
  drawHeader(doc, `Sales Transaction #${r.id}`);
    const details = [
      ['ID', r.id],
      ['Order Date', r.order_date],
      ['Customer', r.customer_name],
      ['Product Type', r.product_type],
      ['Order Qty', r.order_quantity],
      ['Delivered Qty', r.delivered_qty],
      ['Pending Qty', r.pending_qty],
      ['Unit Price', Number(r.unit_price||0).toFixed(2)],
      ['Total (delivered×unit)', Number(r.total_amount|| (r.delivered_qty * r.unit_price) || 0).toFixed(2)],
      ['Status', r.status],
    ];
    // @ts-ignore
    doc.autoTable({ startY: 28, head: [['Field','Value']], body: details, styles: { fontSize: 10 } });
    // Deliveries breakdown under this order
    try {
      const dRes = await api.get('/deliveries');
      const list = (dRes.data || []).filter(d => Number(d.order_id) === Number(r.id));
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
    doc.save(`sale-${r.id}.pdf`);
  };

  return (
    <div className="container mt-5">
      <h2>Sales</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? (
        <div className="d-flex justify-content-center my-4"><Spinner animation="border" /></div>
      ) : (
        <>
          <Form className="mb-3">
            <Row className="g-2">
              <Col md={4}>
                <InputGroup>
                  <InputGroup.Text>Search</InputGroup.Text>
                  <Form.Control value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="customer, product or id" />
                </InputGroup>
              </Col>
              <Col md={2}>
                <Form.Select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="Pending Delivery">Pending Delivery</option>
                  <option value="Partial">Partial</option>
                  <option value="Delivered">Delivered</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Control type="date" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} />
              </Col>
              <Col md={2}>
                <Form.Control type="date" value={toDate} onChange={(e)=>setToDate(e.target.value)} />
              </Col>
              <Col md={2} className="d-flex">
                <Button variant="secondary" className="me-2" onClick={() => { setQuery(''); setStatusFilter('all'); setFromDate(''); setToDate(''); }}>Reset</Button>
                <Button variant="primary" onClick={exportPDF}>Export PDF</Button>
              </Col>
            </Row>
          </Form>

          <div className="table-responsive">
            <table className="table table-sm table-bordered">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product Type</th>
                  <th>Qty</th>
                  <th>Delivered</th>
                  <th>Pending</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="10" className="text-center text-muted">No sales found.</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.order_date}</td>
                    <td>{r.customer_name}</td>
                    <td>{r.product_type}</td>
                    <td>{r.order_quantity}</td>
                    <td>{r.delivered_qty}</td>
                    <td>{r.pending_qty}</td>
                    <td>{Number(r.unit_price || 0).toFixed(2)}</td>
                    <td>{Number((r.total_amount ?? (r.delivered_qty * r.unit_price)) || 0).toFixed(2)}</td>
                    <td className="d-flex align-items-center justify-content-between">
                      <span>{r.status}</span>
                      <Button size="sm" variant="outline-primary" onClick={()=>exportRowPDF(r)}>PDF</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan="4">Totals (shown)</th>
                  <th>{totals.qty}</th>
                  <th>{totals.delivered}</th>
                  <th>{totals.pending}</th>
                  <th></th>
                  <th>{Number(totals.total).toFixed(2)}</th>
                  <th></th>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default Sales;
