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
      <div className="vn-page-header">
        <h1>Profile & Settings</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
        {/* Profile Info */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>
              <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '20px' }}>person</span>
              Profile
            </h2>
          </div>
          <div className="vn-card-body">
            <div style={{ display: 'grid', gap: 'var(--spacing-1)', fontSize: '14px' }}>
              <div><strong>Name:</strong> {user.name}</div>
              <div><strong>Email:</strong> {user.email}</div>
              <div><strong>Role:</strong> <span className={`vn-chip vn-chip-${user.role === 'admin' ? 'primary' : 'secondary'}`}>{user.role}</span></div>
              <div><strong>Carrier:</strong> {user.carrierName}</div>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>
              <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '20px' }}>lock</span>
              Change Password
            </h2>
          </div>
          <div className="vn-card-body">
            {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>{error}</div>}
            {success && <div className="vn-alert vn-alert-success" style={{ marginBottom: 'var(--spacing-2)' }}>{success}</div>}

            <form onSubmit={handleChangePassword}>
              <div className="vn-field" style={{ marginBottom: 'var(--spacing-2)' }}>
                <label className="vn-field-label">Current Password</label>
                <input
                  className="vn-input"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="vn-field" style={{ marginBottom: 'var(--spacing-2)' }}>
                <label className="vn-field-label">New Password</label>
                <input
                  className="vn-input"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <span className="vn-field-hint">Min 8 chars, must include uppercase, lowercase, and a number</span>
              </div>
              <div className="vn-field" style={{ marginBottom: 'var(--spacing-2)' }}>
                <label className="vn-field-label">Confirm New Password</label>
                <input
                  className="vn-input"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <button type="submit" className="vn-btn vn-btn-primary" disabled={loading}>
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
