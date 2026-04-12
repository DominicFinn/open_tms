import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../api';
import { VnPageHeader, VnAlert, VnModal } from './components';

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

export default function VNextAgentConfig() {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [templateVars, setTemplateVars] = useState<TemplateVariable[]>([]);
  const [availableEvents, setAvailableEvents] = useState<AvailableEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
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

          // Load active prompt
          const activeVersion = cfg.versions?.find((v) => v.id === cfg.activeVersionId) || cfg.versions?.[0];
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

      // Check if prompt changed
      const activeVersion = config?.versions?.find((v) => v.id === config.activeVersionId) || config?.versions?.[0];
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

      // Refresh
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
      const activeVersion = cfg.versions?.find((v) => v.id === cfg.activeVersionId) || cfg.versions?.[0];
      if (activeVersion) setPrompt(activeVersion.systemPrompt);

      const versionsRes = await fetch(`${API_URL}/api/v1/agent-configs/triage/versions`);
      setVersions((await versionsRes.json()).data || []);

      setSuccessMsg('Prompt version activated');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Group events by domain
  const eventsByDomain: Record<string, AvailableEvent[]> = {};
  for (const e of availableEvents) {
    const domainKey = e.domain;
    if (!EVENT_DOMAINS[domainKey]) continue;
    if (!eventsByDomain[domainKey]) eventsByDomain[domainKey] = [];
    eventsByDomain[domainKey].push(e);
  }

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading agent config...</h3>
      </div>
    );
  }

  const activeVersion = versions.find((v) => v.isActive) || versions[0];
  const promptChanged = activeVersion && prompt !== activeVersion.systemPrompt;

  return (
    <>
      <VnPageHeader title="Agent Configuration" subtitle="Configure AI agent prompts and behaviour">
        <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => setShowVersions(true)}>
          <span className="material-icons">history</span>
          Version History ({versions.length})
        </button>
      </VnPageHeader>

      {successMsg && <VnAlert variant="success" onClose={() => setSuccessMsg('')}>{successMsg}</VnAlert>}
      {error && <VnAlert variant="error" onClose={() => setError('')}>{error}</VnAlert>}

      {/* Enable toggle + agent info */}
      <div className="vn-card" style={{ marginBottom: 24 }}>
        <div className="vn-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="material-icons" style={{ fontSize: 32, color: 'var(--primary)' }}>smart_toy</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{config?.name || 'Triage Agent'}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                {config?.description || 'Analyzes shipment exceptions and creates issues'}
              </p>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{enabled ? 'Enabled' : 'Disabled'}</span>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--primary)' }} />
          </label>
        </div>
      </div>

      <div className="vn-detail-grid">
        {/* Main: prompt editor */}
        <div className="vn-detail-main">
          {/* System prompt */}
          <div className="vn-card">
            <div className="vn-card-header">
              <h2>System Prompt {promptChanged && <span style={{ fontSize: 12, color: 'var(--warning)', marginLeft: 8 }}>(unsaved changes)</span>}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={handlePreviewPrompt}>
                  <span className="material-icons">visibility</span>Preview
                </button>
                {activeVersion && (
                  <span style={{ fontSize: 12, color: 'var(--on-surface-variant)', alignSelf: 'center' }}>
                    v{activeVersion.versionNumber}
                  </span>
                )}
              </div>
            </div>
            <div className="vn-card-body" style={{ padding: 0 }}>
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 320,
                  border: 'none',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                  padding: 20,
                  background: 'transparent',
                  color: 'var(--on-surface)',
                }}
              />
            </div>
            {promptChanged && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--outline-variant)' }}>
                <input
                  className="vn-input"
                  placeholder="Change note (optional) - e.g. 'Made more aggressive on cold chain'"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
            )}
          </div>

          {/* Event subscriptions */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Event Subscriptions</h2></div>
            <div className="vn-card-body">
              <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 16 }}>
                Select which events trigger this agent. Unchecked events are ignored without restarting the worker.
              </p>
              {Object.entries(eventsByDomain).map(([domain, events]) => (
                <div key={domain} style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--on-surface-variant)', marginBottom: 8 }}>
                    {EVENT_DOMAINS[domain]}
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {events.map((e) => {
                      const checked = subscribedEvents.includes(e.value);
                      return (
                        <label key={e.value} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                          borderRadius: 8, cursor: 'pointer', fontSize: 13,
                          background: checked ? 'var(--primary-container)' : 'var(--surface-container)',
                          color: checked ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                          border: `1px solid ${checked ? 'var(--primary)' : 'var(--outline-variant)'}`,
                        }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (checked) setSubscribedEvents(subscribedEvents.filter((x) => x !== e.value));
                              else setSubscribedEvents([...subscribedEvents, e.value]);
                            }}
                            style={{ display: 'none' }}
                          />
                          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.value}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Advanced settings */}
          <div className="vn-card">
            <div className="vn-card-header" style={{ cursor: 'pointer' }} onClick={() => setShowAdvanced(!showAdvanced)}>
              <h2>Advanced Settings</h2>
              <span className="material-icons" style={{ color: 'var(--on-surface-variant)' }}>
                {showAdvanced ? 'expand_less' : 'expand_more'}
              </span>
            </div>
            {showAdvanced && (
              <div className="vn-card-body">
                <div className="vn-form-grid">
                  <div className="vn-field">
                    <label className="vn-field-label">Temperature ({temperature})</label>
                    <input type="range" min="0" max="1" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Lower = more deterministic, higher = more creative</span>
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Max Tokens</label>
                    <input className="vn-input" type="number" min="64" max="4096" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))} />
                    <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Maximum response length (tokens)</span>
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Confidence Threshold ({confidenceThreshold || 'Off'})</label>
                    <input type="range" min="0" max="1" step="0.05" value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Decisions below this confidence are overridden to "no action" (0 = accept all)</span>
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Deduplication Window (minutes)</label>
                    <input className="vn-input" type="number" min="1" max="1440" value={deduplicationMinutes} onChange={(e) => setDeduplicationMinutes(parseInt(e.target.value, 10))} />
                    <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Suppress duplicate decisions for the same entity within this window</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button className="vn-btn vn-btn-primary" onClick={handleSaveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Sidebar: template variables */}
        <div className="vn-detail-sidebar">
          <div className="vn-card">
            <div className="vn-card-header"><h2>Template Variables</h2></div>
            <div className="vn-card-body" style={{ padding: '12px 16px' }}>
              <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 12 }}>
                Click to insert into your prompt. These are replaced with real data at runtime.
              </p>
              {templateVars.map((v) => (
                <div key={v.name} style={{ marginBottom: 12 }}>
                  <button
                    className="vn-btn vn-btn-outline vn-btn-sm"
                    style={{ fontFamily: 'monospace', marginBottom: 4, width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => insertVariable(v.name)}
                  >
                    <span className="material-icons" style={{ fontSize: 14 }}>add</span>
                    {v.name}
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--on-surface-variant)', margin: '2px 0 0 4px', lineHeight: 1.4 }}>
                    {v.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      <VnModal open={showPreview} onClose={() => setShowPreview(false)} title="Prompt Preview (with sample data)" size="lg">
        <pre style={{
          background: 'var(--surface-container)',
          padding: 16,
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          maxHeight: 500,
          overflow: 'auto',
        }}>
          {previewContent}
        </pre>
      </VnModal>

      {/* Version history modal */}
      <VnModal open={showVersions} onClose={() => setShowVersions(false)} title="Prompt Version History" size="lg">
        {versions.length === 0 ? (
          <p style={{ color: 'var(--on-surface-variant)' }}>No versions yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {versions.map((v) => (
              <div key={v.id} style={{
                padding: 16,
                borderRadius: 8,
                background: v.isActive ? 'var(--primary-container)' : 'var(--surface-container)',
                border: v.isActive ? '1px solid var(--primary)' : '1px solid var(--outline-variant)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>Version {v.versionNumber}</span>
                    {v.isActive && <span className="vn-chip vn-chip-primary" style={{ fontSize: 11 }}>Active</span>}
                  </div>
                  {!v.isActive && (
                    <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => activateVersion(v.id)}>
                      Activate
                    </button>
                  )}
                </div>
                {v.changeNote && <p style={{ fontSize: 13, margin: '0 0 4px', color: 'var(--on-surface)' }}>{v.changeNote}</p>}
                <p style={{ fontSize: 11, color: 'var(--on-surface-variant)', margin: 0 }}>
                  {new Date(v.createdAt).toLocaleString()} {v.createdBy ? `by ${v.createdBy}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </VnModal>
    </>
  );
}
