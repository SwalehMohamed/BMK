import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import api from '../services/api';

function FeedManager() {
  const [feeds, setFeeds] = useState([]);
  const [showModal, setShowModal] = useState(false);
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
  const totalFeedQty = feeds.reduce((a, f) => a + Number(f.quantity_kg || 0), 0);

  useEffect(() => {
    fetchFeeds();
    fetchBatches(); 
  }, []);

  useEffect(() => {
    if (selectedFeedId) {
      api.get(`/feed/usage?feed_id=${selectedFeedId}`)
        .then(res => setUsageEvents(Array.isArray(res.data.usage) ? res.data.usage : []))
        .catch(() => setUsageEvents([]));
    }
  }, [selectedFeedId]);

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
      await api.post('/feed', feedData);
      fetchFeeds();
      setShowModal(false);
      setSuccess('Feed added successfully');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
    } catch (error) {
      setError('Error adding feed');
      console.error('Error adding feed:', error);
    }
  };

  const handleRecordUsage = async (e) => {
    e.preventDefault();
    try {
      await api.post('/feed/usage', usageData);
      fetchFeeds();
      setShowUsageModal(false);
      setSuccess('Feed usage recorded successfully');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
    } catch (error) {
      setError('Error recording feed usage');
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
        <div className="badge bg-info">Total Qty (kg): {totalFeedQty.toFixed(2)}</div>
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Type</th>
            <th>Quantity (kg)</th>
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
              <td>{feed.supplier}</td>
              <td>{new Date(feed.purchase_date).toLocaleDateString()}</td>
              <td>{new Date(feed.expiry_date).toLocaleDateString()}</td>
              <td>
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
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Add Feed Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Feed</Modal.Title>
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

            <Button variant="primary" type="submit">
              Save Feed
            </Button>
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
                    {feed.type} ({feed.supplier})
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
                required
              />
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
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>User</th>
                <th>Amount Used</th>
                <th>Date/Time</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(usageEvents) && usageEvents.length === 0 ? (
                <tr><td colSpan={3}>No usage events found.</td></tr>
              ) : (
                Array.isArray(usageEvents) && usageEvents.map(event => (
                  <tr key={event.id}>
                    <td>{event.user_name}</td>
                    <td>{event.amount_used}</td>
                    <td>{new Date(event.used_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default FeedManager;
