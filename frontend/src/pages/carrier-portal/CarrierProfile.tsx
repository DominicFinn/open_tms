import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../api';
import { carrierFetch, getCarrierToken, getCarrierUser } from './CarrierDashboard';

export default function CarrierProfile() {
  const navigate = useNavigate();
  const user = getCarrierUser();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!getCarrierToken()) {
    navigate('/carrier-portal/login');
    return null;
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password must contain uppercase, lowercase, and a number');
      return;
    }

    setLoading(true);
    const res = await carrierFetch(`${API_URL}/api/v1/carrier-portal/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const json = await res.json();

    if (json.error) {
      setError(json.error);
    } else {
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Profile & Settings</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
        {/* Profile Info */}
        <div className="card">
          <h3 style={{ margin: '0 0 var(--spacing-2)' }}>
            <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '20px' }}>person</span>
            Profile
          </h3>
          <div style={{ display: 'grid', gap: 'var(--spacing-1)', fontSize: '14px' }}>
            <div><strong>Name:</strong> {user.name}</div>
            <div><strong>Email:</strong> {user.email}</div>
            <div><strong>Role:</strong> <span className={`chip chip-${user.role === 'admin' ? 'primary' : 'secondary'}`}>{user.role}</span></div>
            <div><strong>Carrier:</strong> {user.carrierName}</div>
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <h3 style={{ margin: '0 0 var(--spacing-2)' }}>
            <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '20px' }}>lock</span>
            Change Password
          </h3>

          {error && <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-2)' }}>{success}</div>}

          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: 'var(--spacing-2)' }}>
              <label className="field-label">Current Password</label>
              <input
                className="text-field"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: 'var(--spacing-2)' }}>
              <label className="field-label">New Password</label>
              <input
                className="text-field"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
              <div className="field-hint">Min 8 chars, must include uppercase, lowercase, and a number</div>
            </div>
            <div style={{ marginBottom: 'var(--spacing-2)' }}>
              <label className="field-label">Confirm New Password</label>
              <input
                className="text-field"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <button type="submit" className="button" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
