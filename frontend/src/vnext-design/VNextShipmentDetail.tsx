import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  ArrowLeft,
  BatteryFull,
  Bot,
  Box,
  CheckCircle2,
  CircleHelp,
  Clock,
  CreditCard,
  Download,
  Edit,
  Eye,
  FileText,
  Globe,
  Handshake,
  Inbox,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  Pen,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Share2,
  ShoppingBasket,
  Sparkles,
  Target,
  Thermometer,
  Timer,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getDeviceImageUrl } from './deviceImages';

// Hex colors used inside Leaflet HTML strings (cannot use Tailwind/var(--*))
const COLOR_INFO = '#3b82f6';
const COLOR_SUCCESS = '#22c55e';
const COLOR_WARNING = '#eab308';
const COLOR_DESTRUCTIVE = '#ef4444';
const COLOR_MUTED = '#94a3b8';

// ─── Temperature Chart ──────────────────────────────────────────────────
function ShipmentTempChart({ readings }: { readings: any[] }) {
  const temps = readings.filter(r => r.temperature != null);
  if (temps.length < 2) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
        <Thermometer className="h-8 w-8" />
        <h3 className="text-base font-medium">Not enough data</h3>
      </div>
    );
  }

  const w = 600, h = 200, pad = 40;
  const minT = Math.min(...temps.map(r => r.temperature));
  const maxT = Math.max(...temps.map(r => r.temperature));
  const range = maxT - minT || 1;

  const points = temps.map((r: any, i: number) => ({
    x: pad + (i / (temps.length - 1)) * (w - pad * 2),
    y: pad + (1 - (r.temperature - minT) / range) * (h - pad * 2),
    alert: r.isAlert,
  }));

  const line = points.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
      <text x={pad} y={pad - 10} fill="currentColor" className="fill-muted-foreground text-[11px]">{maxT.toFixed(1)}°</text>
      <text x={pad} y={h - pad + 16} fill="currentColor" className="fill-muted-foreground text-[11px]">{minT.toFixed(1)}°</text>
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} className="stroke-border" strokeWidth="1" />
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} className="stroke-border" strokeWidth="1" />
      <path d={line} fill="none" className="stroke-primary" strokeWidth="2" />
      {points.map((p: any, i: number) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.alert ? 5 : 3}
          className={p.alert ? 'fill-destructive' : 'fill-primary'}
        />
      ))}
    </svg>
  );
}

