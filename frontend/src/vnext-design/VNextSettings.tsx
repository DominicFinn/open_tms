import React, { useState, useEffect } from 'react';
import {
  Building2,
  Briefcase,
  Warehouse,
  Bell,
  Plug,
  Palette,
  Save,
  Ruler,
  Gavel,
  MapPin,
  Thermometer,
  History,
  QrCode,
  Loader2,
  Printer,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { API_URL } from '../api';

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border border-input bg-background accent-primary"
      />
      {label}
    </label>
  );
}

function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-4">
        {options.map(opt => (
          <label key={opt.value} className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 border border-input bg-background accent-primary"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function Banner({
  variant,
  message,
  onClose,
}: {
  variant: 'success' | 'error';
  message: string;
  onClose?: () => void;
}) {
  const tone =
    variant === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-destructive/30 bg-destructive/10 text-destructive';
  return (
    <div className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${tone}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-xs underline opacity-70 hover:opacity-100">
          Dismiss
        </button>
      )}
    </div>
  );
}

function GeneralTab() {
  const [orgName, setOrgName] = useState('');
  const [weight, setWeight] = useState('kg');
  const [dimensions, setDimensions] = useState('cm');
  const [temperature, setTemperature] = useState('C');
  const [distance, setDistance] = useState('km');
  const [autoDeliverDocs, setAutoDeliverDocs] = useState(false);
  const [autoTenderEnabled, setAutoTenderEnabled] = useState(false);
  const [defaultGeofenceRadius, setDefaultGeofenceRadius] = useState(200);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; variant: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/organization/settings`)
      .then(r => r.json())
      .then(json => {
        const s = json.data;
        if (s) {
          setOrgName(s.name || '');
          setWeight(s.weightUnit || 'kg');
          setDimensions(s.dimUnit || 'cm');
          setTemperature(s.temperatureUnit || 'C');
          setDistance(s.distanceUnit || 'km');
          setAutoDeliverDocs(s.autoDeliverShipmentDocs || false);
          setAutoTenderEnabled(s.autoTenderEnabled || false);
          setDefaultGeofenceRadius(s.defaultGeofenceRadiusMeters ?? 200);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/organization/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName,
          weightUnit: weight,
          dimUnit: dimensions,
          temperatureUnit: temperature,
          distanceUnit: distance,
          autoDeliverShipmentDocs: autoDeliverDocs,
          autoTenderEnabled,
          defaultGeofenceRadiusMeters: defaultGeofenceRadius,
        }),
      });
      if (res.ok) setSaveMessage({ text: 'Settings saved', variant: 'success' });
      else setSaveMessage({ text: 'Failed to save settings', variant: 'error' });
    } catch {
      setSaveMessage({ text: 'Failed to save settings', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saveMessage && (
        <Banner variant={saveMessage.variant} message={saveMessage.text} onClose={() => setSaveMessage(null)} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Organization
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Company name</Label>
            <Input value={orgName} onChange={e => setOrgName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Select defaultValue="logistics">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="logistics">Logistics</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select defaultValue="America/New_York">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/New_York">America / New York (ET)</SelectItem>
                <SelectItem value="America/Chicago">America / Chicago (CT)</SelectItem>
                <SelectItem value="America/Denver">America / Denver (MT)</SelectItem>
                <SelectItem value="America/Los_Angeles">America / Los Angeles (PT)</SelectItem>
                <SelectItem value="Europe/London">Europe / London (GMT)</SelectItem>
                <SelectItem value="Europe/Berlin">Europe / Berlin (CET)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default currency</Label>
            <Select defaultValue="USD">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-primary" />
            Units of measure
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <RadioGroup
            label="Weight"
            name="weight"
            value={weight}
            onChange={setWeight}
            options={[
              { value: 'kg', label: 'Kilograms (kg)' },
              { value: 'lb', label: 'Pounds (lb)' },
            ]}
          />
          <RadioGroup
            label="Dimensions"
            name="dimensions"
            value={dimensions}
            onChange={setDimensions}
            options={[
              { value: 'cm', label: 'Centimeters (cm)' },
              { value: 'in', label: 'Inches (in)' },
            ]}
          />
          <RadioGroup
            label="Temperature"
            name="temperature"
            value={temperature}
            onChange={setTemperature}
            options={[
              { value: 'C', label: 'Celsius (°C)' },
              { value: 'F', label: 'Fahrenheit (°F)' },
            ]}
          />
          <RadioGroup
            label="Distance"
            name="distance"
            value={distance}
            onChange={setDistance}
            options={[
              { value: 'km', label: 'Kilometers (km)' },
              { value: 'mi', label: 'Miles (mi)' },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-primary" />
            Carrier tendering
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Switch
            label="Auto-tender for laneless shipments"
            checked={autoTenderEnabled}
            onChange={setAutoTenderEnabled}
          />
          <p className="ml-6 text-xs text-muted-foreground">
            When enabled, a broadcast tender is automatically created for all carriers when a shipment is created without a lane or carrier assignment.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Location and geofencing
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Default geofence radius (meters)</Label>
            <Input
              type="number"
              value={String(defaultGeofenceRadius)}
              onChange={e => setDefaultGeofenceRadius(Number(e.target.value) || 200)}
            />
          </div>
          <p className="self-end text-xs text-muted-foreground">
            Default radius for geofence arrival criteria when new locations are auto-created.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-primary" />
            Cold chain and compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Switch
            label="Auto-deliver shipment documents to customers on completion"
            checked={autoDeliverDocs}
            onChange={setAutoDeliverDocs}
          />
          <p className="ml-6 text-xs text-muted-foreground">
            When enabled, cold chain compliance reports and other shipment documents will be automatically sent to the customer when a shipment is delivered.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button variant="gradient" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [emailPrefs, setEmailPrefs] = useState({
    shipmentStatus: true,
    deliveryConfirmations: true,
    exceptionAlerts: true,
    dailyReport: false,
  });
  const [appPrefs, setAppPrefs] = useState({
    shipmentStatus: true,
    deliveryConfirmations: false,
    exceptionAlerts: true,
    dailyReport: false,
  });

  const toggleEmail = (key: keyof typeof emailPrefs) => setEmailPrefs(p => ({ ...p, [key]: !p[key] }));
  const toggleApp = (key: keyof typeof appPrefs) => setAppPrefs(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Switch label="Shipment status changes" checked={emailPrefs.shipmentStatus} onChange={() => toggleEmail('shipmentStatus')} />
          <Switch label="Delivery confirmations" checked={emailPrefs.deliveryConfirmations} onChange={() => toggleEmail('deliveryConfirmations')} />
          <Switch label="Exception alerts" checked={emailPrefs.exceptionAlerts} onChange={() => toggleEmail('exceptionAlerts')} />
          <Switch label="Daily report" checked={emailPrefs.dailyReport} onChange={() => toggleEmail('dailyReport')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>In-app notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Switch label="Shipment status changes" checked={appPrefs.shipmentStatus} onChange={() => toggleApp('shipmentStatus')} />
          <Switch label="Delivery confirmations" checked={appPrefs.deliveryConfirmations} onChange={() => toggleApp('deliveryConfirmations')} />
          <Switch label="Exception alerts" checked={appPrefs.exceptionAlerts} onChange={() => toggleApp('exceptionAlerts')} />
          <Switch label="Daily report" checked={appPrefs.dailyReport} onChange={() => toggleApp('dailyReport')} />
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Plug className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold">Integrations are managed from the Integrations app</p>
        <a href="/integrations" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Go to Integrations <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}

function ThemeTab() {
  const [primaryColor, setPrimaryColor] = useState('#1976d2');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Branding
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>System name</Label>
            <Input defaultValue="Open TMS" />
          </div>
          <div className="space-y-2">
            <Label>Primary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
              />
              <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Logo</Label>
            <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-input bg-background py-8 text-center text-sm text-muted-foreground">
              <span className="font-medium">Click to upload or drag and drop</span>
              <span className="text-xs">SVG, PNG, or JPG (max 2MB)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button variant="gradient">
          <Save className="h-4 w-4" />
          Save theme
        </Button>
      </div>
    </div>
  );
}

function BrokerageTab() {
  const [orgType, setOrgType] = useState('shipper');
  const [mcNumber, setMcNumber] = useState('');
  const [bondAmount, setBondAmount] = useState('');
  const [bondExpiration, setBondExpiration] = useState('');
  const [authorityStatus, setAuthorityStatus] = useState('active');
  const [marginAlertEnabled, setMarginAlertEnabled] = useState(false);
  const [minMarginPercent, setMinMarginPercent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; variant: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/organization/settings`)
      .then(r => r.json())
      .then(json => {
        const s = json.data;
        if (s) {
          setOrgType(s.organizationType || 'shipper');
          setMcNumber(s.mcNumber || '');
          setBondAmount(s.bondAmountCents ? (s.bondAmountCents / 100).toFixed(2) : '');
          setBondExpiration(s.bondExpirationDate ? s.bondExpirationDate.split('T')[0] : '');
          setAuthorityStatus(s.operatingAuthorityStatus || 'active');
          setMarginAlertEnabled(s.marginAlertEnabled || false);
          setMinMarginPercent(s.minMarginPercent != null ? String(s.minMarginPercent) : '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/organization/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationType: orgType,
          mcNumber: mcNumber || null,
          bondAmountCents: bondAmount ? Math.round(parseFloat(bondAmount) * 100) : null,
          bondExpirationDate: bondExpiration || null,
          operatingAuthorityStatus: authorityStatus || null,
          marginAlertEnabled,
          minMarginPercent: minMarginPercent ? parseFloat(minMarginPercent) : null,
        }),
      });
      if (res.ok) setSaveMessage({ text: 'Brokerage settings saved', variant: 'success' });
      else setSaveMessage({ text: 'Failed to save settings', variant: 'error' });
    } catch {
      setSaveMessage({ text: 'Failed to save settings', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isBroker = orgType === 'broker' || orgType === '3pl';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 md:max-w-sm">
            <Label>Organization type</Label>
            <Select value={orgType} onValueChange={setOrgType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shipper">Shipper</SelectItem>
                <SelectItem value="broker">Broker</SelectItem>
                <SelectItem value="carrier">Carrier</SelectItem>
                <SelectItem value="3pl">3PL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            This determines the default UI experience and available features. Brokers and 3PLs get the load board, margin tracking, and broker-specific workflows.
          </p>
        </CardContent>
      </Card>

      {isBroker && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Authority and compliance</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>MC number</Label>
                <Input value={mcNumber} onChange={e => setMcNumber(e.target.value)} placeholder="e.g. 123456" />
              </div>
              <div className="space-y-2">
                <Label>Operating authority status</Label>
                <Select value={authorityStatus} onValueChange={setAuthorityStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="revoked">Revoked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bond amount ($)</Label>
                <Input type="number" step="0.01" value={bondAmount} onChange={e => setBondAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Bond expiration</Label>
                <Input type="date" value={bondExpiration} onChange={e => setBondExpiration(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Margin alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Switch label="Enable margin alerts" checked={marginAlertEnabled} onChange={setMarginAlertEnabled} />
              <p className="text-xs text-muted-foreground">
                When enabled, an issue is automatically created when a shipment's margin drops below the threshold.
              </p>
              {marginAlertEnabled && (
                <div className="space-y-2 md:max-w-xs">
                  <Label>Minimum margin (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={minMarginPercent}
                    onChange={e => setMinMarginPercent(e.target.value)}
                    placeholder="e.g. 10"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {saveMessage && (
        <Banner variant={saveMessage.variant} message={saveMessage.text} onClose={() => setSaveMessage(null)} />
      )}

      <div className="flex justify-end">
        <Button variant="gradient" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save brokerage settings'}
        </Button>
      </div>
    </div>
  );
}

function WarehouseTab() {
  const [magicLinksEnabled, setMagicLinksEnabled] = useState(true);
  const [scanMode, setScanMode] = useState('hid');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; variant: 'success' | 'error' } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v1/warehouse/settings`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/organization/users`).then(r => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([settings, usersRes]) => {
        if (settings.data) {
          setMagicLinksEnabled(settings.data.magicLinksEnabled ?? true);
          setScanMode(settings.data.warehouseScanMode || 'hid');
        }
        setUsers(usersRes.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magicLinksEnabled, warehouseScanMode: scanMode }),
      });
      if (res.ok) setSaveMessage({ text: 'Warehouse settings saved', variant: 'success' });
      else setSaveMessage({ text: 'Failed to save settings', variant: 'error' });
    } catch {
      setSaveMessage({ text: 'Failed to save settings', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const generateMagicLink = async () => {
    if (!selectedUserId) return;
    setGenerating(true);
    setGeneratedLink('');
    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/auth/magic-link/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      const json = await res.json();
      if (json.data?.token) {
        setGeneratedLink(`${window.location.origin}/warehouse/login?token=${json.data.token}`);
      } else {
        setSaveMessage({ text: json.error || 'Failed to generate', variant: 'error' });
      }
    } catch {
      setSaveMessage({ text: 'Failed to generate magic link', variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const printQrCode = () => {
    const userName = users.find(u => u.id === selectedUserId);
    const name = userName ? `${userName.firstName} ${userName.lastName}` : 'User';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Login QR Code - ${name}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        .qr-container { display: inline-block; padding: 20px; border: 2px solid #333; border-radius: 12px; }
        h2 { margin: 0 0 8px; }
        p { color: #666; margin: 0 0 16px; font-size: 14px; }
        img { display: block; margin: 0 auto 16px; }
        .footer { font-size: 12px; color: #999; margin-top: 16px; }
      </style></head><body>
        <div class="qr-container">
          <h2>Warehouse Login</h2>
          <p>${name}</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generatedLink)}" width="200" height="200" />
          <p style="font-size: 11px; word-break: break-all; max-width: 300px;">${generatedLink}</p>
          <div class="footer">Scan this QR code with your device camera to log in</div>
        </div>
        <script>setTimeout(() => window.print(), 500);</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saveMessage && (
        <Banner variant={saveMessage.variant} message={saveMessage.text} onClose={() => setSaveMessage(null)} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-primary" />
            Warehouse app settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Switch
              label="Magic link login (QR codes)"
              checked={magicLinksEnabled}
              onChange={setMagicLinksEnabled}
            />
            <p className="ml-6 mt-1 text-xs text-muted-foreground">
              When enabled, admins can generate printable QR codes for warehouse users to log in without typing credentials.
            </p>
          </div>
          <RadioGroup
            label="Default scanner mode"
            name="scanMode"
            options={[
              { value: 'hid', label: 'Built-in scanner (HID)' },
              { value: 'camera', label: 'Camera' },
            ]}
            value={scanMode}
            onChange={setScanMode}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>Reset</Button>
        <Button variant="gradient" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save settings'}
        </Button>
      </div>

      {magicLinksEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              Generate login QR code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label>Select user</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="gradient" onClick={generateMagicLink} disabled={!selectedUserId || generating}>
                <QrCode className="h-4 w-4" />
                {generating ? 'Generating...' : 'Generate QR code'}
              </Button>
            </div>

            {generatedLink && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-6">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generatedLink)}`}
                    alt="Login QR Code"
                    width={200}
                    height={200}
                  />
                  <p className="max-w-md break-all text-center text-xs text-muted-foreground">{generatedLink}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigator.clipboard.writeText(generatedLink)}>
                      <Copy className="h-4 w-4" />
                      Copy link
                    </Button>
                    <Button variant="gradient" onClick={printQrCode}>
                      <Printer className="h-4 w-4" />
                      Print QR code
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Login audit log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoginAuditPreview />
        </CardContent>
      </Card>
    </div>
  );
}

function LoginAuditPreview() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/warehouse/audit/logins?limit=20`)
      .then(r => r.json())
      .then(json => setLogs(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">No login activity yet.</p>;
  }

  return (
    <div className="max-h-72 overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">User</th>
            <th className="px-3 py-2 text-left">Method</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any) => (
            <tr key={log.id} className="border-t">
              <td className="px-3 py-2">{log.user?.firstName} {log.user?.lastName}</td>
              <td className="px-3 py-2">
                <Badge variant={log.method === 'magic_link' ? 'info' : 'secondary'}>
                  {log.method === 'magic_link' ? 'QR / Magic Link' : log.method === 'password' ? 'Password' : log.method}
                </Badge>
              </td>
              <td className={`px-3 py-2 ${log.success ? 'text-success' : 'text-destructive'}`}>
                {log.success ? 'Success' : `Failed (${log.failReason})`}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {new Date(log.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function VNextSettings() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your organization preferences and integrations
          </p>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general"><Building2 className="mr-1 h-4 w-4" />General</TabsTrigger>
          <TabsTrigger value="brokerage"><Briefcase className="mr-1 h-4 w-4" />Brokerage</TabsTrigger>
          <TabsTrigger value="warehouse"><Warehouse className="mr-1 h-4 w-4" />Warehouse</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1 h-4 w-4" />Notifications</TabsTrigger>
          <TabsTrigger value="integrations"><Plug className="mr-1 h-4 w-4" />Integrations</TabsTrigger>
          <TabsTrigger value="theme"><Palette className="mr-1 h-4 w-4" />Theme</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-6"><GeneralTab /></TabsContent>
        <TabsContent value="brokerage" className="mt-6"><BrokerageTab /></TabsContent>
        <TabsContent value="warehouse" className="mt-6"><WarehouseTab /></TabsContent>
        <TabsContent value="notifications" className="mt-6"><NotificationsTab /></TabsContent>
        <TabsContent value="integrations" className="mt-6"><IntegrationsTab /></TabsContent>
        <TabsContent value="theme" className="mt-6"><ThemeTab /></TabsContent>
      </Tabs>
    </div>
  );
}
