import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Spinner, Container } from 'react-bootstrap';
import api from '../services/api';
import { FaChartLine, FaChartPie, FaTable, FaTachometerAlt } from 'react-icons/fa';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// Distinct, colorblind-friendly palette for charts
const PIE_COLORS = ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
const FEED_USED_COLOR = '#1f77b4'; // blue
const FEED_PURCHASED_COLOR = '#ff7f0e'; // orange

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [mortalityMonths, setMortalityMonths] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(`/dashboard?mortalityMonths=${mortalityMonths}`);
        setStats(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, [mortalityMonths]);

  if (loading) {
    return (
      <Container>
        <div className="loading-spinner">
          <Spinner animation="border" variant="success" size="lg" />
        </div>
      </Container>
    );
  }

  const dashboardData = stats || { total_chicks: 0, current_stock: 0, mortality_rate: 0, monthly_sales: 0, feed_consumption: [], breed_distribution: [], product_distribution: [], recent_activity: [] };

  return (
    <Container fluid className="py-4">
      {/* Page Header */}
      <div className="page-header">
        <div className="d-flex align-items-center">
          <FaTachometerAlt className="me-3" style={{ fontSize: '2rem', color: 'var(--primary-green)' }} />
          <div>
            <h1 className="page-title">Farm Dashboard</h1>
            <p className="page-subtitle">Real-time overview of your poultry farm operations</p>
          </div>
        </div>
      </div>
      
      {/* Controls + Stats Cards */}
      <Row className="mb-4 g-4">
        <Col md={12} className="d-flex justify-content-end">
          <div className="d-flex align-items-center gap-2">
            <label className="me-2 small text-muted">Mortality Period</label>
            <select className="form-select form-select-sm" style={{width: 160}}
              value={mortalityMonths}
              onChange={(e)=>setMortalityMonths(Number(e.target.value))}
            >
              <option value={1}>Last 1 month</option>
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </div>
        </Col>
      </Row>

      <Row className="mb-4 g-4">
        <Col md={6} lg={3}>
          <Card className="stats-card h-100">
            <Card.Body className="text-center">
              <div className="stats-icon chicken">
                🐔
              </div>
              <h2 className="stats-number">{dashboardData.total_chicks || 0}</h2>
              <p className="stats-label">Total Chicks</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="stats-card h-100">
            <Card.Body className="text-center">
              <div className="stats-icon feed">
                📊
              </div>
              <h2 className="stats-number">{dashboardData.current_stock || 0}</h2>
              <p className="stats-label">Current Stock</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="stats-card h-100">
            <Card.Body className="text-center">
              <div className="stats-icon slaughter">
                📈
              </div>
              <h2 className="stats-number">{dashboardData.mortality_rate || 0}%</h2>
              <p className="stats-label">Mortality Rate</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="stats-card h-100">
            <Card.Body className="text-center">
              <div className="stats-icon users">
                💰
              </div>
              <h2 className="stats-number">${Number(dashboardData.total_sales || 0).toFixed(2)}</h2>
              <p className="stats-label">Total Sales</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row className="mb-4 g-4">
        <Col lg={8}>
          <Card className="card-modern h-100">
            <Card.Header className="card-header-modern">
              <FaChartLine className="me-2" />
              Feed Consumption Trends
            </Card.Header>
            <Card.Body>
              {(dashboardData.feed_consumption || []).length === 0 ? (
                <div className="text-center text-muted py-5">No feed activity found for the selected period.</div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={dashboardData.feed_consumption || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="used" fill={FEED_USED_COLOR} name="Used (kg)" />
                    <Bar dataKey="purchased" fill={FEED_PURCHASED_COLOR} name="Purchased (kg)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="card-modern h-100">
            <Card.Header className="card-header-modern">
              <FaChartPie className="me-2" />
              Breed Distribution
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={dashboardData.breed_distribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {(dashboardData.breed_distribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Row>
        <Col>
          <Card className="card-modern">
            <Card.Header className="card-header-modern">
              <FaTable className="me-2" />
              Recent Activity
            </Card.Header>
            <Card.Body className="p-0">
              <Table className="table-modern mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Activity Type</th>
                    <th>Details</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboardData.recent_activity || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted">No recent activity</td>
                    </tr>
                  ) : (
                    (dashboardData.recent_activity || []).map((a, idx) => (
                      <tr key={idx}>
                        <td>{a.date ? new Date(a.date).toLocaleDateString() : '-'}</td>
                        <td>{a.type}</td>
                        <td>{a.details}</td>
                        <td><span className="badge bg-success">Recorded</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Dashboard;
