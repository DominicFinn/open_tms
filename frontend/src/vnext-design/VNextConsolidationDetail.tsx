import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, CircleAlert, Loader2, MapPin, PackagePlus, Radio, Undo2, X } from 'lucide-react';

import { API_URL } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ConsolidationShipmentPicker from './ConsolidationShipmentPicker';
import ConsolidationRunMap from './ConsolidationRunMap';
import { consolidationStatusVariant } from './consolidationStatus';

interface ConsolidationStop {
  id: string;
  sequenceNumber: number;
  stopType: string;
  status: string;
  location: { id: string; name: string; city: string | null; state: string | null; lat: number | null; lng: number | null };
  shipmentStops: Array<{ shipmentId: string }>;
}

interface MemberShipment {
  id: string;
  reference: string;
  status: string;
  serviceLevel: string | null;
  pickupDate: string | null;
  deliveryDate: string | null;
  customer: { id: string; name: string };
  stops: Array<{ id: string; sequenceNumber: number; consolidationStopId: string | null }>;
}

interface Consolidation {
  id: string;
  reference: string;
  status: string;
  notes: string | null;
  archived: boolean;
  carrier: { id: string; name: string } | null;
  devices: Array<{ id: string; device: { id: string; name: string; externalId: string } }>;
  position: { lat: number; lng: number; at: string | null } | null;
  stops: ConsolidationStop[];
  shipments: Array<{ addedAt: string; shipment: MemberShipment }>;
}

const NO_CARRIER = 'none';
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

