import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

interface CarrierUser {
  id: string;
  carrierId: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Props {
  carrierId: string;
  carrierName: string;
}

export default function CarrierUserManagement({ carrierId, carrierName }: Props) {
  const [users, setUsers] = useState<CarrierUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('dispatcher');

  // Reset password form
  const [resetPassword, setResetPassword] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [carrierId]);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/v1/carriers/${carrierId}/users`);
    const json = await res.json();
    setUsers(json.data || []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const res = await fetch(`${API_URL}/api/v1/carriers/${carrierId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, name: newName, password: newPassword, role: newRole }),
    });
    const json = await res.json();

    if (json.error) {
      setError(json.error);
    } else {
      setSuccess(`User ${newEmail} created successfully`);
      setShowCreate(false);
      setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('dispatcher');
      await fetchUsers();
    }
  }

  async function handleToggleActive(user: CarrierUser) {
    const res = await fetch(`${API_URL}/api/v1/carriers/${carrierId}/users/${user.id}`, {
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

  async function handleResetPassword(userId: string) {
    setError('');
    setSuccess('');

    const res = await fetch(`${API_URL}/api/v1/carriers/${carrierId}/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: resetPassword }),
    });
    const json = await res.json();

    if (json.error) {
      setError(json.error);
    } else {
      setSuccess('Password reset successfully');
      setShowResetPassword(null);
      setResetPassword('');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
        <h3 style={{ margin: 0 }}>
          <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '20px' }}>people</span>
          Portal Users
        </h3>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)} style={{ fontSize: '13px', padding: '6px 12px' }}>
          <span className="material-icons" style={{ fontSize: '16px', marginRight: '4px' }}>person_add</span>
          Add User
        </button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 'var(--spacing-1)' }}>{error}</div>}
      {success && <div className="vn-alert vn-alert-success" style={{ marginBottom: 'var(--spacing-1)' }}>{success}</div>}

      {loading ? (
        <div className="vn-empty"><span className="material-icons" style={{animation:'spin 1s linear infinite'}}>refresh</span><h3>Loading...</h3></div>
      ) : users.length === 0 ? (
        <div className="vn-empty" style={{ textAlign: 'center', padding: 'var(--spacing-3)' }}>
          <span className="material-icons" style={{ fontSize: '48px', display: 'block', marginBottom: '8px', opacity: 0.5 }}>person_off</span>
          No portal users yet. Create one so the carrier can log in and respond to tenders.
        </div>
      ) : (
        <div className="vn-card">
          <div className="vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td><span className={`vn-chip vn-chip-${u.role === 'admin' ? 'primary' : 'secondary'}`}>{u.role}</span></td>
                      <td>
                        <span className={`vn-chip vn-chip-${u.active ? 'success' : 'error'}`}>
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--on-surface-variant)', fontSize: '13px' }}>
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="vn-btn-icon"
                            title={u.active ? 'Deactivate' : 'Activate'}
                            onClick={() => handleToggleActive(u)}
                          >
                            <span className="material-icons" style={{ fontSize: '18px', color: u.active ? 'var(--error)' : 'var(--success)' }}>
                              {u.active ? 'person_off' : 'person'}
                            </span>
                          </button>
                          <button
                            className="vn-btn-icon"
                            title="Reset Password"
                            onClick={() => { setShowResetPassword(u.id); setResetPassword(''); setError(''); }}
                          >
                            <span className="material-icons" style={{ fontSize: '18px' }}>lock_reset</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="vn-modal-header">
              <h2>Create Portal User</h2>
              <button className="vn-modal-close" onClick={() => setShowCreate(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="vn-modal-body">
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '13px', margin: '0 0 var(--spacing-2)' }}>
                Create a login for <strong>{carrierName}</strong> so they can access the carrier portal and respond to tenders.
              </p>
              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: 'var(--spacing-2)' }}>
                  <label className="vn-field-label">Full Name *</label>
                  <input className="vn-input" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="John Doe" />
                </div>
                <div style={{ marginBottom: 'var(--spacing-2)' }}>
                  <label className="vn-field-label">Email *</label>
                  <input className="vn-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="user@carrier.com" />
                </div>
                <div style={{ marginBottom: 'var(--spacing-2)' }}>
                  <label className="vn-field-label">Password *</label>
                  <input className="vn-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} placeholder="Min 8 chars, upper, lower, number" />
                  <div className="vn-field-hint">Must contain uppercase, lowercase, and a number</div>
                </div>
                <div style={{ marginBottom: 'var(--spacing-2)' }}>
                  <label className="vn-field-label">Role</label>
                  <select className="vn-select" value={newRole} onChange={e => setNewRole(e.target.value)}>
                    <option value="dispatcher">Dispatcher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="vn-form-actions">
                  <button type="button" className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="vn-btn vn-btn-primary">Create User</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPassword && (
        <div className="vn-modal-backdrop" onClick={() => setShowResetPassword(null)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="vn-modal-header">
              <h2>Reset Password</h2>
              <button className="vn-modal-close" onClick={() => setShowResetPassword(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="vn-modal-body">
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '13px', margin: '0 0 var(--spacing-2)' }}>
                Set a new password for <strong>{users.find(u => u.id === showResetPassword)?.email}</strong>
              </p>
              {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 'var(--spacing-1)' }}>{error}</div>}
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <label className="vn-field-label">New Password</label>
                <input
                  className="vn-input"
                  type="password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  minLength={8}
                  placeholder="Min 8 chars, upper, lower, number"
                />
                <div className="vn-field-hint">Must contain uppercase, lowercase, and a number</div>
              </div>
              <div className="vn-form-actions">
                <button className="vn-btn vn-btn-outline" onClick={() => setShowResetPassword(null)}>Cancel</button>
                <button className="vn-btn vn-btn-primary" onClick={() => handleResetPassword(showResetPassword)} disabled={resetPassword.length < 8}>
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
