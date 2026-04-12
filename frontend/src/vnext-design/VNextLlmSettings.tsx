import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import { VnPageHeader, VnAlert, VnInfoGrid } from './components';

interface LlmConfig {
  llmProvider: string | null;
  llmModel: string | null;
  llmEnabled: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  envConfigured: boolean;
}

export default function VNextLlmSettings() {
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
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
      // Only send API key if user entered a new one
      if (apiKey) {
        body.llmApiKey = apiKey;
      }

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
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading settings...</h3>
      </div>
    );
  }

  return (
    <>
      <VnPageHeader title="AI / LLM Settings" subtitle="Configure the AI provider for agent features" />

      {successMsg && <VnAlert variant="success" onClose={() => setSuccessMsg('')}>{successMsg}</VnAlert>}
      {error && <VnAlert variant="error" onClose={() => setError('')}>{error}</VnAlert>}

      {/* Status card */}
      <div className="vn-card" style={{ marginBottom: 24 }}>
        <div className="vn-card-header"><h2>Current Status</h2></div>
        <div className="vn-card-body">
          <VnInfoGrid items={[
            {
              label: 'AI Agents',
              value: config?.llmEnabled
                ? <span className="vn-chip vn-chip-success">Enabled</span>
                : <span className="vn-chip vn-chip-secondary">Disabled</span>,
            },
            {
              label: 'API Key',
              value: config?.hasApiKey
                ? <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{config.apiKeyMasked}</span>
                : <span style={{ color: 'var(--on-surface-variant)' }}>Not configured</span>,
            },
            {
              label: 'Environment Override',
              value: config?.envConfigured
                ? <span className="vn-chip vn-chip-info">ANTHROPIC_API_KEY set</span>
                : <span style={{ color: 'var(--on-surface-variant)' }}>Not set</span>,
            },
            {
              label: 'Provider',
              value: config?.llmProvider
                ? <span style={{ textTransform: 'capitalize' }}>{config.llmProvider}</span>
                : '-',
            },
            {
              label: 'Model',
              value: config?.llmModel || 'Default (claude-sonnet-4-20250514)',
            },
          ]} />
        </div>
      </div>

      {config?.envConfigured && (
        <div className="vn-alert vn-alert-info" style={{ marginBottom: 24 }}>
          <span className="material-icons">info</span>
          <div className="vn-alert-content">
            The <code>ANTHROPIC_API_KEY</code> environment variable is set. The agent will use the env var unless you configure a key here, which takes priority.
          </div>
        </div>
      )}

      {/* Configuration form */}
      <div className="vn-card">
        <div className="vn-card-header"><h2>Configuration</h2></div>
        <div className="vn-card-body">
          <div className="vn-form-grid">
            <div className="vn-field">
              <label className="vn-field-label">Provider</label>
              <select className="vn-input" value={provider} onChange={e => setProvider(e.target.value)}>
                <option value="anthropic">Anthropic (Claude)</option>
              </select>
              <span className="field-hint" style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                More providers coming soon
              </span>
            </div>

            <div className="vn-field">
              <label className="vn-field-label">Model Override (optional)</label>
              <input
                className="vn-input"
                placeholder="claude-sonnet-4-20250514"
                value={model}
                onChange={e => setModel(e.target.value)}
              />
              <span className="field-hint" style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                Leave blank for default model
              </span>
            </div>

            <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
              <label className="vn-field-label">API Key</label>
              <input
                className="vn-input"
                type="password"
                placeholder={config?.hasApiKey ? 'Key is set - enter new key to replace' : 'sk-ant-...'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <span className="field-hint" style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                Your API key is stored securely and never exposed in API responses. You are responsible for your own API costs.
              </span>
            </div>

            <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e => setEnabled(e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>Enable AI Agents</div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                    When enabled, the triage agent will process shipment exceptions, SLA breaches, and other events
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end' }}>
            <button className="vn-btn vn-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Cost warning */}
      <div className="vn-alert vn-alert-warning" style={{ marginTop: 24 }}>
        <span className="material-icons">payments</span>
        <div className="vn-alert-content">
          <strong>Cost awareness:</strong> AI agents make LLM API calls that cost money. Each invocation typically uses 500-2,000 tokens. Monitor usage on the Agent Decisions page and set appropriate event filters to control volume.
        </div>
      </div>
    </>
  );
}
