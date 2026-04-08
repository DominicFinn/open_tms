import React, { useState } from 'react';
import {
  VnPageHeader,
  VnTabs,
  VnCard,
  VnButton,
  VnChip,
  VnField,
  VnInput,
  VnSelect,
  VnFormGrid,
  VnFormSection,
  VnFormActions,
} from './components';

/* ── Static demo data ───────────────────────────────────── */

const integrations = [
  { name: 'Google Maps', icon: 'map', status: 'connected' as const },
  { name: 'SendGrid', icon: 'email', status: 'connected' as const },
  { name: 'Slack', icon: 'chat', status: 'not_configured' as const },
  { name: 'SAP', icon: 'inventory_2', status: 'not_configured' as const },
];

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
  const [weight, setWeight] = useState('kg');
  const [dimensions, setDimensions] = useState('cm');
  const [temperature, setTemperature] = useState('C');
  const [distance, setDistance] = useState('km');

  return (
    <>
      <VnFormSection title="Organization" icon="business">
        <VnFormGrid>
          <VnField label="Company Name" required>
            <VnInput defaultValue="Acme Logistics" />
          </VnField>
          <VnField label="Industry">
            <VnSelect defaultValue="logistics">
              <option value="logistics">Logistics</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="retail">Retail</option>
            </VnSelect>
          </VnField>
          <VnField label="Timezone">
            <VnSelect defaultValue="America/New_York">
              <option value="America/New_York">America / New York (ET)</option>
              <option value="America/Chicago">America / Chicago (CT)</option>
              <option value="America/Denver">America / Denver (MT)</option>
              <option value="America/Los_Angeles">America / Los Angeles (PT)</option>
              <option value="Europe/London">Europe / London (GMT)</option>
              <option value="Europe/Berlin">Europe / Berlin (CET)</option>
            </VnSelect>
          </VnField>
          <VnField label="Default Currency">
            <VnSelect defaultValue="USD">
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

      <VnFormActions>
        <VnButton variant="outline">Cancel</VnButton>
        <VnButton variant="primary" icon="save">Save</VnButton>
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px',
      }}
    >
      {integrations.map(integ => (
        <VnCard key={integ.name}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'center',
            }}
          >
            <span
              className="material-icons"
              style={{
                fontSize: '40px',
                color: 'var(--primary)',
                background: 'var(--primary-container)',
                borderRadius: '12px',
                padding: '12px',
              }}
            >
              {integ.icon}
            </span>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--on-surface)',
              }}
            >
              {integ.name}
            </span>
            <VnChip variant={integ.status === 'connected' ? 'success' : 'secondary'}>
              {integ.status === 'connected' ? 'Connected' : 'Not configured'}
            </VnChip>
            <VnButton variant="outline" size="sm" icon="settings">
              Configure
            </VnButton>
          </div>
        </VnCard>
      ))}
    </div>
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
                color: '#fff',
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
