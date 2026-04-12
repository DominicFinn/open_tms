import React, { useState, useEffect } from 'react';
import {
  VnPageHeader,
  VnTabs,
  VnCard,
  VnButton,
  VnAlert,
  VnField,
  VnInput,
  VnSelect,
  VnFormGrid,
  VnFormSection,
  VnFormActions,
} from './components';
import { API_URL } from '../api';

const tabs = [
  { key: 'general', label: 'General', icon: 'settings' },
  { key: 'warehouse', label: 'Warehouse', icon: 'warehouse' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications' },
  { key: 'integrations', label: 'Integrations', icon: 'extension' },
  { key: 'theme', label: 'Theme', icon: 'palette' },
];

/* ── Switch helper ──────────────────────────────────────── */

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
    <label className="vn-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="vn-switch-track" />
      {label}
    </label>
  );
}

/* ── Radio helper ───────────────────────────────────────── */

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
    <VnField label={label}>
      <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
        {options.map(opt => (
          <label
            key={opt.value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              color: 'var(--on-surface)',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              style={{ accentColor: 'var(--primary)' }}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </VnField>
  );
}

/* ── Tab Content ────────────────────────────────────────── */

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
    return <div className="loading-spinner" style={{ margin: '40px auto' }} />;
  }

  return (
    <>
      {saveMessage && (
        <VnAlert variant={saveMessage.variant} onClose={() => setSaveMessage(null)}>
          {saveMessage.text}
        </VnAlert>
      )}

      <VnFormSection title="Organization" icon="business">
        <VnFormGrid>
          <VnField label="Company Name" required>
            <VnInput value={orgName} onChange={e => setOrgName(e.target.value)} />
          </VnField>
          <VnField label="Industry">
            <VnSelect>
              <option value="logistics">Logistics</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="retail">Retail</option>
            </VnSelect>
          </VnField>
          <VnField label="Timezone">
            <VnSelect>
              <option value="America/New_York">America / New York (ET)</option>
              <option value="America/Chicago">America / Chicago (CT)</option>
              <option value="America/Denver">America / Denver (MT)</option>
              <option value="America/Los_Angeles">America / Los Angeles (PT)</option>
              <option value="Europe/London">Europe / London (GMT)</option>
              <option value="Europe/Berlin">Europe / Berlin (CET)</option>
            </VnSelect>
          </VnField>
          <VnField label="Default Currency">
            <VnSelect>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
            </VnSelect>
          </VnField>
        </VnFormGrid>
      </VnFormSection>

      <VnFormSection title="Units of Measure" icon="straighten">
        <VnFormGrid>
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
              { value: 'C', label: 'Celsius (\u00B0C)' },
              { value: 'F', label: 'Fahrenheit (\u00B0F)' },
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
        </VnFormGrid>
      </VnFormSection>

      <VnFormSection title="Carrier Tendering" icon="gavel">
        <VnFormGrid>
          <div className="vn-col-span-2">
            <Switch
              label="Auto-tender for laneless shipments"
              checked={autoTenderEnabled}
              onChange={setAutoTenderEnabled}
            />
            <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px', marginLeft: '28px' }}>
              When enabled, a broadcast tender is automatically created for all carriers when a shipment is created without a lane or carrier assignment.
            </p>
          </div>
        </VnFormGrid>
      </VnFormSection>

      <VnFormSection title="Location & Geofencing" icon="location_on">
        <VnFormGrid>
          <VnField label="Default Geofence Radius (meters)">
            <VnInput
              type="number"
              value={String(defaultGeofenceRadius)}
              onChange={e => setDefaultGeofenceRadius(Number(e.target.value) || 200)}
            />
          </VnField>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '8px' }}>
              Default radius for geofence arrival criteria when new locations are auto-created. Applies to all new locations created via order/shipment ingestion.
            </p>
          </div>
        </VnFormGrid>
      </VnFormSection>

      <VnFormSection title="Cold Chain & Compliance" icon="thermostat">
        <VnFormGrid>
          <div className="vn-col-span-2">
            <Switch
              label="Auto-deliver shipment documents to customers on completion"
              checked={autoDeliverDocs}
              onChange={setAutoDeliverDocs}
            />
            <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px', marginLeft: '28px' }}>
              When enabled, cold chain compliance reports and other shipment documents will be automatically sent to the customer when a shipment is delivered.
            </p>
          </div>
        </VnFormGrid>
      </VnFormSection>

      <VnFormActions>
        <VnButton variant="outline">Cancel</VnButton>
        <VnButton variant="primary" icon="save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </VnButton>
      </VnFormActions>
    </>
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

  const toggleEmail = (key: keyof typeof emailPrefs) =>
    setEmailPrefs(p => ({ ...p, [key]: !p[key] }));

  const toggleApp = (key: keyof typeof appPrefs) =>
    setAppPrefs(p => ({ ...p, [key]: !p[key] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <VnCard title="Email Notifications">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Switch
            label="Shipment status changes"
            checked={emailPrefs.shipmentStatus}
            onChange={() => toggleEmail('shipmentStatus')}
          />
          <Switch
            label="Delivery confirmations"
            checked={emailPrefs.deliveryConfirmations}
            onChange={() => toggleEmail('deliveryConfirmations')}
          />
          <Switch
            label="Exception alerts"
            checked={emailPrefs.exceptionAlerts}
            onChange={() => toggleEmail('exceptionAlerts')}
          />
          <Switch
            label="Daily report"
            checked={emailPrefs.dailyReport}
            onChange={() => toggleEmail('dailyReport')}
          />
        </div>
      </VnCard>

      <VnCard title="In-App Notifications">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Switch
            label="Shipment status changes"
            checked={appPrefs.shipmentStatus}
            onChange={() => toggleApp('shipmentStatus')}
          />
          <Switch
            label="Delivery confirmations"
            checked={appPrefs.deliveryConfirmations}
            onChange={() => toggleApp('deliveryConfirmations')}
          />
          <Switch
            label="Exception alerts"
            checked={appPrefs.exceptionAlerts}
            onChange={() => toggleApp('exceptionAlerts')}
          />
          <Switch
            label="Daily report"
            checked={appPrefs.dailyReport}
            onChange={() => toggleApp('dailyReport')}
          />
        </div>
      </VnCard>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <VnCard>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '40px 20px',
          textAlign: 'center',
        }}
      >
        <span
          className="material-icons"
          style={{
            fontSize: '48px',
            color: 'var(--primary)',
            background: 'var(--primary-container)',
            borderRadius: '12px',
            padding: '12px',
          }}
        >
          extension
        </span>
        <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--on-surface)' }}>
          Integrations are managed from the Integrations app
        </span>
        <a
          href="/integrations"
          style={{
            color: 'var(--primary)',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Go to Integrations &rarr;
        </a>
      </div>
    </VnCard>
  );
}

