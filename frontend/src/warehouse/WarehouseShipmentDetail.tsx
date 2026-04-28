import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bluetooth,
  Camera,
  Check,
  CheckCircle2,
  DoorClosed,
  Flag,
  Link as LinkIcon,
  Loader2,
  Lock,
  Package,
  Play,
  Plus,
  Radio,
  Rocket,
  Save,
  ScanLine,
  Thermometer,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';

import { API_URL } from '../api';
import { useBarcodeScanner } from './useBarcodeScanner';
import { CameraScannerModal } from './CameraScannerModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type WizardStep = 'detail' | 'trackers' | 'accessories' | 'units' | 'review';

const ACCESSORY_TYPES = [
  { value: 'temp_sensor_front', label: 'Temp Sensor (Front)', icon: 'thermostat', isIoT: true },
  { value: 'temp_sensor_middle', label: 'Temp Sensor (Middle)', icon: 'thermostat', isIoT: true },
  { value: 'temp_sensor_back', label: 'Temp Sensor (Back)', icon: 'thermostat', isIoT: true },
  { value: 'door_sensor', label: 'Door Sensor', icon: 'sensor_door', isIoT: true },
  { value: 'door_seal', label: 'Door Seal (Non-IoT)', icon: 'lock', isIoT: false },
  { value: 'ble_tracker', label: 'BLE Tracker', icon: 'bluetooth', isIoT: true },
];

const ACCESSORY_ICON: Record<string, LucideIcon> = {
  thermostat: Thermometer,
  sensor_door: DoorClosed,
  lock: Lock,
  bluetooth: Bluetooth,
};

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'detail', label: 'Detail' },
  { key: 'trackers', label: 'Trackers' },
  { key: 'accessories', label: 'Accessories' },
  { key: 'units', label: 'Units' },
  { key: 'review', label: 'Review' },
];

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted';

function statusVariant(status?: string): StatusVariant {
  if (!status) return 'muted';
  const s = status.toLowerCase();
  if (s === 'delivered') return 'success';
  if (s === 'in_transit' || s === 'in transit') return 'info';
  if (s === 'booked' || s === 'pickup') return 'warning';
  if (s === 'exception' || s === 'issue') return 'destructive';
  return 'muted';
}

