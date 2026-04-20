import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface Appointment {
  id: string;
  scheduledAt: string;
  scheduledEndAt: string;
  status: string;
  carrierName: string | null;
  trailerNumber: string | null;
  sealNumber: string | null;
  asnReference: string | null;
  dockBin: { id: string; label: string } | null;
}

function statusColour(s: string): string {
  if (s === 'scheduled') return '#3b82f6';
  if (s === 'checked_in') return '#f59e0b';
  if (s === 'receiving') return '#f59e0b';
  if (s === 'completed') return '#10b981';
  return '#94a3b8';
}

export default function WarehouseAppointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const locationId = (() => {
    try { return JSON.parse(localStorage.getItem('warehouse_location') || '{}').id; } catch { return null; }
  })();

  const load = () => {
    if (!locationId) { setLoading(false); return; }
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    fetch(`${API_URL}/api/v1/receiving/appointments?locationId=${locationId}&date=${today}`)
      .then(r => r.json())
      .then(res => {
        const all = res.data || [];
        // Show scheduled + checked_in at the top, skip completed/cancelled
        setAppointments(all.filter((a: any) => a.status !== 'completed' && a.status !== 'cancelled'));
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCheckIn = async (id: string) => {
    setError(''); setBusy(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/receiving/appointments/${id}/check-in`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else load();
    } finally { setBusy(null); }
  };

  return (
    <div>
      <button onClick={() => navigate('/warehouse')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
        <span className="material-icons" style={{ fontSize: '20px' }}>arrow_back</span> Home
      </button>

      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Today's Appointments</h1>
      <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px' }}>Check in arriving carriers before receiving.</p>

      {error && <div style={{ padding: '10px', background: '#7f1d1d', borderRadius: '8px', color: '#fca5a5', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</div>
      ) : appointments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: '#475569', display: 'block', marginBottom: '8px' }}>event_available</span>
          <div style={{ color: '#94a3b8' }}>No appointments today</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {appointments.map(a => (
            <div key={a.id} style={{ background: '#1e293b', borderRadius: '12px', padding: '14px 16px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>
                    {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' '}-{' '}
                    {new Date(a.scheduledEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: 2 }}>
                    {a.carrierName ?? 'Carrier TBD'}
                    {a.dockBin?.label && <> &middot; {a.dockBin.label}</>}
                  </div>
                  {(a.trailerNumber || a.asnReference) && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>
                      {a.trailerNumber && <>Trailer {a.trailerNumber}</>}
                      {a.trailerNumber && a.asnReference && <> &middot; </>}
                      {a.asnReference && <>ASN {a.asnReference}</>}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <div style={{
                    padding: '4px 8px', borderRadius: '8px', fontSize: '11px',
                    background: statusColour(a.status) + '22', color: statusColour(a.status),
                    textTransform: 'uppercase', fontWeight: 600,
                  }}>
                    {a.status.replace('_', ' ')}
                  </div>
                  {a.status === 'scheduled' && (
                    <button onClick={() => handleCheckIn(a.id)} disabled={busy === a.id}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: busy === a.id ? 0.5 : 1 }}>
                      {busy === a.id ? '...' : 'Check In'}
                    </button>
                  )}
                  {a.status === 'checked_in' && (
                    <div style={{ fontSize: '11px', color: '#f59e0b' }}>Ready to receive</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
