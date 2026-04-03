import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../api';
import { useTheme } from '../ThemeProvider';

interface ThemeColor {
  key: string;
  label: string;
  group: string;
}

const THEME_COLORS: ThemeColor[] = [
  // Primary
  { key: 'primary', label: 'Primary', group: 'Primary' },
  { key: 'on-primary', label: 'On Primary', group: 'Primary' },
  { key: 'primary-container', label: 'Primary Container', group: 'Primary' },
  { key: 'on-primary-container', label: 'On Primary Container', group: 'Primary' },
  // Secondary
  { key: 'secondary', label: 'Secondary', group: 'Secondary' },
  { key: 'on-secondary', label: 'On Secondary', group: 'Secondary' },
  { key: 'secondary-container', label: 'Secondary Container', group: 'Secondary' },
  { key: 'on-secondary-container', label: 'On Secondary Container', group: 'Secondary' },
  // Tertiary
  { key: 'tertiary', label: 'Tertiary', group: 'Tertiary' },
  { key: 'on-tertiary', label: 'On Tertiary', group: 'Tertiary' },
  { key: 'tertiary-container', label: 'Tertiary Container', group: 'Tertiary' },
  { key: 'on-tertiary-container', label: 'On Tertiary Container', group: 'Tertiary' },
  // Status
  { key: 'error', label: 'Error', group: 'Status' },
  { key: 'on-error', label: 'On Error', group: 'Status' },
  { key: 'success', label: 'Success', group: 'Status' },
  { key: 'on-success', label: 'On Success', group: 'Status' },
  { key: 'warning', label: 'Warning', group: 'Status' },
  { key: 'on-warning', label: 'On Warning', group: 'Status' },
  { key: 'info', label: 'Info', group: 'Status' },
  { key: 'on-info', label: 'On Info', group: 'Status' },
  // Surface
  { key: 'background', label: 'Background', group: 'Surface' },
  { key: 'on-background', label: 'On Background', group: 'Surface' },
  { key: 'surface', label: 'Surface', group: 'Surface' },
  { key: 'on-surface', label: 'On Surface', group: 'Surface' },
  { key: 'surface-variant', label: 'Surface Variant', group: 'Surface' },
  { key: 'on-surface-variant', label: 'On Surface Variant', group: 'Surface' },
  { key: 'surface-container-lowest', label: 'Container Lowest', group: 'Surface' },
  { key: 'surface-container-low', label: 'Container Low', group: 'Surface' },
  { key: 'surface-container', label: 'Container', group: 'Surface' },
  { key: 'surface-container-high', label: 'Container High', group: 'Surface' },
  { key: 'surface-container-highest', label: 'Container Highest', group: 'Surface' },
  // Other
  { key: 'outline', label: 'Outline', group: 'Other' },
  { key: 'outline-variant', label: 'Outline Variant', group: 'Other' },
];

function getComputedColor(key: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim() || '#000000';
}

function normalizeHex(val: string): string {
  const s = val.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return s;
}

