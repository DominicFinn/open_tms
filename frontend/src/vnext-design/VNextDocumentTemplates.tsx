import { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface DocumentTemplate {
  id: string;
  name: string;
  documentType: string;
  description: string | null;
  htmlTemplate: string | null;
  config: any;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
}

const DOCUMENT_TYPES = [
  { value: 'bol', label: 'Bill of Lading' },
  { value: 'label', label: 'Label' },
  { value: 'customs', label: 'Customs' },
  { value: 'daily_report', label: 'Daily Report' },
];

const typeLabel = (t: string) => DOCUMENT_TYPES.find(d => d.value === t)?.label || t;

const emptyForm = {
  name: '',
  documentType: 'bol',
  description: '',
  htmlTemplate: '',
  config: '{}',
  isDefault: false,
  active: true,
};

export default function VNextDocumentTemplates() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/document-templates`);
      if (!res.ok) throw new Error('Failed to load document templates');
      const json = await res.json();
      setTemplates(json.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load document templates');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
    setSuccess('');
  }

  function openEdit(t: DocumentTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      documentType: t.documentType,
      description: t.description || '',
      htmlTemplate: t.htmlTemplate || '',
      config: t.config ? JSON.stringify(t.config, null, 2) : '{}',
      isDefault: t.isDefault,
      active: t.active,
    });
    setShowForm(true);
    setSuccess('');
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setForm({ ...emptyForm });
  }

  async function saveTemplate() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    let parsedConfig: any;
    try {
      parsedConfig = JSON.parse(form.config);
    } catch {
      setError('Config must be valid JSON');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body = {
        name: form.name.trim(),
        documentType: form.documentType,
        description: form.description.trim() || null,
        htmlTemplate: form.htmlTemplate || null,
        config: parsedConfig,
        isDefault: form.isDefault,
        active: form.active,
      };
      const url = editing
        ? `${API_URL}/api/v1/document-templates/${editing.id}`
        : `${API_URL}/api/v1/document-templates`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to save template');
      }
      setSuccess(editing ? 'Template updated successfully' : 'Template created successfully');
      cancelForm();
      await loadTemplates();
    } catch (e: any) {
      setError(e.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/v1/document-templates/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete template');
      setSuccess('Template deleted successfully');
      await loadTemplates();
    } catch (e: any) {
      setError(e.message || 'Failed to delete template');
    }
  }

  function truncate(s: string | null, max: number) {
    if (!s) return '';
    return s.length > max ? s.slice(0, max) + '...' : s;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Document Templates</h1>
          <p>Manage templates for BOLs, labels, customs forms, and reports</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary" onClick={openCreate}>
            <span className="material-icons">add</span>
            New Template
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button
            className="vn-btn-icon"
            style={{ marginLeft: 'auto' }}
            onClick={() => setError('')}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {success}
          <button
            className="vn-btn-icon"
            style={{ marginLeft: 'auto' }}
            onClick={() => setSuccess('')}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      )}

      {showForm && (
        <div className="vn-card" style={{ marginBottom: 24 }}>
          <div className="vn-card-header">
            <h2>{editing ? 'Edit Template' : 'Create Template'}</h2>
          </div>
          <div className="vn-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                  Name *
                </label>
                <input
                  className="vn-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Template name"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                  Document Type
                </label>
                <select
                  className="vn-input"
                  value={form.documentType}
                  onChange={e => setForm(f => ({ ...f, documentType: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  {DOCUMENT_TYPES.map(dt => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                  Description
                </label>
                <textarea
                  className="vn-input"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of this template"
                  rows={2}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                  HTML Template
                </label>
                <textarea
                  className="vn-input"
                  value={form.htmlTemplate}
                  onChange={e => setForm(f => ({ ...f, htmlTemplate: e.target.value }))}
                  placeholder="<html>...</html>"
                  rows={10}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                  Config (JSON)
                </label>
                <textarea
                  className="vn-input"
                  value={form.config}
                  onChange={e => setForm(f => ({ ...f, config: e.target.value }))}
                  placeholder="{}"
                  rows={4}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--on-surface)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  Default Template
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--on-surface)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  Active
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="vn-btn vn-btn-outline" onClick={cancelForm}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={saveTemplate} disabled={saving}>
                <span className="material-icons">{editing ? 'save' : 'add'}</span>
                {saving ? 'Saving...' : editing ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">description</span>
          </div>
          <div>
            <div className="vn-stat-value">{templates.length}</div>
            <div className="vn-stat-label">Total Templates</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{templates.filter(t => t.active).length}</div>
            <div className="vn-stat-label">Active</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">star</span>
          </div>
          <div>
            <div className="vn-stat-value">{templates.filter(t => t.isDefault).length}</div>
            <div className="vn-stat-label">Default</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="vn-card">
        <div className="vn-card-header">
          <h2>Templates</h2>
        </div>
        <div className="vn-card-body" style={{ padding: 0 }}>
          {templates.length === 0 ? (
            <div className="vn-empty">
              <span className="material-icons">description</span>
              <h3>No document templates</h3>
              <p>Create your first template to get started.</p>
            </div>
          ) : (
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Default</th>
                    <th>Active</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 500 }}>{t.name}</td>
                      <td>
                        <span className="vn-chip primary">{typeLabel(t.documentType)}</span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {truncate(t.description, 60)}
                      </td>
                      <td>
                        {t.isDefault && (
                          <span className="material-icons" style={{ fontSize: 20, color: 'var(--primary)' }}>
                            check_circle
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`vn-chip ${t.active ? 'success' : 'error'}`}>
                          {t.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="vn-btn-icon" title="Edit" onClick={() => openEdit(t)}>
                            <span className="material-icons" style={{ fontSize: 18 }}>edit</span>
                          </button>
                          <button className="vn-btn-icon" title="Delete" onClick={() => deleteTemplate(t.id)}>
                            <span className="material-icons" style={{ fontSize: 18, color: 'var(--error)' }}>delete</span>
                          </button>
                        </div>
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
  );
}