export default function WarehouseShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<WizardStep>('detail');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Scanner state
  const [scanMode, setScanMode] = useState<'tracker' | 'accessory' | 'unit' | null>(null);
  const [scannedDevice, setScannedDevice] = useState<any>(null);
  const [scanError, setScanError] = useState('');

  // Accessory form
  const [selectedAccessoryType, setSelectedAccessoryType] = useState('');
  const [accessoryIdentifier, setAccessoryIdentifier] = useState('');

  // Unit pairing
  const [scannedUnit, setScannedUnit] = useState<any>(null);
  const [unitDevicePairs, setUnitDevicePairs] = useState<{ unitId: string; unitName: string; deviceId: string; deviceName: string }[]>([]);

  // Flag form
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  // Camera scanner
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraScanContext, setCameraScanContext] = useState<'tracker' | 'accessory' | 'unit' | 'unit-device'>('tracker');

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('warehouse_user') || '{}'); }
    catch { return {}; }
  })();

  const loadShipment = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setShipment(json.data);
      }
    } catch {
      setError('Failed to load shipment');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadShipment(); }, [loadShipment]);

  // Barcode scanner - context-aware
  const handleScan = useCallback(async (barcode: string) => {
    setScanError('');
    if (step === 'trackers' || scanMode === 'tracker') {
      try {
        const res = await fetch(`${API_URL}/api/v1/warehouse/devices/lookup?barcode=${encodeURIComponent(barcode)}`);
        const json = await res.json();
        if (json.error) {
          setScanError(json.error);
        } else {
          setScannedDevice(json.data);
        }
      } catch {
        setScanError('Network error looking up device');
      }
    } else if (step === 'accessories' && scanMode === 'accessory') {
      setAccessoryIdentifier(barcode);
    } else if (step === 'units') {
      if (scanMode === 'unit') {
        try {
          const res = await fetch(`${API_URL}/api/v1/warehouse/trackable-units/lookup?barcode=${encodeURIComponent(barcode)}`);
          const json = await res.json();
          if (json.error) {
            setScanError(json.error);
          } else {
            setScannedUnit(json.data);
            setScanMode(null);
          }
        } catch {
          setScanError('Network error looking up unit');
        }
      } else {
        if (scannedUnit) {
          try {
            const res = await fetch(`${API_URL}/api/v1/warehouse/devices/lookup?barcode=${encodeURIComponent(barcode)}`);
            const json = await res.json();
            if (json.error) {
              setScanError(json.error);
            } else {
              setUnitDevicePairs(prev => [...prev, {
                unitId: scannedUnit.id,
                unitName: scannedUnit.identifier,
                deviceId: json.data.id,
                deviceName: json.data.displayId || json.data.name,
              }]);
              setScannedUnit(null);
              setScanMode('unit');
            }
          } catch {
            setScanError('Network error looking up device');
          }
        }
      }
    }
  }, [step, scanMode, scannedUnit]);

  useBarcodeScanner(handleScan, { enabled: step !== 'detail' && step !== 'review' });

  const handleCameraScan = useCallback((barcode: string) => {
    handleScan(barcode);
    setCameraOpen(false);
  }, [handleScan]);

  function openCameraScanner(context: 'tracker' | 'accessory' | 'unit' | 'unit-device') {
    setCameraScanContext(context);
    setCameraOpen(true);
  }

  // Actions

  async function assignTracker() {
    if (!scannedDevice || !id) return;
    try {
      await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/assign-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: scannedDevice.id }),
      });
      setScannedDevice(null);
      setScanError('');
      await loadShipment();
      setSuccess('Tracker assigned');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setScanError('Failed to assign tracker');
    }
  }

  async function removeDevice(deviceId: string) {
    if (!id) return;
    await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/devices/${deviceId}`, { method: 'DELETE' });
    await loadShipment();
  }

  async function addAccessory() {
    if (!selectedAccessoryType || !id) return;
    const accType = ACCESSORY_TYPES.find(a => a.value === selectedAccessoryType);
    try {
      await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/accessories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessoryType: selectedAccessoryType,
          alias: accType?.label,
          identifier: accessoryIdentifier || null,
          isIoT: accType?.isIoT || false,
          deviceId: scannedDevice?.id || null,
        }),
      });
      setSelectedAccessoryType('');
      setAccessoryIdentifier('');
      setScannedDevice(null);
      await loadShipment();
      setSuccess('Accessory added');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setScanError('Failed to add accessory');
    }
  }

  async function removeAccessory(accId: string) {
    if (!id) return;
    await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/accessories/${accId}`, { method: 'DELETE' });
    await loadShipment();
  }

  async function saveUnitPairings() {
    if (!id) return;
    for (const pair of unitDevicePairs) {
      await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/assign-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: pair.deviceId, trackableUnitId: pair.unitId }),
      });
    }
    setUnitDevicePairs([]);
    await loadShipment();
    setSuccess('Unit trackers saved');
    setTimeout(() => setSuccess(''), 2000);
  }

  async function flagShipment() {
    if (!id || !flagReason.trim()) return;
    await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: flagReason,
        flaggedBy: user.id,
        flaggedByName: `${user.firstName} ${user.lastName}`,
      }),
    });
    setShowFlagForm(false);
    setFlagReason('');
    await loadShipment();
  }

  async function launchShipment() {
    if (!id) return;
    const res = await fetch(`${API_URL}/api/v1/warehouse/shipments/${id}/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ launchedBy: user.id }),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setSuccess('Shipment launched!');
    setTimeout(() => navigate('/warehouse'), 1500);
  }

  // Render

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="space-y-4 pb-24">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="text-lg font-semibold">Shipment not found</div>
            <Button variant="outline" size="lg" onClick={() => navigate('/warehouse')}>
              Back to list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex(s => s.key === step);
  const completedKeys = STEPS.slice(0, stepIndex).map(s => s.key);
  const hasUnits = shipment.orderShipments?.some((os: any) => os.order?.trackableUnits?.length > 0);
  const unresolvedFlags = shipment.flags?.filter((f: any) => !f.resolved) || [];
  const canLaunch = unresolvedFlags.length === 0;

  const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString() : '-');

  const selectedAcc = ACCESSORY_TYPES.find(a => a.value === selectedAccessoryType);

  return (
    <div className="space-y-4 pb-24">
      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          <span>{success}</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Dismiss"
            className="text-destructive hover:opacity-70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Wizard step indicator (hidden on detail step) */}
      {step !== 'detail' && (
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const isActive = step === s.key;
            const isCompleted = completedKeys.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(s.key)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                  {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* STEP: Detail */}
      {step === 'detail' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/warehouse')} className="-ml-2">
              <ArrowLeft className="h-5 w-5" />
              <span className="text-base">Shipments</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFlagForm(true)}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              aria-label="Flag shipment"
            >
              <Flag className="h-4 w-4" />
              Flag
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Shipment
              </div>
              <div className="text-xl font-bold">{shipment.reference}</div>
            </div>
            {shipment.status && (
              <Badge variant={statusVariant(shipment.status)} className="capitalize">
                {String(shipment.status).replace(/_/g, ' ')}
              </Badge>
            )}
          </div>

          {/* Flags */}
          {unresolvedFlags.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">
                  {unresolvedFlags.length} unresolved flag{unresolvedFlags.length !== 1 ? 's' : ''}
                </div>
                <div className="text-xs">
                  {unresolvedFlags.map((f: any) => `"${f.reason}"`).join(', ')}
                </div>
              </div>
            </div>
          )}

          {/* Route */}
          <Card>
            <CardContent className="p-0">
              <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Route
              </div>
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="text-muted-foreground">From</span>
                  <span className="text-right font-medium">
                    {shipment.origin?.name} - {shipment.origin?.city}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="text-muted-foreground">To</span>
                  <span className="text-right font-medium">
                    {shipment.destination?.name} - {shipment.destination?.city}
                  </span>
                </div>
                {shipment.stops?.length > 0 && (
                  <div className="flex items-center justify-between gap-3 p-4 text-sm">
                    <span className="text-muted-foreground">Stops</span>
                    <span className="font-medium">
                      {shipment.stops.length} stop{shipment.stops.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Customer & Dates */}
          <Card>
            <CardContent className="p-0">
              <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Details
              </div>
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="text-right font-medium">{shipment.customer?.name}</span>
                </div>
                <div className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="text-muted-foreground">Pickup</span>
                  <span className="font-medium">{fmtDate(shipment.pickupDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium">{fmtDate(shipment.deliveryDate)}</span>
                </div>
                {shipment.proNumber && (
                  <div className="flex items-center justify-between gap-3 p-4 text-sm">
                    <span className="text-muted-foreground">PRO #</span>
                    <span className="font-medium">{shipment.proNumber}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Carrier & Vehicle */}
          <Card>
            <CardContent className="p-0">
              <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Transport
              </div>
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="text-muted-foreground">Carrier</span>
                  <span className="font-medium">{shipment.carrier?.name || '-'}</span>
                </div>
                {shipment.loads?.[0]?.driver && (
                  <div className="flex items-center justify-between gap-3 p-4 text-sm">
                    <span className="text-muted-foreground">Driver</span>
                    <span className="font-medium">{shipment.loads[0].driver.name}</span>
                  </div>
                )}
                {shipment.loads?.[0]?.vehicle && (
                  <>
                    <div className="flex items-center justify-between gap-3 p-4 text-sm">
                      <span className="text-muted-foreground">Vehicle</span>
                      <span className="font-medium">{shipment.loads[0].vehicle.plate}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 p-4 text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{shipment.loads[0].vehicle.type}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Orders & Units */}
          {shipment.orderShipments?.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Orders & Units
                </div>
                <div className="divide-y divide-border">
                  {shipment.orderShipments.map((os: any) => (
                    <div key={os.order.id} className="space-y-2 p-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Order</span>
                        <span className="font-bold">{os.order.orderNumber}</span>
                      </div>
                      {os.order.trackableUnits?.map((u: any) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3"
                        >
                          <Package className="h-5 w-5 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{u.identifier}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {u.unitType}
                              {u.barcode ? ` - ${u.barcode}` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing trackers */}
          {shipment.deviceAssignments?.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assigned Trackers
                </div>
                <div className="divide-y divide-border">
                  {shipment.deviceAssignments.map((da: any) => (
                    <div key={da.id} className="flex items-center gap-3 p-4">
                      <Radio className="h-5 w-5 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {da.device?.displayId || da.device?.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Battery: {da.device?.batteryLevel ?? '-'}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action bar */}
          <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-background/95 p-4 backdrop-blur">
            {shipment.launchedAt ? (
              <div className="flex items-center justify-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-3 text-sm font-semibold text-success">
                <CheckCircle2 className="h-5 w-5" />
                Launched
              </div>
            ) : (
              <Button
                size="lg"
                variant="gradient"
                className="w-full text-base"
                onClick={() => setStep('trackers')}
              >
                <Play className="h-5 w-5" />
                Start launch wizard
              </Button>
            )}
          </div>

          {/* Flag dialog */}
          <Dialog open={showFlagForm} onOpenChange={setShowFlagForm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Flag an issue</DialogTitle>
              </DialogHeader>
              <textarea
                value={flagReason}
                onChange={e => setFlagReason(e.target.value)}
                placeholder="Describe the issue..."
                rows={4}
                autoFocus
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <DialogFooter className="flex flex-row gap-2 sm:justify-end">
                <Button variant="outline" onClick={() => setShowFlagForm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={flagShipment}
                  disabled={!flagReason.trim()}
                >
                  <Flag className="h-4 w-4" />
                  Flag
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* STEP: Trackers */}
      {step === 'trackers' && (
        <>
          <div>
            <h2 className="text-xl font-bold">Assign trackers</h2>
            <p className="text-sm text-muted-foreground">
              Scan the barcode on each IoT tracker to assign it to this shipment.
            </p>
          </div>

          {scanError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{scanError}</span>
            </div>
          )}

          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-5 text-center">
              <ScanLine className="mx-auto h-12 w-12 text-primary" />
              <div className="mt-2 text-base font-semibold">Scan tracker barcode</div>
              <div className="text-sm text-muted-foreground">
                Use built-in scanner or tap camera button
              </div>
              <Button
                variant="gradient"
                size="lg"
                className="mt-3 w-full text-base"
                onClick={() => openCameraScanner('tracker')}
              >
                <Camera className="h-5 w-5" />
                Use camera
              </Button>
            </CardContent>
          </Card>

          {/* Scanned device preview */}
          {scannedDevice && (
            <Card className="border-primary">
              <CardContent className="flex items-center gap-3 p-4">
                <Radio className="h-5 w-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {scannedDevice.displayId || scannedDevice.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {scannedDevice.model || scannedDevice.provider}
                    {scannedDevice.alreadyAssigned && (
                      <span className="text-warning">
                        {' '}- Currently on {scannedDevice.currentShipmentRef}
                      </span>
                    )}
                  </div>
                </div>
                <Button size="sm" onClick={assignTracker}>
                  Assign
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Already assigned trackers */}
          {shipment.deviceAssignments?.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assigned ({shipment.deviceAssignments.length})
                </div>
                <div className="divide-y divide-border">
                  {shipment.deviceAssignments.map((da: any) => (
                    <div key={da.id} className="flex items-center gap-3 p-4">
                      <Radio className="h-5 w-5 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {da.device?.displayId || da.device?.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {da.device?.model || 'Tracker'}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-destructive hover:bg-destructive/10"
                        aria-label="Remove tracker"
                        onClick={() => removeDevice(da.device?.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="fixed inset-x-0 bottom-16 z-20 flex gap-2 border-t border-border bg-background/95 p-4 backdrop-blur">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 text-base"
              onClick={() => setStep('detail')}
            >
              Back
            </Button>
            <Button
              size="lg"
              variant="gradient"
              className="flex-[2] text-base"
              onClick={() => {
                setStep('accessories');
                setScanMode('accessory');
                setScannedDevice(null);
              }}
            >
              Next
            </Button>
          </div>
        </>
      )}

      {/* STEP: Accessories */}
      {step === 'accessories' && (
        <>
          <div>
            <h2 className="text-xl font-bold">Add accessories</h2>
            <p className="text-sm text-muted-foreground">
              Add door seals, temperature sensors, or BLE devices.
            </p>
          </div>

          {scanError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Accessory type grid */}
          <div className="grid grid-cols-2 gap-2">
            {ACCESSORY_TYPES.map(acc => {
              const Icon = ACCESSORY_ICON[acc.icon] ?? Radio;
              const isSelected = selectedAccessoryType === acc.value;
              return (
                <button
                  key={acc.value}
                  type="button"
                  onClick={() => setSelectedAccessoryType(acc.value)}
                  className={cn(
                    'flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-md border p-3 text-center text-sm font-medium transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:bg-muted/40'
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span>{acc.label}</span>
                </button>
              );
            })}
          </div>

          {selectedAcc && (
            <>
              <Card className="border-primary/40 bg-primary/5">
                <CardContent className="p-5 text-center">
                  <ScanLine className="mx-auto h-10 w-10 text-primary" />
                  <div className="mt-2 text-base font-semibold">
                    {selectedAcc.isIoT ? 'Scan device ID' : 'Scan seal ID'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedAcc.isIoT
                      ? 'Scan the barcode on the BLE device'
                      : 'Scan or type the door seal identifier'}
                  </div>
                  <Button
                    variant="gradient"
                    size="lg"
                    className="mt-3 w-full text-base"
                    onClick={() => openCameraScanner('accessory')}
                  >
                    <Camera className="h-5 w-5" />
                    Use camera
                  </Button>
                  {selectedAcc.isIoT && scannedDevice && (
                    <div className="mt-2 text-sm font-semibold text-primary">
                      Found: {scannedDevice.displayId || scannedDevice.name}
                    </div>
                  )}
                  {!selectedAcc.isIoT && (
                    <div className="mt-3 text-left">
                      <Input
                        value={accessoryIdentifier}
                        onChange={e => setAccessoryIdentifier(e.target.value)}
                        placeholder="Or type seal ID..."
                        data-manual-input="true"
                        className="h-12 text-center text-base"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button
                size="lg"
                variant="gradient"
                className="w-full text-base"
                onClick={addAccessory}
              >
                <Plus className="h-5 w-5" />
                Add {selectedAcc.label}
              </Button>
            </>
          )}

          {/* Existing accessories */}
          {shipment.accessories?.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Added ({shipment.accessories.length})
                </div>
                <div className="divide-y divide-border">
                  {shipment.accessories.map((acc: any) => {
                    const Icon = acc.isIoT ? Bluetooth : Lock;
                    return (
                      <div key={acc.id} className="flex items-center gap-3 p-4">
                        <Icon className="h-5 w-5 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {acc.alias || acc.accessoryType}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {acc.identifier || 'No ID'}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-destructive hover:bg-destructive/10"
                          aria-label="Remove accessory"
                          onClick={() => removeAccessory(acc.id)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="fixed inset-x-0 bottom-16 z-20 flex gap-2 border-t border-border bg-background/95 p-4 backdrop-blur">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 text-base"
              onClick={() => {
                setStep('trackers');
                setScanMode('tracker');
              }}
            >
              Back
            </Button>
            <Button
              size="lg"
              variant="gradient"
              className="flex-[2] text-base"
              onClick={() => {
                if (hasUnits) {
                  setStep('units');
                  setScanMode('unit');
                } else {
                  setStep('review');
                  setScanMode(null);
                }
              }}
            >
              {hasUnits ? 'Next' : 'Review'}
            </Button>
          </div>
        </>
      )}

      {/* STEP: Unit Pairing */}
      {step === 'units' && (
        <>
          <div>
            <h2 className="text-xl font-bold">Track units</h2>
            <p className="text-sm text-muted-foreground">
              Scan a pallet/tote barcode, then scan the IoT device to pair them.
            </p>
          </div>

          {scanError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{scanError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Step 1: Scan unit */}
            <Card className={cn(scanMode === 'unit' && !scannedUnit && 'border-primary')}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4 text-primary" />
                  Step 1: Scan unit
                </div>
                {scannedUnit ? (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
                    <Package className="h-5 w-5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{scannedUnit.identifier}</div>
                      <div className="text-xs text-muted-foreground">{scannedUnit.unitType}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-3 text-center">
                    <ScanLine className="h-8 w-8 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground">Scan unit barcode</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setScanMode('unit');
                        openCameraScanner('unit');
                      }}
                    >
                      <Camera className="h-4 w-4" />
                      Camera
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Scan tracker */}
            <Card className={cn(scannedUnit && 'border-primary')}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Radio className="h-4 w-4 text-primary" />
                  Step 2: Scan tracker
                </div>
                {scannedUnit ? (
                  <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-primary p-3 text-center">
                    <ScanLine className="h-8 w-8 text-primary" />
                    <div className="text-xs text-muted-foreground">Now scan the tracker</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openCameraScanner('unit-device')}
                    >
                      <Camera className="h-4 w-4" />
                      Camera
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    Scan a unit first
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Paired items */}
          {unitDevicePairs.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Paired ({unitDevicePairs.length})
                </div>
                <div className="divide-y divide-border">
                  {unitDevicePairs.map((pair, i) => (
                    <div key={i} className="flex items-center gap-3 p-4">
                      <LinkIcon className="h-5 w-5 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{pair.unitName}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          Tracker: {pair.deviceName}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-destructive hover:bg-destructive/10"
                        aria-label="Remove pairing"
                        onClick={() =>
                          setUnitDevicePairs(prev => prev.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border p-4">
                  <Button
                    size="lg"
                    variant="gradient"
                    className="w-full text-base"
                    onClick={saveUnitPairings}
                  >
                    <Save className="h-5 w-5" />
                    Save pairings
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="fixed inset-x-0 bottom-16 z-20 flex gap-2 border-t border-border bg-background/95 p-4 backdrop-blur">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 text-base"
              onClick={() => {
                setStep('accessories');
                setScanMode('accessory');
              }}
            >
              Back
            </Button>
            <Button
              size="lg"
              variant="gradient"
              className="flex-[2] text-base"
              onClick={() => {
                setStep('review');
                setScanMode(null);
              }}
            >
              Review
            </Button>
          </div>
        </>
      )}

      {/* STEP: Review & Launch */}
      {step === 'review' && (
        <>
          <div>
            <h2 className="text-xl font-bold">Review & launch</h2>
            <p className="text-sm text-muted-foreground">
              Confirm everything looks good before launching.
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                <ReviewRow
                  ok
                  label="Shipment"
                  detail={`${shipment.reference} - ${shipment.customer?.name}`}
                />
                <ReviewRow
                  ok
                  label="Route"
                  detail={`${shipment.origin?.name} -> ${shipment.destination?.name}`}
                />
                <ReviewRow
                  ok={shipment.deviceAssignments?.length > 0}
                  label="Trackers"
                  detail={`${shipment.deviceAssignments?.length || 0} tracker${
                    shipment.deviceAssignments?.length !== 1 ? 's' : ''
                  } assigned`}
                />
                <ReviewRow
                  ok
                  label="Accessories"
                  detail={`${shipment.accessories?.length || 0} accessory item${
                    shipment.accessories?.length !== 1 ? 's' : ''
                  }`}
                />
                {shipment.carrier && (
                  <ReviewRow ok label="Carrier" detail={shipment.carrier.name} />
                )}
                {unresolvedFlags.length > 0 && (
                  <ReviewRow
                    error
                    label="Unresolved flags"
                    detail={`${unresolvedFlags.length} flag${
                      unresolvedFlags.length !== 1 ? 's' : ''
                    } must be resolved before launch`}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <div className="fixed inset-x-0 bottom-16 z-20 flex gap-2 border-t border-border bg-background/95 p-4 backdrop-blur">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 text-base"
              onClick={() => setStep(hasUnits ? 'units' : 'accessories')}
            >
              Back
            </Button>
            <Button
              size="lg"
              variant="gradient"
              className="flex-[2] text-base"
              onClick={launchShipment}
              disabled={!canLaunch}
            >
              <Rocket className="h-5 w-5" />
              Launch shipment
            </Button>
          </div>
        </>
      )}

      {/* Camera scanner modal - shared across all wizard steps */}
      <CameraScannerModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleCameraScan}
        title={
          cameraScanContext === 'tracker' ? 'Scan tracker' :
          cameraScanContext === 'accessory' ? 'Scan accessory' :
          cameraScanContext === 'unit' ? 'Scan unit' :
          'Scan device'
        }
        hint={
          cameraScanContext === 'tracker' ? 'Point camera at the tracker barcode' :
          cameraScanContext === 'accessory' ? 'Point camera at the accessory barcode' :
          cameraScanContext === 'unit' ? 'Point camera at the pallet/tote barcode' :
          'Point camera at the IoT device barcode'
        }
      />
    </div>
  );
}

interface ReviewRowProps {
  ok?: boolean;
  error?: boolean;
  label: string;
  detail: string;
}

function ReviewRow({ ok, error, label, detail }: ReviewRowProps) {
  const Icon = error ? AlertTriangle : ok ? CheckCircle2 : CheckCircle2;
  const tint = error ? 'text-destructive' : ok ? 'text-success' : 'text-muted-foreground';
  return (
    <div className="flex items-start gap-3 p-4">
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', tint)} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}