function ThemeTab() {
  const [primaryColor, setPrimaryColor] = useState('#1976d2');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <VnFormSection title="Branding" icon="brush">
        <VnFormGrid>
          <VnField label="System Name">
            <VnInput defaultValue="Open TMS" />
          </VnField>
          <VnField label="Primary Color">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                style={{
                  width: '40px',
                  height: '40px',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  padding: '2px',
                  background: 'var(--surface-container-lowest)',
                }}
              />
              <VnInput
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </VnField>
          <VnField label="Logo" className="vn-col-span-2">
            <div
              style={{
                border: '2px dashed var(--outline-variant)',
                borderRadius: '12px',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--on-surface-variant)',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              <span className="material-icons" style={{ fontSize: '36px' }}>
                cloud_upload
              </span>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>
                Click to upload or drag and drop
              </span>
              <span style={{ fontSize: '12px' }}>SVG, PNG, or JPG (max 2MB)</span>
            </div>
          </VnField>
        </VnFormGrid>
      </VnFormSection>

      <VnCard title="Preview">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--on-surface-variant)' }}>
              Primary color:
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: primaryColor,
              }}
            />
            <span
              style={{
                fontSize: '13px',
                fontFamily: 'monospace',
                color: 'var(--on-surface-variant)',
              }}
            >
              {primaryColor}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <button
              style={{
                background: primaryColor,
                color: 'var(--on-primary)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Primary Button
            </button>
            <button
              style={{
                background: 'transparent',
                color: primaryColor,
                border: `1px solid ${primaryColor}`,
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Outline Button
            </button>
          </div>
          <div
            style={{
              background: 'var(--surface-container-low)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '40px',
                borderRadius: '4px',
                background: primaryColor,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--on-surface)',
                }}
              >
                Sample Navigation Item
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--on-surface-variant)',
                  marginTop: '2px',
                }}
              >
                This shows how the primary color appears in the sidebar
              </div>
            </div>
          </div>
        </div>
      </VnCard>

      <VnFormActions>
        <VnButton variant="outline">Cancel</VnButton>
        <VnButton variant="primary" icon="save">Save Theme</VnButton>
      </VnFormActions>
    </div>
  );
}

/* ── Warehouse Tab ─────────────────────────────────────── */

