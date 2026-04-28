import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  Loader2,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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

function statusVariant(s: string): 'success' | 'warning' | 'info' | 'muted' {
  if (s === 'scheduled') return 'info';
  if (s === 'checked_in' || s === 'receiving') return 'warning';
  if (s === 'completed') return 'success';
  return 'muted';
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
    <div className="mx-auto max-w-2xl space-y-4 px-1 py-2 pb-24">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0"
          onClick={() => navigate('/warehouse')}
          aria-label="Home"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today's Appointments</h1>
          <p className="text-sm text-muted-foreground">Check in arriving carriers before receiving.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : appointments.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <CalendarCheck className="h-12 w-12 text-muted-foreground" />
          <p className="text-base font-semibold">No appointments today</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map(a => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold tabular-nums">
                    {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(a.scheduledEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {a.carrierName ?? 'Carrier TBD'}
                    {a.dockBin?.label && <> &middot; {a.dockBin.label}</>}
                  </div>
                  {(a.trailerNumber || a.asnReference) && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {a.trailerNumber && <>Trailer {a.trailerNumber}</>}
                      {a.trailerNumber && a.asnReference && <> &middot; </>}
                      {a.asnReference && <>ASN {a.asnReference}</>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={statusVariant(a.status)} className="px-3 py-1 text-sm uppercase tracking-wider">
                    {a.status.replace('_', ' ')}
                  </Badge>
                  {a.status === 'scheduled' && (
                    <Button
                      type="button"
                      size="lg"
                      variant="gradient"
                      onClick={() => handleCheckIn(a.id)}
                      disabled={busy === a.id}
                    >
                      {busy === a.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      {busy === a.id ? '...' : 'Check In'}
                    </Button>
                  )}
                  {a.status === 'checked_in' && (
                    <span className="text-sm font-medium text-warning">Ready to receive</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
