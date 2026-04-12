import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import { VnPageHeader, VnAlert, VnModal, VnChip } from './components';

interface SkillDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  fields: { key: string; label: string; type: string; required: boolean; placeholder?: string }[];
  configSchema: { key: string; label: string; type: string; required: boolean; placeholder?: string }[];
  requiresConfig: boolean;
}

interface SkillConfig {
  id: string;
  skillType: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export default function VNextSkillsConfig() {
  const [definitions, setDefinitions] = useState<SkillDefinition[]>([]);
  const [configs, setConfigs] = useState<SkillConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Config form
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [configSkillType, setConfigSkillType] = useState('');
  const [configName, setConfigName] = useState('');
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const [defsRes, configsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/skills`),
        fetch(`${API_URL}/api/v1/skill-configs`),
      ]);
      const defsJson = await defsRes.json();
      const configsJson = await configsRes.json();
      setDefinitions(defsJson.data || []);
      setConfigs(configsJson.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  function openConfigForm(skillType: string) {
    const def = definitions.find((d) => d.type === skillType);
    setConfigSkillType(skillType);
    setConfigName(def?.name || skillType);
    setConfigValues({});
    setShowConfigForm(true);
  }

  async function saveConfig() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/skill-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillType: configSkillType,
          name: configName,
          config: configValues,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setShowConfigForm(false);
      await loadData();
      setSuccessMsg('Skill configured');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteConfig(id: string) {
    await fetch(`${API_URL}/api/v1/skill-configs/${id}`, { method: 'DELETE' });
    await loadData();
    setSuccessMsg('Configuration deleted');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  const configuredTypes = new Set(configs.map((c) => c.skillType));

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading skills...</h3>
      </div>
    );
  }

  const selectedDef = definitions.find((d) => d.type === configSkillType);

  return (
    <>
      <VnPageHeader title="Skills Configuration" subtitle="Configure available skills for automation rules and chains" />

      {successMsg && <VnAlert variant="success" onClose={() => setSuccessMsg('')}>{successMsg}</VnAlert>}
      {error && <VnAlert variant="error" onClose={() => setError('')}>{error}</VnAlert>}

      {/* Available skills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {definitions.map((def) => {
          const isConfigured = !def.requiresConfig || configuredTypes.has(def.type);
          const skillConfigs = configs.filter((c) => c.skillType === def.type);

          return (
            <div key={def.type} className="vn-card">
              <div className="vn-card-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isConfigured ? 'var(--success-container)' : 'var(--surface-container-high)',
                    color: isConfigured ? 'var(--on-success-container)' : 'var(--on-surface-variant)',
                  }}>
                    <span className="material-icons">{def.icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 15 }}>{def.name}</h3>
                      <VnChip variant={isConfigured ? 'success' : 'secondary'}>
                        {isConfigured ? 'Ready' : 'Needs setup'}
                      </VnChip>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--on-surface-variant)' }}>{def.description}</p>
                  </div>
                </div>

                {/* Fields preview */}
                <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 12 }}>
                  <strong>Fields:</strong> {def.fields.map((f) => f.label).join(', ') || 'None'}
                </div>

                {/* Existing configs */}
                {skillConfigs.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {skillConfigs.map((sc) => (
                      <div key={sc.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 10px', background: 'var(--surface-container)', borderRadius: 6, marginBottom: 4, fontSize: 13,
                      }}>
                        <span>{sc.name}</span>
                        <button className="vn-btn-icon" onClick={() => deleteConfig(sc.id)}>
                          <span className="material-icons" style={{ fontSize: 16 }}>close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {def.requiresConfig && (
                  <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ width: '100%' }} onClick={() => openConfigForm(def.type)}>
                    <span className="material-icons">add</span>
                    {skillConfigs.length > 0 ? 'Add Another Config' : 'Configure'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Config form modal */}
      <VnModal
        open={showConfigForm}
        onClose={() => setShowConfigForm(false)}
        title={`Configure ${selectedDef?.name || configSkillType}`}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => setShowConfigForm(false)}>Cancel</button>
            <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={saveConfig} disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        }
      >
        <div className="vn-field" style={{ marginBottom: 16 }}>
          <label className="vn-field-label">Configuration Name</label>
          <input className="vn-input" value={configName} onChange={(e) => setConfigName(e.target.value)} placeholder="e.g. Ops Webhook" />
        </div>

        {selectedDef?.configSchema.map((field) => (
          <div key={field.key} className="vn-field" style={{ marginBottom: 16 }}>
            <label className="vn-field-label">{field.label} {field.required && '*'}</label>
            <input
              className="vn-input"
              type={field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text'}
              placeholder={field.placeholder}
              value={configValues[field.key] || ''}
              onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
            />
          </div>
        ))}
      </VnModal>
    </>
  );
}
