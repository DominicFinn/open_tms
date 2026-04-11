import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../api';
import './warehouse.css';

export default function WarehouseLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  // Handle magic link token from URL (QR code scan)
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setMagicLinkLoading(true);
      handleMagicLink(token);
    }
  }, [searchParams]);

  // Check if already logged in
  useEffect(() => {
    const user = localStorage.getItem('warehouse_user');
    if (user) {
      const loc = localStorage.getItem('warehouse_location');
      navigate(loc ? '/warehouse' : '/warehouse/select-location');
    }
  }, [navigate]);

  async function handleMagicLink(token: string) {
    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/auth/magic-link/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || 'Invalid magic link');
        setMagicLinkLoading(false);
        return;
      }
      loginSuccess(json.data.user);
    } catch {
      setError('Network error. Check your connection.');
      setMagicLinkLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || 'Login failed');
        setLoading(false);
        return;
      }
      loginSuccess(json.data.user);
    } catch {
      setError('Network error. Check your connection.');
      setLoading(false);
    }
  }

  function loginSuccess(user: any) {
    localStorage.setItem('warehouse_user', JSON.stringify(user));

    // If user has a preferred location, auto-select it
    if (user.preferredLocationId) {
      fetch(`${API_URL}/api/v1/warehouse/locations`)
        .then(r => r.json())
        .then(json => {
          const loc = (json.data || []).find((l: any) => l.id === user.preferredLocationId);
          if (loc) {
            localStorage.setItem('warehouse_location', JSON.stringify(loc));
            navigate('/warehouse');
          } else {
            navigate('/warehouse/select-location');
          }
        })
        .catch(() => navigate('/warehouse/select-location'));
    } else {
      navigate('/warehouse/select-location');
    }
  }

  if (magicLinkLoading) {
    return (
      <div className="wh-login">
        <div className="wh-login-card">
          <div className="wh-loading">
            <div className="wh-spinner" />
          </div>
          <p style={{ marginTop: '16px', color: 'var(--on-surface-variant)', fontSize: '14px' }}>
            Signing you in...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wh-login">
      <div className="wh-login-card">
        <span className="material-icons wh-login-logo">warehouse</span>
        <h1 className="wh-login-title">Warehouse</h1>
        <p className="wh-login-subtitle">Sign in to start operations</p>

        {error && (
          <div className="wh-banner wh-banner-error" style={{ marginBottom: '16px', textAlign: 'left' }}>
            <span className="material-icons">error</span>
            {error}
          </div>
        )}

        <form className="wh-login-form" onSubmit={handlePasswordLogin}>
          <div className="wh-login-field">
            <label htmlFor="wh-email">Email</label>
            <input
              id="wh-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="wh-login-field">
            <label htmlFor="wh-password">Password</label>
            <input
              id="wh-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            className="wh-login-btn wh-login-btn-primary"
            disabled={loading || !email || !password}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="wh-login-divider">or scan QR code</div>

        <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', margin: 0 }}>
          Ask your admin for a login QR code to stick on the wall for quick access.
        </p>
      </div>
    </div>
  );
}
