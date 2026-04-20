import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

interface InternalUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  authProvider: string | null;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  roles: { id: string; name: string }[];
  createdAt: string;
}

export default function VNextUsers() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetTarget, setResetTarget] = useState<InternalUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/users`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setUsers(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function doReset() {
    if (!resetTarget) return;
    setResetBusy(true);
    setResetError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const json = await res.json();
      if (json.error) {
        setResetError(json.error);
      } else {
        setResetSuccess(`Password reset for ${resetTarget.email}. Share the new password securely.`);
        setResetTarget(null);
        setNewPassword('');
        load();
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password');
    }
    setResetBusy(false);
  }

  async function toggleActive(u: InternalUser) {
    const next = !u.active;
    try {
      await fetch(`${API_URL}/api/v1/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
      load();
    } catch {
      // swallowed — next load will show actual state
    }
  }

  return (
    <div className="vn-page">
      <div className="vn-page-header">
        <div>
          <h1 className="vn-page-title">Internal Users</h1>
          <p className="vn-page-subtitle">Manage TMS staff accounts. Reset a password when a user is locked out.</p>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error">{error}</div>}
      {resetSuccess && <div className="vn-alert vn-alert-success">{resetSuccess}</div>}

      {loading ? (
        <div className="vn-card">Loading…</div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.firstName} {u.lastName}</td>
                  <td className="vn-table-secondary">{u.email}</td>
                  <td>
                    {u.roles.length === 0
                      ? <span className="vn-table-secondary">No roles</span>
                      : u.roles.map((r) => (
                        <span key={r.id} className="vn-chip vn-chip-info" style={{ marginRight: 4 }}>{r.name}</span>
                      ))}
                  </td>
                  <td>
                    <span className={`vn-chip ${u.active ? 'vn-chip-success' : 'vn-chip-secondary'}`}>
                      {u.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="vn-table-secondary">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                  </td>
                  <td>
                    <button className="vn-btn vn-btn-sm" onClick={() => setResetTarget(u)}>Reset password</button>
                    <button
                      className="vn-btn vn-btn-sm"
                      style={{ marginLeft: 8 }}
                      onClick={() => toggleActive(u)}
                    >
                      {u.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="vn-table-secondary">No users.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {resetTarget && (
        <div className="vn-modal-backdrop" onClick={() => setResetTarget(null)}>
          <div className="vn-modal vn-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="vn-modal-header">
              <h2>Reset password for {resetTarget.email}</h2>
              <button className="vn-icon-btn" onClick={() => setResetTarget(null)} aria-label="Close">
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="vn-modal-body">
              <p className="vn-table-secondary" style={{ marginTop: 0 }}>
                Choose a temporary password. Share it with the user via a secure channel; they can change it after signing in.
              </p>
              {resetError && <div className="vn-alert vn-alert-error">{resetError}</div>}
              <div className="vn-field">
                <label className="vn-field-label">New password</label>
                <input
                  className="vn-input"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 chars, upper/lower/number"
                  autoFocus
                />
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn" onClick={() => setResetTarget(null)}>Cancel</button>
              <button
                className="vn-btn vn-btn-primary"
                onClick={doReset}
                disabled={resetBusy || newPassword.length < 8}
              >
                {resetBusy ? 'Resetting…' : 'Reset password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
