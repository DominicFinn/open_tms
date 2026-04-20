import { useEffect, useState } from 'react';
import { API_URL } from '../api';

interface Appointment {
  id: string;
  locationId: string;
  scheduledAt: string;
  scheduledEndAt: string;
  status: string;
  carrierName: string | null;
  trailerNumber: string | null;
  sealNumber: string | null;
  asnReference: string | null;
  dockBin: { id: string; label: string } | null;
  inboundShipmentId: string | null;
}

interface LocationLite { id: string; name: string; }
interface BinLite { id: string; label: string; binType: string; }

function statusChip(s: string): string {
  const m: Record<string, string> = {
    scheduled: 'info', checked_in: 'warning', receiving: 'warning',
    completed: 'success', no_show: 'error', cancelled: 'secondary',
  };
  return `vn-chip-${m[s] || 'secondary'}`;
}

export default function VNextWmsReceivingAppointments() {
  const [locations, setLocations] = useState<LocationLite[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bins, setBins] = useState<BinLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const empty = {
    scheduledAt: '', scheduledEndAt: '',
    carrierName: '', trailerNumber: '', sealNumber: '', asnReference: '',
    dockBinId: '',
  };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json()).then(res => {
      const locs = (res.data || []).filter((l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType));
      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0].id);
      else setLoading(false);
    });
  }, []);

  const load = () => {
    if (!selectedLocation) return;
    setLoading(true);
    const params = new URLSearchParams({ locationId: selectedLocation });
    if (filterDate) params.set('date', filterDate);
    fetch(`${API_URL}/api/v1/receiving/appointments?${params}`)
      .then(r => r.json())
      .then(res => setAppointments(res.data || []))
      .finally(() => setLoading(false));
  };
  useEffect(load, [selectedLocation, filterDate]);

  useEffect(() => {
    if (!selectedLocation) return;
    fetch(`${API_URL}/api/v1/warehouse-bins?locationId=${selectedLocation}&binType=dock`)
      .then(r => r.json())
      .then(res => setBins(res.data || []))
      .catch(() => setBins([]));
  }, [selectedLocation]);

  const handleCreate = async () => {
    if (!selectedLocation || !form.scheduledAt || !form.scheduledEndAt) {
      setError('Start and end time are required');
      return;
    }
    setError(''); setBusy('create');
    try {
      const res = await fetch(`${API_URL}/api/v1/receiving/appointments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          scheduledEndAt: new Date(form.scheduledEndAt).toISOString(),
          carrierName: form.carrierName || undefined,
          trailerNumber: form.trailerNumber || undefined,
          sealNumber: form.sealNumber || undefined,
          asnReference: form.asnReference || undefined,
          dockBinId: form.dockBinId || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); setForm(empty); load(); }
    } finally { setBusy(null); }
  };

  const handleCheckIn = async (id: string) => {
    setBusy(id);
    await fetch(`${API_URL}/api/v1/receiving/appointments/${id}/check-in`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setBusy(null); load();
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this appointment?')) return;
    setBusy(id);
    await fetch(`${API_URL}/api/v1/receiving/appointments/${id}/cancel`, { method: 'POST' });
    setBusy(null); load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Receiving Appointments</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Dock scheduling for inbound carriers with check-in workflow.</p>
        </div>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(v => !v)}>
          <span className="material-icons">add</span> Schedule Appointment
        </button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="vn-card" style={{ marginBottom: 16 }}>
        <div className="vn-filters" style={{ padding: '8px 16px' }}>
          <select className="vn-filter-select" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <input className="vn-filter-input" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        </div>
      </div>

      {showCreate && (
        <div className="vn-card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>New Appointment</h3>
          <div className="vn-form-grid" style={{ gap: 8 }}>
            <div className="vn-field">
              <label className="vn-field-label">Scheduled start *</label>
              <input className="vn-input" type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Scheduled end *</label>
              <input className="vn-input" type="datetime-local" value={form.scheduledEndAt} onChange={e => setForm(f => ({ ...f, scheduledEndAt: e.target.value }))} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Dock bin</label>
              <select className="vn-input" value={form.dockBinId} onChange={e => setForm(f => ({ ...f, dockBinId: e.target.value }))}>
                <option value="">-- unassigned --</option>
                {bins.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Carrier name</label>
              <input className="vn-input" value={form.carrierName} onChange={e => setForm(f => ({ ...f, carrierName: e.target.value }))} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Trailer number</label>
              <input className="vn-input" value={form.trailerNumber} onChange={e => setForm(f => ({ ...f, trailerNumber: e.target.value }))} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Seal number</label>
              <input className="vn-input" value={form.sealNumber} onChange={e => setForm(f => ({ ...f, sealNumber: e.target.value }))} />
            </div>
            <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
              <label className="vn-field-label">ASN reference</label>
              <input className="vn-input" value={form.asnReference} onChange={e => setForm(f => ({ ...f, asnReference: e.target.value }))} placeholder="PO / BOL / ASN id" />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="vn-btn vn-btn-primary" onClick={handleCreate} disabled={busy === 'create'}>
              {busy === 'create' ? 'Scheduling...' : 'Schedule'}
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
                <th>Scheduled</th>
                <th>Status</th>
                <th>Dock</th>
                <th>Carrier</th>
                <th>Trailer / Seal</th>
                <th>ASN Ref</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}><div className="vn-loading-spinner" /></td></tr>}
              {!loading && appointments.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                  No appointments for this day.
                </td></tr>
              )}
              {appointments.map(a => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{new Date(a.scheduledAt).toLocaleString()}</div>
                    <div className="vn-table-secondary">to {new Date(a.scheduledEndAt).toLocaleTimeString()}</div>
                  </td>
                  <td><span className={`vn-chip ${statusChip(a.status)}`}>{a.status.replace('_', ' ')}</span></td>
                  <td>{a.dockBin?.label ?? <span className="vn-table-secondary">-</span>}</td>
                  <td>{a.carrierName ?? <span className="vn-table-secondary">-</span>}</td>
                  <td>
                    {a.trailerNumber ?? <span className="vn-table-secondary">-</span>}
                    {a.sealNumber && <div className="vn-table-secondary" style={{ fontSize: 11 }}>seal {a.sealNumber}</div>}
                  </td>
                  <td>{a.asnReference ?? <span className="vn-table-secondary">-</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    {a.status === 'scheduled' && (
                      <>
                        <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => handleCheckIn(a.id)} disabled={busy === a.id}>Check in</button>
                        {' '}
                        <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleCancel(a.id)} disabled={busy === a.id}>Cancel</button>
                      </>
                    )}
                    {a.status === 'checked_in' && (
                      <span className="vn-chip vn-chip-warning">ready to receive</span>
                    )}
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
