import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  History,
  Eye,
  Save,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface AgentConfig {
  id: string;
  agentType: string;
  name: string;
  description: string | null;
  enabled: boolean;
  subscribedEvents: string[] | null;
  activeVersionId: string | null;
  temperature: number | null;
  maxTokens: number | null;
  confidenceThreshold: number | null;
  deduplicationWindowMinutes: number | null;
  versions: PromptVersion[];
}

interface PromptVersion {
  id: string;
  versionNumber: number;
  systemPrompt: string;
  changeNote: string | null;
  createdAt: string;
  createdBy: string | null;
  isActive?: boolean;
}

interface TemplateVariable {
  name: string;
  description: string;
  sample: string;
}

interface AvailableEvent {
  key: string;
  value: string;
  domain: string;
}

const EVENT_DOMAINS: Record<string, string> = {
  shipment: 'Shipments',
  sla: 'SLA',
  cargo: 'Cargo',
  cold_chain: 'Cold Chain',
  order: 'Orders',
  tracking: 'Tracking',
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

export default function VNextAgentConfig() {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [templateVars, setTemplateVars] = useState<TemplateVariable[]>([]);
  const [availableEvents, setAvailableEvents] = useState<AvailableEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [enabled, setEnabled] = useState(true);
  const [subscribedEvents, setSubscribedEvents] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(512);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0);
  const [deduplicationMinutes, setDeduplicationMinutes] = useState(30);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [showVersions, setShowVersions] = useState(false);

  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [configRes, varsRes, eventsRes, versionsRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/agent-configs/triage`),
          fetch(`${API_URL}/api/v1/agent-configs/template-variables`),
          fetch(`${API_URL}/api/v1/agent-configs/available-events`),
          fetch(`${API_URL}/api/v1/agent-configs/triage/versions`),
        ]);

        const configJson = await configRes.json();
        const varsJson = await varsRes.json();
        const eventsJson = await eventsRes.json();
        const versionsJson = await versionsRes.json();

        const cfg = configJson.data as AgentConfig;
        setConfig(cfg);
        setVersions(versionsJson.data || []);
        setTemplateVars(varsJson.data || []);
        setAvailableEvents(eventsJson.data || []);

        if (cfg) {
          setEnabled(cfg.enabled);
          setSubscribedEvents(cfg.subscribedEvents || []);
          setTemperature(cfg.temperature ?? 0.2);
          setMaxTokens(cfg.maxTokens ?? 512);
          setConfidenceThreshold(cfg.confidenceThreshold ?? 0);
          setDeduplicationMinutes(cfg.deduplicationWindowMinutes ?? 30);

          const activeVersion = cfg.versions?.find(v => v.id === cfg.activeVersionId) || cfg.versions?.[0];
          if (activeVersion) setPrompt(activeVersion.systemPrompt);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function insertVariable(varName: string) {
    const el = promptRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newPrompt = prompt.slice(0, start) + varName + prompt.slice(end);
    setPrompt(newPrompt);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + varName.length, start + varName.length);
    }, 0);
  }

  async function handleSaveSettings() {
    setSaving(true);
    setError('');
    try {
      await fetch(`${API_URL}/api/v1/agent-configs/triage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          subscribedEvents,
          temperature,
          maxTokens,
          confidenceThreshold: confidenceThreshold || null,
          deduplicationWindowMinutes: deduplicationMinutes,
        }),
      });

      const activeVersion = config?.versions?.find(v => v.id === config.activeVersionId) || config?.versions?.[0];
      if (activeVersion && prompt !== activeVersion.systemPrompt) {
        const promptRes = await fetch(`${API_URL}/api/v1/agent-configs/triage/prompt`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemPrompt: prompt, changeNote: changeNote || undefined }),
        });
        const promptJson = await promptRes.json();
        if (promptJson.error) throw new Error(promptJson.error);
        setChangeNote('');
      }

      const refreshRes = await fetch(`${API_URL}/api/v1/agent-configs/triage`);
      const refreshJson = await refreshRes.json();
      setConfig(refreshJson.data);

      const versionsRes = await fetch(`${API_URL}/api/v1/agent-configs/triage/versions`);
      const versionsJson = await versionsRes.json();
      setVersions(versionsJson.data || []);

      setSuccessMsg('Agent configuration saved');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePreviewPrompt() {
    try {
      const res = await fetch(`${API_URL}/api/v1/agent-configs/triage/preview-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: prompt }),
      });
      const json = await res.json();
      setPreviewContent(json.data?.resolved || prompt);
      setShowPreview(true);
    } catch {
      setPreviewContent(prompt);
      setShowPreview(true);
    }
  }

  async function activateVersion(versionId: string) {
    try {
      await fetch(`${API_URL}/api/v1/agent-configs/triage/versions/${versionId}/activate`, { method: 'POST' });
      const refreshRes = await fetch(`${API_URL}/api/v1/agent-configs/triage`);
      const refreshJson = await refreshRes.json();
      const cfg = refreshJson.data as AgentConfig;
      setConfig(cfg);
      const activeVersion = cfg.versions?.find(v => v.id === cfg.activeVersionId) || cfg.versions?.[0];
      if (activeVersion) setPrompt(activeVersion.systemPrompt);

      const versionsRes = await fetch(`${API_URL}/api/v1/agent-configs/triage/versions`);
      setVersions((await versionsRes.json()).data || []);

      setSuccessMsg('Prompt version activated');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const eventsByDomain: Record<string, AvailableEvent[]> = {};
  for (const e of availableEvents) {
    const domainKey = e.domain;
    if (!EVENT_DOMAINS[domainKey]) continue;
    if (!eventsByDomain[domainKey]) eventsByDomain[domainKey] = [];
    eventsByDomain[domainKey].push(e);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeVersion = versions.find(v => v.isActive) || versions[0];
  const promptChanged = activeVersion && prompt !== activeVersion.systemPrompt;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent configuration</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure AI agent prompts and behaviour</p>
        </div>
        <Button variant="outline" onClick={() => setShowVersions(true)}>
          <History className="h-4 w-4" />
          Version history ({versions.length})
        </Button>
      </div>

      {successMsg && <Banner variant="success" message={successMsg} onClose={() => setSuccessMsg('')} />}
      {error && <Banner variant="error" message={error} onClose={() => setError('')} />}

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{config?.name || 'Triage Agent'}</h2>
              <p className="text-sm text-muted-foreground">
                {config?.description || 'Analyzes shipment exceptions and creates issues'}
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-sm text-muted-foreground">{enabled ? 'Enabled' : 'Disabled'}</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="h-5 w-5 rounded border border-input bg-background accent-primary"
            />
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                System prompt
                {promptChanged && (
                  <span className="ml-2 text-xs font-normal text-warning">(unsaved changes)</span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handlePreviewPrompt}>
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
                {activeVersion && (
                  <span className="text-xs text-muted-foreground">v{activeVersion.versionNumber}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={14}
                className="block w-full resize-y border-0 bg-transparent p-5 font-mono text-xs leading-relaxed outline-none focus:ring-0"
              />
              {promptChanged && (
                <div className="border-t p-4">
                  <Input
                    value={changeNote}
                    onChange={e => setChangeNote(e.target.value)}
                    placeholder="Change note (optional) - e.g. 'Made more aggressive on cold chain'"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select which events trigger this agent. Unchecked events are ignored without restarting the worker.
              </p>
              {Object.entries(eventsByDomain).map(([domain, events]) => (
                <div key={domain}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {EVENT_DOMAINS[domain]}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {events.map(e => {
                      const checked = subscribedEvents.includes(e.value);
                      return (
                        <label
                          key={e.value}
                          className={cn(
                            'flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1 font-mono text-xs',
                            checked
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-muted/40 text-muted-foreground',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (checked) setSubscribedEvents(subscribedEvents.filter(x => x !== e.value));
                              else setSubscribedEvents([...subscribedEvents, e.value]);
                            }}
                            className="hidden"
                          />
                          {e.value}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              className="flex cursor-pointer flex-row items-center justify-between"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <CardTitle>Advanced settings</CardTitle>
              {showAdvanced ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </CardHeader>
            {showAdvanced && (
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Temperature ({temperature})</Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">Lower = more deterministic, higher = more creative</p>
                </div>
                <div className="space-y-2">
                  <Label>Max tokens</Label>
                  <Input type="number" min="64" max="4096" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value, 10))} />
                  <p className="text-xs text-muted-foreground">Maximum response length (tokens)</p>
                </div>
                <div className="space-y-2">
                  <Label>Confidence threshold ({confidenceThreshold || 'Off'})</Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={e => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Decisions below this confidence are overridden to "no action" (0 = accept all)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Deduplication window (minutes)</Label>
                  <Input type="number" min="1" max="1440" value={deduplicationMinutes} onChange={e => setDeduplicationMinutes(parseInt(e.target.value, 10))} />
                  <p className="text-xs text-muted-foreground">Suppress duplicate decisions for the same entity within this window</p>
                </div>
              </CardContent>
            )}
          </Card>

          <div className="flex justify-end">
            <Button variant="gradient" onClick={handleSaveSettings} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save configuration'}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template variables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Click to insert into your prompt. These are replaced with real data at runtime.
              </p>
              {templateVars.map(v => (
                <div key={v.name}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start font-mono"
                    onClick={() => insertVariable(v.name)}
                  >
                    <Plus className="h-3 w-3" />
                    {v.name}
                  </Button>
                  <p className="ml-1 mt-1 text-xs leading-relaxed text-muted-foreground">{v.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prompt preview (with sample data)</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs leading-relaxed">
            {previewContent}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prompt version history</DialogTitle>
          </DialogHeader>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            <div className="space-y-3">
              {versions.map(v => (
                <Card
                  key={v.id}
                  className={cn(v.isActive && 'border-primary bg-primary/5')}
                >
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Version {v.versionNumber}</span>
                        {v.isActive && <Badge variant="info">Active</Badge>}
                      </div>
                      {!v.isActive && (
                        <Button variant="outline" size="sm" onClick={() => activateVersion(v.id)}>
                          Activate
                        </Button>
                      )}
                    </div>
                    {v.changeNote && <p className="mb-1 text-sm">{v.changeNote}</p>}
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString()} {v.createdBy ? `by ${v.createdBy}` : ''}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
