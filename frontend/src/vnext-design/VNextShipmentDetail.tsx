import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BatteryFull,
  Bot,
  Box,
  CheckCircle2,
  ChevronDown,
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
  Info,
  Loader2,
  Lock,
  MapPin,
  MoreVertical,
  Package,
  Pen,
  Pencil,
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
  Trash2,
  Truck,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

import { toast } from 'sonner';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import MapView from '../maps/Map';
import type { MapMarker, MapPolyline } from '../maps/types';
import { ShareShipmentDialog } from '../components/ShareShipmentDialog';
import { ShipmentShareLinksTab } from '../components/ShipmentShareLinksTab';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { getDeviceImageUrl } from './deviceImages';
import {
  TimeSeriesChart,
  TelemetryPeriodFilter,
  readingsToSeries,
  computeTelemetryRange,
  TelemetryPeriodKey,
} from './TelemetryChart';
import ShipmentIssueActivity from './ShipmentIssueActivity';
import {
  SHIPMENT_STATUS_LABELS,
  allowedTransitions,
  canTransition,
  validateShipmentReadiness,
  SHIPMENT_FIELD_LABELS,
  SHIPMENT_EVENT_TYPES,
  shipmentEventLabel,
} from '@open-tms/shared';

const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  dryVan: 'Dry van',
  reefer: 'Reefer',
  flatbed: 'Flatbed',
  tanker: 'Tanker',
  intermodal: 'Intermodal',
};

// Maps a canonical lifecycle status to a Badge variant.
function shipmentStatusVariant(status: string): 'muted' | 'warning' | 'info' | 'success' {
  switch (status) {
    case 'ready': return 'warning';
    case 'in_progress': return 'info';
    case 'complete': return 'success';
    default: return 'muted'; // draft + anything unknown
  }
}

function shipmentStatusLabel(status: string): string {
  return SHIPMENT_STATUS_LABELS[status] ?? status;
}

