import React from 'react';
import { Navbar, Nav, Container, NavDropdown } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useAuth } from '../context/AuthContext';
import { FaUserCircle, FaSignOutAlt, FaCog } from 'react-icons/fa';

function Header() {
  const { currentUser, logout } = useAuth();
  
  return (
    <Navbar className="navbar-custom" variant="dark" expand="lg" collapseOnSelect>
      <Container>
        <LinkContainer to="/">
          <Navbar.Brand className="d-flex align-items-center">
            <img 
              src="/logo192.png" 
              alt="Bin Masud Kuku Logo" 
              height="80" 
              width="80" 
              className="me-2"
            />
          </Navbar.Brand>
        </LinkContainer>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {currentUser && (
              <>
                <LinkContainer to="/dashboard">
                  <Nav.Link className="fw-medium">📊 Dashboard</Nav.Link>
                </LinkContainer>
                <LinkContainer to="/feed">
                  <Nav.Link className="fw-medium">🌾 Feed </Nav.Link>
                </LinkContainer>
                <LinkContainer to="/chicks">
                  <Nav.Link className="fw-medium">🐣 Chicks</Nav.Link>
                </LinkContainer>
                <LinkContainer to="/mortalities">
                  <Nav.Link className="fw-medium">☠️ Mortalities</Nav.Link>
                </LinkContainer>
                <LinkContainer to="/slaughter">
                  <Nav.Link className="fw-medium">🥩 Slaughter </Nav.Link>
                </LinkContainer>
                <LinkContainer to="/products">
                  <Nav.Link className="fw-medium">📦 Products</Nav.Link>
                </LinkContainer>
                <LinkContainer to="/orders">
                  <Nav.Link className="fw-medium">🧾 Orders</Nav.Link>
                </LinkContainer>
                <LinkContainer to="/deliveries">
                  <Nav.Link className="fw-medium">🚚 Deliveries</Nav.Link>
                </LinkContainer>
                {currentUser.role === 'admin' && (
                  <LinkContainer to="/product-types">
                    <Nav.Link className="fw-medium">🏷️ Product Types</Nav.Link>
                  </LinkContainer>
                )}
                {currentUser.role === 'admin' && (
                  <LinkContainer to="/sales">
                    <Nav.Link className="fw-medium">💰 Sales</Nav.Link>
                  </LinkContainer>
                )}
                {currentUser.role === 'admin' && (
                  <LinkContainer to="/users">
                    <Nav.Link className="fw-medium">
                      👥 Users
                    </Nav.Link>
                  </LinkContainer>
                )}
              </>
            )}
          </Nav>
          <Nav>
            {currentUser ? (
              <NavDropdown 
                title={
                  <span>
                    <FaUserCircle className="me-2" />
                    {currentUser.name || currentUser.email}
                  </span>
                } 
                id="username"
                className="fw-medium"
              >
                <LinkContainer to="/profile">
                  <NavDropdown.Item>
                    <FaCog className="me-2" />
                    Profile Settings
                  </NavDropdown.Item>
                </LinkContainer>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={logout} className="text-danger">
                  <FaSignOutAlt className="me-2" />
                  Logout
                </NavDropdown.Item>
              </NavDropdown>
            ) : (
              <>
                <LinkContainer to="/login">
                  <Nav.Link>Login</Nav.Link>
                </LinkContainer>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Header;