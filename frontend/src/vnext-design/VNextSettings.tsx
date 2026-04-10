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

/* ── Main Page ──────────────────────────────────────────── */

export default function VNextSettings() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="vn-page">
      <VnPageHeader title="Settings" subtitle="Manage your organization preferences and integrations" />

      <VnTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div style={{ marginTop: '24px' }}>
        {activeTab === 'general' && <GeneralTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'theme' && <ThemeTab />}
      </div>
    </div>
  );
}
