import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../api';
import { useTheme } from '../ThemeProvider';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  const { hasLogo, logoUrl, systemName } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (json.error || !json.data?.token) {
        setError(json.error || 'Login failed. Please try again.');
      } else {
        localStorage.setItem('auth_token', json.data.token);
        localStorage.setItem('auth_user', JSON.stringify(json.data.user));
        navigate(returnTo, { replace: true });
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="vn-login-shell">
      <div className="vn-login-card">
        <div className="vn-login-brand">
          <div className={`vn-login-logo ${loading ? 'spinning' : ''}`} aria-hidden="true">
            {hasLogo && logoUrl ? (
              <img src={logoUrl} alt={systemName} />
            ) : (
              <span className="material-icons">hub</span>
            )}
          </div>
          <h1 className="vn-login-title">{systemName}</h1>
          <p className="vn-login-subtitle">Sign in to continue</p>
        </div>

        {error && (
          <div className="vn-alert vn-alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="vn-field" style={{ marginBottom: 'var(--spacing-2)' }}>
            <label className="vn-field-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="vn-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              placeholder="you@company.com"
            />
          </div>
          <div className="vn-field" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label className="vn-field-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="vn-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          </div>
          <button
            className="vn-btn vn-btn-primary"
            type="submit"
            disabled={loading || !email || !password}
            style={{ width: '100%' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="vn-login-footer">
          <Link to="/forgot-password" className="vn-link">Forgot password?</Link>
        </div>
      </div>
    </div>
  );
}
