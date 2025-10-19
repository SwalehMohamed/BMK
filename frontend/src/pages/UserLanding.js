import React from 'react';
import { Container, Button, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function UserLanding() {
  return (
    <Container className="mt-5">
      <div className="p-5 mb-4 bg-light rounded-3 text-center">
        <h1 className="display-4">Welcome to BinMasud Kuku</h1>
        <p className="lead">
          Chicken farm management system
        </p>
      </div>
      
      <Row className="mt-5">
        <Col md={4} className="mb-4">
          <div className="p-4 border rounded">
            <h3>Feed Management</h3>
            <p>Track and manage chicken feed inventory</p>
            <Link to="/feed">
              <Button variant="outline-primary">Go to Feed</Button>
            </Link>
          </div>
        </Col>
        <Col md={4} className="mb-4">
          <div className="p-4 border rounded">
            <h3>Chick Management</h3>
            <p>Manage chick batches and track mortality</p>
            <Link to="/chicks">
              <Button variant="outline-primary">Go to Chicks</Button>
            </Link>
          </div>
        </Col>
        <Col md={4} className="mb-4">
          <div className="p-4 border rounded">
            <h3>Slaughter Records</h3>
            <p>Process and track slaughtered chickens</p>
            <Link to="/slaughter">
              <Button variant="outline-primary">Go to Slaughter</Button>
            </Link>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default UserLanding;
