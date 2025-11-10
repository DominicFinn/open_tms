import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    webhookLogs: number;
  };
}

export default function ApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKeyWarning, setShowKeyWarning] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/api-keys`);
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setApiKeys(result.data || []);
    } catch (err: any) {
      setError('Failed to load API keys');
      console.error('Failed to load API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      setError('Please enter a name for the API key');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create API key');
      }

      // Show the new key (only shown once)
      setNewKey(result.data.key);
      setShowKeyWarning(true);
      setShowCreateForm(false);
      setNewKeyName('');
      await loadApiKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/api-keys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update API key');
      }

      await loadApiKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to update API key');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/api-keys/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete API key');
      }

      await loadApiKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to delete API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
        <h1>API Keys</h1>
        <button
          className="button"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '4px' }}>add</span>
          Create API Key
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-3)' }}>
          <span className="material-icons">error</span>
          {error}
        </div>
      )}

      {showKeyWarning && newKey && (
        <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-3)' }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--spacing-2)' }}>
            <span className="material-icons">warning</span>
            <div style={{ flex: 1 }}>
              <strong>Important: Save this API key now!</strong>
              <p style={{ margin: 'var(--spacing-1) 0', fontSize: '14px' }}>
                You won't be able to see this key again. Make sure to copy it and store it securely.
              </p>
              <div style={{
                display: 'flex',
                gap: 'var(--spacing-1)',
                alignItems: 'center',
                marginTop: 'var(--spacing-2)',
                padding: 'var(--spacing-2)',
                backgroundColor: 'var(--color-surface)',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '14px'
              }}>
                <code style={{ flex: 1, wordBreak: 'break-all' }}>{newKey}</code>
                <button
                  className="button button-outline"
                  onClick={() => copyToClipboard(newKey)}
                  style={{ minWidth: 'auto', padding: 'var(--spacing-1) var(--spacing-2)' }}
                >
                  <span className="material-icons" style={{ fontSize: '18px' }}>content_copy</span>
                </button>
              </div>
              <button
                className="button"
                onClick={() => {
                  setShowKeyWarning(false);
                  setNewKey(null);
                }}
                style={{ marginTop: 'var(--spacing-2)' }}
              >
                I've saved the key
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
          <h2>Create New API Key</h2>
          <form onSubmit={handleCreate} className="form-grid">
            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="input"
                placeholder="e.g., Production Webhook Key"
                required
                autoFocus
              />
              <label>API Key Name</label>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end', marginTop: 'var(--spacing-2)' }}>
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewKeyName('');
                  setError(null);
                }}
                disabled={creating}
              >
                Cancel
              </button>
              <button type="submit" className="button" disabled={creating}>
                {creating ? 'Creating...' : 'Create API Key'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <div className="loading-spinner"></div>
            <p>Loading API keys...</p>
          </div>
        </div>
      )}

      {!loading && apiKeys.length === 0 && !showCreateForm && (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <span className="material-icons" style={{ fontSize: '48px', color: 'var(--color-grey)', marginBottom: 'var(--spacing-2)' }}>vpn_key</span>
            <h3>No API Keys</h3>
            <p style={{ color: 'var(--color-grey)', marginBottom: 'var(--spacing-3)' }}>
              Create an API key to enable webhook integrations
            </p>
            <button className="button" onClick={() => setShowCreateForm(true)}>
              Create Your First API Key
            </button>
          </div>
        </div>
      )}

      {!loading && apiKeys.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Status</th>
                <th>Last Used</th>
                <th>Created</th>
                <th>Webhooks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>
                    <code style={{ fontSize: '12px', color: 'var(--color-grey)' }}>
                      {key.keyPrefix}...
                    </code>
                  </td>
                  <td>
                    <span
                      className={`badge ${key.active ? 'badge-success' : 'badge-error'}`}
                    >
                      {key.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
                    {formatDate(key.lastUsedAt)}
                  </td>
                  <td style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
                    {key._count?.webhookLogs || 0}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                      <button
                        className="button button-outline"
                        onClick={() => handleToggleActive(key.id, key.active)}
                        style={{ minWidth: 'auto', padding: 'var(--spacing-1) var(--spacing-2)', fontSize: '12px' }}
                        title={key.active ? 'Deactivate' : 'Activate'}
                      >
                        <span className="material-icons" style={{ fontSize: '16px' }}>
                          {key.active ? 'toggle_on' : 'toggle_off'}
                        </span>
                      </button>
                      <button
                        className="button button-outline"
                        onClick={() => handleDelete(key.id)}
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

      {!loading && apiKeys.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--spacing-3)' }}>
          <h3>Webhook Endpoint</h3>
          <p style={{ color: 'var(--color-grey)', marginBottom: 'var(--spacing-2)' }}>
            Use this endpoint URL with your API key to send webhook data:
          </p>
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-1)',
            alignItems: 'center',
            padding: 'var(--spacing-2)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '14px'
          }}>
            <code style={{ flex: 1 }}>{API_URL}/api/v1/webhook</code>
            <button
              className="button button-outline"
              onClick={() => copyToClipboard(`${API_URL}/api/v1/webhook`)}
              style={{ minWidth: 'auto', padding: 'var(--spacing-1) var(--spacing-2)' }}
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>content_copy</span>
            </button>
          </div>
          <div style={{ marginTop: 'var(--spacing-2)', fontSize: '14px', color: 'var(--color-grey)' }}>
            <p><strong>Authentication:</strong> Include your API key in the request header:</p>
            <code style={{ display: 'block', padding: 'var(--spacing-1)', backgroundColor: 'var(--color-surface)', borderRadius: '4px', marginTop: 'var(--spacing-1)' }}>
              X-API-Key: your_api_key_here
            </code>
            <p style={{ marginTop: 'var(--spacing-1)' }}>or</p>
            <code style={{ display: 'block', padding: 'var(--spacing-1)', backgroundColor: 'var(--color-surface)', borderRadius: '4px', marginTop: 'var(--spacing-1)' }}>
              Authorization: Bearer your_api_key_here
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

