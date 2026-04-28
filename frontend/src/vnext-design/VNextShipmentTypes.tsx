import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';
import { SHIPMENT_FIELD_LABELS } from '../shared/shipmentTypeValidator';

interface ShipmentType {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  defaults: Record<string, unknown>;
  requiredFields: string[];
  isBuiltIn: boolean;
  archived: boolean;
}

// Curated set of Material Icons that are meaningful for shipping templates.
const ICON_CHOICES = [
  'local_shipping', 'ac_unit', 'warning', 'inventory_2', 'flight', 'directions_boat',
  'train', 'medical_services', 'emergency', 'pets', 'restaurant', 'science',
  'bolt', 'eco', 'local_fire_department', 'water_drop', 'hub', 'construction',
];

const COLOR_CHOICES = [
  '#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#64748B',
];

const SELECTABLE_FIELDS = [
  'customerId', 'originId', 'destinationId',
  'pickupDate', 'deliveryDate',
  'pickupWindowStart', 'pickupWindowEnd',
  'deliveryWindowStart', 'deliveryWindowEnd',
  'proNumber', 'reference', 'carrierId', 'laneId',
];

interface Option { id: string; name: string; }

export default function VNextShipmentTypes() {
  const [rows, setRows] = useState<ShipmentType[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShipmentType | null>(null);
  const [error, setError] = useState('');

  const emptyForm = {
    name: '', icon: 'local_shipping', color: '#6366F1', description: '',
    defaultCustomerId: '', defaultOriginId: '', defaultDestinationId: '',
    requiredFields: ['customerId', 'originId', 'destinationId'] as string[],
  };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/shipment-types`)
      .then(r => r.json())
      .then(json => setRows(json.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch(`${API_URL}/api/v1/customers`).then(r => r.json()).then(j => setCustomers(j.data || [])).catch(() => {});
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json()).then(j => setLocations(j.data || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (t: ShipmentType) => {
    setEditing(t);
    const d = t.defaults || {};
    setForm({
      name: t.name,
      icon: t.icon,
      color: t.color,
      description: t.description ?? '',
      defaultCustomerId: (d.customerId as string) || '',
      defaultOriginId: (d.originId as string) || '',
      defaultDestinationId: (d.destinationId as string) || '',
      requiredFields: t.requiredFields,
    });
    setError('');
    setShowForm(true);
  };

  const toggleRequired = (field: string) => {
    setForm(f => ({
      ...f,
      requiredFields: f.requiredFields.includes(field)
        ? f.requiredFields.filter(x => x !== field)
        : [...f.requiredFields, field],
    }));
  };

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('Name is required'); return; }
    const defaults: Record<string, unknown> = {};
    if (form.defaultCustomerId) defaults.customerId = form.defaultCustomerId;
    if (form.defaultOriginId) defaults.originId = form.defaultOriginId;
    if (form.defaultDestinationId) defaults.destinationId = form.defaultDestinationId;

    const payload: any = {
      name: form.name.trim(),
      icon: form.icon,
      color: form.color,
      description: form.description || undefined,
      defaults,
      requiredFields: form.requiredFields,
    };
    const url = editing ? `${API_URL}/api/v1/shipment-types/${editing.id}` : `${API_URL}/api/v1/shipment-types`;
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.error) { setError(data.error); return; }
    setShowForm(false);
    load();
  };

  const handleDelete = async (t: ShipmentType) => {
    if (t.isBuiltIn) return;
    if (!confirm(`Archive shipment type "${t.name}"? Existing shipments that use it will keep their reference but new shipments will no longer see it.`)) return;
    const res = await fetch(`${API_URL}/api/v1/shipment-types/${t.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    load();
  };

  const defaultsLabel = (d: Record<string, unknown>): string => {
    const keys = Object.keys(d || {});
    if (keys.length === 0) return '—';
    return keys.map(k => SHIPMENT_FIELD_LABELS[k] || k).join(', ');
  };

  const builtInCount = useMemo(() => rows.filter(r => r.isBuiltIn).length, [rows]);

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Shipment Types</h1>
          <p>Templates that pre-decide required fields, default values, and icon. {rows.length} total · {builtInCount} built-in.</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary" onClick={openCreate}>
            <span className="material-icons">add</span>
            New Type
          </button>
        </div>
      </div>

      {loading ? (
        <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>
      ) : (
        <div className="vn-card">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Icon</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Required fields</th>
                  <th>Pre-filled defaults</th>
                  <th style={{ width: 80 }}>Built-in</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--on-surface-variant)' }}>No shipment types yet.</td></tr>
                )}
                {rows.map(t => (
                  <tr key={t.id}>
                    <td>
                      <span
                        className="material-icons"
                        style={{ color: t.color, fontSize: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        title={t.icon}
                      >{t.icon}</span>
                    </td>
                    <td><strong>{t.name}</strong></td>
                    <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{t.description || '—'}</td>
                    <td style={{ fontSize: 13 }}>
                      {t.requiredFields.length === 0 ? '—' : t.requiredFields.map(f => SHIPMENT_FIELD_LABELS[f] || f).join(', ')}
                    </td>
                    <td style={{ fontSize: 13 }}>{defaultsLabel(t.defaults || {})}</td>
                    <td>{t.isBuiltIn ? <span className="vn-chip vn-chip-secondary">Built-in</span> : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => openEdit(t)}>
                          <span className="material-icons" style={{ fontSize: 18 }}>edit</span>
                        </button>
                        {!t.isBuiltIn && (
                          <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => handleDelete(t)}>
                            <span className="material-icons" style={{ fontSize: 18 }}>archive</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="vn-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="vn-modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="vn-modal-header">
              <h2>{editing ? 'Edit Shipment Type' : 'New Shipment Type'}</h2>
              <button className="vn-btn-icon" onClick={() => setShowForm(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="vn-modal-body">
              {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 12 }}>{error}</div>}

              <div className="vn-form-section">
                <div className="vn-form-grid">
                  <div className="vn-field">
                    <label className="vn-field-label">Name</label>
                    <input className="vn-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekly Dallas Reefer" />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Description</label>
                    <input className="vn-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
                  </div>
                </div>
              </div>

              <div className="vn-form-section">
                <h3 className="vn-form-section-title"><span className="material-icons">palette</span>Icon &amp; Color</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {ICON_CHOICES.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setForm(f => ({ ...f, icon }))}
                      title={icon}
                      style={{
                        width: 48, height: 48, borderRadius: 8,
                        border: `2px solid ${form.icon === icon ? form.color : 'var(--outline-variant)'}`,
                        background: form.icon === icon ? `${form.color}20` : 'var(--surface-container-lowest)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <span className="material-icons" style={{ color: form.icon === icon ? form.color : 'var(--on-surface-variant)' }}>{icon}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {COLOR_CHOICES.map(color => (
                    <button
                      key={color}
                      onClick={() => setForm(f => ({ ...f, color }))}
                      title={color}
                      style={{
                        width: 32, height: 32, borderRadius: '50%', background: color,
                        border: form.color === color ? '3px solid var(--on-surface)' : '2px solid var(--outline-variant)',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="vn-form-section">
                <h3 className="vn-form-section-title"><span className="material-icons">auto_awesome</span>Default values</h3>
                <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 0 }}>
                  Pre-fill the new shipment form with these values. The user can still change them.
                </p>
                <div className="vn-form-grid">
                  <div className="vn-field">
                    <label className="vn-field-label">Default customer</label>
                    <select className="vn-select" value={form.defaultCustomerId} onChange={e => setForm(f => ({ ...f, defaultCustomerId: e.target.value }))}>
                      <option value="">— none —</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Default origin</label>
                    <select className="vn-select" value={form.defaultOriginId} onChange={e => setForm(f => ({ ...f, defaultOriginId: e.target.value }))}>
                      <option value="">— none —</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Default destination</label>
                    <select className="vn-select" value={form.defaultDestinationId} onChange={e => setForm(f => ({ ...f, defaultDestinationId: e.target.value }))}>
                      <option value="">— none —</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="vn-form-section">
                <h3 className="vn-form-section-title"><span className="material-icons">rule</span>Required fields</h3>
                <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 0 }}>
                  These must be filled for a shipment of this type to leave draft. Users can still save drafts with missing fields.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {SELECTABLE_FIELDS.map(field => (
                    <label key={field} className="vn-checkbox" style={{ flex: '0 0 auto' }}>
                      <input
                        type="checkbox"
                        checked={form.requiredFields.includes(field)}
                        onChange={() => toggleRequired(field)}
                      />
                      {SHIPMENT_FIELD_LABELS[field] || field}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={handleSave}>
                <span className="material-icons">save</span>
                {editing ? 'Save changes' : 'Create type'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
