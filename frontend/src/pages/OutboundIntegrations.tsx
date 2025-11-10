import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface OutboundIntegration {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  active: boolean;
  senderId?: string | null;
  receiverId?: string | null;
  interchangeControlNumber?: string | null;
  authType: 'none' | 'basic' | 'bearer' | 'api_key';
  authHeader?: string | null;
  authValue?: string | null; // Will be redacted
  createdAt: string;
  updatedAt: string;
  _count?: {
    logs: number;
  };
}

export default function OutboundIntegrations() {
  const [integrations, setIntegrations] = useState<OutboundIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    active: true,
    senderId: '',
    receiverId: '',
    interchangeControlNumber: '',
    authType: 'none' as 'none' | 'basic' | 'bearer' | 'api_key',
    authHeader: '',
    authValue: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/outbound-integrations`);
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setIntegrations(result.data || []);
    } catch (err: any) {
      setError('Failed to load outbound integrations');
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) {
      setError('Name and URL are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        name: formData.name.trim(),
        url: formData.url.trim(),
        description: formData.description.trim() || undefined,
        active: formData.active,
        senderId: formData.senderId.trim() || undefined,
        receiverId: formData.receiverId.trim() || undefined,
        interchangeControlNumber: formData.interchangeControlNumber.trim() || undefined,
        authType: formData.authType
      };

      if (formData.authType !== 'none') {
        if (formData.authType === 'api_key') {
          payload.authHeader = formData.authHeader.trim() || 'X-API-Key';
        }
        if (formData.authValue.trim()) {
          payload.authValue = formData.authValue.trim();
        }
      }

      const url = editingId
        ? `${API_URL}/api/v1/outbound-integrations/${editingId}`
        : `${API_URL}/api/v1/outbound-integrations`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save integration');
      }

      setShowCreateForm(false);
      setEditingId(null);
      resetForm();
      await loadIntegrations();
    } catch (err: any) {
      setError(err.message || 'Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (integration: OutboundIntegration) => {
    setFormData({
      name: integration.name,
      url: integration.url,
      description: integration.description || '',
      active: integration.active,
      senderId: integration.senderId || '',
      receiverId: integration.receiverId || '',
      interchangeControlNumber: integration.interchangeControlNumber || '',
      authType: integration.authType,
      authHeader: integration.authHeader || '',
      authValue: '' // Don't show existing value
    });
    setEditingId(integration.id);
    setShowCreateForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/outbound-integrations/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete integration');
      }

      await loadIntegrations();
    } catch (err: any) {
      setError(err.message || 'Failed to delete integration');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/outbound-integrations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update integration');
      }

      await loadIntegrations();
    } catch (err: any) {
      setError(err.message || 'Failed to update integration');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      description: '',
      active: true,
      senderId: '',
      receiverId: '',
      interchangeControlNumber: '',
      authType: 'none',
      authHeader: '',
      authValue: ''
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
        <h1>Outbound Integrations</h1>
        <button
          className="button"
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowCreateForm(true);
          }}
          disabled={showCreateForm}
        >
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '4px' }}>add</span>
          Create Integration
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-3)' }}>
          <span className="material-icons">error</span>
          {error}
        </div>
      )}

      {showCreateForm && (
        <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
          <h2>{editingId ? 'Edit' : 'Create'} Outbound Integration</h2>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="e.g., Customer ERP System"
                required
                autoFocus
              />
              <label>Integration Name *</label>
            </div>

            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="input"
                placeholder="https://example.com/api/shipments"
                required
              />
              <label>Webhook URL *</label>
            </div>

            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                placeholder="Optional description"
                rows={2}
              />
              <label>Description</label>
            </div>

            <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>EDI Configuration (Optional)</h3>

            <div className="input-wrapper">
              <input
                type="text"
                value={formData.senderId}
                onChange={(e) => setFormData({ ...formData, senderId: e.target.value })}
                className="input"
                placeholder="SENDER_ID"
              />
              <label>Sender ID (ISA06)</label>
            </div>

            <div className="input-wrapper">
              <input
                type="text"
                value={formData.receiverId}
                onChange={(e) => setFormData({ ...formData, receiverId: e.target.value })}
                className="input"
                placeholder="RECEIVER_ID"
              />
              <label>Receiver ID (ISA08)</label>
            </div>

            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
              <input
                type="text"
                value={formData.interchangeControlNumber}
                onChange={(e) => setFormData({ ...formData, interchangeControlNumber: e.target.value })}
                className="input"
                placeholder="Control number prefix"
              />
              <label>Interchange Control Number Prefix</label>
            </div>

            <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Authentication</h3>

            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
              <select
                value={formData.authType}
                onChange={(e) => setFormData({ ...formData, authType: e.target.value as any })}
                className="input"
              >
                <option value="none">None</option>
                <option value="basic">Basic Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="api_key">API Key</option>
              </select>
              <label>Authentication Type</label>
            </div>

            {formData.authType === 'api_key' && (
              <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
                <input
                  type="text"
                  value={formData.authHeader}
                  onChange={(e) => setFormData({ ...formData, authHeader: e.target.value })}
                  className="input"
                  placeholder="X-API-Key"
                />
                <label>Header Name</label>
              </div>
            )}

            {formData.authType !== 'none' && (
              <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
                <input
                  type="password"
                  value={formData.authValue}
                  onChange={(e) => setFormData({ ...formData, authValue: e.target.value })}
                  className="input"
                  placeholder={formData.authType === 'basic' ? 'username:password' : 'Enter token/key'}
                />
                <label>
                  {formData.authType === 'basic' ? 'Username:Password' : 
                   formData.authType === 'bearer' ? 'Bearer Token' : 'API Key'}
                  {editingId && ' (leave blank to keep existing)'}
                </label>
              </div>
            )}

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end', marginTop: 'var(--spacing-2)' }}>
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingId(null);
                  resetForm();
                  setError(null);
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="button" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update Integration' : 'Create Integration'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <div className="loading-spinner"></div>
            <p>Loading integrations...</p>
          </div>
        </div>
      )}

      {!loading && integrations.length === 0 && !showCreateForm && (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <span className="material-icons" style={{ fontSize: '48px', color: 'var(--color-grey)', marginBottom: 'var(--spacing-2)' }}>send</span>
            <h3>No Outbound Integrations</h3>
            <p style={{ color: 'var(--color-grey)', marginBottom: 'var(--spacing-3)' }}>
              Create an integration to automatically send EDI 856 Advance Ship Notices when shipments are created
            </p>
            <button className="button" onClick={() => setShowCreateForm(true)}>
              Create Your First Integration
            </button>
          </div>
        </div>
      )}

      {!loading && integrations.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>URL</th>
                <th>Status</th>
                <th>Logs</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((integration) => (
                <tr key={integration.id}>
                  <td>
                    <div style={{ fontWeight: '500' }}>{integration.name}</div>
                    {integration.description && (
                      <div style={{ fontSize: '12px', color: 'var(--color-grey)' }}>
                        {integration.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <code style={{ fontSize: '12px', color: 'var(--color-grey)' }}>
                      {integration.url.length > 50 ? integration.url.substring(0, 50) + '...' : integration.url}
                    </code>
                  </td>
                  <td>
                    <span className={`badge ${integration.active ? 'badge-success' : 'badge-error'}`}>
                      {integration.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
                    {integration._count?.logs || 0}
                  </td>
                  <td style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
                    {new Date(integration.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                      <button
                        className="button button-outline"
                        onClick={() => handleToggleActive(integration.id, integration.active)}
                        style={{ minWidth: 'auto', padding: 'var(--spacing-1) var(--spacing-2)', fontSize: '12px' }}
                        title={integration.active ? 'Deactivate' : 'Activate'}
                      >
                        <span className="material-icons" style={{ fontSize: '16px' }}>
                          {integration.active ? 'toggle_on' : 'toggle_off'}
                        </span>
                      </button>
                      <button
                        className="button button-outline"
                        onClick={() => handleEdit(integration)}
                        style={{ minWidth: 'auto', padding: 'var(--spacing-1) var(--spacing-2)', fontSize: '12px' }}
                        title="Edit"
                      >
                        <span className="material-icons" style={{ fontSize: '16px' }}>edit</span>
                      </button>
                      <button
                        className="button button-outline"
                        onClick={() => handleDelete(integration.id)}
                        style={{ minWidth: 'auto', padding: 'var(--spacing-1) var(--spacing-2)', fontSize: '12px' }}
                        title="Delete"
                      >
                        <span className="material-icons" style={{ fontSize: '16px', color: 'var(--color-error)' }}>
                          delete
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
