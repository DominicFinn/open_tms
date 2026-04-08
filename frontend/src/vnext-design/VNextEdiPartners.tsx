import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

export default function VNextEdiPartners() {
  const [partners, setPartners] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', customerId: '', sftpHost: '', sftpPort: '22', sftpUsername: '', sftpPassword: '',
    remotePath: '', pollingEnabled: false, pollingIntervalMinutes: '15', autoCreateOrders: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [partnersRes, customersRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/edi-partners`),
        fetch(`${API_URL}/api/v1/customers`),
      ]);
      if (!partnersRes.ok) throw new Error('Failed to load EDI partners');
      const partnersJson = await partnersRes.json();
      setPartners(partnersJson.data || []);

      if (customersRes.ok) {
        const customersJson = await customersRes.json();
        setCustomers(customersJson.data || []);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function openEdit(p: any) {
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      customerId: p.customerId || '',
      sftpHost: p.sftpHost || '',
      sftpPort: String(p.sftpPort || 22),
      sftpUsername: p.sftpUsername || '',
      sftpPassword: '',
      remotePath: p.remotePath || '',
      pollingEnabled: p.pollingEnabled || false,
      pollingIntervalMinutes: String(p.pollingIntervalMinutes || 15),
      autoCreateOrders: p.autoCreateOrders || false,
    });
    setShowCreate(true);
  }

  function resetForm() {
    setForm({
      name: '', customerId: '', sftpHost: '', sftpPort: '22', sftpUsername: '', sftpPassword: '',
      remotePath: '', pollingEnabled: false, pollingIntervalMinutes: '15', autoCreateOrders: false,
    });
    setEditingId(null);
    setShowCreate(false);
  }

  async function savePartner() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const body: any = {
        name: form.name,
        customerId: form.customerId || undefined,
        sftpHost: form.sftpHost || undefined,
        sftpPort: form.sftpPort ? parseInt(form.sftpPort) : undefined,
        sftpUsername: form.sftpUsername || undefined,
        remotePath: form.remotePath || undefined,
        pollingEnabled: form.pollingEnabled,
        pollingIntervalMinutes: parseInt(form.pollingIntervalMinutes) || 15,
        autoCreateOrders: form.autoCreateOrders,
      };
      if (form.sftpPassword) body.sftpPassword = form.sftpPassword;

      const url = editingId
        ? `${API_URL}/api/v1/edi-partners/${editingId}`
        : `${API_URL}/api/v1/edi-partners`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to ${editingId ? 'update' : 'create'} EDI partner`);
      resetForm();
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to save EDI partner');
    } finally {
      setSaving(false);
    }
  }

  async function deletePartner(id: string) {
    if (!confirm('Are you sure you want to delete this EDI partner?')) return;
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/edi-partners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete EDI partner');
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to delete EDI partner');
    }
  }

  const filtered = partners.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.name || '').toLowerCase().includes(q)
      || (p.customerName || '').toLowerCase().includes(q);
  });

  const activeCount = partners.filter(p => p.pollingEnabled || p.active !== false).length;
  const autoCreateCount = partners.filter(p => p.autoCreateOrders).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>EDI Partners</h1>
          <p>Manage EDI trading partners and SFTP connections</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary" onClick={() => { resetForm(); setShowCreate(true); }}>
            <span className="material-icons">add</span>
            Add EDI Partner
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {showCreate && (
        <div className="vn-card" style={{ marginBottom: 16 }}>
          <div className="vn-card-header">
            <h2>{editingId ? 'Edit' : 'Add'} EDI Partner</h2>
          </div>
          <div className="vn-card-body">
            <div className="form-grid">
              <div>
                <label>Name</label>
                <input className="vn-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Partner name" />
              </div>
              <div>
                <label>Customer</label>
                <select className="vn-select" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}>
                  <option value="">Select customer...</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>SFTP Host</label>
                <input className="vn-input" value={form.sftpHost} onChange={e => setForm({ ...form, sftpHost: e.target.value })} placeholder="sftp.example.com" />
              </div>
              <div>
                <label>SFTP Port</label>
                <input className="vn-input" type="number" value={form.sftpPort} onChange={e => setForm({ ...form, sftpPort: e.target.value })} />
              </div>
              <div>
                <label>SFTP Username</label>
                <input className="vn-input" value={form.sftpUsername} onChange={e => setForm({ ...form, sftpUsername: e.target.value })} placeholder="username" />
              </div>
              <div>
                <label>SFTP Password</label>
                <input className="vn-input" type="password" value={form.sftpPassword} onChange={e => setForm({ ...form, sftpPassword: e.target.value })} placeholder={editingId ? '(leave blank to keep)' : 'password'} />
              </div>
              <div>
                <label>Remote Path</label>
                <input className="vn-input" value={form.remotePath} onChange={e => setForm({ ...form, remotePath: e.target.value })} placeholder="/inbound" />
              </div>
              <div>
                <label>Polling Interval (minutes)</label>
                <input className="vn-input" type="number" value={form.pollingIntervalMinutes} onChange={e => setForm({ ...form, pollingIntervalMinutes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.pollingEnabled} onChange={e => setForm({ ...form, pollingEnabled: e.target.checked })} />
                  Polling Enabled
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.autoCreateOrders} onChange={e => setForm({ ...form, autoCreateOrders: e.target.checked })} />
                  Auto-Create Orders
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="vn-btn vn-btn-primary" onClick={savePartner} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button className="vn-btn vn-btn-outline" onClick={resetForm}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">handshake</span></div>
          <div>
            <div className="vn-stat-value">{partners.length}</div>
            <div className="vn-stat-label">Total Partners</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{activeCount}</div>
            <div className="vn-stat-label">Active</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">auto_fix_high</span></div>
          <div>
            <div className="vn-stat-value">{autoCreateCount}</div>
            <div className="vn-stat-label">Auto-Create Orders</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group" style={{ flex: 1 }}>
            <span className="material-icons">search</span>
            <input
              className="vn-filter-input"
              placeholder="Search partners..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="vn-empty">
            <span className="material-icons">handshake</span>
            <h3>No EDI partners found</h3>
            <p>Add an EDI partner to start processing files.</p>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Customer</th>
                  <th>SFTP</th>
                  <th>Polling</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ fontSize: 13 }}>{p.customerName || customers.find((c: any) => c.id === p.customerId)?.name || '—'}</td>
                    <td>
                      {p.sftpHost ? (
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.sftpHost}:{p.sftpPort || 22}</span>
                      ) : (
                        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>Not configured</span>
                      )}
                    </td>
                    <td>
                      <span className={`vn-chip ${p.pollingEnabled ? 'vn-chip-success' : 'vn-chip-secondary'}`}>
                        {p.pollingEnabled ? `Every ${p.pollingIntervalMinutes || 15}m` : 'Off'}
                      </span>
                    </td>
                    <td>
                      <span className={`vn-chip ${p.pollingEnabled || p.active !== false ? 'vn-chip-success' : 'vn-chip-secondary'}`}>
                        {p.pollingEnabled || p.active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="vn-btn-icon" title="Edit" onClick={() => openEdit(p)}>
                          <span className="material-icons" style={{ fontSize: 18 }}>edit</span>
                        </button>
                        <button className="vn-btn-icon" title="Delete" onClick={() => deletePartner(p.id)}>
                          <span className="material-icons" style={{ fontSize: 18 }}>delete</span>
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
    </>
  );
}
