import { useEffect, useState } from 'react';
import { API_URL } from '../../../api';
import { customerFetch } from '../CustomerDashboard';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  description: string | null;
  secret: string;
  lastDeliveryAt: string | null;
  lastStatusCode: number | null;
  deliveryCount: number;
  failureCount: number;
  createdAt: string;
}

interface Delivery {
  id: string;
  eventType: string;
  status: string;
  statusCode: number | null;
  errorMessage: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export default function CustomerWebhooks() {
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', description: '', events: ['*'] });
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, Delivery[]>>({});
  const [busy, setBusy] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks`).then(r => r.json()),
      customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/events`).then(r => r.json()),
    ]).then(([h, e]) => {
      setHooks(h.data || []);
      setEvents(e.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleEvent = (pattern: string) => {
    setForm(f => {
      if (f.events.includes(pattern)) return { ...f, events: f.events.filter(e => e !== pattern) };
      return { ...f, events: [...f.events, pattern] };
    });
  };

  const handleCreate = async () => {
    if (!form.name || !form.url) { setError('Name and URL are required'); return; }
    if (form.events.length === 0) { setError('Select at least one event'); return; }
    setError(''); setBusy('create');
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); setForm({ name: '', url: '', description: '', events: ['*'] }); load(); }
    } finally { setBusy(''); }
  };

  const handleToggle = async (h: Webhook) => {
    setBusy(h.id);
    await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/${h.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !h.enabled }),
    });
    setBusy(''); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/${id}`, { method: 'DELETE' });
    load();
  };

  const handleRotate = async (id: string) => {
    if (!confirm('Rotate the signing secret? The old secret will stop working immediately.')) return;
    setBusy(id);
    const res = await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/${id}/rotate-secret`, { method: 'POST' });
    const data = await res.json();
    setBusy('');
    if (!data.error) { alert(`New secret: ${data.data.secret}\n\nStore it now - it won't be shown in the list.`); load(); }
  };

  const handleTest = async (id: string) => {
    setBusy(id);
    const res = await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/${id}/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    const data = await res.json();
    setBusy('');
    alert(data.error
      ? `Test failed: ${data.error}`
      : `Test sent - status: ${data.data.status}${data.data.statusCode ? ` (HTTP ${data.data.statusCode})` : ''}${data.data.errorMessage ? `\n${data.data.errorMessage}` : ''}`);
    load();
  };

  const loadDeliveries = async (id: string) => {
    const res = await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/${id}/deliveries?limit=20`);
    const data = await res.json();
    setDeliveries(d => ({ ...d, [id]: data.data || [] }));
  };

  const toggleExpanded = (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!deliveries[id]) loadDeliveries(id);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Webhooks</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Subscribe to events from your orders, shipments, invoices, and returns.</p>
        </div>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(v => !v)}>
          <span className="material-icons">add</span> New Webhook
        </button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {showCreate && (
        <div className="vn-card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>New webhook</h3>
          <div className="vn-form-grid" style={{ gap: 12 }}>
            <div className="vn-field">
              <label className="vn-field-label">Name</label>
              <input className="vn-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Shipment tracker" />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Endpoint URL</label>
              <input className="vn-input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://yourdomain.com/webhooks/open-tms" />
            </div>
          </div>
          <div className="vn-field" style={{ marginTop: 8 }}>
            <label className="vn-field-label">Description</label>
            <input className="vn-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes for your team" />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Subscribed events</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {events.map(ev => (
                <button
                  key={ev}
                  onClick={() => toggleEvent(ev)}
                  className={`vn-chip ${form.events.includes(ev) ? 'vn-chip-primary' : 'vn-chip-secondary'}`}
                  style={{ cursor: 'pointer', border: 'none' }}
                >
                  {ev}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              Use <code>*</code> for everything, <code>rma.*</code> for all RMA events, or exact patterns.
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="vn-btn vn-btn-primary" onClick={handleCreate} disabled={busy === 'create'}>
              {busy === 'create' ? 'Creating...' : 'Create'}
            </button>
            <button className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div className="vn-loading-spinner" /> : hooks.length === 0 ? (
        <div className="vn-card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
          No webhooks yet. Create one above to start receiving events.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hooks.map(h => (
            <div key={h.id} className="vn-card">
              <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0 }}>{h.name}</h3>
                    <span className={`vn-chip ${h.enabled ? 'vn-chip-success' : 'vn-chip-secondary'}`}>{h.enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.url}</div>
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {h.events.map(e => <span key={e} className="vn-chip vn-chip-secondary" style={{ fontSize: 11 }}>{e}</span>)}
                  </div>
                  {h.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{h.description}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                    {h.deliveryCount} deliveries &middot; {h.failureCount} failures
                    {h.lastDeliveryAt && <> &middot; last at {new Date(h.lastDeliveryAt).toLocaleString()} (HTTP {h.lastStatusCode ?? '-'})</>}
                  </div>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>Reveal signing secret</summary>
                    <code style={{ display: 'block', padding: 6, marginTop: 6, background: 'var(--surface-secondary)', borderRadius: 6, fontSize: 12, wordBreak: 'break-all' }}>{h.secret}</code>
                  </details>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => handleTest(h.id)} disabled={busy === h.id}>Send test</button>
                  <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => toggleExpanded(h.id)}>
                    {expanded === h.id ? 'Hide log' : 'View log'}
                  </button>
                  <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => handleToggle(h)} disabled={busy === h.id}>
                    {h.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => handleRotate(h.id)} disabled={busy === h.id}>Rotate secret</button>
                  <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(h.id)}>Delete</button>
                </div>
              </div>

              {expanded === h.id && (
                <div style={{ padding: '0 16px 16px' }}>
                  <div className="vn-table-wrap">
                    <table className="vn-table">
                      <thead><tr><th>Event</th><th>Status</th><th>HTTP</th><th>Time</th><th>Error</th></tr></thead>
                      <tbody>
                        {(deliveries[h.id] || []).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)' }}>No deliveries yet</td></tr>}
                        {(deliveries[h.id] || []).map(d => (
                          <tr key={d.id}>
                            <td>{d.eventType}</td>
                            <td><span className={`vn-chip ${d.status === 'delivered' ? 'vn-chip-success' : 'vn-chip-error'}`}>{d.status}</span></td>
                            <td>{d.statusCode ?? '-'}</td>
                            <td><span className="vn-table-secondary">{new Date(d.createdAt).toLocaleString()}</span></td>
                            <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>{d.errorMessage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