function WarehouseTab() {
  const [magicLinksEnabled, setMagicLinksEnabled] = useState(true);
  const [scanMode, setScanMode] = useState('hid');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [qrSvg, setQrSvg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; variant: 'success' | 'error' } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v1/warehouse/settings`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/organization/users`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([settings, usersRes]) => {
      if (settings.data) {
        setMagicLinksEnabled(settings.data.magicLinksEnabled ?? true);
        setScanMode(settings.data.warehouseScanMode || 'hid');
      }
      setUsers(usersRes.data || []);
    }).finally(() => setLoading(false));
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
    setQrSvg('');
    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/auth/magic-link/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      const json = await res.json();
      if (json.data?.token) {
        const link = `${window.location.origin}/warehouse/login?token=${json.data.token}`;
        setGeneratedLink(link);
        // Generate QR code SVG inline (simple QR using a data URL approach)
        setQrSvg(link);
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

  if (loading) return <div className="loading-spinner" style={{ margin: '40px auto' }} />;

  return (
    <>
      {saveMessage && (
        <VnAlert variant={saveMessage.variant} onClose={() => setSaveMessage(null)}>
          {saveMessage.text}
        </VnAlert>
      )}

      <VnFormSection title="Warehouse App Settings" icon="warehouse">
        <VnFormGrid>
          <div>
            <Switch
              label="Magic Link Login (QR Codes)"
              checked={magicLinksEnabled}
              onChange={setMagicLinksEnabled}
            />
            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px', marginLeft: '40px' }}>
              When enabled, admins can generate printable QR codes for warehouse users to log in without typing credentials.
              Disable this if security concerns require password-only access.
            </div>
          </div>
          <RadioGroup
            label="Default Scanner Mode"
            name="scanMode"
            options={[
              { value: 'hid', label: 'Built-in Scanner (HID)' },
              { value: 'camera', label: 'Camera' },
            ]}
            value={scanMode}
            onChange={setScanMode}
          />
        </VnFormGrid>
      </VnFormSection>

      <VnFormActions>
        <VnButton variant="outline" onClick={() => window.location.reload()}>Reset</VnButton>
        <VnButton variant="primary" icon="save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </VnButton>
      </VnFormActions>

      {magicLinksEnabled && (
        <VnFormSection title="Generate Login QR Code" icon="qr_code">
          <VnFormGrid>
            <VnField label="Select User">
              <VnSelect value={selectedUserId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedUserId(e.target.value)}>
                <option value="">Choose a user...</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                ))}
              </VnSelect>
            </VnField>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <VnButton
                variant="primary"
                icon="qr_code"
                onClick={generateMagicLink}
                disabled={!selectedUserId || generating}
              >
                {generating ? 'Generating...' : 'Generate QR Code'}
              </VnButton>
            </div>
          </VnFormGrid>

          {generatedLink && (
            <VnCard className="vn-mt-3">
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generatedLink)}`}
                  alt="Login QR Code"
                  width={200}
                  height={200}
                  style={{ display: 'block', margin: '0 auto 16px' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', wordBreak: 'break-all', maxWidth: '400px', margin: '0 auto 16px' }}>
                  {generatedLink}
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <VnButton variant="outline" icon="content_copy" onClick={() => navigator.clipboard.writeText(generatedLink)}>
                    Copy Link
                  </VnButton>
                  <VnButton variant="primary" icon="print" onClick={printQrCode}>
                    Print QR Code
                  </VnButton>
                </div>
              </div>
            </VnCard>
          )}
        </VnFormSection>
      )}

      <VnFormSection title="Login Audit Log" icon="history">
        <LoginAuditPreview />
      </VnFormSection>
    </>
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

  if (loading) return <div className="loading-spinner" style={{ margin: '20px auto' }} />;

  if (logs.length === 0) {
    return <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px' }}>No login activity yet.</p>;
  }

  return (
    <div className="vn-table-wrap" style={{ maxHeight: '300px', overflow: 'auto' }}>
      <table className="vn-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Method</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any) => (
            <tr key={log.id}>
              <td>{log.user?.firstName} {log.user?.lastName}</td>
              <td>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '12px', padding: '2px 8px', borderRadius: '12px',
                  background: log.method === 'magic_link' ? 'var(--primary-container)' : 'var(--surface-container)',
                  color: log.method === 'magic_link' ? 'var(--on-primary-container)' : 'var(--on-surface)',
                }}>
                  {log.method === 'magic_link' ? 'QR / Magic Link' : log.method === 'password' ? 'Password' : log.method}
                </span>
              </td>
              <td>
                <span style={{ color: log.success ? 'var(--color-success)' : 'var(--error)' }}>
                  {log.success ? 'Success' : `Failed (${log.failReason})`}
                </span>
              </td>
              <td style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>
                {new Date(log.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────── */

export default function VNextSettings() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="vn-page">
      <VnPageHeader title="Settings" subtitle="Manage your organization preferences and integrations" />

      <VnTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div style={{ marginTop: '24px' }}>
        {activeTab === 'general' && <GeneralTab />}
        {activeTab === 'warehouse' && <WarehouseTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'theme' && <ThemeTab />}
      </div>
    </div>
  );
}