// Percent of the pickup-to-delivery window elapsed, for the route progress bar.
function routeProgressPct(pickupDate?: string | null, deliveryDate?: string | null, status?: string): number {
  if (status === 'complete') return 100;
  if (!pickupDate || !deliveryDate) return 0;
  const start = new Date(pickupDate).getTime();
  const end = new Date(deliveryDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const now = Date.now();
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}

// Hex colors used inside Leaflet HTML strings (cannot use Tailwind/var(--*))
const COLOR_INFO = '#3b82f6';
const COLOR_SUCCESS = '#22c55e';
const COLOR_WARNING = '#eab308';
const COLOR_DESTRUCTIVE = '#ef4444';
const COLOR_MUTED = '#94a3b8';
const COLOR_ROUTE = '#a855f7';

// ─── Financials Tab ─────────────────────────────────────────────────────
function FinancialsTab({ shipmentId, hasBol }: { shipmentId: string; hasBol: boolean }) {
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

  // BUSINESS RULE: rate/margin data stays hidden until the load is sealed
  // (a BOL has been generated) so it isn't visible mid-negotiation or before
  // the shipment's contents/charges are finalized.
  if (!hasBol) {
    return (
      <Card>
        <CardHeader><CardTitle>Financials</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Lock className="h-12 w-12 opacity-50" />
            <p>Financial data becomes available once the load is sealed.</p>
            <p className="text-sm">Generate a Bill of Lading from the Docs tab to unlock revenue, cost, and margin.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
const DEVICE_PURPOSE_LABELS: Record<string, string> = {
  cargo_condition: 'Cargo condition',
  security: 'Security & tamper',
  location: 'Location tracking',
  general: 'General',
};

function TelemetryTab({ shipmentId, deviceAssignments }: { shipmentId: string; deviceAssignments: any[] }) {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [tLoading, setTLoading] = useState(true);
  const [tError, setTError] = useState('');
  const [period, setPeriod] = useState<TelemetryPeriodKey>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = computeTelemetryRange(period, customFrom, customTo);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setTLoading(true);
        const params = new URLSearchParams({ limit: '2000' });
        if (range.since) params.set('since', range.since);
        if (range.until) params.set('until', range.until);
        const res = await fetch(`${API_URL}/api/v1/shipments/${shipmentId}/telemetry?${params}`);
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
  }, [shipmentId, range.since, range.until]);

  const periodFilter = (
    <TelemetryPeriodFilter
      period={period}
      onPeriodChange={setPeriod}
      customFrom={customFrom}
      customTo={customTo}
      onCustomFromChange={setCustomFrom}
      onCustomToChange={setCustomTo}
    />
  );

  if (tError) {
    return (
      <div className="space-y-4">
        {periodFilter}
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <XCircle className="h-5 w-5" />
          {tError}
        </div>
      </div>
    );
  }

  if (tLoading || !telemetry) {
    return (
      <div className="space-y-4">
        {periodFilter}
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <h3 className="text-base font-medium">Loading telemetry...</h3>
        </div>
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

  const purposeByDeviceId = new Map<string, string>();
  (deviceAssignments || []).forEach((a: any) => {
    if (a.deviceId && a.purpose) purposeByDeviceId.set(a.deviceId, a.purpose);
  });

  const tempSeries = readingsToSeries(readings, 'temperature');
  const pressureSeries = readingsToSeries(readings, 'atmosphericPressure');
  const batterySeries = readingsToSeries(readings, 'batteryLevel');

  const thresholdReading = [...readings].reverse().find((r: any) => r.tempMin != null || r.tempMax != null);
  const tempBand = thresholdReading
    ? { min: thresholdReading.tempMin ?? null, max: thresholdReading.tempMax ?? null }
    : null;

  return (
    <div className="space-y-6">
      {periodFilter}

      {trackerDevices.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tracking Devices</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {trackerDevices.map((dev: any) => {
                const imgUrl = getDeviceImageUrl(dev.model);
                const purpose = purposeByDeviceId.get(dev.id);
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{dev.name || dev.displayId || 'Device'}</span>
                        {purpose && <Badge variant="muted">{DEVICE_PURPOSE_LABELS[purpose] || purpose}</Badge>}
                      </div>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Temperature over time</CardTitle></CardHeader>
          <CardContent>
            <TimeSeriesChart
              points={tempSeries}
              unit="°"
              band={tempBand}
              lineClassName="stroke-primary"
              pointClassName="fill-primary"
            />
            {tempBand && (tempBand.min != null || tempBand.max != null) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Shaded band shows the acceptable range
                {tempBand.min != null ? ` (${tempBand.min}°` : ' (up to'}
                {tempBand.max != null ? ` to ${tempBand.max}°)` : ')'}.
              </p>
            )}
          </CardContent>
        </Card>

        {pressureSeries.length >= 2 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Atmospheric pressure over time</CardTitle></CardHeader>
            <CardContent>
              <TimeSeriesChart points={pressureSeries} unit=" hPa" lineClassName="stroke-warning" pointClassName="fill-warning" />
            </CardContent>
          </Card>
        )}

        {batterySeries.length >= 2 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Battery over time</CardTitle></CardHeader>
            <CardContent>
              <TimeSeriesChart points={batterySeries} unit="%" lineClassName="stroke-success" pointClassName="fill-success" />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Readings</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead>Pressure</TableHead>
                <TableHead>Battery</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Alert</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readings.slice(0, 25).map((r: any, i: number) => (
                <TableRow key={r.id || i}>
                  <TableCell className="text-sm">{r.eventTime ? new Date(r.eventTime).toLocaleString() : '-'}</TableCell>
                  <TableCell>{r.temperature != null ? `${r.temperature}°` : '-'}</TableCell>
                  <TableCell>{r.atmosphericPressure != null ? `${r.atmosphericPressure} hPa` : '-'}</TableCell>
                  <TableCell>{r.batteryLevel != null ? `${r.batteryLevel}%` : '-'}</TableCell>
                  <TableCell className="text-xs">
                    {r.lat != null && r.lng != null ? (
                      <span>
                        {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                        {(r.locationType || r.locationAccuracy != null) && (
                          <span className="text-muted-foreground">
                            {' · '}{r.locationType || 'fix'}{r.locationAccuracy != null ? ` ±${Math.round(r.locationAccuracy)}m` : ''}
                          </span>
                        )}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {r.isAlert
                      ? <Badge variant="destructive">Alert</Badge>
                      : <span className="text-xs text-muted-foreground">-</span>}
                  </TableCell>
                </TableRow>
              ))}
              {readings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">No readings available</TableCell>
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

// ─── Events Tab (read-only, platform-generated timeline) ───────────────
function eventTone(eventType: string): string {
  switch (eventType) {
    case 'delivered':
    case 'enters_destination':
      return 'border-success/30 bg-success/10 text-success';
    case 'exception':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    case 'leaves_origin':
    case 'entered_waypoint':
    case 'exited_waypoint':
      return 'border-warning/30 bg-warning/10 text-warning';
    case 'archived':
    case 'unarchived':
    case 'deleted':
      return 'border-muted bg-muted text-muted-foreground';
    default:
      return 'border-info/30 bg-info/10 text-info';
  }
}

function EventsTab({ shipmentId }: { shipmentId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (eventType !== 'all') params.set('eventType', eventType);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', `${toDate}T23:59:59Z`);
    const qs = params.toString();
    fetch(`${API_URL}/api/v1/shipments/${shipmentId}/events${qs ? `?${qs}` : ''}`)
      .then(r => r.json())
      .then(j => { if (!cancelled && !j.error) setEvents(j.data || []); })
      .catch(() => { })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [shipmentId, eventType, fromDate, toDate]);

  const hasFilters = eventType !== 'all' || !!fromDate || !!toDate;
  const clearFilters = () => { setEventType('all'); setFromDate(''); setToDate(''); };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-base">Event Timeline</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All event types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All event types</SelectItem>
              {SHIPMENT_EVENT_TYPES.map(t => (
                <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePicker type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} aria-label="From date" className="w-[160px]" />
          <span className="text-xs text-muted-foreground">to</span>
          <DatePicker type="date" value={toDate} onChange={e => setToDate(e.target.value)} aria-label="To date" className="w-[160px]" />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading events...
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Clock className="h-8 w-8 opacity-50" />
            <p className="text-sm">{hasFilters ? 'No events match these filters.' : 'No events recorded yet.'}</p>
          </div>
        ) : (
          <ol className="relative space-y-6 border-l border-border pl-6">
            {events.map((ev: any, i: number) => (
              <li key={ev.id || i} className="relative">
                <span className={cn('absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full border', eventTone(ev.eventType))}>
                  <Clock className="h-3 w-3" />
                </span>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {ev.eventTime ? new Date(ev.eventTime).toLocaleString() : ''}
                </div>
                <div className="mt-1 text-sm font-medium">{shipmentEventLabel(ev.eventType)}</div>
                {ev.description && <div className="mt-0.5 text-xs text-muted-foreground">{ev.description}</div>}
                {(ev.address || ev.locationSummary) && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {ev.address || ev.locationSummary}
                  </div>
                )}
              </li>
            ))}
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

  useEffect(() => { window.scrollTo(0, 0); }, [id]);
  const [activeTab, setActiveTab] = useState('details');
  const [shipment, setShipment] = useState<any>(null);
  const [shipmentType, setShipmentType] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [bolReadiness, setBolReadiness] = useState<
    { ready: boolean; missing: string[]; orderCount: number; lineItemCount: number } | null
  >(null);
  const [routeDeviation, setRouteDeviation] = useState<any>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unarchiving, setUnarchiving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [laneRoute, setLaneRoute] = useState<any>(undefined);
  const [showLane, setShowLane] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [addOrderOpen, setAddOrderOpen] = useState(false);
  const [eligibleOrders, setEligibleOrders] = useState<any[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [eligibleSearch, setEligibleSearch] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [addingOrders, setAddingOrders] = useState(false);
  const { hasPermission } = useCurrentUser();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  // Bumped after a link is issued so the Shared links tab reloads without a full refetch.
  const [shareLinksVersion, setShareLinksVersion] = useState(0);

  const loadShipment = useCallback((showSpinner = true) => {
    if (!id) return;
    if (showSpinner) setLoading(true);
    setNotFound(false);
    fetch(`${API_URL}/api/v1/shipments/${id}`)
      .then(res => {
        // A soft-deleted (or genuinely missing) shipment 404s — render the
        // styled not-found screen rather than a generic error.
        if (res.status === 404) { setNotFound(true); return null; }
        if (!res.ok) throw new Error('Failed to load shipment');
        return res.json();
      })
      .then(json => {
        if (!json) return;
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
      .finally(() => { if (showSpinner) setLoading(false); });
  }, [id]);

  useEffect(() => { loadShipment(); }, [loadShipment]);

  const openAddOrderModal = useCallback(() => {
    if (!id) return;
    setAddOrderOpen(true);
    setSelectedOrderIds(new Set());
    setEligibleSearch('');
    setEligibleLoading(true);
    fetch(`${API_URL}/api/v1/shipments/${id}/eligible-orders`)
      .then(res => res.json())
      .then(json => setEligibleOrders(json.data || []))
      .catch(() => setEligibleOrders([]))
      .finally(() => setEligibleLoading(false));
  }, [id]);

  const toggleEligibleOrder = useCallback((orderId: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  }, []);

  const handleAddOrders = useCallback(async () => {
    if (!id || selectedOrderIds.size === 0) return;
    setAddingOrders(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/shipments/${id}/add-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: Array.from(selectedOrderIds) }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to add orders', { duration: 8000 });
        return;
      }
      const errors: string[] = json.data?.errors || [];
      if (errors.length > 0) {
        toast.warning(json.data.message, { duration: 9000 });
      } else {
        toast.success(json.data.message);
      }
      setAddOrderOpen(false);
      loadShipment(false);
    } catch {
      toast.error('Failed to add orders');
    } finally {
      setAddingOrders(false);
    }
  }, [id, selectedOrderIds, loadShipment]);

  const [orderActionBusyId, setOrderActionBusyId] = useState<string | null>(null);

  const handleRemoveOrder = useCallback(async (orderId: string, orderNumber: string) => {
    if (!id) return;
    if (!window.confirm(`Remove ${orderNumber} from this shipment? It'll become available to add to another shipment.`)) return;
    setOrderActionBusyId(orderId);
    try {
      const res = await fetch(`${API_URL}/api/v1/shipments/${id}/orders/${orderId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to remove order', { duration: 8000 });
        return;
      }
      toast.success(`${orderNumber} removed from shipment`);
      loadShipment(false);
    } catch {
      toast.error('Failed to remove order');
    } finally {
      setOrderActionBusyId(null);
    }
  }, [id, loadShipment]);

  const handleArchiveOrder = useCallback(async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Archive order ${orderNumber}? You can restore it later from Settings > Archives.`)) return;
    setOrderActionBusyId(orderId);
    try {
      const res = await fetch(`${API_URL}/api/v1/orders/${orderId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to archive order', { duration: 8000 });
        return;
      }
      toast.success(`${orderNumber} archived`);
      loadShipment(false);
    } catch {
      toast.error('Failed to archive order');
    } finally {
      setOrderActionBusyId(null);
    }
  }, [loadShipment]);

  const handleTransition = useCallback(async (toStatus: string) => {
    if (!id) return;
    setTransitioning(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/shipments/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to change status', { duration: 8000 });
        return;
      }
      toast.success(`Moved to ${shipmentStatusLabel(toStatus)}`);
      loadShipment(false);
    } catch {
      toast.error('Failed to change status');
    } finally {
      setTransitioning(false);
    }
  }, [id, loadShipment]);

  const handleArchive = useCallback(async () => {
    if (!id) return;
    setArchiving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/shipments/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to archive shipment', { duration: 8000 });
        return;
      }
      toast.success('Shipment archived');
      navigate('/shipments');
    } catch {
      toast.error('Failed to archive shipment');
    } finally {
      setArchiving(false);
    }
  }, [id, navigate]);

  const handleUnarchive = useCallback(async () => {
    if (!id) return;
    setUnarchiving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/shipments/${id}/unarchive`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to unarchive shipment', { duration: 8000 });
        return;
      }
      toast.success('Shipment restored');
      loadShipment(false);
    } catch {
      toast.error('Failed to unarchive shipment');
    } finally {
      setUnarchiving(false);
    }
  }, [id, loadShipment]);

  const handleSoftDelete = useCallback(async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/shipments/${id}/soft-delete`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to delete shipment', { duration: 8000 });
        return;
      }
      toast.success('Shipment deleted');
      navigate('/shipments');
    } catch {
      toast.error('Failed to delete shipment');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [id, navigate]);

  const loadDocuments = useCallback(() => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/documents?shipmentId=${id}`)
      .then(r => r.json())
      .then(json => { if (!json.error) setDocuments(json.data || []); })
      .catch(() => { });
  }, [id]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // BOL readiness drives the greyed-out state of the Generate BOL button. A BOL
  // is a legal document; if the shipment lacks the required cargo detail
  // (attached orders + per-line goods description/quantity/weight) we disable
  // the button rather than let the user generate an incomplete document.
  const loadBolReadiness = useCallback(() => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/documents/bol-readiness/${id}`)
      .then(r => r.json())
      .then(json => { if (!json.error) setBolReadiness(json.data); })
      .catch(() => { });
  }, [id]);

  useEffect(() => { loadBolReadiness(); }, [loadBolReadiness]);

  // Check route deviation for in-transit shipments with a lane
  useEffect(() => {
    if (!shipment?.laneId) return;
    const inTransit = shipment.status === 'in_progress';
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

  // Fetch the lane's planned route (if any) so it can be overlaid on the map.
  // laneRoute stays `undefined` while this is unresolved, then settles to
  // either the route object or `null` (no lane / no saved route) — that
  // three-way state lets the default-visibility effect below tell "still
  // loading" apart from "confirmed no route".
  useEffect(() => {
    // Wait for the shipment itself to load first — otherwise `shipment` is
    // still null on mount, `shipment?.laneId` reads as undefined, and this
    // would prematurely resolve laneRoute to `null` ("no route") before the
    // real laneId is even known, locking in the wrong default below.
    if (!shipment) return;
    if (!shipment.laneId) { setLaneRoute(null); return; }
    fetch(`${API_URL}/api/v1/lanes/${shipment.laneId}/route`)
      .then(r => r.json())
      .then(json => setLaneRoute(json.error ? null : (json.data ?? null)))
      .catch(() => setLaneRoute(null));
  }, [shipment?.laneId, !!shipment]);

  // Default the map to whichever layer is more useful: once we know whether
  // a planned route exists, show the route (and hide the plain straight
  // line) if one was found, otherwise fall back to the straight line. Only
  // applied once so it doesn't fight with the user's own toggle clicks.
  const routeDefaultsAppliedRef = useRef(false);
  useEffect(() => {
    if (routeDefaultsAppliedRef.current || laneRoute === undefined) return;
    routeDefaultsAppliedRef.current = true;
    const hasRoute = Array.isArray(laneRoute?.waypoints) && laneRoute.waypoints.length >= 2;
    setShowRoute(hasRoute);
    setShowLane(!hasRoute);
  }, [laneRoute]);

  const handleGenerateDoc = async (type: 'bol' | 'customs' | 'rate_confirmation') => {
    if (!id) return;
    const names: Record<string, string> = { bol: 'Bill of Lading', customs: 'Customs Form', rate_confirmation: 'Rate Confirmation' };
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
      if (!res.ok || json.error) {
        toast.error(json.error || `Failed to generate ${names[type] || type}`, {
          duration: 8000,
        });
        return;
      }
      toast.success(`${names[type] || type} generated`);
      loadDocuments();
      if (type === 'bol') {
        navigate(`/documents/${json.data.id}/view`);
      }
    } catch {
      toast.error(`Failed to generate ${names[type] || type}`);
    } finally {
      setGenerating(null);
    }
  };

  const hasOriginCoords = !!(shipment?.origin?.lat && shipment?.origin?.lng);
  const hasDestCoords = !!(shipment?.destination?.lat && shipment?.destination?.lng);
  const hasAnyCoords = hasOriginCoords || hasDestCoords;

  // The map is declared, not driven. Markers and lines are derived from the shipment, and the
  // layer toggles simply leave a line out of the array rather than adding and removing it from a
  // live map. The adapter decides whether that is drawn by Leaflet or by Google.
  const pin = (colour: string, size: number, inner: boolean) =>
    `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${colour};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">`
    + (inner ? '<div style="width:6px;height:6px;border-radius:50%;background:white;"></div>' : '')
    + '</div>';

  const mapMarkers = useMemo<MapMarker[]>(() => {
    if (!shipment) return [];
    const out: MapMarker[] = [];

    if (hasOriginCoords) {
      out.push({
        id: 'origin',
        position: { lat: shipment.origin.lat, lng: shipment.origin.lng },
        html: pin(COLOR_INFO, 20, true),
        size: { width: 20, height: 20 },
        popupHtml: `<strong>Origin</strong><br/>${shipment.origin.city || ''}, ${shipment.origin.state || ''}`,
      });
    }
    if (hasDestCoords) {
      out.push({
        id: 'destination',
        position: { lat: shipment.destination.lat, lng: shipment.destination.lng },
        html: pin(COLOR_SUCCESS, 20, true),
        size: { width: 20, height: 20 },
        popupHtml: `<strong>Destination</strong><br/>${shipment.destination.city || ''}, ${shipment.destination.state || ''}`,
      });
    }
    (shipment.stops || []).filter((st: any) => st.lat && st.lng).forEach((st: any, i: number) => {
      out.push({
        id: `stop-${st.id ?? i}`,
        position: { lat: st.lat, lng: st.lng },
        html: pin(COLOR_WARNING, 16, false),
        size: { width: 16, height: 16 },
        popupHtml: `<strong>Stop</strong><br/>${st.city || ''}, ${st.state || ''}`,
      });
    });

    return out;
  }, [shipment, hasOriginCoords, hasDestCoords]);

  const mapPolylines = useMemo<MapPolyline[]>(() => {
    const lines: MapPolyline[] = [];
    const lanePoints = mapMarkers.map((m) => m.position);

    if (showLane && lanePoints.length >= 2) {
      lines.push({ id: 'lane-shadow', points: lanePoints, color: COLOR_MUTED, weight: 3, opacity: 0.7, dashed: true });
      lines.push({ id: 'lane', points: lanePoints, color: COLOR_INFO, weight: 4 });
    }

    const waypoints = laneRoute?.waypoints;
    if (showRoute && Array.isArray(waypoints) && waypoints.length >= 2) {
      lines.push({
        id: 'planned-route',
        points: waypoints.map((w: any) => ({ lat: w.lat, lng: w.lng })),
        color: COLOR_ROUTE,
        weight: 4,
        opacity: 0.9,
      });
    }

    return lines;
  }, [mapMarkers, showLane, showRoute, laneRoute]);

  // Framing follows whatever is actually drawn, so toggling the planned route on re-frames to
  // include it rather than leaving half the line off screen.
  const mapFitTo = useMemo(
    () => [...mapMarkers.map((m) => m.position), ...mapPolylines.flatMap((l) => l.points)],
    [mapMarkers, mapPolylines]
  );


  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (notFound || (!error && !shipment)) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 px-6 py-24 text-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-muted text-6xl" role="img" aria-label="Magnifying glass">
          🔍
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Shipment not found</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            We couldn't find this shipment. It may have been deleted, or the link is incorrect.
          </p>
        </div>
        <Button onClick={() => navigate('/shipments')}>
          <ArrowLeft className="h-4 w-4" />
          Back to shipments
        </Button>
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
  const orders = shipment.orderShipments || [];

  const filteredEligibleOrders = eligibleSearch.trim()
    ? eligibleOrders.filter(o => {
        const q = eligibleSearch.toLowerCase();
        const orderNum = (o.orderNumber || '').toLowerCase();
        const customerName = (o.customer?.name || '').toLowerCase();
        const destLabel = o.destination ? `${o.destination.city}, ${o.destination.state || ''}`.toLowerCase() : '';
        return orderNum.includes(q) || customerName.includes(q) || destLabel.includes(q);
      })
    : eligibleOrders;

  const tabs = [
    { value: 'details', label: 'Details', Icon: Info },
    { value: 'events', label: 'Events', Icon: Clock },
    { value: 'activity', label: 'Activity', Icon: Activity },
    { value: 'orders', label: 'Orders', Icon: Box },
    { value: 'documents', label: 'Docs', Icon: FileText },
    { value: 'financials', label: 'Financials', Icon: CreditCard },
    { value: 'cargo', label: 'Cargo', Icon: Package },
    { value: 'telemetry', label: 'Telemetry', Icon: Thermometer },
    { value: 'sla', label: 'SLA', Icon: Timer },
    { value: 'carrier-tracking', label: 'Carriers', Icon: Target },
    // Sharing is a separate grant: an operator who can edit a shipment is not automatically
    // trusted to put it in front of someone outside the organisation.
    ...(hasPermission('shipments:share')
      ? [{ value: 'shared-links', label: 'Shared links', Icon: Share2 }]
      : []),
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
            {(() => {
              const status = shipment.status || 'draft';
              const readiness = validateShipmentReadiness(shipment, shipmentType);
              const targets = allowedTransitions(status);
              const isForward = (to: string) => {
                const order = ['draft', 'ready', 'in_progress', 'complete'];
                return order.indexOf(to) > order.indexOf(status);
              };
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 px-2"
                      disabled={transitioning || targets.length === 0}
                      title="Change lifecycle status"
                    >
                      <Badge variant={shipmentStatusVariant(status)}>{shipmentStatusLabel(status)}</Badge>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    <DropdownMenuLabel>Move shipment to</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {targets.map(to => {
                      // Forward moves into ready/in_progress/complete are gated.
                      const blocked = isForward(to) && to !== 'draft' && !readiness.isValid;
                      return (
                        <DropdownMenuItem
                          key={to}
                          disabled={blocked || transitioning}
                          onSelect={(e) => {
                            if (blocked) { e.preventDefault(); return; }
                            handleTransition(to);
                          }}
                          className="flex flex-col items-start gap-1"
                        >
                          <span className="font-medium">{shipmentStatusLabel(to)}</span>
                          {blocked && (
                            <span className="text-xs text-muted-foreground">
                              Missing: {readiness.missing.map(f => SHIPMENT_FIELD_LABELS[f] ?? f).join(', ')}
                            </span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                    {targets.length === 0 && (
                      <DropdownMenuItem disabled>No transitions available</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })()}
            {shipment.hasException && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Exception
              </Badge>
            )}
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
          {hasPermission('shipments:share') && (
            <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          )}
          <Button variant="gradient" size="sm" onClick={() => setActiveTab('carrier-tracking')}>
            <Target className="h-4 w-4" />
            Track
          </Button>
          {hasPermission('shipments:write') && !shipment.archived && !shipment.deletedAt && (
            <Button variant="outline" size="sm" onClick={handleArchive} disabled={archiving}>
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Archive
            </Button>
          )}
          {hasPermission('shipments:delete') && !shipment.deletedAt && (
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} disabled={deleting}
              className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Archived banner */}
      {shipment.archived && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm">
          <Archive className="h-5 w-5 text-warning" />
          <div className="flex-1">
            <span className="font-medium text-warning">This shipment is archived.</span>
            <span className="ml-1 text-muted-foreground">It does not appear in active shipment lists.</span>
          </div>
          {hasPermission('shipments:delete') && (
            <Button variant="outline" size="sm" onClick={handleUnarchive} disabled={unarchiving}>
              {unarchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
              Unarchive
            </Button>
          )}
        </div>
      )}

      {/* Soft-delete confirmation (admin) */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this shipment?</DialogTitle>
            <DialogDescription>
              {shipment.reference || id} will be removed from all views. The record is retained for audit
              but cannot be restored from the UI. This is different from archiving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleSoftDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete shipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add order to shipment */}
      <Dialog open={addOrderOpen} onOpenChange={setAddOrderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add order to {shipment.reference || 'this shipment'}</DialogTitle>
            <DialogDescription>
              Only verified orders with the same origin and customer as this shipment are eligible.
            </DialogDescription>
          </DialogHeader>
          {eligibleOrders.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search eligible orders..."
                value={eligibleSearch}
                onChange={e => setEligibleSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
            {eligibleLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : eligibleOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No eligible orders. Orders must be validated, share this shipment's origin and customer, and not already be linked to a shipment.
              </p>
            ) : filteredEligibleOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No eligible orders match "{eligibleSearch}".
              </p>
            ) : (
              <div className="space-y-1">
                {filteredEligibleOrders.map(o => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-primary"
                      checked={selectedOrderIds.has(o.id)}
                      onChange={() => toggleEligibleOrder(o.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{o.orderNumber}</span>
                      <span className="block text-xs text-muted-foreground">
                        {o.customer?.name} &middot; to {o.destination ? `${o.destination.city}, ${o.destination.state || ''}` : 'unknown destination'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOrderOpen(false)} disabled={addingOrders}>Cancel</Button>
            <Button onClick={handleAddOrders} disabled={addingOrders || selectedOrderIds.size === 0}>
              {addingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add {selectedOrderIds.size > 0 ? selectedOrderIds.size : ''} order{selectedOrderIds.size === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Route summary + map */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-info" />
            {origin.city}, {origin.state}
            <ArrowLeft className="h-3.5 w-3.5 rotate-180 text-muted-foreground" />
            {destination.city}, {destination.state}
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
          </div>
          <span className="text-xs text-muted-foreground">
            {shipment.pickupDate && `Picked up ${new Date(shipment.pickupDate).toLocaleDateString()}`}
            {shipment.pickupDate && shipment.deliveryDate && ' · '}
            {shipment.deliveryDate && `ETA ${new Date(shipment.deliveryDate).toLocaleDateString()}`}
          </span>
        </div>
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-success transition-[width]"
            style={{ width: `${routeProgressPct(shipment.pickupDate, shipment.deliveryDate, shipment.status)}%` }}
          />
        </div>

        {hasAnyCoords ? (
          <div className="space-y-2 p-4 pt-3">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex cursor-pointer select-none items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showLane}
                  onChange={(e) => setShowLane(e.target.checked)}
                  className="h-4 w-4 rounded border border-input bg-background accent-primary"
                />
                <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: COLOR_INFO }} />
                Lane
              </label>
              {laneRoute?.waypoints?.length > 0 && (
                <label className="flex cursor-pointer select-none items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showRoute}
                    onChange={(e) => setShowRoute(e.target.checked)}
                    className="h-4 w-4 rounded border border-input bg-background accent-primary"
                  />
                  <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: COLOR_ROUTE }} />
                  Planned route
                </label>
              )}
              {shipment.laneId && laneRoute === null && (
                <Link to={`/lanes/${shipment.laneId}/edit`} className="ml-auto text-muted-foreground underline">
                  Plan a route for this lane
                </Link>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <MapView
                markers={mapMarkers}
                polylines={mapPolylines}
                fitTo={mapFitTo}
                height={300}
                ariaLabel={`Route map for shipment ${shipment.reference || ''}`}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-[220px] flex-col items-center justify-center gap-2 border-t border-dashed border-border bg-muted/30 px-6 text-center">
            <div className="text-3xl" role="img" aria-label="Map">🗺️</div>
            <div className="text-sm font-medium">No location data yet</div>
            <div className="max-w-sm text-xs text-muted-foreground">
              Live position appears here once a carrier-tracking integration or an assigned IoT device reports a location.
            </div>
          </div>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full justify-start overflow-x-auto">
          {tabs.map(t => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="divide-y divide-border p-0">
              <section className="space-y-2 p-4 text-sm">
                <Detail label="Carrier" value={shipment.carrier?.name || '-'} />
                <Detail label="PRO Number" value={shipment.proNumber || '-'} />
                <Detail label="Mode" value={shipment.serviceLevel || '-'} />
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
              </section>

              {(shipment.tempControlled || shipment.hazmat || shipment.humidityControlled || shipment.requiredEquipmentType) && (
                <section className="space-y-2 p-4 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Restrictions
                  </span>
                  {shipment.tempControlled && (
                    <Detail
                      label="Temperature"
                      value={`${shipment.tempMinC ?? '?'}°C to ${shipment.tempMaxC ?? '?'}°C`}
                    />
                  )}
                  {shipment.humidityControlled && (
                    <Detail
                      label="Humidity"
                      value={`${shipment.humidityMinPct ?? '?'}% to ${shipment.humidityMaxPct ?? '?'}%`}
                    />
                  )}
                  {shipment.hazmat && (
                    <>
                      <Detail label="Hazmat" value={<Badge variant="warning">Hazmat</Badge>} />
                      {shipment.unNumber && <Detail label="UN Number" value={shipment.unNumber} />}
                      {shipment.hazmatClass && <Detail label="Hazmat Class" value={shipment.hazmatClass} />}
                      {shipment.packingGroup && <Detail label="Packing Group" value={shipment.packingGroup} />}
                      {shipment.properShippingName && (
                        <Detail label="Proper Shipping Name" value={shipment.properShippingName} />
                      )}
                    </>
                  )}
                  {shipment.requiredEquipmentType && (
                    <Detail
                      label="Equipment"
                      value={EQUIPMENT_TYPE_LABELS[shipment.requiredEquipmentType] || shipment.requiredEquipmentType}
                    />
                  )}
                </section>
              )}

              <section className="space-y-4 p-4 text-sm">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-info" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Origin</span>
                  </div>
                  <div className="space-y-2 pl-4">
                    <Detail label="Facility" value={origin.name || '-'} />
                    <Detail label="Address" value={[origin.address1, origin.city, origin.state].filter(Boolean).join(', ') || '-'} />
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
                </div>

                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-success" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destination</span>
                  </div>
                  <div className="space-y-2 pl-4">
                    <Detail label="Facility" value={destination.name || '-'} />
                    <Detail label="Address" value={[destination.address1, destination.city, destination.state].filter(Boolean).join(', ') || '-'} />
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
                </div>
              </section>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
              {id && <EventsTab shipmentId={id} />}
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              {id && <ShipmentIssueActivity shipmentId={id} />}
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Orders ({orders.length})</CardTitle>
                  {(shipment.status === 'draft' || shipment.status === 'ready') && hasPermission('orders:write') && (
                    <Button variant="outline" size="sm" onClick={openAddOrderModal}>
                      <Plus className="h-4 w-4" />
                      Add order
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {orders.length === 0 ? (
                    <p className="text-muted-foreground">No orders linked to this shipment yet.</p>
                  ) : (
                    orders.map((os: any) => {
                      const order = os.order || {};
                      const canModify = (shipment.status === 'draft' || shipment.status === 'ready') && hasPermission('orders:write');
                      const busy = orderActionBusyId === order.id;
                      return (
                        <div
                          key={os.id}
                          className="flex items-center gap-2 rounded-md px-2 py-2 -mx-2 hover:bg-muted/40"
                        >
                          <Link to={`/orders/${order.id}`} className="min-w-0 flex-1">
                            <div>
                              <span className="font-medium">{order.orderNumber}</span>
                              <span className="ml-2 text-muted-foreground">{order.customer?.name}</span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              <span>
                                {order.origin ? [order.origin.city, order.origin.state].filter(Boolean).join(', ') : '-'}
                                {' → '}
                                {order.destination ? [order.destination.city, order.destination.state].filter(Boolean).join(', ') : '-'}
                              </span>
                              {(order.requestedPickupDate || order.requestedDeliveryDate) && (
                                <span>
                                  {order.requestedPickupDate ? new Date(order.requestedPickupDate).toLocaleDateString() : '-'}
                                  {' - '}
                                  {order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate).toLocaleDateString() : '-'}
                                </span>
                              )}
                            </div>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                disabled={busy}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                                title="Order actions"
                              >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => navigate(`/orders/${order.id}`)}>
                                <Eye className="h-4 w-4" />
                                View details
                              </DropdownMenuItem>
                              {canModify && (
                                <DropdownMenuItem onSelect={() => handleRemoveOrder(order.id, order.orderNumber)}>
                                  <X className="h-4 w-4" />
                                  Remove from shipment
                                </DropdownMenuItem>
                              )}
                              {hasPermission('orders:write') && (
                                <DropdownMenuItem
                                  onSelect={() => handleArchiveOrder(order.id, order.orderNumber)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Archive className="h-4 w-4" />
                                  Archive order
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardHeader className="flex flex-col gap-2 space-y-0">
                  <div className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Documents</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      disabled={generating !== null || (bolReadiness !== null && !bolReadiness.ready)}
                      onClick={() => handleGenerateDoc('bol')}
                      title={
                        bolReadiness && !bolReadiness.ready
                          ? `Bill of Lading unavailable: ${bolReadiness.missing.join('; ')}.`
                          : undefined
                      }
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
                  </div>
                  {bolReadiness && !bolReadiness.ready && (
                    <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <span className="font-medium">Bill of Lading not available yet.</span> A BOL is a
                        legal document and needs the following before it can be generated:
                        <ul className="mt-1 list-inside list-disc">
                          {bolReadiness.missing.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
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
              <FinancialsTab shipmentId={id!} hasBol={documents.some((d: any) => d.documentType === 'bol')} />
            </TabsContent>

            <TabsContent value="cargo" className="mt-4">
              <CargoTab shipmentId={id!} />
            </TabsContent>

            <TabsContent value="telemetry" className="mt-4">
              <TelemetryTab shipmentId={id!} deviceAssignments={shipment.deviceAssignments || []} />
            </TabsContent>

            <TabsContent value="sla" className="mt-4">
              <SlaTab shipmentId={id!} />
            </TabsContent>

            <TabsContent value="carrier-tracking" className="mt-4">
              <CarrierTrackingTab shipmentId={id!} />
            </TabsContent>

            {hasPermission('shipments:share') && (
              <TabsContent value="shared-links" className="mt-4">
                <ShipmentShareLinksTab
                  shipmentId={id!}
                  refreshKey={shareLinksVersion}
                  onShareClick={() => setShareDialogOpen(true)}
                />
              </TabsContent>
            )}
      </Tabs>

      {id && hasPermission('shipments:share') && (
        <ShareShipmentDialog
          shipmentId={id}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          onIssued={() => setShareLinksVersion(v => v + 1)}
        />
      )}
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
