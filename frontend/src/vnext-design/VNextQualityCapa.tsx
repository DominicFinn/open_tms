import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../api';

interface CAPAReport {
  id: string;
  reportNumber: string;
  title: string;
  status: string;
  priority: string;
  description: string;
  rootCauseCategory: string | null;
  issueId: string;
  shipmentId: string | null;
  createdAt: string;
}

interface FollowUp {
  id: string;
  followUpType: string;
  dueDate: string;
  completedAt: string | null;
  status: string;
  notes: string | null;
  outcome: string | null;
  actionItems: string | null;
  assigneeName: string | null;
  completedByName: string | null;
}

const STATUS_CHIPS: Record<string, string> = {
  draft: 'vn-chip-secondary',
  investigation: 'vn-chip-info',
  root_cause_identified: 'vn-chip-warning',
  action_plan: 'vn-chip-primary',
  implementation: 'vn-chip-info',
  verification: 'vn-chip-warning',
  closed: 'vn-chip-success',
};

const PRIORITY_CHIPS: Record<string, string> = {
  critical: 'vn-chip-error',
  high: 'vn-chip-warning',
  medium: 'vn-chip-primary',
  low: 'vn-chip-secondary',
};

const FOLLOW_UP_LABELS: Record<string, string> = {
  '30_day': '30-Day Review',
  '60_day': '60-Day Review',
  '90_day': '90-Day Review',
  ad_hoc: 'Ad-Hoc Note',
  effectiveness_check: 'Effectiveness Check',
};

const OUTCOME_LABELS: Record<string, string> = {
  on_track: 'On Track',
  needs_attention: 'Needs Attention',
  escalated: 'Escalated',
  closed_effective: 'Closed - Effective',
  closed_ineffective: 'Closed - Ineffective',
};

