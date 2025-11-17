import React, { useState } from 'react';
import api from '../services/api';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await api.post('/users/forgot-password', { email });
      setStatus({ type: 'success', msg: 'If that email exists a reset link has been sent.' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.message || 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: 480 }}>
      <h3>Forgot Password</h3>
      <form onSubmit={submit}>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <button className="btn btn-primary" disabled={loading}>Send Reset Link</button>
      </form>
      {status && (
        <div className={`alert mt-3 alert-${status.type === 'success' ? 'success' : 'danger'}`}>{status.msg}</div>
      )}
    </div>
  );
}

export default ForgotPassword;
