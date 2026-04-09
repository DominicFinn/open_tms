import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../api';

export default function CarrierLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else {
        localStorage.setItem('carrier_token', json.data.token);
        localStorage.setItem('carrier_user', JSON.stringify(json.data.user));
        navigate('/carrier-portal');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-background)',
      padding: 'var(--spacing-3)',
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-3)' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--color-primary)' }}>local_shipping</span>
          <h2 style={{ margin: '8px 0 4px' }}>Carrier Portal</h2>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '14px' }}>
            Sign in to view tenders and submit bids
          </p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--spacing-2)' }}>
            <label className="field-label">Email</label>
            <input
              className="text-field"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="your@email.com"
            />
          </div>
          <div style={{ marginBottom: 'var(--spacing-3)' }}>
            <label className="field-label">Password</label>
            <input
              className="text-field"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>
          <button className="button" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
