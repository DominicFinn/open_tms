import { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface CustomField {
  id?: string;
  fieldKey: string;
  label: string;
  description: string;
  fieldType: string;
  required: boolean;
  defaultValue: string;
  config: any;
  displayOrder: number;
}

interface CustomFieldVersion {
  id: string;
  entityType: string;
  version: number;
  active: boolean;
  description: string | null;
  fields: CustomField[];
  createdAt: string;
}

const ENTITY_TYPES = [
  { key: 'shipment', label: 'Shipment', icon: 'local_shipping' },
  { key: 'order', label: 'Order', icon: 'receipt_long' },
  { key: 'carrier', label: 'Carrier', icon: 'airport_shuttle' },
  { key: 'customer', label: 'Customer', icon: 'people' },
  { key: 'location', label: 'Location', icon: 'place' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'integer', label: 'Integer' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'list', label: 'List' },
  { value: 'multi_list', label: 'Multi-List' },
];

const emptyField: CustomField = {
  fieldKey: '',
  label: '',
  description: '',
  fieldType: 'text',
  required: false,
  defaultValue: '',
  config: null,
  displayOrder: 0,
};

export default function VNextCustomFields() {
  const [activeTab, setActiveTab] = useState('shipment');
  const [currentVersion, setCurrentVersion] = useState<CustomFieldVersion | null>(null);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [versions, setVersions] = useState<CustomFieldVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState<CustomField>({ ...emptyField });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  async function loadData(entityType: string) {
    setLoading(true);
    setError('');
    try {
      const [fieldsRes, versionsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/custom-fields/${entityType}`),
        fetch(`${API_URL}/api/v1/custom-fields/${entityType}/versions`),
      ]);
      if (!fieldsRes.ok) throw new Error('Failed to load custom fields');
      const fieldsJson = await fieldsRes.json();
      const current = fieldsJson.data || null;
      setCurrentVersion(current);
      setFields(current?.fields || []);

      if (versionsRes.ok) {
        const versionsJson = await versionsRes.json();
        setVersions(versionsJson.data || []);
      } else {
        setVersions([]);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  }

  function addField() {
    if (!newField.fieldKey.trim() || !newField.label.trim()) {
      setError('Field Key and Label are required');
      return;
    }
    if (fields.some(f => f.fieldKey === newField.fieldKey.trim())) {
      setError('Field Key must be unique');
      return;
    }
    setFields(prev => [
      ...prev,
      { ...newField, fieldKey: newField.fieldKey.trim(), label: newField.label.trim(), displayOrder: newField.displayOrder || prev.length + 1 },
    ]);
    setNewField({ ...emptyField });
    setShowAddField(false);
    setError('');
  }

  function removeField(idx: number) {
    setFields(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveVersion() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body = {
        entityType: activeTab,
        description: 'Updated fields',
        fields: fields.map((f, i) => ({
          fieldKey: f.fieldKey,
          label: f.label,
          description: f.description || '',
          fieldType: f.fieldType,
          required: f.required,
          defaultValue: f.defaultValue || '',
          config: f.config || null,
          displayOrder: f.displayOrder || i + 1,
        })),
      };
      const res = await fetch(`${API_URL}/api/v1/custom-fields/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to save version');
      }
      setSuccess('Custom fields version saved successfully');
      await loadData(activeTab);
    } catch (e: any) {
      setError(e.message || 'Failed to save version');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Custom Fields</h1>
          <p>Define custom fields for each entity type</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary" onClick={saveVersion} disabled={saving}>
            <span className="material-icons">save</span>
            {saving ? 'Saving...' : 'Save Version'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="vn-btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setError('')}>
            <span className="material-icons" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {success}
          <button className="vn-btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setSuccess('')}>
            <span className="material-icons" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      )}

      {/* Entity Type Tabs */}
      <div className="vn-tabs" style={{ marginBottom: 24 }}>
        {ENTITY_TYPES.map(et => (
          <button
            key={et.key}
            className={`vn-tab ${activeTab === et.key ? 'active' : ''}`}
            onClick={() => setActiveTab(et.key)}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>{et.icon}</span>
            {et.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <>
          {/* Current Fields */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header">
              <h2>
                {ENTITY_TYPES.find(e => e.key === activeTab)?.label} Fields
                {currentVersion && (
                  <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--on-surface-variant)', marginLeft: 8 }}>
                    (Version {currentVersion.version})
                  </span>
                )}
              </h2>
              <button className="vn-btn vn-btn-outline" onClick={() => { setShowAddField(true); setNewField({ ...emptyField, displayOrder: fields.length + 1 }); }}>
                <span className="material-icons">add</span>
                Add Field
              </button>
            </div>
            <div className="vn-card-body" style={{ padding: 0 }}>
              {fields.length === 0 ? (
                <div className="vn-empty">
                  <span className="material-icons">input</span>
                  <h3>No custom fields defined</h3>
                  <p>Add fields to extend this entity type.</p>
                </div>
              ) : (
                <div className="vn-table-wrap">
                  <table className="vn-table">
                    <thead>
                      <tr>
                        <th>Field Key</th>
                        <th>Label</th>
                        <th>Type</th>
                        <th>Required</th>
                        <th>Default Value</th>
                        <th>Order</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f, idx) => (
                        <tr key={f.fieldKey + idx}>
                          <td>
                            <code style={{
                              fontFamily: 'monospace',
                              fontSize: 12,
                              background: 'var(--surface-container)',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}>
                              {f.fieldKey}
                            </code>
                          </td>
                          <td style={{ fontWeight: 500 }}>{f.label}</td>
                          <td>
                            <span className="vn-chip primary">
                              {FIELD_TYPES.find(ft => ft.value === f.fieldType)?.label || f.fieldType}
                            </span>
                          </td>
                          <td>
                            {f.required && (
                              <span className="material-icons" style={{ fontSize: 20, color: 'var(--primary)' }}>
                                check_circle
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                            {f.defaultValue || ''}
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                            {f.displayOrder}
                          </td>
                          <td>
                            <button className="vn-btn-icon" title="Remove" onClick={() => removeField(idx)}>
                              <span className="material-icons" style={{ fontSize: 18, color: 'var(--error)' }}>delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Add Field Form */}
          {showAddField && (
            <div className="vn-card" style={{ marginBottom: 24 }}>
              <div className="vn-card-header">
                <h2>Add Field</h2>
              </div>
              <div className="vn-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                      Field Key *
                    </label>
                    <input
                      className="vn-input"
                      value={newField.fieldKey}
                      onChange={e => setNewField(f => ({ ...f, fieldKey: e.target.value }))}
                      placeholder="e.g. custom_weight"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                      Label *
                    </label>
                    <input
                      className="vn-input"
                      value={newField.label}
                      onChange={e => setNewField(f => ({ ...f, label: e.target.value }))}
                      placeholder="e.g. Custom Weight"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                      Field Type
                    </label>
                    <select
                      className="vn-input"
                      value={newField.fieldType}
                      onChange={e => setNewField(f => ({ ...f, fieldType: e.target.value }))}
                      style={{ width: '100%' }}
                    >
                      {FIELD_TYPES.map(ft => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                      Description
                    </label>
                    <input
                      className="vn-input"
                      value={newField.description}
                      onChange={e => setNewField(f => ({ ...f, description: e.target.value }))}
                      placeholder="Field description"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                      Default Value
                    </label>
                    <input
                      className="vn-input"
                      value={newField.defaultValue}
                      onChange={e => setNewField(f => ({ ...f, defaultValue: e.target.value }))}
                      placeholder="Default value"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                      Display Order
                    </label>
                    <input
                      className="vn-input"
                      type="number"
                      value={newField.displayOrder}
                      onChange={e => setNewField(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--on-surface)', cursor: 'pointer', marginTop: 20 }}>
                      <input
                        type="checkbox"
                        checked={newField.required}
                        onChange={e => setNewField(f => ({ ...f, required: e.target.checked }))}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      Required
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button className="vn-btn vn-btn-outline" onClick={() => setShowAddField(false)}>Cancel</button>
                  <button className="vn-btn vn-btn-primary" onClick={addField}>
                    <span className="material-icons">add</span>
                    Add Field
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Version History */}
          <div className="vn-card">
            <div className="vn-card-header">
              <h2>Version History</h2>
            </div>
            <div className="vn-card-body" style={{ padding: 0 }}>
              {versions.length === 0 ? (
                <div className="vn-empty">
                  <span className="material-icons">history</span>
                  <h3>No version history</h3>
                  <p>Versions will appear here after saving custom fields.</p>
                </div>
              ) : (
                <div className="vn-table-wrap">
                  <table className="vn-table">
                    <thead>
                      <tr>
                        <th>Version</th>
                        <th>Status</th>
                        <th>Fields</th>
                        <th>Description</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map(v => (
                        <tr key={v.id}>
                          <td style={{ fontWeight: 500 }}>v{v.version}</td>
                          <td>
                            <span className={`vn-chip ${v.active ? 'success' : 'secondary'}`}>
                              {v.active ? 'Active' : 'Previous'}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                            {v.fields?.length || 0} fields
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                            {v.description || ''}
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                            {v.createdAt ? new Date(v.createdAt).toLocaleString() : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
