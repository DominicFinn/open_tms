import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

interface CustomerUser {
  id: string;
  customerId: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Props {
  customerId: string;
  customerName: string;
}

export default function CustomerUserManagement({ customerId, customerName }: Props) {
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [resetPassword, setResetPassword] = useState('');

  useEffect(() => { fetchUsers(); }, [customerId]);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/v1/customers/${customerId}/users`);
    const json = await res.json();
    setUsers(json.data || []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    const res = await fetch(`${API_URL}/api/v1/customers/${customerId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, name: newName, password: newPassword, role: newRole }),
    });
    const json = await res.json();
    if (json.error) { setError(json.error); }
    else {
      setSuccess(`User ${newEmail} created successfully`);
      setShowCreate(false);
      setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('viewer');
      await fetchUsers();
    }
  }

  async function handleToggleActive(user: CustomerUser) {
    const res = await fetch(`${API_URL}/api/v1/customers/${customerId}/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !user.active }),
    });
    const json = await res.json();
    if (!json.error) {
      setSuccess(`User ${user.email} ${user.active ? 'deactivated' : 'activated'}`);
      await fetchUsers();
    }
  }

  async function handleResetPw(userId: string) {
    setError(''); setSuccess('');
    const res = await fetch(`${API_URL}/api/v1/customers/${customerId}/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: resetPassword }),
    });
    const json = await res.json();
    if (json.error) { setError(json.error); }
    else { setSuccess('Password reset successfully'); setShowResetPassword(null); setResetPassword(''); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
        <h3 style={{ margin: 0 }}>
          <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '20px' }}>people</span>
          Customer Portal Users
        </h3>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)} style={{ fontSize: '13px', padding: '6px 12px' }}>
          <span className="material-icons" style={{ fontSize: '16px', marginRight: '4px' }}>person_add</span>
          Add User
        </button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 'var(--spacing-1)' }}>{error}</div>}
      {success && <div className="vn-alert vn-alert-success" style={{ marginBottom: 'var(--spacing-1)' }}>{success}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}><div className="loading-spinner" /></div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--on-surface-variant)' }}>
          <span className="material-icons" style={{ fontSize: 48, display: 'block', marginBottom: 8, opacity: 0.5 }}>person_off</span>
          No portal users yet. Create one so {customerName} can log in and view shipments, orders, and invoices.
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className={`vn-chip vn-chip-${u.role === 'admin' ? 'primary' : 'secondary'}`}>{u.role}</span></td>
                  <td><span className={`vn-chip vn-chip-${u.active ? 'success' : 'error'}`}>{u.active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ fontSize: 13 }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => { setShowResetPassword(u.id); setResetPassword(''); }}>Reset PW</button>
                      <button className={`vn-btn vn-btn-sm ${u.active ? 'vn-btn-outline' : 'vn-btn-success'}`} onClick={() => handleToggleActive(u)}>
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="vn-modal-header">
              <h3>Create Portal User</h3>
              <button className="vn-btn-icon" onClick={() => setShowCreate(false)}><span className="material-icons">close</span></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="vn-modal-body">
                <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 16 }}>
                  Create a login for {customerName} so they can access the customer portal.
                </p>
                <div className="vn-field" style={{ marginBottom: 12 }}>
                  <label className="vn-field-label">Name</label>
                  <input className="vn-input" value={newName} onChange={e => setNewName(e.target.value)} required />
                </div>
                <div className="vn-field" style={{ marginBottom: 12 }}>
                  <label className="vn-field-label">Email</label>
                  <input className="vn-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                </div>
                <div className="vn-field" style={{ marginBottom: 12 }}>
                  <label className="vn-field-label">Password</label>
                  <input className="vn-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 4 }}>8+ characters, uppercase, lowercase, number</div>
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Role</label>
                  <select className="vn-input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="vn-modal-footer">
                <button type="button" className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="vn-btn vn-btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPassword && (
        <div className="vn-modal-backdrop" onClick={() => setShowResetPassword(null)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="vn-modal-header">
              <h3>Reset Password</h3>
              <button className="vn-btn-icon" onClick={() => setShowResetPassword(null)}><span className="material-icons">close</span></button>
            </div>
            <div className="vn-modal-body">
              <div className="vn-field">
                <label className="vn-field-label">New Password</label>
                <input className="vn-input" type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} minLength={8} />
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setShowResetPassword(null)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={() => handleResetPw(showResetPassword)} disabled={resetPassword.length < 8}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
