import React from 'react';
import { Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function AdminLanding() {
  return (
    <Container className="mt-5 text-center">
      <div className="p-5 mb-4 bg-light rounded-3">
        <h1 className="display-4">Admin Dashboard</h1>
        <p className="lead">
          Manage all aspects of the chicken farm
        </p>
        <hr className="my-4" />
        <p>
          You have access to all modules including user management and system configuration.
        </p>
        <Link to="/dashboard">
          <Button variant="primary" size="lg">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </Container>
  );
}

export default AdminLanding;
