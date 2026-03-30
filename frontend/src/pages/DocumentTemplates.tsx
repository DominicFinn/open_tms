import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface Template {
  id: string;
  name: string;
  documentType: string;
  description?: string;
  htmlTemplate: string;
  config?: any;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  bol: 'Bill of Lading',
  label: 'Shipping Label',
  customs: 'Customs Form',
  daily_report: 'Daily Report',
};

export default function DocumentTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('bol');
  const [formDescription, setFormDescription] = useState('');
  const [formHtml, setFormHtml] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/document-templates`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setTemplates(result.data || []);
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormType('bol');
    setFormDescription('');
    setFormHtml('');
    setFormIsDefault(false);
    setEditing(null);
    setCreating(false);
  };

  const startEdit = (t: Template) => {
    setEditing(t);
    setCreating(false);
    setFormName(t.name);
    setFormType(t.documentType);
    setFormDescription(t.description || '');
    setFormHtml(t.htmlTemplate);
    setFormIsDefault(t.isDefault);
  };

  const handleSave = async () => {
    try {
      const body = {
        name: formName,
        documentType: formType,
        description: formDescription || undefined,
        htmlTemplate: formHtml,
        isDefault: formIsDefault,
      };

      if (editing) {
        const response = await fetch(`${API_URL}/api/v1/document-templates/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (result.error) throw new Error(result.error);
      } else {
        const response = await fetch(`${API_URL}/api/v1/document-templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (result.error) throw new Error(result.error);
      }

      resetForm();
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await fetch(`${API_URL}/api/v1/document-templates/${id}`, { method: 'DELETE' });
      loadTemplates();
    } catch (err) {
      setError('Failed to delete template');
    }
  };

  const showForm = creating || editing;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>Document Templates</h1>
        {!showForm && (
          <button onClick={() => { resetForm(); setCreating(true); }}
            style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', background: 'var(--md-primary)', color: 'var(--md-on-primary)', cursor: 'pointer', fontWeight: 500 }}>
            + New Template
          </button>
        )}
      </div>

      {error && <div style={{ color: 'var(--md-error)', marginBottom: '16px' }}>{error}</div>}

      {showForm && (
        <div style={{ marginBottom: '24px', padding: '20px', borderRadius: '12px', background: 'var(--md-surface-container-low)', border: '1px solid var(--md-outline-variant)' }}>
          <h3 style={{ margin: '0 0 16px 0' }}>{editing ? 'Edit Template' : 'New Template'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Name</label>
              <input value={formName} onChange={e => setFormName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--md-outline)', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value)} disabled={!!editing}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--md-outline)' }}>
                <option value="bol">Bill of Lading</option>
                <option value="label">Shipping Label</option>
                <option value="customs">Customs Form</option>
                <option value="daily_report">Daily Report</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Description</label>
            <input value={formDescription} onChange={e => setFormDescription(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--md-outline)', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>HTML Template (Handlebars syntax)</label>
            <textarea value={formHtml} onChange={e => setFormHtml(e.target.value)} rows={12}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--md-outline)', fontFamily: 'monospace', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={formIsDefault} onChange={e => setFormIsDefault(e.target.checked)} />
              Set as default template for this type
            </label>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSave}
              style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', background: 'var(--md-primary)', color: 'var(--md-on-primary)', cursor: 'pointer', fontWeight: 500 }}>
              {editing ? 'Save Changes' : 'Create Template'}
            </button>
            <button onClick={resetForm}
              style={{ padding: '10px 20px', borderRadius: '20px', border: '1px solid var(--md-outline)', background: 'var(--md-surface)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading templates...</p>
      ) : templates.length === 0 && !showForm ? (
        <p style={{ color: 'var(--md-on-surface-variant)' }}>
          No custom templates yet. The system uses built-in default templates for each document type. Create a custom template to override the defaults.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--md-outline-variant)' }}>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Description</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Default</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Active</th>
              <th style={{ textAlign: 'right', padding: '12px 8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--md-outline-variant)' }}>
                <td style={{ padding: '10px 8px', fontWeight: 500 }}>{t.name}</td>
                <td style={{ padding: '10px 8px' }}>{typeLabels[t.documentType] || t.documentType}</td>
                <td style={{ padding: '10px 8px', color: 'var(--md-on-surface-variant)' }}>{t.description || '-'}</td>
                <td style={{ padding: '10px 8px' }}>{t.isDefault ? 'Yes' : '-'}</td>
                <td style={{ padding: '10px 8px' }}>{t.active ? 'Active' : 'Inactive'}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  <button onClick={() => startEdit(t)}
                    style={{ marginRight: '8px', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--md-outline)', background: 'var(--md-surface)', cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(t.id)}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--md-error)', color: 'var(--md-error)', background: 'var(--md-surface)', cursor: 'pointer' }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
