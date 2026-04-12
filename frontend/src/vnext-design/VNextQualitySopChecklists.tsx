/**
 * VNextQualitySopChecklists - SOP/GDP checklist management page.
 *
 * Lists SOP checklists with stats, filtering, and a create/edit modal
 * that supports adding/removing/reordering checklist items grouped by section.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../api';
import { VnPageHeader, VnChip, VnFilterBar, VnAlert, VnModal } from './components';

/* ── Types ───────────────────────────────────────────────── */

interface ChecklistItem {
  id?: string;
  question: string;
  section: string;
  guidance: string;
  evidenceRequired: boolean;
  isCritical: boolean;
  sortOrder: number;
}

interface SopChecklist {
  id: string;
  title: string;
  description: string | null;
  sopReference: string | null;
  category: string;
  frequency: string;
  status: string;
  nextDueDate: string | null;
  lastCompletedAt: string | null;
  items: ChecklistItem[];
  _count?: { audits: number };
  createdAt: string;
  updatedAt: string;
}

/* ── Constants ───────────────────────────────────────────── */

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'gdp', label: 'GDP' },
  { value: 'cold_chain', label: 'Cold Chain' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'transport', label: 'Transport' },
  { value: 'general', label: 'General' },
];

const FREQUENCIES: { value: string; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one_off', label: 'One Off' },
];