export default function VNextConsolidationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();
  const [consolidation, setConsolidation] = useState<Consolidation | null>(null);
  const [carriers, setCarriers] = useState<Array<{ id: string; name: string }>>([]);
  const [carrierId, setCarrierId] = useState(NO_CARRIER);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceExternalId, setDeviceExternalId] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/consolidations/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to load consolidation (${res.status})`);
      setConsolidation(json.data);
      setCarrierId(json.data.carrier?.id ?? NO_CARRIER);
      setNotes(json.data.notes ?? '');
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch(`${API_URL}/api/v1/carriers`).then((r) => r.json()).then((json) => setCarriers(json.data || [])).catch(() => setCarriers([]));
  }, []);

  const shipments = useMemo(() => consolidation?.shipments.map((s) => s.shipment) ?? [], [consolidation]);
  const referenceOf = useMemo(() => new Map(shipments.map((s) => [s.id, s.reference])), [shipments]);
  const sequenceOf = useMemo(() => new Map(consolidation?.stops.map((s) => [s.id, s.sequenceNumber]) ?? []), [consolidation]);

  async function call(path: string, body?: object): Promise<string | null> {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/consolidations/${id}${path}`, {
        method: path === '' ? 'PATCH' : 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) return json.error || 'Request failed';
      await load();
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function act(path: string, body?: object) {
    const problem = await call(path, body);
    if (problem) setActionError(problem);
  }

  /** Moves a stop one place within its own section, so pickups always stay before drops. */
  function move(stopId: string, delta: -1 | 1) {
    if (!consolidation) return;
    const order = consolidation.stops.map((s) => s.id);
    const i = order.indexOf(stopId);
    const j = i + delta;
    const typeAt = (k: number) => consolidation.stops[k]?.stopType;
    if (j < 0 || j >= order.length || typeAt(i) !== typeAt(j)) return;
    [order[i], order[j]] = [order[j], order[i]];
    act('/stops/order', { stopIds: order });
  }

  function saveDevices(next: Array<{ name: string; externalId: string }>) {
    act('', { devices: next });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (error || !consolidation) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" /> {error ?? 'Consolidation not found'}
      </div>
    );
  }

  const canWrite = hasPermission('shipments:write') && !consolidation.archived;
  const editable = canWrite && consolidation.status === 'draft';
  const customers = new Set(shipments.map((s) => s.customer.id)).size;
  const settingsChanged = carrierId !== (consolidation.carrier?.id ?? NO_CARRIER) || notes !== (consolidation.notes ?? '');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/consolidations')}>
            <ArrowLeft className="h-4 w-4" /> Consolidations
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{consolidation.reference}</h1>
            <Badge variant={consolidation.archived ? 'muted' : consolidationStatusVariant(consolidation.status)} className="capitalize">
              {consolidation.archived ? 'archived' : consolidation.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {shipments.length} shipment{shipments.length === 1 ? '' : 's'} for {customers} customer{customers === 1 ? '' : 's'} · {consolidation.stops.length} stops
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            {editable && (
              <Button variant="outline" onClick={() => setPicking(true)} disabled={busy}>
                <PackagePlus className="h-4 w-4" /> Add shipments
              </Button>
            )}
            {consolidation.status === 'draft' && (
              <Button onClick={() => act('/status', { to: 'ready' })} disabled={busy || shipments.length === 0}>
                <CheckCircle2 className="h-4 w-4" /> Mark ready
              </Button>
            )}
            {consolidation.status === 'ready' && (
              <Button variant="outline" onClick={() => act('/status', { to: 'draft' })} disabled={busy}>
                <Undo2 className="h-4 w-4" /> Back to draft
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                const freed = consolidation.status === 'draft' ? ' Its shipments will be freed to consolidate again.' : '';
                if (window.confirm(`Archive ${consolidation.reference}?${freed}`)) act('/archive');
              }}
            >
              <Archive className="h-4 w-4" /> Archive
            </Button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <CircleAlert className="h-4 w-4" /> {actionError}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Map</CardTitle></CardHeader>
        <CardContent>
          <ConsolidationRunMap reference={consolidation.reference} stops={consolidation.stops} position={consolidation.position} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Stops</CardTitle></CardHeader>
          <CardContent>
            {consolidation.stops.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stops. Add shipments to build the run.</p>
            ) : (
              <ol className="space-y-2">
                {consolidation.stops.map((stop, i) => (
                  <li key={stop.id} className="flex items-start gap-3 rounded-md border p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {stop.sequenceNumber}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{stop.location.name}</span>
                        <Badge variant={stop.stopType === 'pickup' ? 'info' : 'secondary'} className="capitalize">{stop.stopType}</Badge>
                        <span className="text-xs capitalize text-muted-foreground">{stop.status}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {[stop.location.city, stop.location.state].filter(Boolean).join(', ')}
                        {stop.shipmentStops.length > 0 && (
                          <> · {stop.stopType === 'pickup' ? 'collects' : 'drops'} {stop.shipmentStops.map((s) => referenceOf.get(s.shipmentId) ?? s.shipmentId).join(', ')}</>
                        )}
                      </div>
                    </div>
                    {editable && (
                      <div className="flex shrink-0 flex-col">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          aria-label={`Move ${stop.location.name} earlier`}
                          disabled={busy || consolidation.stops[i - 1]?.stopType !== stop.stopType}
                          onClick={() => move(stop.id, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          aria-label={`Move ${stop.location.name} later`}
                          disabled={busy || consolidation.stops[i + 1]?.stopType !== stop.stopType}
                          onClick={() => move(stop.id, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Run</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Select value={carrierId} onValueChange={setCarrierId} disabled={!canWrite}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CARRIER}>No carrier yet</SelectItem>
                  {carriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                rows={4}
                value={notes}
                disabled={!canWrite}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dock times, loading order..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            {canWrite && (
              <Button
                className="w-full"
                disabled={!settingsChanged || busy}
                onClick={() => act('', { carrierId: carrierId === NO_CARRIER ? null : carrierId, notes: notes.trim() || null })}
              >
                Save
              </Button>
            )}
            <div className="space-y-2 border-t pt-4">
              <Label className="flex items-center gap-2"><Radio className="h-4 w-4" /> Tracking devices</Label>
              <p className="text-xs text-muted-foreground">Pings from a device here update every shipment on the run.</p>
              {consolidation.devices.length === 0 && <p className="text-sm text-muted-foreground">No device yet.</p>}
              {consolidation.devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{d.device.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{d.device.externalId}</div>
                  </div>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove device ${d.device.name}`}
                      disabled={busy}
                      onClick={() => saveDevices(consolidation.devices.filter((x) => x.id !== d.id).map((x) => ({ name: x.device.name, externalId: x.device.externalId })))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {canWrite && (
                <div className="space-y-2">
                  <Input placeholder="Device name" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
                  <Input placeholder="Device ID" value={deviceExternalId} onChange={(e) => setDeviceExternalId(e.target.value)} />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={busy || !deviceName.trim() || !deviceExternalId.trim()}
                    onClick={() => {
                      saveDevices([
                        ...consolidation.devices.map((x) => ({ name: x.device.name, externalId: x.device.externalId })),
                        { name: deviceName.trim(), externalId: deviceExternalId.trim() },
                      ]);
                      setDeviceName('');
                      setDeviceExternalId('');
                    }}
                  >
                    Add device
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Shipments</CardTitle></CardHeader>
        <CardContent className="p-0">
          {shipments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No shipments on this consolidation.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Run stops</TableHead>
                  <TableHead>Status</TableHead>
                  {editable && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link to={`/shipments/${s.id}`} className="text-primary hover:underline">{s.reference}</Link>
                    </TableCell>
                    <TableCell>{s.customer.name}</TableCell>
                    <TableCell>{s.serviceLevel ?? '—'}</TableCell>
                    <TableCell>{day(s.pickupDate)}</TableCell>
                    <TableCell>{day(s.deliveryDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.stops.map((st) => (st.consolidationStopId ? sequenceOf.get(st.consolidationStopId) : null)).filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="capitalize">{s.status.replace('_', ' ')}</TableCell>
                    {editable && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => act(`/shipments/${s.id}/remove`)}
                          aria-label={`Remove ${s.reference}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConsolidationShipmentPicker
        open={picking}
        onOpenChange={setPicking}
        title={`Add shipments to ${consolidation.reference}`}
        confirmLabel="Add shipments"
        onConfirm={(shipmentIds) => call('/shipments', { shipmentIds })}
      />
    </div>
  );
}
