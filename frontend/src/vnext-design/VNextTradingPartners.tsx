import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../api';

interface Transaction {
  id: string;
  transactionType: string;
  direction: string;
  enabled: boolean;
  autoProcess: boolean;
  ack997Required: boolean;
}

interface TradingPartner {
  id: string;
  name: string;
  active: boolean;
  entityType: string;
  customerId?: string;
  carrierId?: string;
  customer?: { id: string; name: string } | null;
  carrier?: { id: string; name: string } | null;
  sftpHost?: string;
  sftpPort?: number;
  sftpUsername?: string;
  httpUrl?: string;
  senderId?: string;
  receiverId?: string;
  inboundEnabled: boolean;
  inboundDir?: string;
  inboundFilePattern?: string;
  pollingInterval?: number;
  lastPolledAt?: string;
  outboundEnabled: boolean;
  outboundTransport?: string;
  outboundDir?: string;
  outboundFileNaming?: string;
  transactions: Transaction[];
  createdAt: string;
}

interface FormData {
  name: string;
  entityType: string;
  customerId: string;
  carrierId: string;
  sftpHost: string;
  sftpPort: number;
  sftpUsername: string;
  sftpPassword: string;
  httpUrl: string;
  httpAuthType: string;
  httpAuthValue: string;
  senderId: string;
  receiverId: string;
  inboundEnabled: boolean;
  inboundDir: string;
  inboundFilePattern: string;
  pollingInterval: number;
  outboundEnabled: boolean;
  outboundTransport: string;
  outboundDir: string;
  outboundFileNaming: string;
}

const EMPTY_FORM: FormData = {
  name: '', entityType: 'carrier', customerId: '', carrierId: '',
  sftpHost: '', sftpPort: 22, sftpUsername: '', sftpPassword: '',
  httpUrl: '', httpAuthType: '', httpAuthValue: '',
  senderId: '', receiverId: '',
  inboundEnabled: false, inboundDir: '/', inboundFilePattern: '*.edi,*.x12', pollingInterval: 900,
  outboundEnabled: false, outboundTransport: 'sftp', outboundDir: '', outboundFileNaming: 'reference',
};

const ENTITY_TYPES = ['customer', 'carrier', '3pl', 'warehouse', 'erp', 'other'];
const ALL_TXN_TYPES = [
  { code: '850', name: 'Purchase Order', directions: ['inbound'] },
  { code: '856', name: 'Ship Notice', directions: ['outbound'] },
  { code: '204', name: 'Load Tender', directions: ['outbound'] },
  { code: '990', name: 'Tender Response', directions: ['inbound'] },
  { code: '997', name: 'Func. Ack', directions: ['inbound', 'outbound'] },
  { code: '214', name: 'Status', directions: ['inbound', 'outbound'] },
  { code: '210', name: 'Freight Invoice', directions: ['inbound'] },
  { code: '810', name: 'Invoice', directions: ['outbound'] },
  { code: '820', name: 'Payment', directions: ['inbound'] },
];

