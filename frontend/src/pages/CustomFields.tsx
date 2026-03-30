import { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface FieldDefinition {
  id?: string;
  fieldKey: string;
  label: string;
  description?: string;
  fieldType: string;
  required: boolean;
  defaultValue?: string;
  config?: Record<string, any>;
  displayOrder: number;
}

interface FieldVersion {
  id: string;
  entityType: string;
  version: number;
  description?: string;
  active: boolean;
  createdAt: string;
  fields?: FieldDefinition[];
}

const ENTITY_TYPES = ['shipment', 'order', 'carrier', 'customer', 'location'];
const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'decimal', label: 'Decimal Number' },
  { value: 'integer', label: 'Whole Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'list', label: 'Single Select List' },
  { value: 'multi_list', label: 'Multi Select List' },
];

export default function CustomFields() {
  const [entityType, setEntityType] = useState('shipment');
  const [activeVersion, setActiveVersion] = useState<FieldVersion | null>(null);
  const [versions, setVersions] = useState<FieldVersion[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadVersion();
    loadVersionHistory();
  }, [entityType]);

  const loadVersion = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/custom-fields/${entityType}`);
      const result = await res.json();
      setActiveVersion(result.data);
      if (result.data?.fields) {
        setFields(result.data.fields.map((f: FieldDefinition) => ({ ...f })));
      } else {
        setFields([]);
      }
    } catch {
      setError('Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  };

  const loadVersionHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/custom-fields/${entityType}/versions`);
      const result = await res.json();
      setVersions(result.data || []);
    } catch { /* non-critical */ }
  };

  const addField = () => {
    setFields([...fields, {
      fieldKey: '',
      label: '',
      fieldType: 'text',
      required: false,
      displayOrder: fields.length,
    }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FieldDefinition>) => {
    setFields(fields.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const handleSave = async () => {
    // Validation
    for (const f of fields) {
      if (!f.fieldKey || !f.label) {
        setError('All fields must have a key and label');
        return;
      }
      if (!/^[a-z][a-z0-9_]*$/.test(f.fieldKey)) {
        setError(`Field key "${f.fieldKey}" must be lowercase with underscores only`);
        return;
      }
      if ((f.fieldType === 'list' || f.fieldType === 'multi_list') && (!f.config?.options || f.config.options.length === 0)) {
        setError(`List field "${f.label}" must have at least one option`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${API_URL}/api/v1/custom-fields/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          description: description || undefined,
          fields: fields.map((f, i) => ({
            fieldKey: f.fieldKey,
            label: f.label,
            description: f.description || undefined,
            fieldType: f.fieldType,
            required: f.required,
            defaultValue: f.defaultValue || undefined,
            config: f.config || undefined,
            displayOrder: i,
          })),
        }),
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setEditing(false);
        setDescription('');
        loadVersion();
        loadVersionHistory();
      }
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
        <h2>Custom Fields</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
          <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setEditing(false); }} className="input" style={{ width: 'auto' }}>
            {ENTITY_TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          {!editing && (
            <button className="button" onClick={() => setEditing(true)}>
              Edit Fields
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-2)' }}>New version published successfully</div>}

      {loading ? (
        <div className="card"><p>Loading...</p></div>
      ) : editing ? (
        <div className="card">
          <h3>Edit Custom Fields for {entityType.charAt(0).toUpperCase() + entityType.slice(1)}</h3>
          <p className="text-muted" style={{ marginBottom: 'var(--spacing-2)' }}>
            Changes create a new version. Existing records keep their original field definitions.
          </p>

          <div className="input-wrapper" style={{ marginBottom: 'var(--spacing-3)' }}>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder=" "
            />
            <label>Change description (e.g., "Added invoice number field")</label>
          </div>

          {fields.map((field, index) => (
            <div key={index} style={{ border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-md)', padding: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-1)' }}>
                <strong>Field #{index + 1}</strong>
                <button className="button button-outline" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => removeField(index)}>Remove</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-1)' }}>
                <div className="input-wrapper">
                  <input className="input" value={field.fieldKey} onChange={(e) => updateField(index, { fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} placeholder=" " />
                  <label>Key (e.g., invoice_number)</label>
                </div>
                <div className="input-wrapper">
                  <input className="input" value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} placeholder=" " />
                  <label>Label</label>
                </div>
                <div className="input-wrapper">
                  <select className="input" value={field.fieldType} onChange={(e) => updateField(index, { fieldType: e.target.value, config: undefined })}>
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <label>Type</label>
                </div>
                <div className="input-wrapper">
                  <input className="input" value={field.defaultValue || ''} onChange={(e) => updateField(index, { defaultValue: e.target.value })} placeholder=" " />
                  <label>Default Value</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                  <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} />
                  <span>Required</span>
                </div>
              </div>

              {/* Type-specific config */}
              {field.fieldType === 'text' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-1)', marginTop: 'var(--spacing-1)' }}>
                  <div className="input-wrapper">
                    <input className="input" type="number" value={field.config?.minLength || ''} onChange={(e) => updateField(index, { config: { ...field.config, minLength: e.target.value ? Number(e.target.value) : undefined } })} placeholder=" " />
                    <label>Min Length</label>
                  </div>
                  <div className="input-wrapper">
                    <input className="input" type="number" value={field.config?.maxLength || ''} onChange={(e) => updateField(index, { config: { ...field.config, maxLength: e.target.value ? Number(e.target.value) : undefined } })} placeholder=" " />
                    <label>Max Length</label>
                  </div>
                  <div className="input-wrapper">
                    <input className="input" value={field.config?.formatMask || ''} onChange={(e) => updateField(index, { config: { ...field.config, formatMask: e.target.value || undefined } })} placeholder=" " />
                    <label>Format Mask</label>
                  </div>
                </div>
              )}
              {(field.fieldType === 'decimal' || field.fieldType === 'integer') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' + (field.fieldType === 'decimal' ? ' 1fr' : ''), gap: 'var(--spacing-1)', marginTop: 'var(--spacing-1)' }}>
                  <div className="input-wrapper">
                    <input className="input" type="number" value={field.config?.minValue ?? ''} onChange={(e) => updateField(index, { config: { ...field.config, minValue: e.target.value !== '' ? Number(e.target.value) : undefined } })} placeholder=" " />
                    <label>Min Value</label>
                  </div>
                  <div className="input-wrapper">
                    <input className="input" type="number" value={field.config?.maxValue ?? ''} onChange={(e) => updateField(index, { config: { ...field.config, maxValue: e.target.value !== '' ? Number(e.target.value) : undefined } })} placeholder=" " />
                    <label>Max Value</label>
                  </div>
                  {field.fieldType === 'decimal' && (
                    <div className="input-wrapper">
                      <input className="input" type="number" value={field.config?.decimalPlaces ?? ''} onChange={(e) => updateField(index, { config: { ...field.config, decimalPlaces: e.target.value !== '' ? Number(e.target.value) : undefined } })} placeholder=" " />
                      <label>Decimal Places</label>
                    </div>
                  )}
                </div>
              )}
              {(field.fieldType === 'list' || field.fieldType === 'multi_list') && (
                <div style={{ marginTop: 'var(--spacing-1)' }}>
                  <div className="input-wrapper">
                    <input
                      className="input"
                      value={(field.config?.options || []).join(', ')}
                      onChange={(e) => updateField(index, { config: { ...field.config, options: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) } })}
                      placeholder=" "
                    />
                    <label>Options (comma-separated)</label>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
            <button className="button button-outline" onClick={addField}>+ Add Field</button>
            <div style={{ flex: 1 }} />
            <button className="button button-outline" onClick={() => { setEditing(false); loadVersion(); }}>Cancel</button>
            <button className="button" onClick={handleSave} disabled={saving || fields.length === 0}>
              {saving ? 'Publishing...' : 'Publish New Version'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <h3>
            Current Fields for {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
            {activeVersion && <span className="chip chip-primary" style={{ marginLeft: 8 }}>v{activeVersion.version}</span>}
          </h3>
          {!activeVersion || !activeVersion.fields?.length ? (
            <p className="text-muted">No custom fields defined for this entity type.</p>
          ) : (
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Default</th>
                  <th>Config</th>
                </tr>
              </thead>
              <tbody>
                {activeVersion.fields.map((f) => (
                  <tr key={f.fieldKey}>
                    <td><code>{f.fieldKey}</code></td>
                    <td>{f.label}</td>
                    <td><span className="chip">{FIELD_TYPES.find(t => t.value === f.fieldType)?.label || f.fieldType}</span></td>
                    <td>{f.required ? 'Yes' : ''}</td>
                    <td>{f.defaultValue || '-'}</td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {f.config && Object.keys(f.config).length > 0
                        ? Object.entries(f.config).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
                        : '-'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Version History */}
      {versions.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--spacing-3)' }}>
          <h3>Version History</h3>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Version</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td>v{v.version}</td>
                  <td>{v.description || '-'}</td>
                  <td>{v.active ? <span className="chip chip-success">Active</span> : <span className="chip">Inactive</span>}</td>
                  <td>{new Date(v.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
