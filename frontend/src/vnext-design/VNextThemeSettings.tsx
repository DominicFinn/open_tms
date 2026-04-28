import React, { useState, useEffect } from 'react';
import { Loader2, Palette, Save, Upload, Image as ImageIcon } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Theme and branding</h1>
          <p className="mt-1 text-sm text-muted-foreground">Customize the look and feel of your system</p>
        </div>
      </div>

      {alert && (
        <Banner variant={alert.type} message={alert.message} onClose={() => setAlert(null)} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>System name</CardTitle>
          <CardDescription>The display name shown across the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Organization name</Label>
            <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Enter organization name" />
          </div>
          <div className="flex justify-end">
            <Button variant="gradient" onClick={saveName} disabled={savingName}>
              <Save className="h-4 w-4" />
              {savingName ? 'Saving...' : 'Save name'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoUrl && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Current logo:</span>
              <img
                src={`${API_URL}/api/v1/theme/logo`}
                alt="Current logo"
                className="max-h-16 max-w-48 rounded-md border bg-background object-contain p-2"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Upload new logo</Label>
            <label className="relative flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-input bg-background p-6 text-center text-sm text-muted-foreground hover:border-primary/40">
              <Upload className="h-8 w-8" />
              <span className="font-medium">{uploadingLogo ? 'Uploading...' : 'Click to select a logo file'}</span>
              <span className="text-xs">SVG, PNG, or JPG (max 2MB)</span>
              <input
                type="file"
                accept="image/svg+xml,image/png,image/jpeg"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo(file);
                }}
                disabled={uploadingLogo}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Theme colors
          </CardTitle>
          <CardDescription>
            Saved colors are stored on the org but no longer applied dynamically; the active theme uses Tailwind tokens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {THEME_KEYS.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeColors[key] || '#000000'}
                    onChange={e => handleColorChange(key, e.target.value)}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                  />
                  <Input
                    value={themeColors[key] || ''}
                    onChange={e => handleColorChange(key, e.target.value)}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={loadTheme}>Reset</Button>
            <Button variant="gradient" onClick={saveColors} disabled={savingColors}>
              <Save className="h-4 w-4" />
              {savingColors ? 'Saving...' : 'Save colors'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