export default function ThemeSettings() {
  const { hasLogo, logoUrl, reloadTheme, systemName: currentSystemName } = useTheme();
  const [themeConfig, setThemeConfig] = useState<Record<string, string>>({});
  const [originalConfig, setOriginalConfig] = useState<Record<string, string>>({});
  const [systemName, setSystemName] = useState('');
  const [originalSystemName, setOriginalSystemName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTheme();
  }, []);

  async function loadTheme() {
    try {
      const [themeRes, orgRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/theme`),
        fetch(`${API_URL}/api/v1/organization/settings`),
      ]);
      const themeResult = await themeRes.json();
      if (themeResult.data?.themeConfig) {
        setThemeConfig(themeResult.data.themeConfig);
        setOriginalConfig(themeResult.data.themeConfig);
      }
      const orgResult = await orgRes.json();
      if (orgResult.data?.name) {
        setSystemName(orgResult.data.name);
        setOriginalSystemName(orgResult.data.name);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load theme configuration' });
    } finally {
      setLoading(false);
    }
  }

  function handleColorChange(key: string, value: string) {
    setThemeConfig((prev) => ({ ...prev, [key]: value }));
    // Live preview
    document.documentElement.style.setProperty(`--${key}`, value);
  }

  function handleRemoveColor(key: string) {
    setThemeConfig((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    document.documentElement.style.removeProperty(`--${key}`);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeConfig }),
      });
      const result = await res.json();
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setOriginalConfig(themeConfig);
        reloadTheme();
        setMessage({ type: 'success', text: 'Theme saved successfully' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save theme' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('Reset all theme customizations to defaults?')) return;
    setSaving(true);
    setMessage(null);
    try {
      await fetch(`${API_URL}/api/v1/theme`, { method: 'DELETE' });
      setThemeConfig({});
      setOriginalConfig({});
      reloadTheme();
      setMessage({ type: 'success', text: 'Theme reset to defaults' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to reset theme' });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setThemeConfig(originalConfig);
    reloadTheme();
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/api/v1/theme/logo`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        reloadTheme();
        setMessage({ type: 'success', text: 'Logo uploaded successfully' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to upload logo' });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleLogoRemove() {
    if (!confirm('Remove the organization logo?')) return;
    setMessage(null);
    try {
      await fetch(`${API_URL}/api/v1/theme/logo`, { method: 'DELETE' });
      reloadTheme();
      setMessage({ type: 'success', text: 'Logo removed' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove logo' });
    }
  }

  const groups = THEME_COLORS.reduce<Record<string, ThemeColor[]>>((acc, c) => {
    (acc[c.group] ||= []).push(c);
    return acc;
  }, {});

  const hasChanges = JSON.stringify(themeConfig) !== JSON.stringify(originalConfig);

  if (loading) {
    return <div className="loading-spinner-page"><div className="loading-spinner" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
          <h1>Theme & Branding</h1>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
            <button className="button button-outline" onClick={handleCancel} disabled={!hasChanges || saving}>
              Cancel
            </button>
            <button className="button button-danger" onClick={handleReset} disabled={saving}>
              Reset to Defaults
            </button>
            <button className="button" onClick={handleSave} disabled={!hasChanges || saving}>
              {saving ? 'Saving...' : 'Save Theme'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: 'var(--spacing-3)' }}>
          {message.text}
        </div>
      )}

      {/* System Name */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2 style={{ marginTop: 0 }}>System Name</h2>
        <p style={{ color: 'var(--on-surface-variant)' }}>
          Customize the name shown in the navigation bar, dashboard, emails, and generated documents. Default is "Open TMS".
        </p>
        <div style={{ display: 'flex', gap: 'var(--spacing-1)', alignItems: 'flex-end' }}>
          <div className="text-field" style={{ flex: 1, maxWidth: '400px' }}>
            <input
              type="text"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              placeholder=" "
            />
            <label>System Name</label>
          </div>
          <button
            className="button"
            disabled={savingName || systemName === originalSystemName || !systemName.trim()}
            onClick={async () => {
              setSavingName(true);
              setMessage(null);
              try {
                const res = await fetch(`${API_URL}/api/v1/organization/settings`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: systemName.trim() }),
                });
                const result = await res.json();
                if (result.error) {
                  setMessage({ type: 'error', text: result.error });
                } else {
                  setOriginalSystemName(systemName.trim());
                  reloadTheme();
                  setMessage({ type: 'success', text: 'System name updated' });
                }
              } catch {
                setMessage({ type: 'error', text: 'Failed to update system name' });
              } finally {
                setSavingName(false);
              }
            }}
          >
            {savingName ? 'Saving...' : 'Save Name'}
          </button>
        </div>
      </div>

      {/* Logo Section */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2 style={{ marginTop: 0 }}>Organization Logo</h2>
        <p style={{ color: 'var(--on-surface-variant)' }}>
          Upload a logo to display in the navigation bar and on generated documents.
          Supported formats: PNG, JPEG, SVG, WebP. Maximum size: 2 MB.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
          {hasLogo && logoUrl ? (
            <div style={{
              border: '1px solid var(--outline-variant)',
              borderRadius: '8px',
              padding: 'var(--spacing-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '200px',
              height: '80px',
              backgroundColor: 'var(--surface-container-low)',
            }}>
              <img
                src={`${logoUrl}?t=${Date.now()}`}
                alt="Organization logo"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div style={{
              border: '2px dashed var(--outline-variant)',
              borderRadius: '8px',
              padding: 'var(--spacing-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '200px',
              height: '80px',
              color: 'var(--on-surface-variant)',
            }}>
              <span className="material-icons" style={{ fontSize: '32px', marginRight: 'var(--spacing-1)' }}>image</span>
              No logo
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleLogoUpload}
              style={{ display: 'none' }}
            />
            <button
              className="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
            >
              <span className="material-icons" style={{ fontSize: '18px', marginRight: '4px' }}>upload</span>
              {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
            </button>
            {hasLogo && (
              <button className="button button-outline" onClick={handleLogoRemove}>
                <span className="material-icons" style={{ fontSize: '18px', marginRight: '4px' }}>delete</span>
                Remove Logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Color Customization */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Color Customization</h2>
        <p style={{ color: 'var(--on-surface-variant)', marginBottom: 'var(--spacing-3)' }}>
          Override individual theme colors. Only modified colors are saved — unmodified colors use the defaults from the CSS theme.
        </p>

        {Object.entries(groups).map(([group, colors]) => (
          <div key={group} style={{ marginBottom: 'var(--spacing-3)' }}>
            <h3 style={{ margin: '0 0 var(--spacing-2) 0', color: 'var(--on-surface-variant)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {group}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--spacing-2)' }}>
              {colors.map((c) => {
                const isOverridden = c.key in themeConfig;
                const currentValue = isOverridden ? themeConfig[c.key] : getComputedColor(c.key);
                return (
                  <div
                    key={c.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-1)',
                      padding: 'var(--spacing-1)',
                      borderRadius: '6px',
                      border: isOverridden ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                      backgroundColor: 'var(--surface-container-lowest)',
                    }}
                  >
                    <input
                      type="color"
                      value={normalizeHex(currentValue)}
                      onChange={(e) => handleColorChange(c.key, e.target.value)}
                      style={{ width: '36px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '4px', padding: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{c.label}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
                        {currentValue}
                      </div>
                    </div>
                    {isOverridden && (
                      <button
                        className="icon-btn"
                        onClick={() => handleRemoveColor(c.key)}
                        title="Reset to default"
                        style={{ flexShrink: 0 }}
                      >
                        <span className="material-icons" style={{ fontSize: '18px' }}>undo</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
