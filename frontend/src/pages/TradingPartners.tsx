import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

interface Transaction {
  id: string;
  transactionType: string;
  direction: string;
  enabled: boolean;
  autoProcess: boolean;
  ack997Required: boolean;
  filePattern: string | null;
}

interface TradingPartner {
  id: string;
  name: string;
  active: boolean;
  entityType: string;
  customerId: string | null;
  carrierId: string | null;
  customer: { id: string; name: string } | null;
  carrier: { id: string; name: string } | null;
  sftpHost: string | null;
  httpUrl: string | null;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  outboundTransport: string;
  senderId: string | null;
  receiverId: string | null;
  transactions: Transaction[];
  lastPolledAt: string | null;
  createdAt: string;
}

interface TransactionType {
  code: string;
  name: string;
  directions: string[];
  status: string;
}

const entityIcons: Record<string, string> = {
  customer: 'people', carrier: 'airport_shuttle', '3pl': 'hub',
  warehouse: 'warehouse', erp: 'dns', other: 'device_hub',
};

export default function TradingPartners() {
  const [partners, setPartners] = useState<TradingPartner[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    name: '', entityType: 'carrier' as string,
    sftpHost: '', sftpPort: '22', sftpUsername: '', sftpPassword: '',
    httpUrl: '', httpAuthType: '', httpAuthValue: '',
    senderId: '', receiverId: '',
    inboundEnabled: false, inboundDir: '/', inboundFilePattern: '*.edi,*.x12',
    pollingInterval: '900',
    outboundEnabled: false, outboundDir: '', outboundTransport: 'sftp' as string,
  });

  // Add transaction form
  const [addTxnPartnerId, setAddTxnPartnerId] = useState<string | null>(null);
  const [addTxnType, setAddTxnType] = useState('');
  const [addTxnDir, setAddTxnDir] = useState('inbound');

  useEffect(() => {
    fetchPartners();
    fetch(`${API_URL}/api/v1/edi/transaction-types`).then(r => r.json()).then(j => setTransactionTypes(j.data || []));
  }, [entityFilter]);

  async function fetchPartners() {
    setLoading(true);
    const params = new URLSearchParams();
    if (entityFilter) params.set('entityType', entityFilter);
    const res = await fetch(`${API_URL}/api/v1/trading-partners?${params}`);
    const json = await res.json();
    setPartners(json.data || []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/v1/trading-partners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        sftpPort: parseInt(form.sftpPort) || 22,
        pollingInterval: parseInt(form.pollingInterval) || 900,
        sftpHost: form.sftpHost || undefined,
        httpUrl: form.httpUrl || undefined,
        outboundDir: form.outboundDir || undefined,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      await fetchPartners();
    }
  }

  async function handleToggleActive(partner: TradingPartner) {
    await fetch(`${API_URL}/api/v1/trading-partners/${partner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !partner.active }),
    });
    await fetchPartners();
  }

  async function handleAddTransaction() {
    if (!addTxnPartnerId || !addTxnType) return;
    await fetch(`${API_URL}/api/v1/trading-partners/${addTxnPartnerId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionType: addTxnType, direction: addTxnDir }),
    });
    setAddTxnPartnerId(null);
    setAddTxnType('');
    await fetchPartners();
  }

  async function handleRemoveTransaction(partnerId: string, txnId: string) {
    await fetch(`${API_URL}/api/v1/trading-partners/${partnerId}/transactions/${txnId}`, { method: 'DELETE' });
    await fetchPartners();
  }

  const detailPartner = showDetail ? partners.find(p => p.id === showDetail) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Trading Partners</h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Manage EDI connections with customers, carriers, ERPs, and other systems
          </p>
        </div>
        <button className="button" onClick={() => setShowCreate(true)}>
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '6px' }}>add</span>
          Add Partner
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 500, fontSize: '14px' }}>Type:</label>
          {['', 'customer', 'carrier', '3pl', 'warehouse', 'erp', 'other'].map(t => (
            <button key={t} className={entityFilter === t ? 'button' : 'button-outline'}
              style={{ padding: '4px 12px', fontSize: '13px' }}
              onClick={() => setEntityFilter(t)}>
              {t || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Partners table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Linked Entity</th>
              <th>Connection</th>
              <th>Inbound</th>
              <th>Outbound</th>
              <th>Transactions</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}><span className="loading-spinner" /></td></tr>
            ) : partners.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>No trading partners configured</td></tr>
            ) : partners.map(p => (
              <tr key={p.id} onClick={() => setShowDetail(p.id)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>
                  <span className="material-icons" style={{ fontSize: '16px', marginRight: '6px', verticalAlign: 'middle' }}>{entityIcons[p.entityType] || 'device_hub'}</span>
                  {p.name}
                </td>
                <td><span className="chip chip-secondary">{p.entityType}</span></td>
                <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {p.customer?.name || p.carrier?.name || '--'}
                </td>
                <td style={{ fontSize: '13px' }}>
                  {p.sftpHost && <span title={`sftp://${p.sftpHost}`}>SFTP</span>}
                  {p.sftpHost && p.httpUrl && ' + '}
                  {p.httpUrl && <span title={p.httpUrl}>HTTP</span>}
                  {!p.sftpHost && !p.httpUrl && '--'}
                </td>
                <td>
                  {p.inboundEnabled
                    ? <span className="chip chip-success" style={{ fontSize: '11px' }}>On</span>
                    : <span className="chip chip-secondary" style={{ fontSize: '11px' }}>Off</span>}
                </td>
                <td>
                  {p.outboundEnabled
                    ? <span className="chip chip-success" style={{ fontSize: '11px' }}>On ({p.outboundTransport})</span>
                    : <span className="chip chip-secondary" style={{ fontSize: '11px' }}>Off</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                    {p.transactions.map(t => (
                      <span key={t.id} className={`chip chip-${t.direction === 'inbound' ? 'info' : 'primary'}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                        {t.direction === 'inbound' ? '↓' : '↑'}{t.transactionType}
                      </span>
                    ))}
                    {p.transactions.length === 0 && <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>None</span>}
                  </div>
                </td>
                <td>
                  <span className={`chip chip-${p.active ? 'success' : 'error'}`}>
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="icon-btn" title={p.active ? 'Deactivate' : 'Activate'}
                    onClick={e => { e.stopPropagation(); handleToggleActive(p); }}>
                    <span className="material-icons" style={{ fontSize: '18px' }}>{p.active ? 'pause' : 'play_arrow'}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {detailPartner && (
        <div className="modal-backdrop" onClick={() => setShowDetail(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
              <h3 style={{ margin: 0 }}>{detailPartner.name}</h3>
              <button className="icon-btn" onClick={() => setShowDetail(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)', fontSize: '13px', marginBottom: 'var(--spacing-2)' }}>
              <div><strong>Type:</strong> {detailPartner.entityType}</div>
              <div><strong>Linked:</strong> {detailPartner.customer?.name || detailPartner.carrier?.name || 'None'}</div>
              <div><strong>SFTP:</strong> {detailPartner.sftpHost || 'Not configured'}</div>
              <div><strong>HTTP:</strong> {detailPartner.httpUrl || 'Not configured'}</div>
              <div><strong>Sender ID:</strong> {detailPartner.senderId || '--'}</div>
              <div><strong>Receiver ID:</strong> {detailPartner.receiverId || '--'}</div>
              <div><strong>Inbound:</strong> {detailPartner.inboundEnabled ? 'Enabled' : 'Disabled'}</div>
              <div><strong>Outbound:</strong> {detailPartner.outboundEnabled ? `Enabled (${detailPartner.outboundTransport})` : 'Disabled'}</div>
              {detailPartner.lastPolledAt && <div><strong>Last Polled:</strong> {new Date(detailPartner.lastPolledAt).toLocaleString()}</div>}
            </div>

            {/* Transaction types */}
            <h4 style={{ margin: 'var(--spacing-2) 0 var(--spacing-1)' }}>Transaction Types</h4>
            {detailPartner.transactions.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>No transaction types configured. Add one below.</p>
            ) : (
              <div className="table-container" style={{ marginBottom: 'var(--spacing-2)' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Type</th><th>Direction</th><th>Auto-Process</th><th>997 Ack</th><th></th></tr>
                  </thead>
                  <tbody>
                    {detailPartner.transactions.map(t => {
                      const typeInfo = transactionTypes.find(tt => tt.code === t.transactionType);
                      return (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 500 }}>{t.transactionType} {typeInfo ? `— ${typeInfo.name}` : ''}</td>
                          <td><span className={`chip chip-${t.direction === 'inbound' ? 'info' : 'primary'}`}>{t.direction}</span></td>
                          <td>{t.autoProcess ? 'Yes' : 'No'}</td>
                          <td>{t.ack997Required ? 'Yes' : 'No'}</td>
                          <td>
                            <button className="icon-btn" title="Remove" onClick={() => handleRemoveTransaction(detailPartner.id, t.id)}>
                              <span className="material-icons" style={{ fontSize: '16px', color: 'var(--color-error)' }}>delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add transaction */}
            <div style={{ display: 'flex', gap: 'var(--spacing-1)', alignItems: 'center' }}>
              <select className="text-field" style={{ width: 'auto', fontSize: '13px', padding: '4px 8px' }}
                value={addTxnType} onChange={e => { setAddTxnType(e.target.value); setAddTxnPartnerId(detailPartner.id); }}>
                <option value="">Add type...</option>
                {transactionTypes.map(tt => (
                  <option key={tt.code} value={tt.code}>{tt.code} — {tt.name} ({tt.status})</option>
                ))}
              </select>
              <select className="text-field" style={{ width: 'auto', fontSize: '13px', padding: '4px 8px' }}
                value={addTxnDir} onChange={e => setAddTxnDir(e.target.value)}>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
              <button className="button" style={{ fontSize: '12px', padding: '4px 12px' }}
                onClick={handleAddTransaction} disabled={!addTxnType}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 var(--spacing-2)' }}>Add Trading Partner</h3>
            <form onSubmit={handleCreate}>
              <div className="form-grid">
                <div>
                  <label className="field-label">Partner Name *</label>
                  <input className="text-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="field-label">Entity Type *</label>
                  <select className="text-field" value={form.entityType} onChange={e => setForm({ ...form, entityType: e.target.value })}>
                    <option value="customer">Customer</option>
                    <option value="carrier">Carrier</option>
                    <option value="3pl">3PL</option>
                    <option value="warehouse">Warehouse</option>
                    <option value="erp">ERP (SAP, Oracle, etc.)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <h4 style={{ margin: 'var(--spacing-2) 0 var(--spacing-1)' }}>SFTP Connection</h4>
              <div className="form-grid">
                <div>
                  <label className="field-label">SFTP Host</label>
                  <input className="text-field" value={form.sftpHost} onChange={e => setForm({ ...form, sftpHost: e.target.value })} placeholder="sftp.example.com" />
                </div>
                <div>
                  <label className="field-label">Port</label>
                  <input className="text-field" type="number" value={form.sftpPort} onChange={e => setForm({ ...form, sftpPort: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Username</label>
                  <input className="text-field" value={form.sftpUsername} onChange={e => setForm({ ...form, sftpUsername: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Password</label>
                  <input className="text-field" type="password" value={form.sftpPassword} onChange={e => setForm({ ...form, sftpPassword: e.target.value })} />
                </div>
              </div>

              <h4 style={{ margin: 'var(--spacing-2) 0 var(--spacing-1)' }}>EDI Config</h4>
              <div className="form-grid">
                <div>
                  <label className="field-label">Sender ID</label>
                  <input className="text-field" value={form.senderId} onChange={e => setForm({ ...form, senderId: e.target.value })} placeholder="Our ISA06 ID" />
                </div>
                <div>
                  <label className="field-label">Receiver ID</label>
                  <input className="text-field" value={form.receiverId} onChange={e => setForm({ ...form, receiverId: e.target.value })} placeholder="Partner's ISA08 ID" />
                </div>
              </div>

              <h4 style={{ margin: 'var(--spacing-2) 0 var(--spacing-1)' }}>Inbound (receive EDI from this partner)</h4>
              <div className="form-grid">
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={form.inboundEnabled} onChange={e => setForm({ ...form, inboundEnabled: e.target.checked })} />
                    Enable inbound polling
                  </label>
                </div>
                <div>
                  <label className="field-label">Inbound Directory</label>
                  <input className="text-field" value={form.inboundDir} onChange={e => setForm({ ...form, inboundDir: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">File Pattern</label>
                  <input className="text-field" value={form.inboundFilePattern} onChange={e => setForm({ ...form, inboundFilePattern: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Polling Interval (seconds)</label>
                  <input className="text-field" type="number" min="60" value={form.pollingInterval} onChange={e => setForm({ ...form, pollingInterval: e.target.value })} />
                </div>
              </div>

              <h4 style={{ margin: 'var(--spacing-2) 0 var(--spacing-1)' }}>Outbound (send EDI to this partner)</h4>
              <div className="form-grid">
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={form.outboundEnabled} onChange={e => setForm({ ...form, outboundEnabled: e.target.checked })} />
                    Enable outbound delivery
                  </label>
                </div>
                <div>
                  <label className="field-label">Transport</label>
                  <select className="text-field" value={form.outboundTransport} onChange={e => setForm({ ...form, outboundTransport: e.target.value })}>
                    <option value="sftp">SFTP</option>
                    <option value="http">HTTP/API</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Outbound Directory (SFTP)</label>
                  <input className="text-field" value={form.outboundDir} onChange={e => setForm({ ...form, outboundDir: e.target.value })} placeholder="/outbound" />
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: 'var(--spacing-2)' }}>
                <button type="button" className="button-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="button">Create Partner</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
