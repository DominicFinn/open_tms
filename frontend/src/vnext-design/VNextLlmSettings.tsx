import React, { useState, useEffect } from 'react';
import { Loader2, Bot, Save, KeyRound, DollarSign, Info } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LlmConfig {
  llmProvider: string | null;
  llmModel: string | null;
  llmEnabled: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  envConfigured: boolean;
}

function Banner({ variant, message, onClose }: { variant: 'success' | 'error' | 'info' | 'warning'; message: React.ReactNode; onClose?: () => void }) {
  const tones: Record<string, string> = {
    success: 'border-success/30 bg-success/10 text-success',
    error: 'border-destructive/30 bg-destructive/10 text-destructive',
    info: 'border-info/30 bg-info/10 text-info',
    warning: 'border-warning/30 bg-warning/10 text-warning',
  };
  return (
    <div className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${tones[variant]}`}>
      <div>{message}</div>
      {onClose && (
        <button onClick={onClose} className="text-xs underline opacity-70 hover:opacity-100">Dismiss</button>
      )}
    </div>
  );
}

export default function VNextLlmSettings() {
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/settings/llm`);
        const json = await res.json();
        const data = json.data as LlmConfig;
        setConfig(data);
        setProvider(data.llmProvider || 'anthropic');
        setModel(data.llmModel || '');
        setEnabled(data.llmEnabled);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        llmProvider: provider,
        llmModel: model || null,
        llmEnabled: enabled,
      };
      if (apiKey) body.llmApiKey = apiKey;

      const res = await fetch(`${API_URL}/api/v1/settings/llm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setConfig(json.data);
      setApiKey('');
      setSuccessMsg('LLM settings saved');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-3xl font-bold tracking-tight">AI / LLM settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure the AI provider for agent features</p>
        </div>
      </div>

      {successMsg && <Banner variant="success" message={successMsg} onClose={() => setSuccessMsg('')} />}
      {error && <Banner variant="error" message={error} onClose={() => setError('')} />}

      <Card>
        <CardHeader>
          <CardTitle>Current status</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">AI agents</dt>
              <dd className="mt-1">
                <Badge variant={config?.llmEnabled ? 'success' : 'secondary'}>
                  {config?.llmEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">API key</dt>
              <dd className="mt-1 text-sm">
                {config?.hasApiKey
                  ? <span className="font-mono text-xs">{config.apiKeyMasked}</span>
                  : <span className="text-muted-foreground">Not configured</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Environment override</dt>
              <dd className="mt-1">
                {config?.envConfigured
                  ? <Badge variant="info">ANTHROPIC_API_KEY set</Badge>
                  : <span className="text-sm text-muted-foreground">Not set</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Provider</dt>
              <dd className="mt-1 text-sm capitalize">{config?.llmProvider || '-'}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Model</dt>
              <dd className="mt-1 text-sm">{config?.llmModel || 'Default (claude-sonnet-4-20250514)'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {config?.envConfigured && (
        <Banner
          variant="info"
          message={
            <span className="flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0" />
              <span>
                The <code className="rounded bg-muted px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code> environment variable is set. The agent will use the env var unless you configure a key here, which takes priority.
              </span>
            </span>
          }
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">More providers coming soon</p>
            </div>
            <div className="space-y-2">
              <Label>Model override (optional)</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} placeholder="claude-sonnet-4-20250514" />
              <p className="text-xs text-muted-foreground">Leave blank for default model</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-1">
                <KeyRound className="h-4 w-4" />
                API key
              </Label>
              <Input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={config?.hasApiKey ? 'Key is set - enter new key to replace' : 'sk-ant-...'}
              />
              <p className="text-xs text-muted-foreground">
                Your API key is stored securely and never exposed in API responses. You are responsible for your own API costs.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e => setEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border border-input bg-background accent-primary"
                />
                <div>
                  <div className="font-medium">Enable AI agents</div>
                  <div className="text-xs text-muted-foreground">
                    When enabled, the triage agent will process shipment exceptions, SLA breaches, and other events
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="gradient" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Banner
        variant="warning"
        message={
          <span className="flex items-start gap-2">
            <DollarSign className="h-4 w-4 shrink-0" />
            <span>
              <strong>Cost awareness:</strong> AI agents make LLM API calls that cost money. Each invocation typically uses 500-2,000 tokens. Monitor usage on the Agent Decisions page and set appropriate event filters to control volume.
            </span>
          </span>
        }
      />
    </div>
  );
}
