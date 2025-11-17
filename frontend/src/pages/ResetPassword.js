import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    const t = params.get('token');
    if (t) setToken(t);
  }, [params]);

  const submit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (password.length < 8) return setStatus({ type: 'error', msg: 'Password must be at least 8 characters' });
    if (password !== confirm) return setStatus({ type: 'error', msg: 'Passwords do not match' });
    try {
      await api.post('/users/reset-password', { token, password });
      setStatus({ type: 'success', msg: 'Password reset successful. Redirecting to login...' });
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.message || 'Reset failed' });
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: 480 }}>
      <h3>Reset Password</h3>
      <form onSubmit={submit}>
        <div className="mb-3">
          <label className="form-label">New Password</label>
          <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Confirm Password</label>
          <input type="password" className="form-control" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <button className="btn btn-primary">Reset Password</button>
      </form>
      {status && (
        <div className={`alert mt-3 alert-${status.type === 'success' ? 'success' : 'danger'}`}>{status.msg}</div>
      )}
    </div>
  );
}

export default ResetPassword;
