import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface Customer {
  id: string;
  name: string;
}

interface EdiPartner {
  id: string;
  name: string;
  active: boolean;
  customerId: string;
  customer?: { id: string; name: string };
  sftpHost?: string | null;
  sftpPort: number;
  sftpUsername?: string | null;
  sftpPassword?: string | null;
  sftpPrivateKey?: string | null;
  sftpRemoteDir: string;
  sftpFilePattern: string;
  pollingEnabled: boolean;
  pollingInterval: number;
  pollingCron?: string | null;
  senderId?: string | null;
  receiverId?: string | null;
  ediVersion: string;
  autoCreateOrders: boolean;
  autoAssignShipments: boolean;
  fieldMapping?: any;
  createdAt: string;
  _count?: { ediFiles: number };
}

const defaultForm = {
  name: '',
  customerId: '',
  active: true,
  sftpHost: '',
  sftpPort: 22,
  sftpUsername: '',
  sftpPassword: '',
  sftpRemoteDir: '/',
  sftpFilePattern: '*.edi,*.x12,*.850',
  pollingEnabled: false,
  pollingInterval: 900,
  senderId: '',
  receiverId: '',
  ediVersion: '005010',
  autoCreateOrders: true,
  autoAssignShipments: false
};

export default function EdiPartners() {
  const [partners, setPartners] = useState<EdiPartner[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPartners();
    loadCustomers();
  }, []);

  const loadPartners = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/edi-partners`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setPartners(result.data || []);
    } catch (err: any) {
      setError('Failed to load EDI partners');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/customers`);
      const result = await response.json();
      setCustomers(result.data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.customerId) {
      setError('Name and Customer are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: any = { ...formData };
      // Clean empty strings
      for (const key of ['sftpHost', 'sftpUsername', 'sftpPassword', 'senderId', 'receiverId']) {
        if (!payload[key]?.trim()) payload[key] = undefined;
      }
      // Don't send redacted password back
      if (payload.sftpPassword === '[REDACTED]') delete payload.sftpPassword;

      const url = editingId
        ? `${API_URL}/api/v1/edi-partners/${editingId}`
        : `${API_URL}/api/v1/edi-partners`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save');

      resetForm();
      await loadPartners();
    } catch (err: any) {
      setError(err.message || 'Failed to save EDI partner');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (partner: EdiPartner) => {
    setEditingId(partner.id);
    setFormData({
      name: partner.name,
      customerId: partner.customerId,
      active: partner.active,
      sftpHost: partner.sftpHost || '',
      sftpPort: partner.sftpPort,
      sftpUsername: partner.sftpUsername || '',
      sftpPassword: partner.sftpPassword || '',
      sftpRemoteDir: partner.sftpRemoteDir,
      sftpFilePattern: partner.sftpFilePattern,
      pollingEnabled: partner.pollingEnabled,
      pollingInterval: partner.pollingInterval,
      senderId: partner.senderId || '',
      receiverId: partner.receiverId || '',
      ediVersion: partner.ediVersion,
      autoCreateOrders: partner.autoCreateOrders,
      autoAssignShipments: partner.autoAssignShipments
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this EDI partner?')) return;
    try {
      const response = await fetch(`${API_URL}/api/v1/edi-partners/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await loadPartners();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingId(null);
    setShowCreateForm(false);
  };

  if (loading && partners.length === 0) {
    return <div className="loading-spinner-page"><div className="loading-spinner" /></div>;
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <div>
            <h2>EDI Partners</h2>
            <p style={{ color: 'var(--color-grey)', marginTop: 'var(--spacing-1)' }}>
              Configure trading partners for EDI import. Each partner is linked to a customer and can have SFTP collection settings.
            </p>
          </div>
          {!showCreateForm && (
            <button onClick={() => setShowCreateForm(true)} className="button">
              <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
              Add EDI Partner
            </button>
          )}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>
            <span className="material-icons">error</span>
            {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius)', padding: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)', backgroundColor: 'var(--color-surface)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-2)' }}>
              {editingId ? 'Edit EDI Partner' : 'New EDI Partner'}
            </h3>
            <form onSubmit={handleSubmit}>
              {/* General */}
              <h4 style={{ marginBottom: 'var(--spacing-1)', color: 'var(--color-grey)' }}>General</h4>
              <div className="form-grid" style={{ marginBottom: 'var(--spacing-2)' }}>
                <div className="input-wrapper">
                  <input type="text" className="input" placeholder="Partner Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                  <label>Name *</label>
                </div>
                <div className="input-wrapper">
                  <select className="input" value={formData.customerId} onChange={e => setFormData({ ...formData, customerId: e.target.value })} required>
                    <option value="">Select Customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <label>Customer *</label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-2)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                  <input type="checkbox" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} />
                  Active
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                  <input type="checkbox" checked={formData.autoCreateOrders} onChange={e => setFormData({ ...formData, autoCreateOrders: e.target.checked })} />
                  Auto-create orders
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                  <input type="checkbox" checked={formData.autoAssignShipments} onChange={e => setFormData({ ...formData, autoAssignShipments: e.target.checked })} />
                  Auto-assign to shipments
                </label>
              </div>

              {/* SFTP Configuration */}
              <h4 style={{ marginBottom: 'var(--spacing-1)', marginTop: 'var(--spacing-2)', color: 'var(--color-grey)' }}>SFTP Configuration</h4>
              <div className="form-grid" style={{ marginBottom: 'var(--spacing-2)' }}>
                <div className="input-wrapper">
                  <input type="text" className="input" placeholder="sftp.example.com" value={formData.sftpHost} onChange={e => setFormData({ ...formData, sftpHost: e.target.value })} />
                  <label>SFTP Host</label>
                </div>
                <div className="input-wrapper">
                  <input type="number" className="input" placeholder="22" value={formData.sftpPort} onChange={e => setFormData({ ...formData, sftpPort: parseInt(e.target.value) || 22 })} />
                  <label>Port</label>
                </div>
                <div className="input-wrapper">
                  <input type="text" className="input" placeholder="Username" value={formData.sftpUsername} onChange={e => setFormData({ ...formData, sftpUsername: e.target.value })} />
                  <label>Username</label>
                </div>
                <div className="input-wrapper">
                  <input type="password" className="input" placeholder="Password" value={formData.sftpPassword} onChange={e => setFormData({ ...formData, sftpPassword: e.target.value })} />
                  <label>Password</label>
                </div>
                <div className="input-wrapper">
                  <input type="text" className="input" placeholder="/" value={formData.sftpRemoteDir} onChange={e => setFormData({ ...formData, sftpRemoteDir: e.target.value })} />
                  <label>Remote Directory</label>
                </div>
                <div className="input-wrapper">
                  <input type="text" className="input" placeholder="*.edi,*.x12,*.850" value={formData.sftpFilePattern} onChange={e => setFormData({ ...formData, sftpFilePattern: e.target.value })} />
                  <label>File Pattern</label>
                </div>
              </div>

              {/* Polling */}
              <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-2)', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                  <input type="checkbox" checked={formData.pollingEnabled} onChange={e => setFormData({ ...formData, pollingEnabled: e.target.checked })} />
                  Enable SFTP polling
                </label>
                {formData.pollingEnabled && (
                  <div className="input-wrapper" style={{ width: '200px' }}>
                    <input type="number" className="input" placeholder="900" min={60} value={formData.pollingInterval} onChange={e => setFormData({ ...formData, pollingInterval: parseInt(e.target.value) || 900 })} />
                    <label>Interval (seconds)</label>
                  </div>
                )}
              </div>

              {/* EDI Settings */}
              <h4 style={{ marginBottom: 'var(--spacing-1)', marginTop: 'var(--spacing-2)', color: 'var(--color-grey)' }}>EDI Settings</h4>
              <div className="form-grid" style={{ marginBottom: 'var(--spacing-2)' }}>
                <div className="input-wrapper">
                  <input type="text" className="input" placeholder="Sender ID (ISA06)" value={formData.senderId} onChange={e => setFormData({ ...formData, senderId: e.target.value })} />
                  <label>Sender ID</label>
                </div>
                <div className="input-wrapper">
                  <input type="text" className="input" placeholder="Receiver ID (ISA08)" value={formData.receiverId} onChange={e => setFormData({ ...formData, receiverId: e.target.value })} />
                  <label>Receiver ID</label>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end' }}>
                <button type="button" onClick={resetForm} className="button button-outline">Cancel</button>
                <button type="submit" disabled={saving} className="button button-primary">
                  {saving ? 'Saving...' : editingId ? 'Update Partner' : 'Create Partner'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Partners Table */}
        {partners.length === 0 && !showCreateForm ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)', color: 'var(--color-grey)' }}>
            <span className="material-icons" style={{ fontSize: '48px', marginBottom: 'var(--spacing-1)' }}>swap_horiz</span>
            <h3>No EDI Partners</h3>
            <p>Configure your first EDI trading partner to start importing orders.</p>
          </div>
        ) : partners.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Customer</th>
                  <th>SFTP</th>
                  <th>Polling</th>
                  <th>Files</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map(partner => (
                  <tr key={partner.id}>
                    <td style={{ fontWeight: '500' }}>{partner.name}</td>
                    <td>{partner.customer?.name || '—'}</td>
                    <td>
                      {partner.sftpHost ? (
                        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                          {partner.sftpHost}:{partner.sftpPort}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-grey)' }}>Not configured</span>
                      )}
                    </td>
                    <td>
                      {partner.pollingEnabled ? (
                        <span className="chip chip-success">
                          Every {Math.round(partner.pollingInterval / 60)}m
                        </span>
                      ) : (
                        <span className="chip">Off</span>
                      )}
                    </td>
                    <td>{partner._count?.ediFiles || 0}</td>
                    <td>
                      <span className={`chip ${partner.active ? 'chip-success' : 'chip-error'}`}>
                        {partner.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                        <button onClick={() => handleEdit(partner)} className="button button-outline button-sm">Edit</button>
                        <button onClick={() => handleDelete(partner.id)} className="button button-outline button-sm" style={{ color: 'var(--color-error)' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