export default function VNextTradingPartners() {
  const [partners, setPartners] = useState<TradingPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [connTestResult, setConnTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connTestLoading, setConnTestLoading] = useState(false);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('entityType', typeFilter);
      const res = await fetch(`${API_URL}/api/v1/trading-partners?${params}`);
      const json = await res.json();
      setPartners(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (p: TradingPartner) => {
    setForm({
      name: p.name,
      entityType: p.entityType,
      customerId: p.customerId || '',
      carrierId: p.carrierId || '',
      sftpHost: p.sftpHost || '',
      sftpPort: p.sftpPort || 22,
      sftpUsername: p.sftpUsername || '',
      sftpPassword: '',
      httpUrl: p.httpUrl || '',
      httpAuthType: '',
      httpAuthValue: '',
      senderId: p.senderId || '',
      receiverId: p.receiverId || '',
      inboundEnabled: p.inboundEnabled,
      inboundDir: p.inboundDir || '/',
      inboundFilePattern: p.inboundFilePattern || '*.edi,*.x12',
      pollingInterval: p.pollingInterval || 900,
      outboundEnabled: p.outboundEnabled,
      outboundTransport: p.outboundTransport || 'sftp',
      outboundDir: p.outboundDir || '',
      outboundFileNaming: p.outboundFileNaming || 'reference',
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const savePartner = async () => {
    const body: any = { ...form };
    // Remove empty optional fields
    if (!body.customerId) delete body.customerId;
    if (!body.carrierId) delete body.carrierId;
    if (!body.sftpPassword) delete body.sftpPassword;
    if (!body.httpUrl) delete body.httpUrl;
    if (!body.httpAuthType) delete body.httpAuthType;
    if (!body.httpAuthValue) delete body.httpAuthValue;

    const url = editingId
      ? `${API_URL}/api/v1/trading-partners/${editingId}`
      : `${API_URL}/api/v1/trading-partners`;
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setShowForm(false);
    fetchPartners();
  };

  const testConnection = async (partnerId: string) => {
    setConnTestLoading(true);
    setConnTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/trading-partners/${partnerId}/test-connection`, { method: 'POST' });
      const json = await res.json();
      if (json.error) {
        setConnTestResult({ success: false, message: json.error });
      } else {
        const sftp = json.data?.sftp;
        const http = json.data?.http;
        if (sftp?.success) {
          setConnTestResult({ success: true, message: `SFTP connected to ${sftp.host}. Files: ${sftp.sampleFiles?.join(', ') || 'none visible'}` });
        } else if (http?.success) {
          setConnTestResult({ success: true, message: `HTTP OK (${http.statusCode}) at ${http.url}` });
        } else {
          setConnTestResult({ success: false, message: sftp?.error || http?.error || 'Connection failed' });
        }
      }
    } catch (err: any) {
      setConnTestResult({ success: false, message: err.message });
    } finally {
      setConnTestLoading(false);
    }
  };

  // Transaction type management
  const [newTxnType, setNewTxnType] = useState('850');
  const [newTxnDirection, setNewTxnDirection] = useState('inbound');

  const addTransaction = async (partnerId: string) => {
    await fetch(`${API_URL}/api/v1/trading-partners/${partnerId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionType: newTxnType, direction: newTxnDirection, enabled: true, autoProcess: true, ack997Required: true }),
    });
    fetchPartners();
    setNewTxnType('850');
    setNewTxnDirection('inbound');
  };

  const removeTransaction = async (partnerId: string, txnId: string) => {
    await fetch(`${API_URL}/api/v1/trading-partners/${partnerId}/transactions/${txnId}`, { method: 'DELETE' });
    fetchPartners();
  };

  const filtered = partners.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const getDirectionBadges = (p: TradingPartner) => {
    const badges = [];
    if (p.inboundEnabled) badges.push('IN');
    if (p.outboundEnabled) badges.push('OUT');
    return badges;
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Trading Partners</h1>
        <button className="vn-btn vn-btn-primary" onClick={openCreate}>Add Partner</button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Filters */}
      <div className="vn-filters" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <select className="vn-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          className="vn-filter-input"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="vn-table-wrap">
        <table className="vn-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Linked To</th>
              <th>Directions</th>
              <th>Transactions</th>
              <th>Status</th>
              <th>Last Polled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No trading partners found</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td><span className="vn-chip">{p.entityType}</span></td>
                <td className="vn-table-secondary">{p.customer?.name || p.carrier?.name || '-'}</td>
                <td>
                  {getDirectionBadges(p).map(b => (
                    <span key={b} className="vn-chip vn-chip-info" style={{ marginRight: '0.25rem', fontSize: '0.7rem' }}>{b}</span>
                  ))}
                </td>
                <td className="vn-table-secondary">
                  {p.transactions.filter(t => t.enabled).map(t => t.transactionType).join(', ') || 'None'}
                </td>
                <td>
                  <span className={p.active ? 'vn-chip vn-chip-success' : 'vn-chip vn-chip-secondary'}>
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="vn-table-secondary">
                  {p.lastPolledAt ? new Date(p.lastPolledAt).toLocaleString() : 'Never'}
                </td>
                <td>
                  <button className="vn-btn" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => openEdit(p)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="vn-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="vn-modal-header">
              <h2>{editingId ? 'Edit' : 'New'} Trading Partner</h2>
              <button className="vn-btn" onClick={() => setShowForm(false)}>Close</button>
            </div>
            <div className="vn-modal-body">
              <div className="vn-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="vn-field-label">Name</label>
                  <input className="vn-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Entity Type</label>
                  <select className="vn-input" value={form.entityType} onChange={e => setForm({ ...form, entityType: e.target.value })}>
                    {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Sender ID (ISA)</label>
                  <input className="vn-input" value={form.senderId} onChange={e => setForm({ ...form, senderId: e.target.value })} placeholder="ISA06" />
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Receiver ID (ISA)</label>
                  <input className="vn-input" value={form.receiverId} onChange={e => setForm({ ...form, receiverId: e.target.value })} placeholder="ISA08" />
                </div>
              </div>

              <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '1rem' }}>SFTP Connection</h3>
              <div className="vn-form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div className="vn-field">
                  <label className="vn-field-label">Host</label>
                  <input className="vn-input" value={form.sftpHost} onChange={e => setForm({ ...form, sftpHost: e.target.value })} />
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Port</label>
                  <input className="vn-input" type="number" value={form.sftpPort} onChange={e => setForm({ ...form, sftpPort: parseInt(e.target.value) || 22 })} />
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Username</label>
                  <input className="vn-input" value={form.sftpUsername} onChange={e => setForm({ ...form, sftpUsername: e.target.value })} />
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Password</label>
                  <input className="vn-input" type="password" value={form.sftpPassword} onChange={e => setForm({ ...form, sftpPassword: e.target.value })} placeholder={editingId ? '(unchanged)' : ''} />
                </div>
              </div>

              {editingId && (
                <div style={{ marginTop: '0.75rem' }}>
                  <button className="vn-btn" onClick={() => testConnection(editingId)} disabled={connTestLoading}
                    style={{ fontSize: '0.8rem' }}>
                    {connTestLoading ? 'Testing...' : 'Test Connection'}
                  </button>
                  {connTestResult && (
                    <div className={`vn-alert ${connTestResult.success ? 'vn-alert-success' : 'vn-alert-error'}`}
                      style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                      {connTestResult.message}
                    </div>
                  )}
                </div>
              )}

              <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '1rem' }}>Inbound (Polling)</h3>
              <div className="vn-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={form.inboundEnabled} onChange={e => setForm({ ...form, inboundEnabled: e.target.checked })} />
                    Enable Inbound Polling
                  </label>
                </div>
                {form.inboundEnabled && (
                  <>
                    <div className="vn-field">
                      <label className="vn-field-label">Directory</label>
                      <input className="vn-input" value={form.inboundDir} onChange={e => setForm({ ...form, inboundDir: e.target.value })} />
                    </div>
                    <div className="vn-field">
                      <label className="vn-field-label">File Pattern</label>
                      <input className="vn-input" value={form.inboundFilePattern} onChange={e => setForm({ ...form, inboundFilePattern: e.target.value })} />
                    </div>
                    <div className="vn-field">
                      <label className="vn-field-label">Polling Interval (sec)</label>
                      <input className="vn-input" type="number" value={form.pollingInterval} onChange={e => setForm({ ...form, pollingInterval: parseInt(e.target.value) || 900 })} />
                    </div>
                  </>
                )}
              </div>

              <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '1rem' }}>Outbound (Delivery)</h3>
              <div className="vn-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={form.outboundEnabled} onChange={e => setForm({ ...form, outboundEnabled: e.target.checked })} />
                    Enable Outbound Delivery
                  </label>
                </div>
                {form.outboundEnabled && (
                  <>
                    <div className="vn-field">
                      <label className="vn-field-label">Transport</label>
                      <select className="vn-input" value={form.outboundTransport} onChange={e => setForm({ ...form, outboundTransport: e.target.value })}>
                        <option value="sftp">SFTP</option>
                        <option value="http">HTTP</option>
                      </select>
                    </div>
                    <div className="vn-field">
                      <label className="vn-field-label">Directory / URL</label>
                      <input className="vn-input" value={form.outboundDir} onChange={e => setForm({ ...form, outboundDir: e.target.value })}
                        placeholder={form.outboundTransport === 'sftp' ? '/outbound' : 'https://...'} />
                    </div>
                    <div className="vn-field">
                      <label className="vn-field-label">File Naming</label>
                      <select className="vn-input" value={form.outboundFileNaming} onChange={e => setForm({ ...form, outboundFileNaming: e.target.value })}>
                        <option value="reference">By Reference</option>
                        <option value="date">By Date</option>
                        <option value="sequence">By Sequence</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
              {/* Transaction Types - only shown when editing */}
              {editingId && (() => {
                const partner = partners.find(p => p.id === editingId);
                if (!partner) return null;
                return (
                  <>
                    <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '1rem' }}>Transaction Types</h3>
                    {partner.transactions.length > 0 && (
                      <div className="vn-table-wrap" style={{ marginBottom: '0.75rem' }}>
                        <table className="vn-table">
                          <thead><tr><th>Type</th><th>Direction</th><th>Status</th><th></th></tr></thead>
                          <tbody>
                            {partner.transactions.map(t => (
                              <tr key={t.id}>
                                <td><strong>{t.transactionType}</strong> - {ALL_TXN_TYPES.find(a => a.code === t.transactionType)?.name || ''}</td>
                                <td>{t.direction}</td>
                                <td><span className={t.enabled ? 'vn-chip vn-chip-success' : 'vn-chip vn-chip-secondary'}>{t.enabled ? 'Enabled' : 'Disabled'}</span></td>
                                <td><button className="vn-btn vn-btn-danger" style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }} onClick={() => removeTransaction(partner.id, t.id)}>Remove</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select className="vn-input" style={{ flex: 1 }} value={newTxnType} onChange={e => setNewTxnType(e.target.value)}>
                        {ALL_TXN_TYPES.map(t => <option key={t.code} value={t.code}>{t.code} - {t.name}</option>)}
                      </select>
                      <select className="vn-input" style={{ width: '120px' }} value={newTxnDirection} onChange={e => setNewTxnDirection(e.target.value)}>
                        <option value="inbound">Inbound</option>
                        <option value="outbound">Outbound</option>
                      </select>
                      <button className="vn-btn vn-btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => addTransaction(partner.id)}>Add</button>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="vn-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem' }}>
              <button className="vn-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={savePartner}>
                {editingId ? 'Save Changes' : 'Create Partner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
