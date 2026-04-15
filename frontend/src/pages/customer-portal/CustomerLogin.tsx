import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../api';

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/customer-portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      localStorage.setItem('customer_token', json.data.token);
      localStorage.setItem('customer_user', JSON.stringify(json.data.user));
      navigate('/customer-portal');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
      <div style={{ width: 400, padding: 32, background: 'var(--surface-container)', borderRadius: 'var(--border-radius-lg)', boxShadow: 'var(--modal-shadow)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span className="material-icons" style={{ fontSize: 48, color: 'var(--primary)' }}>business</span>
          <h1 style={{ margin: '8px 0 4px', fontSize: 24, fontWeight: 700 }}>Customer Portal</h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: 14 }}>Sign in to view shipments, orders, and invoices</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{error}</div>}
          <div className="vn-field" style={{ marginBottom: 16 }}>
            <label className="vn-field-label">Email</label>
            <input className="vn-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="vn-field" style={{ marginBottom: 24 }}>
            <label className="vn-field-label">Password</label>
            <input className="vn-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="vn-btn vn-btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
