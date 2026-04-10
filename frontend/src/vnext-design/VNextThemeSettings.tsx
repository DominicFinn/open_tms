import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import {
  VnPageHeader,
  VnCard,
  VnButton,
  VnField,
  VnInput,
  VnFormGrid,
  VnFormSection,
  VnFormActions,
  VnAlert,
} from './components';

const THEME_KEYS = [
  { key: 'primary', label: 'Primary' },
  { key: 'on-primary', label: 'On Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'on-secondary', label: 'On Secondary' },
  { key: 'surface', label: 'Surface' },
  { key: 'on-surface', label: 'On Surface' },
  { key: 'surface-container', label: 'Surface Container' },
  { key: 'surface-container-low', label: 'Surface Container Low' },
  { key: 'surface-container-lowest', label: 'Surface Container Lowest' },
  { key: 'outline', label: 'Outline' },
  { key: 'outline-variant', label: 'Outline Variant' },
  { key: 'error', label: 'Error' },
  { key: 'primary-container', label: 'Primary Container' },
];

interface ThemeData {
  themeConfig: Record<string, string> | null;
  logoUrl: string | null;
  themeUpdatedAt: string | null;
  name: string;
}

export default function VNextThemeSettings() {
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [themeColors, setThemeColors] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingColors, setSavingColors] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  async function loadTheme() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/theme/config`);
      if (!res.ok) throw new Error('Failed to load theme configuration');
      const json = await res.json();
      const data: ThemeData = json.data;
      setOrgName(data.name || '');
      setThemeColors(data.themeConfig || {});
      setLogoUrl(data.logoUrl || null);
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to load theme' });
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    setSavingName(true);
    setAlert(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/theme/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName }),
      });
      if (!res.ok) throw new Error('Failed to save system name');
      setAlert({ type: 'success', message: 'System name saved successfully.' });
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to save system name' });
    } finally {
      setSavingName(false);
    }
  }

  async function saveColors() {
    setSavingColors(true);
    setAlert(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/theme/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeConfig: themeColors }),
      });
      if (!res.ok) throw new Error('Failed to save theme colors');
      setAlert({ type: 'success', message: 'Theme colors saved successfully.' });
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to save theme colors' });
    } finally {
      setSavingColors(false);
    }
  }

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    setAlert(null);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch(`${API_URL}/api/v1/theme/upload-logo`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload logo');
      setAlert({ type: 'success', message: 'Logo uploaded successfully.' });
      await loadTheme();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to upload logo' });
    } finally {
      setUploadingLogo(false);
    }
  }

  function handleColorChange(key: string, value: string) {
    setThemeColors(prev => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="vn-page">
      <VnPageHeader title="Theme & Branding" subtitle="Customize the look and feel of your system" />

      <nav style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginBottom: '24px' }}>
        <span style={{ cursor: 'pointer', color: 'var(--primary)' }}>Settings</span>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Theme & Branding</span>
      </nav>

      {alert && (
        <div style={{ marginBottom: '16px' }}>
          <VnAlert variant={alert.type} onClose={() => setAlert(null)}>
            {alert.message}
          </VnAlert>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <VnCard title="System Name">
          <VnFormGrid>
            <VnField label="Organization Name">
              <VnInput
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Enter organization name"
              />
            </VnField>
          </VnFormGrid>
          <VnFormActions>
            <VnButton variant="primary" icon="save" onClick={saveName} disabled={savingName}>
              {savingName ? 'Saving...' : 'Save Name'}
            </VnButton>
          </VnFormActions>
        </VnCard>

        <VnCard title="Logo">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {logoUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '14px', color: 'var(--on-surface-variant)' }}>Current logo:</span>
                <img
                  src={`${API_URL}/api/v1/theme/logo`}
                  alt="Current logo"
                  style={{
                    maxHeight: '64px',
                    maxWidth: '200px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    border: '1px solid var(--outline-variant)',
                    padding: '8px',
                    background: 'var(--surface-container-lowest)',
                  }}
                />
              </div>
            )}
            <VnField label="Upload New Logo">
              <div
                style={{
                  border: '2px dashed var(--outline-variant)',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--on-surface-variant)',
                  position: 'relative',
                }}
              >
                <span className="material-icons" style={{ fontSize: '36px' }}>cloud_upload</span>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                  {uploadingLogo ? 'Uploading...' : 'Click to select a logo file'}
                </span>
                <span style={{ fontSize: '12px' }}>SVG, PNG, or JPG (max 2MB)</span>
                <input
                  type="file"
                  accept="image/svg+xml,image/png,image/jpeg"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) uploadLogo(file);
                  }}
                  disabled={uploadingLogo}
                />
              </div>
            </VnField>
          </div>
        </VnCard>

        <VnCard title="Theme Colors">
          <VnFormSection title="Color Palette" icon="palette">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              {THEME_KEYS.map(({ key, label }) => (
                <VnField key={key} label={label}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={themeColors[key] || '#000000'}
                      onChange={e => handleColorChange(key, e.target.value)}
                      style={{
                        width: '40px',
                        height: '40px',
                        border: '1px solid var(--outline-variant)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        padding: '2px',
                        background: 'var(--surface-container-lowest)',
                        flexShrink: 0,
                      }}
                    />
                    <VnInput
                      value={themeColors[key] || ''}
                      onChange={e => handleColorChange(key, e.target.value)}
                      placeholder="#000000"
                      style={{ flex: 1 }}
                    />
                  </div>
                </VnField>
              ))}
            </div>
          </VnFormSection>
          <VnFormActions>
            <VnButton variant="outline" onClick={loadTheme}>Reset</VnButton>
            <VnButton variant="primary" icon="save" onClick={saveColors} disabled={savingColors}>
              {savingColors ? 'Saving...' : 'Save Colors'}
            </VnButton>
          </VnFormActions>
        </VnCard>
      </div>
    </div>
  );
}
