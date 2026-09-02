import { useState, useEffect } from 'react';
import {
  Map as MapIcon,
  Globe,
  KeyRound,
  ServerCog,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Pencil,
  Save,
  FlaskConical,
  Loader2,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MapsSettings {
  hasBrowserKey: boolean;
  maskedBrowserKey: string | null;
  hasServerKey: boolean;
  maskedServerKey: string | null;
}

type KeyField = 'googleMapsBrowserKey' | 'googleMapsServerKey';

const EMPTY_SETTINGS: MapsSettings = {
  hasBrowserKey: false,
  maskedBrowserKey: null,
  hasServerKey: false,
  maskedServerKey: null,
};

function Banner({ variant, message, onClose }: { variant: 'success' | 'error'; message: string; onClose?: () => void }) {
  const tone =
    variant === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-destructive/30 bg-destructive/10 text-destructive';
  return (
    <div className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${tone}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-xs underline opacity-70 hover:opacity-100">Dismiss</button>
      )}
    </div>
  );
}

export default function VNextMapsSettings() {
  const [settings, setSettings] = useState<MapsSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/maps/settings`);
      if (!res.ok) throw new Error('Failed to load maps settings');
      const json = await res.json();
      setSettings(json.data || EMPTY_SETTINGS);
    } catch (e: any) {
      setError(e.message || 'Failed to load maps settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveKey(field: KeyField, value: string) {
    setError('');
    setSuccess('');
    const res = await fetch(`${API_URL}/api/v1/maps/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // Only the edited key is sent. The other is left untouched by the server.
      body: JSON.stringify({ [field]: value.trim() || null }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || 'Failed to save the key');
    }
    setSuccess('Saved.');
    setTestResult(null);
    await loadSettings();
  }

  async function testServerKey() {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/maps/test`, { method: 'POST' });
      const json = await res.json();
      setTestResult({
        ok: Boolean(json.data?.valid),
        message: json.data?.message || json.error || 'The test did not return a result.',
      });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || 'The test could not be run.' });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading map settings
      </div>
    );
  }

  const mode = settings.hasBrowserKey ? 'Google Maps' : 'OpenStreetMap';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Map settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Maps work with no configuration at all. Adding Google keys turns on the things
          OpenStreetMap cannot do.
        </p>
      </div>

      {error && <Banner variant="error" message={error} onClose={() => setError('')} />}
      {success && <Banner variant="success" message={success} onClose={() => setSuccess('')} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              settings.hasBrowserKey ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
            )}>
              {settings.hasBrowserKey ? <MapIcon className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Current mode</div>
              <div className="text-lg font-semibold">{mode}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              settings.hasServerKey ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
            )}>
              <ServerCog className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Server features</div>
              <div className="text-lg font-semibold">{settings.hasServerKey ? 'Enabled' : 'Fallbacks in use'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <KeyCard
        title="Browser key"
        icon={<KeyRound className="h-4 w-4" />}
        field="googleMapsBrowserKey"
        hasKey={settings.hasBrowserKey}
        maskedKey={settings.maskedBrowserKey}
        onSave={saveKey}
        onError={setError}
        summary="Loads the interactive Google map and address autocomplete. It is sent to the browser, so anyone who opens a map can read it."
        restriction="Restrict this key by HTTP referrer to your own domains. Do not use it for anything server-side: Google rejects referrer-restricted keys on its web service APIs."
        unlocks={['Google basemap in the lane route editor', 'Places address autocomplete', 'Drag-to-adjust route planning']}
      />

      <KeyCard
        title="Server key"
        icon={<ServerCog className="h-4 w-4" />}
        field="googleMapsServerKey"
        hasKey={settings.hasServerKey}
        maskedKey={settings.maskedServerKey}
        onSave={saveKey}
        onError={setError}
        summary="Used by the backend only and never sent to a browser. This is the more capable of the two, and it is what any further Google work will run on."
        restriction="Restrict this key by IP address or by API. It must not carry HTTP referrer restrictions, or every server-side call will be denied."
        unlocks={[
          'Server-side route calculation and deviation corridors',
          'Distance Matrix instead of the OpenRouteService and haversine fallbacks',
          'Google geocoding instead of Nominatim',
        ]}
        footer={
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Checks the server key against the Geocoding API.
              </p>
              <Button variant="outline" size="sm" onClick={testServerKey} disabled={testing || !settings.hasServerKey}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                Test key
              </Button>
            </div>
            {testResult && (
              <div className={cn(
                'flex items-start gap-2 rounded-md border p-3 text-sm',
                testResult.ok
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
              )}>
                {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            With no keys at all the product still works. Maps draw OpenStreetMap tiles, addresses
            geocode through Nominatim, distances fall back to OpenRouteService and then to
            straight-line maths, and lane routes are drawn by placing waypoints by hand.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function KeyCard({
  title,
  icon,
  field,
  hasKey,
  maskedKey,
  onSave,
  onError,
  summary,
  restriction,
  unlocks,
  footer,
}: {
  title: string;
  icon: React.ReactNode;
  field: KeyField;
  hasKey: boolean;
  maskedKey: string | null;
  onSave: (field: KeyField, value: string) => Promise<void>;
  onError: (message: string) => void;
  summary: string;
  restriction: string;
  unlocks: string[];
  footer?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputId = `${field}-input`;

  const save = async () => {
    setSaving(true);
    try {
      await onSave(field, value);
      setValue('');
      setEditing(false);
    } catch (e: any) {
      onError(e.message || 'Failed to save the key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <Badge variant={hasKey ? 'success' : 'muted'}>{hasKey ? 'Configured' : 'Not set'}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{summary}</p>

        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          {restriction}
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Turns on</p>
          <ul className="space-y-1 text-sm">
            {unlocks.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {hasKey && !editing ? (
          <div className="flex items-center justify-between gap-3">
            <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{maskedKey}</code>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                Replace
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onSave(field, '').catch((e) => onError(e.message))}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={inputId}>{hasKey ? 'New key' : 'Key'}</Label>
            <div className="flex gap-2">
              <Input
                id={inputId}
                type="password"
                autoComplete="off"
                placeholder="AIza..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <Button size="sm" onClick={save} disabled={saving || !value.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
              {editing && (
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); setValue(''); }}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {footer}
      </CardContent>
    </Card>
  );
}
