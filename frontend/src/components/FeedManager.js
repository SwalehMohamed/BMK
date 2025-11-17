import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import api from '../services/api';

function FeedManager() {
  const [feeds, setFeeds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingFeedId, setEditingFeedId] = useState(null);
  const [feedData, setFeedData] = useState({
    type: '',
    quantity_kg: '',
    supplier: '',
    purchase_date: '', 
    expiry_date: ''
  });
  const [usageData, setUsageData] = useState({
    feed_id: '',
    batch_id: '',
    quantity_used: '',
    date_used: ''
  });
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showUsageTableModal, setShowUsageTableModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [selectedFeedId, setSelectedFeedId] = useState(null);
  const [usageEvents, setUsageEvents] = useState([]);
  const [usageMeta, setUsageMeta] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [usageSearch, setUsageSearch] = useState('');
  const [usageStartDate, setUsageStartDate] = useState('');
  const [usageEndDate, setUsageEndDate] = useState('');
  const totalFeedQty = feeds.reduce((a, f) => a + Number(f.quantity_kg || 0), 0);
  const totalFeedUsed = feeds.reduce((a, f) => a + Number(f.used_total || 0), 0);

  useEffect(() => {
    fetchFeeds();
    fetchBatches(); 
  }, []);

  useEffect(() => {
    if (selectedFeedId) {
      fetchUsageEvents(1); // reset to page 1 when changing feed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeedId]);

  const fetchUsageEvents = async (page = usageMeta.page) => {
    if (!selectedFeedId) return;
    try {
      const params = new URLSearchParams({
        feed_id: selectedFeedId,
        page: String(page),
        limit: String(usageMeta.limit),
      });
      if (usageSearch.trim()) params.append('q', usageSearch.trim());
      if (usageStartDate && usageEndDate) {
        params.append('start_date', usageStartDate);
        params.append('end_date', usageEndDate);
      }
      const res = await api.get(`/feed/usage?${params.toString()}`);
      setUsageEvents(Array.isArray(res.data.usage) ? res.data.usage : []);
      if (res.data.meta) setUsageMeta(res.data.meta);
    } catch (err) {
      setUsageEvents([]);
    }
  };

  const fetchFeeds = async () => {
    setLoading(true);
    try {
      const response = await api.get('/feed');
      setFeeds(response.data || []);
      if(response.data && response.data.length > 0) {
        setUsageData(prev => ({...prev, feed_id: response.data[0].id}));
      }
      setError('');
    } catch (error) {
      setError('Error fetching feeds');
      console.error('Error fetching feeds:', error);
      setFeeds([]);
    }
    setLoading(false);
  };

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const response = await api.get('/chicks');
      // Handle paginated response - extract the data array
      setBatches(response.data.data || []);
      setError('');
    } catch (error) {
      setError('Error fetching batches');
      console.error('Error fetching batches:', error);
      // Set empty array as fallback
      setBatches([]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing && editingFeedId) {
        await api.put(`/feed/${editingFeedId}`, feedData);
      } else {
        await api.post('/feed', feedData);
      }
      fetchFeeds();
      setShowModal(false);
      setSuccess(isEditing ? 'Feed updated successfully' : 'Feed added successfully');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
      setIsEditing(false);
      setEditingFeedId(null);
      setFeedData({ type: '', quantity_kg: '', supplier: '', purchase_date: '', expiry_date: '' });
    } catch (error) {
      setError(isEditing ? 'Error updating feed' : 'Error adding feed');
      console.error('Error adding feed:', error);
    }
  };

  const handleDeleteFeed = async (feed) => {
    if (!window.confirm(`Delete feed '${feed.type}' from ${feed.supplier}? This cannot be undone if no usage events are present.`)) return;
    try {
      await api.delete(`/feed/${feed.id}`);
      setSuccess('Feed deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
      fetchFeeds();
    } catch (error) {
      const serverMsg = error?.response?.data?.message || error?.response?.data?.errors?.[0]?.message;
      setError(serverMsg || 'Error deleting feed');
    }
  };

  const [editingUsageId, setEditingUsageId] = useState(null);
  const [editingUsageQty, setEditingUsageQty] = useState('');

  const beginEditUsage = (event) => {
    setEditingUsageId(event.id);
    setEditingUsageQty(event.amount_used);
  };

  const cancelEditUsage = () => {
    setEditingUsageId(null);
    setEditingUsageQty('');
  };

  const saveEditUsage = async (event) => {
    const newQty = Number(editingUsageQty);
    if (isNaN(newQty) || newQty <= 0) {
      setError('Enter a valid positive quantity');
      return;
    }
    try {
      await api.put(`/feed/usage/${event.id}`, { quantity_used: newQty });
      setSuccess('Usage event updated');
      setTimeout(() => setSuccess(''), 3000);
      cancelEditUsage();
      // Refresh usage events & feeds
      fetchUsageEvents();
      fetchFeeds();
    } catch (error) {
      const serverMsg = error?.response?.data?.message || error?.response?.data?.errors?.[0]?.message;
      setError(serverMsg || 'Error updating usage event');
    }
  };

  const deleteUsageEvent = async (event) => {
    if (!window.confirm('Delete this usage event and restore its quantity to feed stock?')) return;
    try {
      await api.delete(`/feed/usage/${event.id}`);
      setSuccess('Usage event deleted');
      setTimeout(() => setSuccess(''), 3000);
      fetchUsageEvents();
      fetchFeeds();
    } catch (error) {
      const serverMsg = error?.response?.data?.message || error?.response?.data?.errors?.[0]?.message;
      setError(serverMsg || 'Error deleting usage event');
    }
  };

  const handleRecordUsage = async (e) => {
    e.preventDefault();
    try {
      // Client-side validation against available quantity
      const selected = Array.isArray(feeds) ? feeds.find(f => String(f.id) === String(usageData.feed_id)) : null;
      const available = selected ? Number(selected.quantity_kg) : 0;
      const requested = Number(usageData.quantity_used);
      if (!selected) {
        setError('Please select a valid feed item.');
        return;
      }
      if (isNaN(requested) || requested <= 0) {
        setError('Please enter a valid quantity used.');
        return;
      }
      if (requested > available) {
        setError(`Quantity used exceeds available stock (${available} kg).`);
        return;
      }
      await api.post('/feed/usage', usageData);
      fetchFeeds();
      setShowUsageModal(false);
      setSuccess('Feed usage recorded successfully');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
    } catch (error) {
      // Try to surface server validation message if available
      const serverMsg = error?.response?.data?.message || error?.response?.data?.errors?.[0]?.message;
      setError(serverMsg || 'Error recording feed usage');
      console.error('Error recording usage:', error);
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between mb-4">
        <h2>Feed Management</h2>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        {loading ? (
          <div className="d-flex justify-content-center my-4">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : (
          <Button variant="primary" onClick={() => setShowModal(true)}>
            Add New Feed
          </Button>
        )}
      </div>

      <div className="d-flex flex-wrap gap-3 mb-3 small text-muted">
        <div className="badge bg-secondary">Feed Items: {Array.isArray(feeds) ? feeds.length : 0}</div>
        <div className="badge bg-info">Total Remaining (kg): {totalFeedQty.toFixed(2)}</div>
        <div className="badge bg-warning text-dark">Total Used (kg): {totalFeedUsed.toFixed(2)}</div>
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Type</th>
            <th>Remaining (kg)</th>
            <th>Used (kg)</th>
            <th>% Consumed</th>
            <th>Supplier</th>
            <th>Purchase Date</th>
            <th>Expiry Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(feeds) && feeds.map((feed) => (
            <tr key={feed.id}>
              <td>{feed.type}</td>
              <td>{feed.quantity_kg}</td>
              <td>{feed.used_total || 0}</td>
              <td>{(() => {
                const used = Number(feed.used_total || 0);
                const remaining = Number(feed.quantity_kg || 0);
                const original = used + remaining;
                if (original <= 0) return '0%';
                return ((used / original) * 100).toFixed(1) + '%';
              })()}</td>
              <td>{feed.supplier}</td>
              <td>{new Date(feed.purchase_date).toLocaleDateString()}</td>
              <td>{new Date(feed.expiry_date).toLocaleDateString()}</td>
              <td>
                <Button
                  variant="warning"
                  size="sm"
                  className="me-2"
                  onClick={() => {
                    setIsEditing(true);
                    setEditingFeedId(feed.id);
                    setFeedData({
                      type: feed.type || '',
                      quantity_kg: feed.quantity_kg || '',
                      supplier: feed.supplier || '',
                      purchase_date: feed.purchase_date ? new Date(feed.purchase_date).toISOString().slice(0,10) : '',
                      expiry_date: feed.expiry_date ? new Date(feed.expiry_date).toISOString().slice(0,10) : ''
                    });
                    setShowModal(true);
                  }}
                >
                  Edit
                </Button>
                <Button 
                  variant="info" 
                  size="sm" 
                  onClick={() => {
                    setUsageData(prev => ({...prev, feed_id: feed.id}));
                    setShowUsageModal(true);
                  }}
                >
                  Record Usage
                </Button>{' '}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedFeedId(feed.id);
                    setShowUsageTableModal(true);
                  }}
                >
                  View Usage
                </Button>
                {' '}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteFeed(feed)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Add Feed Modal */}
      <Modal show={showModal} onHide={() => { setShowModal(false); setIsEditing(false); setEditingFeedId(null); }}>
        <Modal.Header closeButton>
          <Modal.Title>{isEditing ? 'Edit Feed' : 'Add New Feed'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group controlId="type" className="mb-3">
              <Form.Label>Feed Type</Form.Label>
              <Form.Control 
                as="select" 
                value={feedData.type}
                onChange={(e) => setFeedData({...feedData, type: e.target.value})}
                required
              >
                <option value="">Select type</option>
                <option value="starter">Starter</option>
                <option value="grower">Grower</option>
                <option value="finisher">Finisher</option>
                <option value="layer">Layer</option>
              </Form.Control>
            </Form.Group>

            <Form.Group controlId="quantity" className="mb-3">
              <Form.Label>Quantity (kg)</Form.Label>
              <Form.Control 
                type="number" 
                min="0"
                step="0.01"
                value={feedData.quantity_kg}
                onChange={(e) => setFeedData({...feedData, quantity_kg: e.target.value})}
                required
              />
            </Form.Group>

            <Form.Group controlId="supplier" className="mb-3">
              <Form.Label>Supplier</Form.Label>
              <Form.Control 
                type="text"
                value={feedData.supplier}
                onChange={(e) => setFeedData({...feedData, supplier: e.target.value})}
                required
              />
            </Form.Group>

            <Form.Group controlId="purchaseDate" className="mb-3">
              <Form.Label>Purchase Date</Form.Label>
              <Form.Control 
                type="date"
                value={feedData.purchase_date}
                onChange={(e) => setFeedData({...feedData, purchase_date: e.target.value})}
                required
              />
            </Form.Group>

            <Form.Group controlId="expiryDate" className="mb-3">
              <Form.Label>Expiry Date</Form.Label>
              <Form.Control 
                type="date"
                value={feedData.expiry_date}
                onChange={(e) => setFeedData({...feedData, expiry_date: e.target.value})}
                required
              />
            </Form.Group>

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit">
                {isEditing ? 'Update Feed' : 'Save Feed'}
              </Button>
              {isEditing && (
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingFeedId(null);
                    setFeedData({ type: '', quantity_kg: '', supplier: '', purchase_date: '', expiry_date: '' });
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Record Usage Modal */}
      <Modal show={showUsageModal} onHide={() => setShowUsageModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Record Feed Usage</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleRecordUsage}>
            <Form.Group controlId="feedId" className="mb-3">
              <Form.Label>Feed</Form.Label>
              <Form.Control 
                as="select"
                value={usageData.feed_id}
                onChange={(e) => setUsageData({...usageData, feed_id: e.target.value})}
                required
              >
                {Array.isArray(feeds) && feeds.map(feed => (
                  <option key={feed.id} value={feed.id}>
                    {feed.type} ({feed.supplier}) - Available: {feed.quantity_kg} kg
                  </option>
                ))}
              </Form.Control>
            </Form.Group>

            <Form.Group controlId="batchId" className="mb-3">
              <Form.Label>Chick Batch</Form.Label>
              <Form.Control 
                as="select"
                value={usageData.batch_id}
                onChange={(e) => setUsageData({...usageData, batch_id: e.target.value})}
                required
              >
                <option value="">Select batch</option>
                {Array.isArray(batches) && batches.map(batch => (
                <option key={batch.id} value={batch.id}>
                {batch.batch_name}
                </option>
                ))}
              </Form.Control>
            </Form.Group>

            <Form.Group controlId="quantityUsed" className="mb-3">
              <Form.Label>Quantity Used (kg)</Form.Label>
              <Form.Control 
                type="number"
                min="0"
                step="0.01"
                value={usageData.quantity_used}
                onChange={(e) => setUsageData({...usageData, quantity_used: e.target.value})}
                max={(() => {
                  const selected = Array.isArray(feeds) ? feeds.find(f => String(f.id) === String(usageData.feed_id)) : null;
                  return selected ? Number(selected.quantity_kg) : undefined;
                })()}
                required
              />
              {(() => {
                const selected = Array.isArray(feeds) ? feeds.find(f => String(f.id) === String(usageData.feed_id)) : null;
                if (!selected) return null;
                return (
                  <small className="text-muted">Available: {selected.quantity_kg} kg</small>
                );
              })()}
            </Form.Group>

            <Form.Group controlId="dateUsed" className="mb-3">
              <Form.Label>Date Used</Form.Label>
              <Form.Control 
                type="date"
                value={usageData.date_used}
                onChange={(e) => setUsageData({...usageData, date_used: e.target.value})}
                required
              />
            </Form.Group>

            <Button variant="primary" type="submit">
              Record Usage
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Usage Events Table Modal */}
      <Modal show={showUsageTableModal} onHide={() => setShowUsageTableModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Usage Events for Feed #{selectedFeedId}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="mb-3" onSubmit={(e) => { e.preventDefault(); fetchUsageEvents(1); }}>
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <Form.Label>Search User</Form.Label>
                <Form.Control
                  type="text"
                  value={usageSearch}
                  onChange={(e) => setUsageSearch(e.target.value)}
                  placeholder="e.g. Ahmed"
                />
              </div>
              <div className="col-md-3">
                <Form.Label>Start Date</Form.Label>
                <Form.Control
                  type="date"
                  value={usageStartDate}
                  onChange={(e) => setUsageStartDate(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <Form.Label>End Date</Form.Label>
                <Form.Control
                  type="date"
                  value={usageEndDate}
                  onChange={(e) => setUsageEndDate(e.target.value)}
                />
              </div>
              <div className="col-md-3 d-flex gap-2">
                <div className="flex-grow-1">
                  <Form.Label>Page Size</Form.Label>
                  <Form.Select
                    value={usageMeta.limit}
                    onChange={(e) => setUsageMeta(m => ({ ...m, limit: Number(e.target.value), page: 1 }))}
                  >
                    {[10,20,50,100].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                  </Form.Select>
                </div>
                <Button className="align-self-end" variant="primary" type="submit">Apply</Button>
              </div>
            </div>
          </Form>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>User</th>
                <th>Batch</th>
                <th>Amount Used (kg)</th>
                <th>Date/Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(usageEvents) && usageEvents.length === 0 ? (
                <tr><td colSpan={5}>No usage events found.</td></tr>
              ) : (
                Array.isArray(usageEvents) && usageEvents.map(event => {
                  const isEditingUsage = editingUsageId === event.id;
                  const batchName = (() => {
                    const b = Array.isArray(batches) ? batches.find(x => String(x.id) === String(event.batch_id)) : null;
                    return b?.batch_name || (event.batch_id ? `#${event.batch_id}` : '-');
                  })();
                  return (
                    <tr key={event.id}>
                      <td>{event.user_name}</td>
                      <td>{batchName}</td>
                      <td>
                        {isEditingUsage ? (
                          <Form.Control
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingUsageQty}
                            onChange={(e) => setEditingUsageQty(e.target.value)}
                            style={{ maxWidth: '120px' }}
                          />
                        ) : (
                          event.amount_used
                        )}
                      </td>
                      <td>{new Date(event.used_at).toLocaleString()}</td>
                      <td>
                        {isEditingUsage ? (
                          <>
                            <Button variant="success" size="sm" onClick={() => saveEditUsage(event)}>Save</Button>{' '}
                            <Button variant="outline-secondary" size="sm" onClick={cancelEditUsage}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="warning" size="sm" onClick={() => beginEditUsage(event)}>Edit</Button>{' '}
                            <Button variant="danger" size="sm" onClick={() => deleteUsageEvent(event)}>Delete</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <div className="small text-muted">Page {usageMeta.page} of {usageMeta.pages} | Total {usageMeta.total} events</div>
            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={usageMeta.page <= 1}
                onClick={() => fetchUsageEvents(usageMeta.page - 1)}
              >Prev</Button>
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={usageMeta.page >= usageMeta.pages}
                onClick={() => fetchUsageEvents(usageMeta.page + 1)}
              >Next</Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default FeedManager;