const STATUSES: { value: string; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

function categoryLabel(val: string): string {
  return CATEGORIES.find((c) => c.value === val)?.label || val;
}

function categoryChipVariant(cat: string): 'primary' | 'success' | 'warning' | 'info' | 'error' | 'secondary' {
  switch (cat) {
    case 'gdp': return 'primary';
    case 'cold_chain': return 'info';
    case 'warehouse': return 'warning';
    case 'transport': return 'success';
    case 'general': return 'secondary';
    default: return 'secondary';
  }
}

function statusChipVariant(status: string): 'success' | 'warning' | 'secondary' {
  switch (status) {
    case 'active': return 'success';
    case 'draft': return 'warning';
    case 'archived': return 'secondary';
    default: return 'secondary';
  }
}

function frequencyLabel(val: string): string {
  return FREQUENCIES.find((f) => f.value === val)?.label || val;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

function isOverdue(nextDueDate: string | null, status: string): boolean {
  if (!nextDueDate || status !== 'active') return false;
  return new Date(nextDueDate) < new Date();
}

function emptyItem(sortOrder: number): ChecklistItem {
  return {
    question: '',
    section: '',
    guidance: '',
    evidenceRequired: false,
    isCritical: false,
    sortOrder,
  };
}

/* ── Create/Edit Modal ───────────────────────────────────── */

interface ChecklistFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editChecklist: SopChecklist | null;
}

function ChecklistFormModal({ open, onClose, onSaved, editChecklist }: ChecklistFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sopReference, setSopReference] = useState('');
  const [category, setCategory] = useState('general');
  const [frequency, setFrequency] = useState('quarterly');
  const [nextDueDate, setNextDueDate] = useState('');
  const [items, setItems] = useState<ChecklistItem[]>([emptyItem(0)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (editChecklist) {
      setTitle(editChecklist.title);
      setDescription(editChecklist.description || '');
      setSopReference(editChecklist.sopReference || '');
      setCategory(editChecklist.category);
      setFrequency(editChecklist.frequency);
      setNextDueDate(editChecklist.nextDueDate ? editChecklist.nextDueDate.slice(0, 10) : '');
      setItems(
        editChecklist.items.length > 0
          ? [...editChecklist.items].sort((a, b) => a.sortOrder - b.sortOrder)
          : [emptyItem(0)],
      );
    } else {
      setTitle('');
      setDescription('');
      setSopReference('');
      setCategory('general');
      setFrequency('quarterly');
      setNextDueDate('');
      setItems([emptyItem(0)]);
    }
    setError('');
  }, [editChecklist, open]);

  const updateItem = (idx: number, field: keyof ChecklistItem, value: any) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem(prev.length)]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sortOrder: i })));
  };

  const moveItem = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const arr = [...prev];
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((it, i) => ({ ...it, sortOrder: i }));
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    const validItems = items.filter((it) => it.question.trim());
    if (validItems.length === 0) {
      setError('At least one checklist item with a question is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        sopReference: sopReference.trim() || null,
        category,
        frequency,
        nextDueDate: nextDueDate || null,
        items: validItems.map((it, i) => ({
          question: it.question.trim(),
          section: it.section.trim() || null,
          guidance: it.guidance.trim() || null,
          evidenceRequired: it.evidenceRequired,
          isCritical: it.isCritical,
          sortOrder: i,
        })),
      };

      const url = editChecklist
        ? `${API_URL}/api/v1/quality/sop-checklists/${editChecklist.id}`
        : `${API_URL}/api/v1/quality/sop-checklists`;
      const method = editChecklist ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save checklist');

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Group items by section for display headers
  const sections = Array.from(new Set(items.map((it) => it.section || '').filter(Boolean)));

  return (
    <VnModal
      open={open}
      onClose={onClose}
      title={editChecklist ? 'Edit Checklist' : 'Create Checklist'}
      size="xl"
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={onClose}>Cancel</button>
          <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? 'Saving...' : editChecklist ? 'Save Changes' : 'Create Checklist'}
          </button>
        </div>
      }
    >
      {error && <VnAlert variant="error" onClose={() => setError('')}>{error}</VnAlert>}

      {/* Basic fields */}
      <div className="vn-form-grid" style={{ marginBottom: 20 }}>
        <div className="vn-field">
          <label className="vn-field-label">Title <span style={{ color: 'var(--color-error)' }}>*</span></label>
          <input className="vn-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GDP Warehouse Compliance" />
        </div>
        <div className="vn-field">
          <label className="vn-field-label">SOP Reference</label>
          <input className="vn-input" value={sopReference} onChange={(e) => setSopReference(e.target.value)} placeholder="e.g. SOP-WH-001" />
        </div>
        <div className="vn-field">
          <label className="vn-field-label">Category</label>
          <select className="vn-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="vn-field">
          <label className="vn-field-label">Frequency</label>
          <select className="vn-input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="vn-field">
          <label className="vn-field-label">Next Due Date</label>
          <input className="vn-input" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
        </div>
        <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
          <label className="vn-field-label">Description</label>
          <textarea
            className="vn-input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of this checklist"
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>
            Checklist Items ({items.filter((it) => it.question.trim()).length})
          </h3>
          <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={addItem}>
            <span className="material-icons" style={{ fontSize: 18 }}>add</span>
            Add Item
          </button>
        </div>

        {sections.length > 0 && (
          <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Sections:</span>
            {sections.map((s) => (
              <span key={s} className="vn-chip vn-chip-secondary" style={{ fontSize: 11 }}>{s}</span>
            ))}
          </div>
        )}

        {items.map((item, idx) => {
          // Show section header when section changes
          const prevSection = idx > 0 ? items[idx - 1].section : null;
          const showSectionHeader = item.section && item.section !== prevSection;

          return (
            <React.Fragment key={idx}>
              {showSectionHeader && (
                <div style={{
                  padding: '8px 0 4px',
                  marginTop: idx > 0 ? 12 : 0,
                  borderBottom: '1px solid var(--outline-variant)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span className="material-icons" style={{ fontSize: 16 }}>folder</span>
                  {item.section}
                </div>
              )}
              <div
                style={{
                  padding: 12,
                  marginBottom: 8,
                  marginTop: showSectionHeader ? 8 : 0,
                  border: '1px solid var(--outline-variant)',
                  borderRadius: 8,
                  borderLeft: item.isCritical ? '4px solid var(--color-error)' : '4px solid var(--outline-variant)',
                  background: 'var(--surface-container-lowest)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface-variant)', minWidth: 24, paddingTop: 8 }}>
                    {idx + 1}.
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="vn-form-grid" style={{ gap: 8 }}>
                      <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                        <label className="vn-field-label">Question <span style={{ color: 'var(--color-error)' }}>*</span></label>
                        <input
                          className="vn-input"
                          value={item.question}
                          onChange={(e) => updateItem(idx, 'question', e.target.value)}
                          placeholder="e.g. Are temperature records maintained for the last 30 days?"
                        />
                      </div>
                      <div className="vn-field">
                        <label className="vn-field-label">Section</label>
                        <input
                          className="vn-input"
                          value={item.section}
                          onChange={(e) => updateItem(idx, 'section', e.target.value)}
                          placeholder="e.g. Documentation"
                          list="section-suggestions"
                        />
                      </div>
                      <div className="vn-field">
                        <label className="vn-field-label">Guidance</label>
                        <input
                          className="vn-input"
                          value={item.guidance}
                          onChange={(e) => updateItem(idx, 'guidance', e.target.value)}
                          placeholder="Hint or reference for the auditor"
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--on-surface-variant)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={item.evidenceRequired}
                          onChange={(e) => updateItem(idx, 'evidenceRequired', e.target.checked)}
                        />
                        Evidence Required
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: item.isCritical ? 'var(--color-error)' : 'var(--on-surface-variant)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={item.isCritical}
                          onChange={(e) => updateItem(idx, 'isCritical', e.target.checked)}
                        />
                        Critical Item
                      </label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button
                      className="vn-btn-icon"
                      onClick={() => moveItem(idx, -1)}
                      disabled={idx === 0}
                      title="Move up"
                      style={{ opacity: idx === 0 ? 0.3 : 1 }}
                    >
                      <span className="material-icons" style={{ fontSize: 18 }}>arrow_upward</span>
                    </button>
                    <button
                      className="vn-btn-icon"
                      onClick={() => moveItem(idx, 1)}
                      disabled={idx === items.length - 1}
                      title="Move down"
                      style={{ opacity: idx === items.length - 1 ? 0.3 : 1 }}
                    >
                      <span className="material-icons" style={{ fontSize: 18 }}>arrow_downward</span>
                    </button>
                    <button
                      className="vn-btn-icon"
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                      title="Remove item"
                      style={{ opacity: items.length <= 1 ? 0.3 : 1, color: 'var(--color-error)' }}
                    >
                      <span className="material-icons" style={{ fontSize: 18 }}>delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Datalist for section auto-complete */}
        <datalist id="section-suggestions">
          {sections.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    </VnModal>
  );
}

/* ── Main Page ───────────────────────────────────────────── */

export default function VNextQualitySopChecklists() {
  const [checklists, setChecklists] = useState<SopChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editChecklist, setEditChecklist] = useState<SopChecklist | null>(null);

  const loadChecklists = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);
      const qs = params.toString();
      const res = await fetch(`${API_URL}/api/v1/quality/sop-checklists${qs ? `?${qs}` : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load checklists');
      setChecklists(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus]);

  useEffect(() => { loadChecklists(); }, [loadChecklists]);

  const openCreate = () => {
    setEditChecklist(null);
    setShowModal(true);
  };

  const openEdit = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/quality/sop-checklists/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load checklist');
      setEditChecklist(json.data);
      setShowModal(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaved = () => {
    setSuccessMsg(editChecklist ? 'Checklist updated' : 'Checklist created');
    setTimeout(() => setSuccessMsg(''), 3000);
    loadChecklists();
  };

  // Filter by search text
  const filtered = checklists.filter((cl) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      cl.title.toLowerCase().includes(q) ||
      (cl.sopReference || '').toLowerCase().includes(q) ||
      cl.category.toLowerCase().includes(q)
    );
  });

  // Stats
  const totalActive = checklists.filter((c) => c.status === 'active').length;
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const dueThisMonth = checklists.filter((c) => {
    if (c.status !== 'active' || !c.nextDueDate) return false;
    const d = new Date(c.nextDueDate);
    return d <= endOfMonth && d >= now;
  }).length;
  const overdue = checklists.filter((c) => isOverdue(c.nextDueDate, c.status)).length;

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading checklists...</h3>
      </div>
    );
  }

  return (
    <>
      <VnPageHeader title="SOP Checklists" subtitle={`${checklists.length} checklists`}>
        <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={openCreate}>
          <span className="material-icons">add</span>Create Checklist
        </button>
      </VnPageHeader>

      {successMsg && <VnAlert variant="success" onClose={() => setSuccessMsg('')}>{successMsg}</VnAlert>}
      {error && <VnAlert variant="error" onClose={() => setError('')}>{error}</VnAlert>}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">checklist</span></div>
          <div>
            <div className="vn-stat-value">{totalActive}</div>
            <div className="vn-stat-label">Total Active</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">event</span></div>
          <div>
            <div className="vn-stat-value">{dueThisMonth}</div>
            <div className="vn-stat-label">Due This Month</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">warning</span></div>
          <div>
            <div className="vn-stat-value">{overdue}</div>
            <div className="vn-stat-label">Overdue</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="vn-card" style={{ marginTop: 24 }}>
        <VnFilterBar searchPlaceholder="Search checklists..." searchValue={search} onSearchChange={setSearch}>
          <select
            className="vn-filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            className="vn-filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </VnFilterBar>

        {filtered.length === 0 ? (
          <div className="vn-empty">
            <span className="material-icons">checklist</span>
            <h3>No checklists found</h3>
            <p>Create your first SOP checklist to start tracking compliance audits.</p>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>SOP Ref</th>
                  <th>Category</th>
                  <th>Frequency</th>
                  <th>Next Due</th>
                  <th>Last Completed</th>
                  <th>Audits</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cl) => {
                  const overdueRow = isOverdue(cl.nextDueDate, cl.status);
                  return (
                    <tr
                      key={cl.id}
                      style={{
                        cursor: 'pointer',
                        background: overdueRow ? 'var(--error-container, rgba(255,0,0,0.04))' : undefined,
                      }}
                      onClick={() => openEdit(cl.id)}
                    >
                      <td>
                        <span className="vn-table-id">{cl.title}</span>
                        {cl.description && (
                          <div className="vn-table-secondary" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cl.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{cl.sopReference || '-'}</span>
                      </td>
                      <td>
                        <VnChip variant={categoryChipVariant(cl.category)}>{categoryLabel(cl.category)}</VnChip>
                      </td>
                      <td style={{ fontSize: 13 }}>{frequencyLabel(cl.frequency)}</td>
                      <td>
                        <span style={{
                          fontSize: 13,
                          fontWeight: overdueRow ? 600 : 400,
                          color: overdueRow ? 'var(--color-error)' : 'var(--on-surface)',
                        }}>
                          {formatDate(cl.nextDueDate)}
                        </span>
                        {overdueRow && (
                          <div style={{ fontSize: 11, color: 'var(--color-error)', fontWeight: 600 }}>OVERDUE</div>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {formatDate(cl.lastCompletedAt)}
                      </td>
                      <td style={{ fontWeight: 600 }}>{cl._count?.audits ?? 0}</td>
                      <td>
                        <VnChip variant={statusChipVariant(cl.status)}>
                          {cl.status.charAt(0).toUpperCase() + cl.status.slice(1)}
                        </VnChip>
                      </td>
                      <td>
                        <button
                          className="vn-btn-icon"
                          onClick={(e) => { e.stopPropagation(); openEdit(cl.id); }}
                          title="Edit checklist"
                        >
                          <span className="material-icons" style={{ fontSize: 18 }}>edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <ChecklistFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditChecklist(null); }}
        onSaved={handleSaved}
        editChecklist={editChecklist}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
