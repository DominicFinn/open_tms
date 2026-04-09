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
        <button className="button" onClick={() => setShowCreate(true)} style={{ fontSize: '13px', padding: '6px 12px' }}>
          <span className="material-icons" style={{ fontSize: '16px', marginRight: '4px' }}>person_add</span>
          Add User
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-1)' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-1)' }}>{success}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-3)' }}><span className="loading-spinner" /></div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-3)', color: 'var(--color-text-secondary)' }}>
          <span className="material-icons" style={{ fontSize: '48px', display: 'block', marginBottom: '8px', opacity: 0.5 }}>person_off</span>
          No portal users yet. Create one so the carrier can log in and respond to tenders.
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
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
                  <td><span className={`chip chip-${u.role === 'admin' ? 'primary' : 'secondary'}`}>{u.role}</span></td>
                  <td>
                    <span className={`chip chip-${u.active ? 'success' : 'error'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="icon-btn"
                        title={u.active ? 'Deactivate' : 'Activate'}
                        onClick={() => handleToggleActive(u)}
                      >
                        <span className="material-icons" style={{ fontSize: '18px', color: u.active ? 'var(--color-error)' : 'var(--color-success)' }}>
                          {u.active ? 'person_off' : 'person'}
                        </span>
                      </button>
                      <button
                        className="icon-btn"
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
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h3 style={{ margin: '0 0 var(--spacing-2)' }}>Create Portal User</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '0 0 var(--spacing-2)' }}>
              Create a login for <strong>{carrierName}</strong> so they can access the carrier portal and respond to tenders.
            </p>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <label className="field-label">Full Name *</label>
                <input className="text-field" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="John Doe" />
              </div>
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <label className="field-label">Email *</label>
                <input className="text-field" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="user@carrier.com" />
              </div>
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <label className="field-label">Password *</label>
                <input className="text-field" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} placeholder="Min 8 chars, upper, lower, number" />
                <div className="field-hint">Must contain uppercase, lowercase, and a number</div>
              </div>
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <label className="field-label">Role</label>
                <select className="text-field" value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="dispatcher">Dispatcher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="button-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="button">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPassword && (
        <div className="modal-backdrop" onClick={() => setShowResetPassword(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 var(--spacing-2)' }}>Reset Password</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '0 0 var(--spacing-2)' }}>
              Set a new password for <strong>{users.find(u => u.id === showResetPassword)?.email}</strong>
            </p>
            {error && <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-1)' }}>{error}</div>}
            <div style={{ marginBottom: 'var(--spacing-2)' }}>
              <label className="field-label">New Password</label>
              <input
                className="text-field"
                type="password"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                minLength={8}
                placeholder="Min 8 chars, upper, lower, number"
              />
              <div className="field-hint">Must contain uppercase, lowercase, and a number</div>
            </div>
            <div className="form-actions">
              <button className="button-outline" onClick={() => setShowResetPassword(null)}>Cancel</button>
              <button className="button" onClick={() => handleResetPassword(showResetPassword)} disabled={resetPassword.length < 8}>
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
