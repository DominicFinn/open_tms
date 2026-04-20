import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';
import { useTheme } from '../ThemeProvider';

export default function ForgotPassword() {
  const { hasLogo, logoUrl, systemName } = useTheme();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Stub endpoint never exposes existence; ignore network errors.
    }
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="vn-login-shell">
      <div className="vn-login-card">
        <div className="vn-login-brand">
          <div className="vn-login-logo" aria-hidden="true">
            {hasLogo && logoUrl ? (
              <img src={logoUrl} alt={systemName} />
            ) : (
              <span className="material-icons">hub</span>
            )}
          </div>
          <h1 className="vn-login-title">Reset password</h1>
          <p className="vn-login-subtitle">
            Self-service reset is not yet available. For now, your administrator can reset your password from the Users admin page.
          </p>
        </div>

        {submitted ? (
          <div className="vn-alert vn-alert-info" style={{ marginBottom: 'var(--spacing-2)' }}>
            Your request has been logged. Please contact your administrator to complete the reset.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="vn-field" style={{ marginBottom: 'var(--spacing-3)' }}>
              <label className="vn-field-label" htmlFor="fp-email">Email</label>
              <input
                id="fp-email"
                className="vn-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@company.com"
              />
            </div>
            <button
              className="vn-btn vn-btn-primary"
              type="submit"
              disabled={loading || !email}
              style={{ width: '100%' }}
            >
              {loading ? 'Submitting...' : 'Request reset'}
            </button>
          </form>
        )}

        <div className="vn-login-footer">
          <Link to="/login" className="vn-link">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
