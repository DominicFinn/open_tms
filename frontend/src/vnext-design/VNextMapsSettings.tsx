import { useState, useEffect } from 'react';
import {
  Map as MapIcon,
  Globe,
  KeyRound,
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
  hasKey: boolean;
  maskedKey: string | null;
}

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
  const [settings, setSettings] = useState<MapsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newKey, setNewKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
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
      setSettings(json.data || { hasKey: false, maskedKey: null });
    } catch (e: any) {
      setError(e.message || 'Failed to load maps settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveKey() {
    if (!newKey.trim()) {
      setError('API key is required');
      return;
    }
    setSavingKey(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/v1/maps/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleMapsApiKey: newKey.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to save API key');
      }
      setSuccess('Google Maps API key saved successfully');
      setNewKey('');
      setShowKeyInput(false);
      setTestResult(null);
      await loadSettings();
    } catch (e: any) {
      setError(e.message || 'Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/maps/test`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setTestResult({ ok: false, message: json.error || 'Connection test failed' });
      } else {
        setTestResult({ ok: true, message: 'Connection successful! Google Maps API is working.' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasKey = settings?.hasKey || false;
  const provider = hasKey ? 'Google Maps' : 'OpenStreetMap (Nominatim)';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maps settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure geocoding and mapping provider</p>
        </div>
      </div>

      {error && <Banner variant="error" message={error} onClose={() => setError('')} />}
      {success && <Banner variant="success" message={success} onClose={() => setSuccess('')} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', hasKey ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
              <MapIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">{provider}</div>
              <div className="text-xs text-muted-foreground">Active provider</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', hasKey ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')}>
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">{hasKey ? 'Configured' : 'Not set'}</div>
              <div className="text-xs text-muted-foreground">API key status</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Google Maps API key</CardTitle>
          </CardHeader>
          <CardContent>
            {hasKey && !showKeyInput ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span>API key is configured</span>
                </div>
                <div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm text-muted-foreground">
                  {settings?.maskedKey || '****...****'}
                </div>
                <Button variant="outline" onClick={() => setShowKeyInput(true)}>
                  <Pencil className="h-4 w-4" />
                  Update key
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {!hasKey && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <span>No API key configured. Using OpenStreetMap (Nominatim) as fallback.</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>API key</Label>
                  <Input
                    type="password"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="Enter your Google Maps API key"
                    onKeyDown={e => e.key === 'Enter' && saveKey()}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="gradient" onClick={saveKey} disabled={savingKey || !newKey.trim()}>
                    <Save className="h-4 w-4" />
                    {savingKey ? 'Saving...' : 'Save key'}
                  </Button>
                  {showKeyInput && (
                    <Button variant="outline" onClick={() => { setShowKeyInput(false); setNewKey(''); }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verify that the Google Maps API key is valid and the geocoding service is reachable.
            </p>
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              {testing ? 'Testing...' : 'Run test'}
            </Button>
            {testResult && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-md border p-3 text-sm',
                  testResult.ok ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive',
                )}
              >
                {testResult.ok ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current provider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className={cn('relative rounded-md border-2 p-5', hasKey ? 'border-primary' : 'border-border')}>
              {hasKey && (
                <Badge variant="success" className="absolute right-3 top-3">Active</Badge>
              )}
              <div className="mb-3 flex items-center gap-3">
                <MapIcon className={cn('h-8 w-8', hasKey ? 'text-primary' : 'text-muted-foreground')} />
                <div>
                  <div className="text-base font-semibold">Google Maps</div>
                  <div className="text-xs text-muted-foreground">Premium geocoding and maps</div>
                </div>
              </div>
              <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                <li>High-accuracy geocoding</li>
                <li>Interactive map tiles</li>
                <li>Route optimization</li>
                <li>Requires API key</li>
              </ul>
            </div>

            <div className={cn('relative rounded-md border-2 p-5', !hasKey ? 'border-primary' : 'border-border')}>
              {!hasKey && (
                <Badge variant="warning" className="absolute right-3 top-3">Fallback</Badge>
              )}
              <div className="mb-3 flex items-center gap-3">
                <Globe className={cn('h-8 w-8', !hasKey ? 'text-primary' : 'text-muted-foreground')} />
                <div>
                  <div className="text-base font-semibold">OpenStreetMap (Nominatim)</div>
                  <div className="text-xs text-muted-foreground">Free geocoding fallback</div>
                </div>
              </div>
              <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                <li>Free to use</li>
                <li>Basic geocoding</li>
                <li>Rate-limited</li>
                <li>No API key needed</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