// ─── Financials Tab ─────────────────────────────────────────────────────
function FinancialsTab({ shipmentId }: { shipmentId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/shipments/${shipmentId}/financials`)
      .then(r => r.json())
      .then(j => setData(j.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [shipmentId]);

  if (loading) return (
    <Card>
      <CardContent className="p-6">
        <p>Loading financials...</p>
      </CardContent>
    </Card>
  );

  if (!data || (data.charges && data.charges.length === 0)) {
    return (
      <Card>
        <CardHeader><CardTitle>Financials</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Wallet className="h-12 w-12 opacity-50" />
            <p>No charges recorded on this shipment yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const fmtMoney = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const margin = data.expectedRevenueCents - data.expectedCostCents;
  const marginPct = data.expectedRevenueCents > 0 ? Math.round((margin / data.expectedRevenueCents) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{fmtMoney(data.expectedRevenueCents)}</div>
          <div className="mt-1 text-sm text-muted-foreground">Expected Revenue</div>
        </Card>
        <Card className="p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning">
            <Truck className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{fmtMoney(data.expectedCostCents)}</div>
          <div className="mt-1 text-sm text-muted-foreground">Expected Cost</div>
        </Card>
        <Card className="p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className={cn('mt-3 text-2xl font-bold tracking-tight', margin >= 0 ? 'text-success' : 'text-destructive')}>
            {fmtMoney(margin)} ({marginPct}%)
          </div>
          <div className="mt-1 text-sm text-muted-foreground">Margin</div>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Charges ({data.charges?.length || 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.charges || []).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{c.description}</TableCell>
                  <TableCell>
                    <Badge variant={c.chargeCategory === 'revenue' ? 'default' : 'warning'}>{c.chargeCategory}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.chargeType.replace(/_/g, ' ')}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === 'approved' ? 'success' : c.status === 'invoiced' ? 'info' : 'muted'}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmtMoney(c.amountCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Telemetry Tab ──────────────────────────────────────────────────────
function TelemetryTab({ shipmentId }: { shipmentId: string }) {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [tLoading, setTLoading] = useState(true);
  const [tError, setTError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setTLoading(true);
        const res = await fetch(`${API_URL}/api/v1/shipments/${shipmentId}/telemetry`);
        if (!res.ok) throw new Error(`Failed to load telemetry (${res.status})`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!cancelled) {
          setTelemetry(json.data);
          setTError('');
        }
      } catch (err: any) {
        if (!cancelled) setTError(err.message || 'Failed to load telemetry');
      } finally {
        if (!cancelled) setTLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shipmentId]);

  if (tLoading) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <h3 className="text-base font-medium">Loading telemetry...</h3>
      </div>
    );
  }

  if (tError) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <XCircle className="h-5 w-5" />
        {tError}
      </div>
    );
  }

  if (!telemetry) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Thermometer className="h-8 w-8" />
        <h3 className="text-base font-medium">No telemetry data</h3>
      </div>
    );
  }

  const readings: any[] = telemetry.readings || [];
  const alerts = readings.filter((r: any) => r.isAlert);
  const tempsWithValues = readings.filter((r: any) => r.temperature != null);
  const avgTemp = tempsWithValues.length > 0
    ? (tempsWithValues.reduce((sum: number, r: any) => sum + r.temperature, 0) / tempsWithValues.length).toFixed(1)
    : '-';
  const latestBattery = readings.length > 0 && readings[0].batteryLevel != null
    ? `${readings[0].batteryLevel}%`
    : '-';

  const deviceMap = new Map<string, any>();
  readings.forEach((r: any) => {
    if (r.device && r.device.id && !deviceMap.has(r.device.id)) {
      deviceMap.set(r.device.id, r.device);
    }
  });
  const trackerDevices = Array.from(deviceMap.values());

  return (
    <div className="space-y-6">
      {trackerDevices.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tracking Devices</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {trackerDevices.map((dev: any) => {
                const imgUrl = getDeviceImageUrl(dev.model);
                return (
                  <div
                    key={dev.id}
                    className="flex min-w-[220px] items-center gap-3 rounded-md border border-border bg-muted/20 px-4 py-3"
                  >
                    {imgUrl ? (
                      <img src={imgUrl} alt={dev.model} className="h-10 w-10 shrink-0 object-contain" />
                    ) : (
                      <Package className="h-9 w-9 shrink-0 text-muted-foreground" />
                    )}
                    <div>
                      <div className="text-sm font-semibold">{dev.name || dev.displayId || 'Device'}</div>
                      <div className="text-xs text-muted-foreground">
                        {dev.model || 'Unknown model'}{dev.displayId ? ` - ${dev.displayId}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Package className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{readings.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">Reading Count</div>
        </Card>
        <Card className="p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{alerts.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">Alerts</div>
        </Card>
        <Card className="p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Thermometer className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{avgTemp}{avgTemp !== '-' ? '°' : ''}</div>
          <div className="mt-1 text-sm text-muted-foreground">Avg Temp</div>
        </Card>
        <Card className="p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
            <BatteryFull className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{latestBattery}</div>
          <div className="mt-1 text-sm text-muted-foreground">Latest Battery</div>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Temperature</CardTitle></CardHeader>
        <CardContent>
          <ShipmentTempChart readings={readings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Readings</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead>Humidity</TableHead>
                <TableHead>Battery</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Alert</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readings.slice(0, 25).map((r: any, i: number) => (
                <TableRow key={r.id || i}>
                  <TableCell className="text-sm">{new Date(r.recordedAt).toLocaleString()}</TableCell>
                  <TableCell>{r.temperature != null ? `${r.temperature}°` : '-'}</TableCell>
                  <TableCell>{r.humidity != null ? `${r.humidity}%` : '-'}</TableCell>
                  <TableCell>{r.batteryLevel != null ? `${r.batteryLevel}%` : '-'}</TableCell>
                  <TableCell className="text-xs">{r.lat != null && r.lng != null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : '-'}</TableCell>
                  <TableCell>
                    {r.isAlert
                      ? <Badge variant="destructive">Alert</Badge>
                      : <span className="text-xs text-muted-foreground">-</span>}
                  </TableCell>
                </TableRow>
              ))}
              {readings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No readings available</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Cargo Tab ─────────────────────────────────────────────────────────
interface CargoManifest {
  shipmentId: string;
  stops: Array<{
    stopId: string;
    sequenceNumber: number;
    locationName: string;
    stopType: string;
    status: string;
    expectedUnits: ManifestUnit[];
    scannedUnits: ManifestUnit[];
    discrepancies: CargoDiscrepancy[];
  }>;
  unassignedUnits: ManifestUnit[];
  totalExpected: number;
  totalScanned: number;
  totalDiscrepancies: number;
}

interface ManifestUnit {
  id: string;
  identifier: string;
  unitType: string;
  barcode: string | null;
  condition: string;
  currentStopId: string | null;
  orderId: string;
  orderNumber: string;
  lineItemCount: number;
  lastScannedAt: string | null;
}

interface CargoDiscrepancy {
  id: string;
  discrepancyType: string;
  severity: string;
  status: string;
  description: string;
  detectedAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  trackableUnit: { identifier: string; unitType: string; order?: { orderNumber: string } };
  expectedStop?: { location: { name: string } };
  actualStop?: { location: { name: string } };
}

const discrepancyTypeLabels: Record<string, string> = {
  misdrop_early: 'Dropped Too Early',
  misdrop_late: 'Dropped Too Late',
  missing_at_stop: 'Missing at Stop',
  unexpected_at_stop: 'Unexpected at Stop',
  left_on_vehicle: 'Left on Vehicle',
  damaged: 'Damaged',
  wrong_destination: 'Wrong Destination',
};

function severityVariant(severity: string): 'destructive' | 'warning' | 'info' {
  if (severity === 'critical' || severity === 'high') return 'destructive';
  if (severity === 'medium') return 'warning';
  return 'info';
}

function conditionVariant(condition: string): 'success' | 'destructive' | 'warning' | 'muted' {
  if (condition === 'good') return 'success';
  if (condition === 'damaged' || condition === 'lost') return 'destructive';
  if (condition === 'unknown') return 'warning';
  return 'muted';
}

function unitTypeIcon(unitType: string): typeof Package {
  if (unitType === 'pallet') return Box;
  if (unitType === 'box') return Package;
  if (unitType === 'tote') return ShoppingBasket;
  return Package;
}

function CargoTab({ shipmentId }: { shipmentId: string }) {
  const [manifest, setManifest] = useState<CargoManifest | null>(null);
  const [discrepancies, setDiscrepancies] = useState<CargoDiscrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!shipmentId) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/v1/shipments/${shipmentId}/cargo-manifest`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/shipments/${shipmentId}/cargo-discrepancies`).then(r => r.json()),
    ])
      .then(([manifestRes, discRes]) => {
        if (manifestRes.error) throw new Error(manifestRes.error);
        setManifest(manifestRes.data);
        setDiscrepancies(discRes.data || []);
        setError('');
      })
      .catch(err => setError(err.message || 'Failed to load cargo data'))
      .finally(() => setLoading(false));
  }, [shipmentId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleResolve = async (discId: string) => {
    const resolution = prompt('Resolution notes:');
    if (!resolution) return;
    setResolving(discId);
    try {
      const res = await fetch(`${API_URL}/api/v1/cargo-discrepancies/${discId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', resolution }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      loadData();
    } catch (err: any) {
      alert(`Failed to resolve: ${err.message}`);
    } finally {
      setResolving(null);
    }
  };

  const handleInvestigate = async (discId: string) => {
    try {
      await fetch(`${API_URL}/api/v1/cargo-discrepancies/${discId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'investigating' }),
      });
      loadData();
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <h3 className="text-base font-medium">Loading cargo data...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <XCircle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  if (!manifest || (manifest.totalExpected === 0 && manifest.unassignedUnits.length === 0)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Package className="h-12 w-12 opacity-30" />
          <h3 className="text-base font-medium">No trackable cargo units</h3>
          <p className="text-sm">
            Add trackable units (pallets, totes, boxes) to orders assigned to this shipment to enable cargo tracking.
          </p>
        </CardContent>
      </Card>
    );
  }

  const openDiscrepancies = discrepancies.filter(d => d.status === 'open' || d.status === 'investigating');

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Package className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{manifest.totalExpected}</div>
          <div className="mt-1 text-sm text-muted-foreground">Expected Units</div>
        </Card>
        <Card className="p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{manifest.totalScanned}</div>
          <div className="mt-1 text-sm text-muted-foreground">Scanned / Confirmed</div>
        </Card>
        <Card className="p-5">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              openDiscrepancies.length > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{openDiscrepancies.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">Open Issues</div>
        </Card>
        <Card className="p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{manifest.stops.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">Delivery Stops</div>
        </Card>
      </div>

      {openDiscrepancies.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Cargo Issues ({openDiscrepancies.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {openDiscrepancies.map((disc) => (
              <div
                key={disc.id}
                className="flex items-center gap-3 border-b border-border p-4 last:border-0"
              >
                <AlertTriangle
                  className={cn(
                    'h-5 w-5 shrink-0',
                    disc.severity === 'critical' || disc.severity === 'high' ? 'text-destructive' : 'text-warning',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      {discrepancyTypeLabels[disc.discrepancyType] || disc.discrepancyType}
                    </span>
                    <Badge variant={severityVariant(disc.severity)}>{disc.severity}</Badge>
                    {disc.status === 'investigating' && <Badge variant="warning">Investigating</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{disc.description}</div>
                  <div className="text-xs text-muted-foreground">
                    Detected {new Date(disc.detectedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {disc.status === 'open' && (
                    <Button variant="outline" size="sm" onClick={() => handleInvestigate(disc.id)}>
                      Investigate
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleResolve(disc.id)}
                    disabled={resolving === disc.id}
                  >
                    {resolving === disc.id ? 'Resolving...' : 'Resolve'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {manifest.stops.map((stop) => {
        const hasIssues = stop.discrepancies.filter(d => d.status !== 'resolved' && d.status !== 'dismissed').length > 0;
        const allDelivered = stop.status === 'completed' && stop.expectedUnits.length > 0;

        return (
          <Card key={stop.stopId} className={cn(hasIssues && 'border-destructive')}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">
                  Stop {stop.sequenceNumber} - {stop.locationName}
                </CardTitle>
                <div className="mt-1 text-xs text-muted-foreground">
                  {stop.stopType} - {stop.status}
                  {stop.expectedUnits.length > 0 && ` - ${stop.expectedUnits.length} unit${stop.expectedUnits.length !== 1 ? 's' : ''} expected`}
                </div>
              </div>
              {allDelivered && !hasIssues && (
                <Badge variant="success">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  All Delivered
                </Badge>
              )}
              {hasIssues && (
                <Badge variant="destructive">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Issues Detected
                </Badge>
              )}
            </CardHeader>

            {stop.expectedUnits.length > 0 ? (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stop.expectedUnits.map((unit) => {
                      const isAtThisStop = unit.currentStopId === stop.stopId;
                      const isScanned = stop.scannedUnits.some(s => s.id === unit.id);
                      const unitDisc = stop.discrepancies.find(
                        (d: any) => d.trackableUnitId === unit.id && d.status !== 'resolved' && d.status !== 'dismissed',
                      );
                      let statusLabel = 'Pending';
                      let statusVariantC: 'success' | 'destructive' | 'warning' | 'info' | 'muted' = 'muted';
                      if (isAtThisStop || isScanned) {
                        statusLabel = 'Delivered';
                        statusVariantC = 'success';
                      } else if (stop.status === 'completed') {
                        statusLabel = isScanned ? 'Delivered' : 'Not confirmed';
                        statusVariantC = isScanned ? 'success' : 'warning';
                      } else if (stop.status === 'arrived' || stop.status === 'in_progress') {
                        statusLabel = 'In transit';
                        statusVariantC = 'info';
                      }
                      if (unitDisc) {
                        statusLabel = discrepancyTypeLabels[(unitDisc as any).discrepancyType] || 'Issue';
                        statusVariantC = 'destructive';
                      }

                      const UnitIcon = unitTypeIcon(unit.unitType);

                      return (
                        <TableRow key={unit.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <UnitIcon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="text-sm font-medium">{unit.identifier}</div>
                                {unit.barcode && (
                                  <div className="text-xs text-muted-foreground">{unit.barcode}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm capitalize">{unit.unitType}</TableCell>
                          <TableCell>
                            <Link to={`/orders/${unit.orderId}`} className="text-sm text-primary hover:underline">
                              {unit.orderNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm">{unit.lineItemCount}</TableCell>
                          <TableCell>
                            <Badge variant={conditionVariant(unit.condition)}>{unit.condition}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariantC}>{statusLabel}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            ) : (
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No cargo units assigned to this stop
              </CardContent>
            )}
          </Card>
        );
      })}

      {manifest.unassignedUnits.length > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleHelp className="h-5 w-5 text-warning" />
              Unassigned Cargo ({manifest.unassignedUnits.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            These trackable units are on this shipment but not assigned to a delivery stop.
          </CardContent>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Condition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manifest.unassignedUnits.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.identifier}</TableCell>
                    <TableCell className="text-sm capitalize">{unit.unitType}</TableCell>
                    <TableCell>
                      <Link to={`/orders/${unit.orderId}`} className="text-sm text-primary hover:underline">
                        {unit.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{unit.lineItemCount}</TableCell>
                    <TableCell><Badge variant={conditionVariant(unit.condition)}>{unit.condition}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {discrepancies.filter(d => d.status === 'resolved' || d.status === 'dismissed').length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resolved Issues</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Resolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discrepancies
                  .filter(d => d.status === 'resolved' || d.status === 'dismissed')
                  .map((disc) => (
                    <TableRow key={disc.id}>
                      <TableCell>{discrepancyTypeLabels[disc.discrepancyType] || disc.discrepancyType}</TableCell>
                      <TableCell>{disc.trackableUnit?.identifier || '-'}</TableCell>
                      <TableCell><Badge variant="success">{disc.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{disc.resolution || '-'}</TableCell>
                      <TableCell className="text-sm">{disc.resolvedAt ? new Date(disc.resolvedAt).toLocaleString() : '-'}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── SLA Tab ───────────────────────────────────────────────────────────
function SlaTab({ shipmentId }: { shipmentId: string }) {
  const [evals, setEvals] = useState<any[]>([]);
  const [slaLoading, setSlaLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setSlaLoading(true);
        const res = await fetch(`${API_URL}/api/v1/shipments/${shipmentId}/sla`);
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const json = await res.json();
        if (!cancelled) setEvals(json.data || []);
      } catch (err) {
        console.error('SLA fetch error:', err);
      } finally {
        if (!cancelled) setSlaLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shipmentId]);

  if (slaLoading) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (evals.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Timer className="mx-auto h-12 w-12 opacity-40" />
        <h3 className="mt-2 text-base font-medium">No SLA Evaluations</h3>
        <p className="text-sm">No SLA policies are tracking this shipment. Configure policies in Admin &gt; Settings &gt; SLA Policies.</p>
      </div>
    );
  }

  const slaVariant = (status: string): 'info' | 'warning' | 'destructive' | 'success' | 'muted' => {
    const map: Record<string, 'info' | 'warning' | 'destructive' | 'success' | 'muted'> = {
      active: 'info',
      warning: 'warning',
      breached: 'destructive',
      met: 'success',
      cancelled: 'muted',
    };
    return map[status] || 'muted';
  };

  const formatRemaining = (e: any) => {
    if (e.status === 'met') return 'Met';
    if (e.status === 'breached') return e.breachDurationMinutes ? `${e.breachDurationMinutes}m overdue` : 'Breached';
    if (!e.slaDueAt) return '--';
    const mins = Math.round((new Date(e.slaDueAt).getTime() - Date.now()) / 60_000);
    if (mins < 0) return `${Math.abs(mins)}m overdue`;
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${Math.floor(mins / 1440)}d`;
  };

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rule</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Time Remaining</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {evals.map((e: any) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{e.ruleName}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{e.ruleType.replace(/_/g, ' ')}</TableCell>
              <TableCell><Badge variant={slaVariant(e.status)}>{e.status}</Badge></TableCell>
              <TableCell
                className={cn(
                  'font-semibold',
                  e.status === 'breached' ? 'text-destructive' : e.status === 'warning' ? 'text-warning' : '',
                )}
              >
                {formatRemaining(e)}
              </TableCell>
              <TableCell className="text-xs">{new Date(e.slaStartedAt).toLocaleString()}</TableCell>
              <TableCell className="text-xs">{e.slaDueAt ? new Date(e.slaDueAt).toLocaleString() : '--'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────
function ShipmentNotesTab({ shipmentId }: { shipmentId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(() => {
    fetch(`${API_URL}/api/v1/comments?entityType=shipment&entityId=${shipmentId}`)
      .then(r => r.json())
      .then(json => setComments(json.data?.items || json.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [shipmentId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${API_URL}/api/v1/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'shipment', entityId: shipmentId, body: newComment }),
      });
      setNewComment('');
      loadComments();
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Notes &amp; Comments</CardTitle></CardHeader>
      <CardContent>
        {comments.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <MessageSquare className="h-12 w-12 opacity-50" />
            <p>No notes yet. Add the first comment below.</p>
          </div>
        )}
        {comments.map((c: any) => (
          <div key={c.id} className="flex gap-3 border-b border-border py-3 last:border-0">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                c.authorType === 'agent' ? 'bg-info' : 'bg-primary',
              )}
            >
              {c.authorType === 'agent'
                ? <Bot className="h-4 w-4" />
                : (c.authorName || '?').split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1">
              <div className="mb-1 flex justify-between">
                <span className="text-sm font-semibold">{c.authorName}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm leading-relaxed">{c.body}</p>
            </div>
          </div>
        ))}
        <div className="mt-4 flex gap-2">
          <textarea
            className="flex w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Add a comment..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            rows={2}
          />
          <Button variant="gradient" onClick={handleSubmit} disabled={submitting || !newComment.trim()} className="self-end">
            {submitting ? '...' : 'Post'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Carrier Tracking Tab ─────────────────────────────────────────────
const TRACKING_STATUS_VARIANT: Record<string, 'success' | 'destructive' | 'info' | 'warning' | 'default' | 'muted'> = {
  delivered: 'success',
  in_transit: 'info',
  out_for_delivery: 'default',
  exception: 'destructive',
  info_received: 'warning',
  return_to_sender: 'destructive',
  unknown: 'muted',
};

function CarrierTrackingTab({ shipmentId }: { shipmentId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/shipments/${shipmentId}/carrier-tracking`)
      .then(r => r.json())
      .then(j => setEvents(j.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [shipmentId]);

  const handlePoll = async () => {
    setPolling(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/shipments/${shipmentId}/carrier-tracking/poll`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Poll failed');
      setMessage(`Poll complete: ${json.data?.eventsCreated ?? 0} new events`);
      const evRes = await fetch(`${API_URL}/api/v1/shipments/${shipmentId}/carrier-tracking`);
      const evJson = await evRes.json();
      setEvents(evJson.data || []);
    } catch (err) {
      setMessage(`Error: ${(err as Error).message}`);
    } finally {
      setPolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Carrier Tracking Events</CardTitle>
        <Button variant="outline" size="sm" onClick={handlePoll} disabled={polling}>
          <RefreshCw className={cn('h-4 w-4', polling && 'animate-spin')} />
          {polling ? 'Polling...' : 'Poll Now'}
        </Button>
      </CardHeader>
      <CardContent>
        {message && (
          <div
            className={cn(
              'mb-4 rounded-md p-3 text-sm',
              message.startsWith('Error')
                ? 'border border-destructive/30 bg-destructive/10 text-destructive'
                : 'border border-success/30 bg-success/10 text-success',
            )}
          >
            {message}
          </div>
        )}

        {events.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <SearchX className="mx-auto h-10 w-10 opacity-40" />
            <p className="mt-2 text-sm">No carrier tracking events yet.</p>
            <p className="text-xs">Events will appear here once the carrier's tracking API reports updates.</p>
          </div>
        ) : (
          <ol className="relative space-y-6 border-l border-border pl-6">
            {events.map((ev: any, i: number) => {
              const statusLabel = (ev.status || 'unknown').replace(/_/g, ' ');
              const variant = TRACKING_STATUS_VARIANT[ev.status] || 'muted';
              const dotTone =
                ev.status === 'delivered' ? 'border-success/30 bg-success/10 text-success' :
                  ev.status === 'exception' ? 'border-destructive/30 bg-destructive/10 text-destructive' :
                    'border-info/30 bg-info/10 text-info';
              const location = [ev.city, ev.state, ev.country].filter(Boolean).join(', ');
              return (
                <li key={ev.id || i} className="relative">
                  <span
                    className={cn(
                      'absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full border',
                      dotTone,
                    )}
                  >
                    <Truck className="h-3 w-3" />
                  </span>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {ev.occurredAt ? new Date(ev.occurredAt).toLocaleString() : ''}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium">
                    <Badge variant={variant}>{statusLabel}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{ev.trackingNumber}</span>
                    <Badge variant="muted" className="text-[10px]">{ev.source}</Badge>
                  </div>
                  {ev.statusDetail && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{ev.statusDetail}</div>
                  )}
                  {location && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {location}
                    </div>
                  )}
                  {ev.signedBy && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Pen className="h-3 w-3" />
                      Signed by: {ev.signedBy}
                    </div>
                  )}
                  {ev.estimatedDelivery && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      ETA: {new Date(ev.estimatedDelivery).toLocaleString()}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export default function VNextShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('events');
  const [shipment, setShipment] = useState<any>(null);
  const [shipmentType, setShipmentType] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [routeDeviation, setRouteDeviation] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/shipments/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load shipment');
        return res.json();
      })
      .then(json => {
        if (json.error) throw new Error(json.error);
        setShipment(json.data);
        if (json.data?.shipmentTypeId) {
          fetch(`${API_URL}/api/v1/shipment-types/${json.data.shipmentTypeId}`)
            .then(r => r.json())
            .then(j => { if (!j.error) setShipmentType(j.data); })
            .catch(() => { });
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const loadDocuments = useCallback(() => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/documents?shipmentId=${id}`)
      .then(r => r.json())
      .then(json => { if (!json.error) setDocuments(json.data || []); })
      .catch(() => { });
  }, [id]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // Check route deviation for in-transit shipments with a lane
  useEffect(() => {
    if (!shipment?.laneId) return;
    const inTransit = ['in_transit', 'dispatched', 'picked_up', 'at_stop'].includes(shipment.status);
    if (!inTransit) return;

    const lat = shipment.currentLat;
    const lng = shipment.currentLng;
    if (!lat || !lng) return;

    fetch(`${API_URL}/api/v1/lanes/${shipment.laneId}/route/check-deviation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.data?.isDeviated) {
          setRouteDeviation(json.data);
        }
      })
      .catch(() => { });
  }, [shipment?.laneId, shipment?.status, shipment?.currentLat, shipment?.currentLng]);

  const handleGenerateDoc = async (type: 'bol' | 'customs' | 'rate_confirmation') => {
    if (!id) return;
    setGenerating(type);
    try {
      const endpoint = type === 'rate_confirmation'
        ? `${API_URL}/api/v1/documents/rate-confirmation`
        : `${API_URL}/api/v1/documents/generate/${type}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentId: id }),
      });
      const json = await res.json();
      if (json.error) { alert(`Error: ${json.error}`); return; }
      loadDocuments();
      if (type === 'bol') {
        navigate(`/documents/${json.data.id}/view`);
      }
    } catch {
      const names: Record<string, string> = { bol: 'Bill of Lading', customs: 'Customs Form', rate_confirmation: 'Rate Confirmation' };
      alert(`Failed to generate ${names[type] || type}`);
    } finally {
      setGenerating(null);
    }
  };

  const hasOriginCoords = !!(shipment?.origin?.lat && shipment?.origin?.lng);
  const hasDestCoords = !!(shipment?.destination?.lat && shipment?.destination?.lng);
  const hasAnyCoords = hasOriginCoords || hasDestCoords;

  useEffect(() => {
    if (!mapRef.current || !shipment || !hasAnyCoords) return;
    const origin = shipment.origin;
    const destination = shipment.destination;

    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

    const allCoords: [number, number][] = [];

    if (hasOriginCoords) {
      const coord: [number, number] = [origin.lat, origin.lng];
      allCoords.push(coord);
      const originIcon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border-radius:50%;background:${COLOR_INFO};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      });
      L.marker(coord, { icon: originIcon }).addTo(map).bindPopup(`<strong>Origin</strong><br/>${origin.city || ''}, ${origin.state || ''}`);
    }

    if (hasDestCoords) {
      const coord: [number, number] = [destination.lat, destination.lng];
      allCoords.push(coord);
      const destIcon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border-radius:50%;background:${COLOR_SUCCESS};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      });
      L.marker(coord, { icon: destIcon }).addTo(map).bindPopup(`<strong>Destination</strong><br/>${destination.city || ''}, ${destination.state || ''}`);
    }

    const stopIcon = L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:${COLOR_WARNING};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    });
    (shipment.stops || []).filter((s: any) => s.lat && s.lng).forEach((s: any) => {
      const coord: [number, number] = [s.lat, s.lng];
      allCoords.push(coord);
      L.marker(coord, { icon: stopIcon }).addTo(map).bindPopup(`<strong>Stop</strong><br/>${s.city || ''}, ${s.state || ''}`);
    });

    if (allCoords.length >= 2) {
      L.polyline(allCoords, { color: COLOR_MUTED, weight: 3, opacity: 0.7, dashArray: '8 4' }).addTo(map);
      L.polyline(allCoords, { color: COLOR_INFO, weight: 4 }).addTo(map);
      map.fitBounds(L.latLngBounds(allCoords).pad(0.1));
    } else if (allCoords.length === 1) {
      map.setView(allCoords[0], 12);
    }

    setTimeout(() => map.invalidateSize(), 100);

    return () => { map.remove(); };
  }, [shipment, hasAnyCoords, hasOriginCoords, hasDestCoords]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="m-6 flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <XCircle className="h-5 w-5" />
        {error}
      </div>
    );
  }
  if (!shipment) {
    return (
      <div className="m-6 flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <XCircle className="h-5 w-5" />
        Shipment not found
      </div>
    );
  }

  const origin = shipment.origin || {};
  const destination = shipment.destination || {};
  const events = shipment.events || [];
  const orders = shipment.orderShipments || [];

  const tabs = [
    { value: 'events', label: 'Events', Icon: Clock },
    { value: 'documents', label: 'Docs', Icon: FileText },
    { value: 'financials', label: 'Financials', Icon: CreditCard },
    { value: 'notes', label: 'Notes', Icon: MessageSquare },
    { value: 'cargo', label: 'Cargo', Icon: Package },
    { value: 'telemetry', label: 'Telemetry', Icon: Thermometer },
    { value: 'sla', label: 'SLA', Icon: Timer },
    { value: 'carrier-tracking', label: 'Carriers', Icon: Target },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/shipments')} className="-ml-3">
          <ArrowLeft className="h-4 w-4" />
          Shipments
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{shipment.reference || id}</h1>
            <Badge variant="info">{shipment.status || 'Unknown'}</Badge>
            {shipmentType && <Badge variant="muted">{shipmentType.name}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {shipment.proNumber && <>PRO# {shipment.proNumber}</>}
            {shipment.customer?.name && <> &middot; {shipment.customer.name}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/shipments/${id}/edit`)}>
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab('documents')}>
            <FileText className="h-4 w-4" />
            Documents
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!id) return;
              try {
                const res = await fetch(`${API_URL}/api/v1/shipments/${id}/tracking-link`, { method: 'POST' });
                const json = await res.json();
                if (json.data?.url) {
                  await navigator.clipboard.writeText(json.data.url);
                  alert('Tracking link copied to clipboard');
                }
              } catch { alert('Failed to generate tracking link'); }
            }}
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button variant="gradient" size="sm">
            <Target className="h-4 w-4" />
            Track
          </Button>
        </div>
      </div>

      {/* Route Deviation Alert */}
      {routeDeviation && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-md border p-4 text-sm',
            routeDeviation.severity === 'critical'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-warning/30 bg-warning/10 text-warning',
          )}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <strong>Route Deviation Detected</strong>
            <p className="mt-1">
              This shipment is <strong>{(routeDeviation.deviationMeters / 1000).toFixed(1)} km</strong> off
              the planned route (corridor: {(routeDeviation.corridorMeters / 1000).toFixed(1)} km).
              {routeDeviation.severity === 'critical' && ' This is a critical deviation.'}
            </p>
            {shipment.laneId && (
              <Link to={`/lanes/${shipment.laneId}`} className="mt-1 inline-block text-xs underline">
                View planned route
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Map */}
      {hasAnyCoords ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <div ref={mapRef} className="h-[480px] w-full" />
        </div>
      ) : (
        <div className="relative flex h-[480px] items-center justify-center overflow-hidden rounded-lg border border-border">
          <img
            src="https://basemaps.cartocdn.com/dark_all/4/4/6.png"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15 grayscale"
          />
          <div className="relative z-10 text-center text-muted-foreground">
            <MapPin className="mx-auto h-12 w-12 opacity-40" />
            <div className="mt-2 text-sm font-medium">No coordinates to plot yet</div>
            <div className="mt-1 text-xs">Add coordinates to the origin or destination location to see the route map</div>
          </div>
        </div>
      )}

      {/* Route Progress */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">{origin.city}, {origin.state} -&gt; {destination.city}, {destination.state}</span>
            <span className="text-sm text-muted-foreground">
              {shipment.deliveryDate ? `ETA ${new Date(shipment.deliveryDate).toLocaleDateString()}` : ''}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success" style={{ width: '58%' }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-info" />
              {origin.city}, {origin.state}{shipment.pickupDate ? ` - ${new Date(shipment.pickupDate).toLocaleDateString()}` : ''}
            </div>
            <div className="flex items-center gap-1.5">
              {destination.city}, {destination.state}{shipment.deliveryDate ? ` - ${new Date(shipment.deliveryDate).toLocaleDateString()}` : ''}
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap">
              {tabs.map(t => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="events" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Event Timeline</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Search className="h-4 w-4" />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4" />
                      Add Event
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No events recorded yet.</p>
                  ) : (
                    <ol className="relative space-y-6 border-l border-border pl-6">
                      {events.map((ev: any, i: number) => {
                        const tone =
                          ev.type === 'pickup' ? 'border-success/30 bg-success/10 text-success' :
                            ev.type === 'delivery' ? 'border-primary/30 bg-primary/10 text-primary' :
                              'border-info/30 bg-info/10 text-info';
                        return (
                          <li key={ev.id || i} className="relative">
                            <span className={cn('absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full border', tone)}>
                              <Clock className="h-3 w-3" />
                            </span>
                            <div className="text-xs uppercase tracking-wider text-muted-foreground">
                              {ev.occurredAt ? new Date(ev.occurredAt).toLocaleString() : ''}
                            </div>
                            <div className="mt-1 text-sm font-medium">{ev.type || ev.title || 'Event'}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{ev.description || ev.notes || ''}</div>
                            {ev.location && (
                              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {ev.location}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Documents</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      disabled={generating !== null}
                      onClick={() => handleGenerateDoc('bol')}
                    >
                      <FileText className="h-4 w-4" />
                      {generating === 'bol' ? 'Generating...' : 'Generate BOL'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={generating !== null}
                      onClick={() => handleGenerateDoc('customs')}
                    >
                      <Globe className="h-4 w-4" />
                      {generating === 'customs' ? 'Generating...' : 'Customs Form'}
                    </Button>
                    {shipment?.carrierId && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={generating !== null}
                        onClick={() => handleGenerateDoc('rate_confirmation')}
                      >
                        <Handshake className="h-4 w-4" />
                        {generating === 'rate_confirmation' ? 'Generating...' : 'Rate Confirmation'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {documents.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <Inbox className="mx-auto h-10 w-10 opacity-40" />
                      <p className="mt-2 text-sm">No documents yet. Generate a Bill of Lading to get started.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.map((doc: any) => {
                          const typeLabel: Record<string, string> = {
                            bol: 'Bill of Lading',
                            customs: 'Customs Form',
                            label: 'Label',
                            attachment: 'Attachment',
                          };
                          const typeVariant: Record<string, 'info' | 'warning' | 'muted'> = {
                            bol: 'info',
                            customs: 'warning',
                            label: 'muted',
                            attachment: 'muted',
                          };
                          return (
                            <TableRow key={doc.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-destructive" />
                                  <span className="font-medium">{doc.fileName}</span>
                                  {doc.documentNumber && (
                                    <span className="text-xs text-muted-foreground">({doc.documentNumber})</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={typeVariant[doc.documentType] || 'muted'}>
                                  {typeLabel[doc.documentType] || doc.documentType}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {doc.documentType === 'bol' && (
                                    <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="View BOL">
                                      <Link to={`/documents/${doc.id}/view`}>
                                        <Eye className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                  )}
                                  <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Download PDF">
                                    <a
                                      href={`${API_URL}/api/v1/documents/${doc.id}/download`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financials" className="mt-4">
              <FinancialsTab shipmentId={id!} />
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <ShipmentNotesTab shipmentId={id!} />
            </TabsContent>

            <TabsContent value="cargo" className="mt-4">
              <CargoTab shipmentId={id!} />
            </TabsContent>

            <TabsContent value="telemetry" className="mt-4">
              <TelemetryTab shipmentId={id!} />
            </TabsContent>

            <TabsContent value="sla" className="mt-4">
              <SlaTab shipmentId={id!} />
            </TabsContent>

            <TabsContent value="carrier-tracking" className="mt-4">
              <CarrierTrackingTab shipmentId={id!} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Customer" value={shipment.customer?.name || '-'} />
              <Detail label="Carrier" value={shipment.carrier?.name || '-'} />
              <Detail label="PRO Number" value={shipment.proNumber || '-'} />
              <Detail label="Status" value={shipment.status || '-'} />
              <Detail label="Pickup Date" value={shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : '-'} />
              <Detail label="Delivery Date" value={shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : '-'} />
              <Detail
                label="Lane"
                value={
                  shipment.laneId ? (
                    <Link to={`/lanes/${shipment.laneId}`} className="text-primary hover:underline">
                      {shipment.lane?.name || 'View Lane'}
                    </Link>
                  ) : '-'
                }
              />
              {routeDeviation && (
                <Detail
                  label="Route Status"
                  value={
                    <Badge variant={routeDeviation.severity === 'critical' ? 'destructive' : 'warning'}>
                      {(routeDeviation.deviationMeters / 1000).toFixed(1)} km off route
                    </Badge>
                  }
                />
              )}
              {orders.length > 0 && (
                <Detail label="Orders" value={orders.map((os: any) => os.order?.orderNumber).filter(Boolean).join(', ') || '-'} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-info" />
                <span className="text-sm font-semibold">Origin</span>
              </div>
              <div className="space-y-2 text-sm">
                <Detail label="Facility" value={origin.name || '-'} />
                <Detail label="Address" value={[origin.address1, origin.city, origin.state].filter(Boolean).join(', ') || '-'} />
                <Detail label="Pickup Date" value={shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : '-'} />
                {(shipment.pickupWindowStart || shipment.pickupWindowEnd) && (
                  <Detail
                    label="Pickup Window"
                    value={
                      <>
                        {shipment.pickupWindowStart ? new Date(shipment.pickupWindowStart).toLocaleString() : '-'}
                        {' - '}
                        {shipment.pickupWindowEnd ? new Date(shipment.pickupWindowEnd).toLocaleString() : '-'}
                      </>
                    }
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-success" />
                <span className="text-sm font-semibold">Destination</span>
              </div>
              <div className="space-y-2 text-sm">
                <Detail label="Facility" value={destination.name || '-'} />
                <Detail label="Address" value={[destination.address1, destination.city, destination.state].filter(Boolean).join(', ') || '-'} />
                <Detail label="Delivery Date" value={shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : '-'} />
                {(shipment.deliveryWindowStart || shipment.deliveryWindowEnd) && (
                  <Detail
                    label="Delivery Window"
                    value={
                      <>
                        {shipment.deliveryWindowStart ? new Date(shipment.deliveryWindowStart).toLocaleString() : '-'}
                        {' - '}
                        {shipment.deliveryWindowEnd ? new Date(shipment.deliveryWindowEnd).toLocaleString() : '-'}
                      </>
                    }
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
