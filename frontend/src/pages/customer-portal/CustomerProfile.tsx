import React, { useState } from 'react';
import { API_URL } from '../../api';
import { customerFetch, getCustomerUser } from './CustomerDashboard';

export default function CustomerProfile() {
  const user = getCustomerUser();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPw !== confirmPw) { setMessage({ text: 'Passwords do not match', type: 'error' }); return; }
    setSaving(true);
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMessage({ text: 'Password changed successfully', type: 'success' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Profile</h1>

      <div className="vn-card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Account Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div><div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Name</div><div style={{ fontWeight: 600 }}>{user.name}</div></div>
          <div><div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Email</div><div style={{ fontWeight: 600 }}>{user.email}</div></div>
          <div><div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Company</div><div style={{ fontWeight: 600 }}>{user.customerName}</div></div>
          <div><div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Role</div><div style={{ fontWeight: 600 }}>{user.role}</div></div>
        </div>
      </div>

      <div className="vn-card" style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Change Password</h3>
        <form onSubmit={handleChangePassword} style={{ maxWidth: 400 }}>
          {message && <div className={`vn-alert vn-alert-${message.type}`} style={{ marginBottom: 16 }}>{message.text}</div>}
          <div className="vn-field" style={{ marginBottom: 16 }}>
            <label className="vn-field-label">Current Password</label>
            <input className="vn-input" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />
          </div>
          <div className="vn-field" style={{ marginBottom: 16 }}>
            <label className="vn-field-label">New Password</label>
            <input className="vn-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required />
            <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 4 }}>8+ characters, uppercase, lowercase, number</div>
          </div>
          <div className="vn-field" style={{ marginBottom: 24 }}>
            <label className="vn-field-label">Confirm New Password</label>
            <input className="vn-input" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
          </div>
          <button className="vn-btn vn-btn-primary" type="submit" disabled={saving}>
            {saving ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
