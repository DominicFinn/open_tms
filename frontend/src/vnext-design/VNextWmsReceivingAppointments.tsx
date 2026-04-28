import { useEffect, useState } from 'react';
import { CircleAlert, Loader2, Plus } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): BadgeVariant {
  const m: Record<string, BadgeVariant> = {
    scheduled: 'info', checked_in: 'warning', receiving: 'warning',
    completed: 'success', no_show: 'destructive', cancelled: 'secondary',
  };
  return m[s] || 'secondary';
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
    dockBinId: 'unassigned',
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
          dockBinId: form.dockBinId === 'unassigned' ? undefined : form.dockBinId,
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receiving Appointments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dock scheduling for inbound carriers with check-in workflow.</p>
        </div>
        <Button variant="gradient" onClick={() => setShowCreate(v => !v)}>
          <Plus className="h-4 w-4" />
          Schedule Appointment
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-auto" />
        </CardContent>
      </Card>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New Appointment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Scheduled start *</Label>
              <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Scheduled end *</Label>
              <Input type="datetime-local" value={form.scheduledEndAt} onChange={e => setForm(f => ({ ...f, scheduledEndAt: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Dock bin</Label>
              <Select value={form.dockBinId} onValueChange={v => setForm(f => ({ ...f, dockBinId: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">-- unassigned --</SelectItem>
                  {bins.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Carrier name</Label>
              <Input value={form.carrierName} onChange={e => setForm(f => ({ ...f, carrierName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Trailer number</Label>
              <Input value={form.trailerNumber} onChange={e => setForm(f => ({ ...f, trailerNumber: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Seal number</Label>
              <Input value={form.sealNumber} onChange={e => setForm(f => ({ ...f, sealNumber: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ASN reference</Label>
              <Input value={form.asnReference} onChange={e => setForm(f => ({ ...f, asnReference: e.target.value }))} placeholder="PO / BOL / ASN id" />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button variant="gradient" onClick={handleCreate} disabled={busy === 'create'}>
                {busy === 'create' ? 'Scheduling...' : 'Schedule'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scheduled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dock</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Trailer / Seal</TableHead>
              <TableHead>ASN Ref</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && appointments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  No appointments for this day.
                </TableCell>
              </TableRow>
            )}
            {appointments.map(a => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-semibold">{new Date(a.scheduledAt).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">to {new Date(a.scheduledEndAt).toLocaleTimeString()}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(a.status)}>{a.status.replace('_', ' ')}</Badge>
                </TableCell>
                <TableCell>{a.dockBin?.label ?? <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell>{a.carrierName ?? <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell>
                  {a.trailerNumber ?? <span className="text-muted-foreground">-</span>}
                  {a.sealNumber && <div className="text-xs text-muted-foreground">seal {a.sealNumber}</div>}
                </TableCell>
                <TableCell>{a.asnReference ?? <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell className="text-right">
                  {a.status === 'scheduled' && (
                    <div className="inline-flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCheckIn(a.id)} disabled={busy === a.id}>
                        Check in
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleCancel(a.id)} disabled={busy === a.id}>
                        Cancel
                      </Button>
                    </div>
                  )}
                  {a.status === 'checked_in' && (
                    <Badge variant="warning">ready to receive</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
