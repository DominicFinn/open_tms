import { useEffect, useState } from 'react';
import { API_URL } from '../../../api';
import { customerFetch } from '../CustomerDashboard';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function CustomerApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [freshKey, setFreshKey] = useState<{ id: string; key: string } | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    customerFetch(`${API_URL}/api/v1/customer-portal/developer/api-keys`)
      .then(r => r.json())
      .then(json => setKeys(json.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) { setError('Name is required'); return; }
    setError(''); setCreating(true);
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/developer/api-keys`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setFreshKey({ id: data.data.id, key: data.data.key });
        setNewName('');
        setShowCreate(false);
        load();
      }
    } finally { setCreating(false); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await customerFetch(`${API_URL}/api/v1/customer-portal/developer/api-keys/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Revoke this API key? Applications using it will stop working immediately.')) return;
    await customerFetch(`${API_URL}/api/v1/customer-portal/developer/api-keys/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>API Keys</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Authenticate programmatic access to Open TMS.</p>
        </div>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(v => !v)}>
          <span className="material-icons">add</span> New Key
        </button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {freshKey && (
        <div className="vn-alert vn-alert-warning" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Copy this key now - it will not be shown again.</div>
          <code style={{ display: 'block', padding: 8, background: 'var(--surface-secondary)', borderRadius: 6, wordBreak: 'break-all', fontSize: 13 }}>
            {freshKey.key}
          </code>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => navigator.clipboard.writeText(freshKey.key)}>Copy</button>
            <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => setFreshKey(null)}>I have stored it</button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="vn-card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>Create API key</h3>
          <div className="vn-field">
            <label className="vn-field-label">Name</label>
            <input className="vn-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Production ERP integration" />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="vn-btn vn-btn-primary" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="vn-card">
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Status</th>
                <th>Last used</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}><div className="vn-loading-spinner" /></td></tr>}
              {!loading && keys.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                  No API keys yet. Create one to start using the public API.
                </td></tr>
              )}
              {keys.map(k => (
                <tr key={k.id}>
                  <td><strong>{k.name}</strong></td>
                  <td><code>{k.keyPrefix}...</code></td>
                  <td><span className={`vn-chip ${k.active ? 'vn-chip-success' : 'vn-chip-secondary'}`}>{k.active ? 'Active' : 'Disabled'}</span></td>
                  <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : <span className="vn-table-secondary">never</span>}</td>
                  <td><span className="vn-table-secondary">{new Date(k.createdAt).toLocaleDateString()}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => handleToggle(k.id, k.active)}>{k.active ? 'Disable' : 'Enable'}</button>
                    {' '}
                    <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(k.id)}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