export default function VNextQualityCapa() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createFromIssue = searchParams.get('createFromIssue');

  const [capas, setCapas] = useState<CAPAReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');

  // Detail / follow-ups
  const [selectedCapa, setSelectedCapa] = useState<CAPAReport | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);

  // Complete follow-up modal
  const [completingFollowUp, setCompletingFollowUp] = useState<FollowUp | null>(null);
  const [completeOutcome, setCompleteOutcome] = useState('on_track');
  const [completeNotes, setCompleteNotes] = useState('');

  // Add follow-up modal
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [newFollowUpType, setNewFollowUpType] = useState('ad_hoc');
  const [newFollowUpDue, setNewFollowUpDue] = useState('');
  const [newFollowUpNotes, setNewFollowUpNotes] = useState('');

  // Create CAPA modal
  const [showCreateCapa, setShowCreateCapa] = useState(!!createFromIssue);
  const [createIssueId, setCreateIssueId] = useState(createFromIssue || '');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPriority, setCreatePriority] = useState('medium');

  const fetchCapas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${API_URL}/api/v1/cold-chain/capa?${params}`);
      const json = await res.json();
      setCapas(json.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchCapas(); }, [fetchCapas]);

  const fetchFollowUps = async (capaId: string) => {
    setLoadingFollowUps(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/quality/capa-follow-ups?capaReportId=${capaId}`);
      const json = await res.json();
      setFollowUps(json.data || []);
    } catch { /* ignore */ }
    setLoadingFollowUps(false);
  };

  const selectCapa = (capa: CAPAReport) => {
    setSelectedCapa(capa);
    fetchFollowUps(capa.id);
  };

  const schedule30_60_90 = async () => {
    if (!selectedCapa) return;
    await fetch(`${API_URL}/api/v1/quality/capa-follow-ups/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capaReportId: selectedCapa.id }),
    });
    fetchFollowUps(selectedCapa.id);
  };

  const addFollowUp = async () => {
    if (!selectedCapa || !newFollowUpDue) return;
    await fetch(`${API_URL}/api/v1/quality/capa-follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capaReportId: selectedCapa.id,
        followUpType: newFollowUpType,
        dueDate: new Date(newFollowUpDue).toISOString(),
        notes: newFollowUpNotes || undefined,
      }),
    });
    setShowAddFollowUp(false);
    setNewFollowUpNotes('');
    fetchFollowUps(selectedCapa.id);
  };

  const completeFollowUp = async () => {
    if (!completingFollowUp) return;
    await fetch(`${API_URL}/api/v1/quality/capa-follow-ups/${completingFollowUp.id}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome: completeOutcome, notes: completeNotes || undefined }),
    });
    setCompletingFollowUp(null);
    setCompleteNotes('');
    if (selectedCapa) fetchFollowUps(selectedCapa.id);
  };

  const createCapa = async () => {
    if (!createIssueId || !createTitle || !createDescription) return;
    const res = await fetch(`${API_URL}/api/v1/cold-chain/capa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueId: createIssueId,
        title: createTitle,
        description: createDescription,
        priority: createPriority,
      }),
    });
    if (res.ok) {
      setShowCreateCapa(false);
      setCreateIssueId('');
      setCreateTitle('');
      setCreateDescription('');
      fetchCapas();
    }
  };

  const filtered = capas.filter(c => {
    if (priorityFilter && c.priority !== priorityFilter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.reportNumber.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: capas.length,
    open: capas.filter(c => !['closed', 'verification'].includes(c.status)).length,
    verification: capas.filter(c => c.status === 'verification').length,
    closed: capas.filter(c => c.status === 'closed').length,
  };

  const isOverdue = (fu: FollowUp) => fu.status === 'pending' && new Date(fu.dueDate) < new Date();
  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>CAPA Management</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 14 }}>Corrective and Preventive Action reports with follow-up tracking</p>
        </div>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowCreateCapa(true)}>
          <span className="material-icons" style={{ fontSize: 18 }}>add</span> Create CAPA
        </button>
      </div>

      {/* Stats */}
      <div className="vn-stats" style={{ marginBottom: 24 }}>
        <div className="vn-stat"><div className="vn-stat-icon primary"><span className="material-icons">assignment</span></div><div><div className="vn-stat-value">{stats.total}</div><div className="vn-stat-label">Total CAPAs</div></div></div>
        <div className="vn-stat"><div className="vn-stat-icon warning"><span className="material-icons">pending_actions</span></div><div><div className="vn-stat-value">{stats.open}</div><div className="vn-stat-label">Open</div></div></div>
        <div className="vn-stat"><div className="vn-stat-icon info"><span className="material-icons">verified</span></div><div><div className="vn-stat-value">{stats.verification}</div><div className="vn-stat-label">In Verification</div></div></div>
        <div className="vn-stat"><div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div><div><div className="vn-stat-value">{stats.closed}</div><div className="vn-stat-label">Closed</div></div></div>
      </div>

      {/* Filters */}
      <div className="vn-filters" style={{ marginBottom: 16 }}>
        <input className="vn-filter-input" placeholder="Search by title or report number..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.keys(STATUS_CHIPS).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="vn-filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedCapa ? '1fr 1fr' : '1fr', gap: 24 }}>
        {/* CAPA List */}
        <div className="vn-table-wrap">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="loading-spinner" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>No CAPA reports found</div>
          ) : (
            <table className="vn-table">
              <thead><tr>
                <th>Report #</th><th>Title</th><th>Status</th><th>Priority</th><th>Root Cause</th><th>Created</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => selectCapa(c)} style={{ cursor: 'pointer', background: selectedCapa?.id === c.id ? 'var(--bg-hover)' : undefined }}>
                    <td><span className="vn-table-id">{c.reportNumber}</span></td>
                    <td>{c.title}</td>
                    <td><span className={`vn-chip ${STATUS_CHIPS[c.status] || ''}`}>{c.status.replace(/_/g, ' ')}</span></td>
                    <td><span className={`vn-chip ${PRIORITY_CHIPS[c.priority] || ''}`}>{c.priority}</span></td>
                    <td><span className="vn-table-secondary">{c.rootCauseCategory || '-'}</span></td>
                    <td><span className="vn-table-secondary">{formatDate(c.createdAt)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Follow-Up Panel */}
        {selectedCapa && (
          <div className="vn-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedCapa.reportNumber}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{selectedCapa.title}</p>
              </div>
              <button onClick={() => setSelectedCapa(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <span className="material-icons">close</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <span className={`vn-chip ${STATUS_CHIPS[selectedCapa.status] || ''}`}>{selectedCapa.status.replace(/_/g, ' ')}</span>
              <span className={`vn-chip ${PRIORITY_CHIPS[selectedCapa.priority] || ''}`}>{selectedCapa.priority}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button className="vn-btn vn-btn-primary" style={{ fontSize: 12 }} onClick={schedule30_60_90}>
                <span className="material-icons" style={{ fontSize: 14 }}>schedule</span> Schedule 30/60/90
              </button>
              <button className="vn-btn" style={{ fontSize: 12 }} onClick={() => setShowAddFollowUp(true)}>
                <span className="material-icons" style={{ fontSize: 14 }}>add</span> Add Follow-Up
              </button>
            </div>

            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Follow-Up Timeline</h4>

            {loadingFollowUps ? (
              <div style={{ padding: 20, textAlign: 'center' }}><div className="loading-spinner" /></div>
            ) : followUps.length === 0 ? (
              <div className="vn-alert vn-alert-info" style={{ fontSize: 13 }}>
                No follow-ups scheduled yet. Click "Schedule 30/60/90" to create automatic review checkpoints.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {followUps.map(fu => (
                  <div key={fu.id} style={{
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid ${isOverdue(fu) ? 'var(--color-warning)' : 'var(--border-color)'}`,
                    background: isOverdue(fu) ? 'color-mix(in srgb, var(--color-warning) 5%, transparent)' : 'var(--bg-secondary)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className="vn-chip vn-chip-primary" style={{ fontSize: 10 }}>{FOLLOW_UP_LABELS[fu.followUpType] || fu.followUpType}</span>
                        {fu.status === 'completed' && <span className="vn-chip vn-chip-success" style={{ fontSize: 10 }}>Completed</span>}
                        {isOverdue(fu) && <span className="vn-chip vn-chip-error" style={{ fontSize: 10 }}>Overdue</span>}
                        {fu.status === 'pending' && !isOverdue(fu) && <span className="vn-chip vn-chip-secondary" style={{ fontSize: 10 }}>Pending</span>}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Due: {formatDate(fu.dueDate)}</span>
                    </div>

                    {fu.notes && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0' }}>{fu.notes}</p>}
                    {fu.outcome && <p style={{ fontSize: 12, color: 'var(--text-primary)', margin: '4px 0' }}>Outcome: <strong>{OUTCOME_LABELS[fu.outcome] || fu.outcome}</strong></p>}
                    {fu.actionItems && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0' }}>Actions: {fu.actionItems}</p>}
                    {fu.completedAt && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0' }}>Completed: {formatDate(fu.completedAt)}{fu.completedByName ? ` by ${fu.completedByName}` : ''}</p>}

                    {fu.status === 'pending' && (
                      <button className="vn-btn vn-btn-success" style={{ fontSize: 11, marginTop: 8 }} onClick={() => {
                        setCompletingFollowUp(fu);
                        setCompleteOutcome('on_track');
                        setCompleteNotes('');
                      }}>
                        <span className="material-icons" style={{ fontSize: 14 }}>check</span> Complete Review
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Complete Follow-Up Modal */}
      {completingFollowUp && (
        <div className="vn-modal-backdrop" onClick={() => setCompletingFollowUp(null)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="vn-modal-header">
              <h3>Complete Follow-Up</h3>
              <button onClick={() => setCompletingFollowUp(null)}><span className="material-icons">close</span></button>
            </div>
            <div className="vn-modal-body">
              <div className="vn-field">
                <label className="vn-field-label">Outcome</label>
                <select className="vn-input" value={completeOutcome} onChange={e => setCompleteOutcome(e.target.value)}>
                  {Object.entries(OUTCOME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="vn-field" style={{ marginTop: 12 }}>
                <label className="vn-field-label">Notes</label>
                <textarea className="vn-input" rows={3} value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} placeholder="Review notes..." />
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn" onClick={() => setCompletingFollowUp(null)}>Cancel</button>
              <button className="vn-btn vn-btn-success" onClick={completeFollowUp}>Complete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Follow-Up Modal */}
      {showAddFollowUp && (
        <div className="vn-modal-backdrop" onClick={() => setShowAddFollowUp(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="vn-modal-header">
              <h3>Add Follow-Up</h3>
              <button onClick={() => setShowAddFollowUp(false)}><span className="material-icons">close</span></button>
            </div>
            <div className="vn-modal-body">
              <div className="vn-field">
                <label className="vn-field-label">Type</label>
                <select className="vn-input" value={newFollowUpType} onChange={e => setNewFollowUpType(e.target.value)}>
                  {Object.entries(FOLLOW_UP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="vn-field" style={{ marginTop: 12 }}>
                <label className="vn-field-label">Due Date</label>
                <input className="vn-input" type="date" value={newFollowUpDue} onChange={e => setNewFollowUpDue(e.target.value)} />
              </div>
              <div className="vn-field" style={{ marginTop: 12 }}>
                <label className="vn-field-label">Notes</label>
                <textarea className="vn-input" rows={3} value={newFollowUpNotes} onChange={e => setNewFollowUpNotes(e.target.value)} placeholder="Optional notes..." />
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn" onClick={() => setShowAddFollowUp(false)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={addFollowUp}>Add Follow-Up</button>
            </div>
          </div>
        </div>
      )}

      {/* Create CAPA Modal */}
      {showCreateCapa && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreateCapa(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="vn-modal-header">
              <h3>Create CAPA Report</h3>
              <button onClick={() => setShowCreateCapa(false)}><span className="material-icons">close</span></button>
            </div>
            <div className="vn-modal-body">
              <div className="vn-form-grid">
                <div className="vn-field">
                  <label className="vn-field-label">Issue ID *</label>
                  <input className="vn-input" value={createIssueId} onChange={e => setCreateIssueId(e.target.value)} placeholder="Issue ID" />
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Priority</label>
                  <select className="vn-input" value={createPriority} onChange={e => setCreatePriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="vn-field" style={{ marginTop: 12 }}>
                <label className="vn-field-label">Title *</label>
                <input className="vn-input" value={createTitle} onChange={e => setCreateTitle(e.target.value)} placeholder="CAPA report title" />
              </div>
              <div className="vn-field" style={{ marginTop: 12 }}>
                <label className="vn-field-label">Description *</label>
                <textarea className="vn-input" rows={4} value={createDescription} onChange={e => setCreateDescription(e.target.value)} placeholder="Describe the issue..." />
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn" onClick={() => setShowCreateCapa(false)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={createCapa} disabled={!createIssueId || !createTitle || !createDescription}>Create CAPA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
