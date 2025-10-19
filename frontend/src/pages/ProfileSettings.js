import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { FaUser, FaEnvelope, FaLock, FaSave, FaEye, FaEyeSlash } from 'react-icons/fa';
import api from '../services/api';

function ProfileSettings() {
  const { currentUser, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [changePassword, setChangePassword] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        name: currentUser.name || '',
        email: currentUser.email || ''
      }));
    }
  }, [currentUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Validate password change if requested
      if (changePassword) {
        if (!formData.currentPassword) {
          throw new Error('Current password is required to change password');
        }
        if (formData.newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters long');
        }
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error('New passwords do not match');
        }
      }

      // Prepare update data
      const updateData = {
        name: formData.name,
        email: formData.email
      };

      if (changePassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      // Make API call to update profile
      const response = await api.put('/users/profile', updateData);
      
      // Update current user context if the API returns updated user data
      if (response.data.user) {
        updateUser(response.data.user);
      }

      setMessage({ 
        type: 'success', 
        text: 'Profile updated successfully!' 
      });

      // Clear password fields
      if (changePassword) {
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
        setChangePassword(false);
      }

    } catch (error) {
      console.error('Profile update error:', error);
      setMessage({ 
        type: 'danger', 
        text: error.response?.data?.message || error.message || 'Failed to update profile' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="loading-spinner">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <Container className="mt-4">
      <div className="page-header">
        <h1 className="page-title">
          <FaUser className="me-3" />
          Profile Settings
        </h1>
        <p className="page-subtitle">Manage your account information and security settings</p>
      </div>

      <Row className="justify-content-center">
        <Col xs={12} lg={8}>
          <Card className="card-modern">
            <Card.Header className="card-header-blue">
              <h4 className="mb-0">
                <FaUser className="me-2" />
                Account Information
              </h4>
            </Card.Header>
            <Card.Body className="p-4">
              {message.text && (
                <Alert 
                  variant={message.type} 
                  className={`alert-modern alert-${message.type}-modern mb-4`}
                >
                  {message.text}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                {/* Basic Information */}
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label-modern">
                        <FaUser className="me-2" />
                        Full Name
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="form-control-modern form-control-blue"
                        placeholder="Enter your full name"
                        required
                        disabled={loading}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="form-label-modern">
                        <FaEnvelope className="me-2" />
                        Email Address
                      </Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="form-control-modern form-control-blue"
                        placeholder="Enter your email address"
                        required
                        disabled={loading}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {/* Current Role (Read-only) */}
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-4">
                      <Form.Label className="form-label-modern">
                        Current Role
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={currentUser.role?.toUpperCase() || 'USER'}
                        className="form-control-modern"
                        disabled
                        readOnly
                      />
                      <Form.Text className="text-muted">
                        Contact an administrator to change your role
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                {/* Password Change Section */}
                <div className="border-top pt-4 mt-4">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h5 className="mb-0">
                      <FaLock className="me-2" />
                      Change Password
                    </h5>
                    <Form.Check
                      type="switch"
                      id="change-password-switch"
                      label="Enable password change"
                      checked={changePassword}
                      onChange={(e) => setChangePassword(e.target.checked)}
                      disabled={loading}
                    />
                  </div>

                  {changePassword && (
                    <Row>
                      <Col md={12}>
                        <Form.Group className="mb-3">
                          <Form.Label className="form-label-modern">
                            Current Password
                          </Form.Label>
                          <div className="position-relative">
                            <Form.Control
                              type={showPasswords.current ? "text" : "password"}
                              name="currentPassword"
                              value={formData.currentPassword}
                              onChange={handleInputChange}
                              className="form-control-modern form-control-blue"
                              placeholder="Enter your current password"
                              required={changePassword}
                              disabled={loading}
                            />
                            <Button
                              variant="outline-secondary"
                              className="position-absolute top-50 end-0 translate-middle-y me-2 border-0"
                              style={{ zIndex: 10 }}
                              onClick={() => togglePasswordVisibility('current')}
                              disabled={loading}
                            >
                              {showPasswords.current ? <FaEyeSlash /> : <FaEye />}
                            </Button>
                          </div>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label className="form-label-modern">
                            New Password
                          </Form.Label>
                          <div className="position-relative">
                            <Form.Control
                              type={showPasswords.new ? "text" : "password"}
                              name="newPassword"
                              value={formData.newPassword}
                              onChange={handleInputChange}
                              className="form-control-modern form-control-blue"
                              placeholder="Enter new password"
                              required={changePassword}
                              disabled={loading}
                              minLength={6}
                            />
                            <Button
                              variant="outline-secondary"
                              className="position-absolute top-50 end-0 translate-middle-y me-2 border-0"
                              style={{ zIndex: 10 }}
                              onClick={() => togglePasswordVisibility('new')}
                              disabled={loading}
                            >
                              {showPasswords.new ? <FaEyeSlash /> : <FaEye />}
                            </Button>
                          </div>
                          <Form.Text className="text-muted">
                            Password must be at least 6 characters long
                          </Form.Text>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label className="form-label-modern">
                            Confirm New Password
                          </Form.Label>
                          <div className="position-relative">
                            <Form.Control
                              type={showPasswords.confirm ? "text" : "password"}
                              name="confirmPassword"
                              value={formData.confirmPassword}
                              onChange={handleInputChange}
                              className="form-control-modern form-control-blue"
                              placeholder="Confirm new password"
                              required={changePassword}
                              disabled={loading}
                            />
                            <Button
                              variant="outline-secondary"
                              className="position-absolute top-50 end-0 translate-middle-y me-2 border-0"
                              style={{ zIndex: 10 }}
                              onClick={() => togglePasswordVisibility('confirm')}
                              disabled={loading}
                            >
                              {showPasswords.confirm ? <FaEyeSlash /> : <FaEye />}
                            </Button>
                          </div>
                        </Form.Group>
                      </Col>
                    </Row>
                  )}
                </div>

                {/* Submit Button */}
                <div className="d-flex justify-content-end mt-4">
                  <Button 
                    type="submit" 
                    className="btn-primary-blue"
                    disabled={loading}
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <FaSave className="me-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default ProfileSettings;
