import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../api';

interface Checklist {
  id: string;
  title: string;
  category: string;
  sopReference: string | null;
}

interface Audit {
  id: string;
  auditNumber: string;
  status: string;
  score: number | null;
  passCount: number;
  failCount: number;
  naCount: number;
  auditorName: string | null;
  auditDate: string;
  findings: string | null;
  correctiveActions: string | null;
  completedAt: string | null;
  checklist: { title: string; category: string; sopReference: string | null };
}

interface AuditDetail extends Audit {
  checklist: {
    title: string;
    category: string;
    sopReference: string | null;
    items: ChecklistItem[];
  };
  responses: AuditResponse[];
}

interface ChecklistItem {
  id: string;
  sortOrder: number;
  section: string | null;
  question: string;
  guidance: string | null;
  evidenceRequired: boolean;
  isCritical: boolean;
}

interface AuditResponse {
  checklistItemId: string;
  result: string;
  notes: string | null;
}

const STATUS_CHIPS: Record<string, string> = {
  in_progress: 'vn-chip-info',
  completed: 'vn-chip-success',
  failed: 'vn-chip-error',
};

const CATEGORY_CHIPS: Record<string, string> = {
  gdp: 'vn-chip-success',
  cold_chain: 'vn-chip-info',
  warehouse: 'vn-chip-primary',
  transport: 'vn-chip-warning',
  general: 'vn-chip-secondary',
};

export default function VNextQualitySopAudits() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [checklistFilter, setChecklistFilter] = useState('');

  // Start audit modal
  const [showStart, setShowStart] = useState(false);
  const [startChecklistId, setStartChecklistId] = useState('');
  const [startAuditorName, setStartAuditorName] = useState('');

  // Audit detail / complete
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [responses, setResponses] = useState<Record<string, { result: string; notes: string }>>({});
  const [completingFindings, setCompletingFindings] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (checklistFilter) params.set('checklistId', checklistFilter);
      const res = await fetch(`${API_URL}/api/v1/quality/sop-audits?${params}`);
      const json = await res.json();
      setAudits(json.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter, checklistFilter]);

  const fetchChecklists = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/quality/sop-checklists?status=active`);
      const json = await res.json();
      setChecklists(json.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchAudits(); fetchChecklists(); }, [fetchAudits]);

  const startAudit = async () => {
    if (!startChecklistId) return;
    const res = await fetch(`${API_URL}/api/v1/quality/sop-audits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checklistId: startChecklistId,
        auditorName: startAuditorName || undefined,
      }),
    });
    if (res.ok) {
      setShowStart(false);
      setStartChecklistId('');
      setStartAuditorName('');
      fetchAudits();
    }
  };

  const openDetail = async (auditId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/quality/sop-audits/${auditId}`);
      const json = await res.json();
      setDetail(json.data);
      // Pre-fill responses from existing
      const resps: Record<string, { result: string; notes: string }> = {};
      for (const r of (json.data?.responses || [])) {
        resps[r.checklistItemId] = { result: r.result, notes: r.notes || '' };
      }
      setResponses(resps);
    } catch { /* ignore */ }
  };

  const completeAudit = async () => {
    if (!detail) return;
    setSubmitting(true);
    const responseList = Object.entries(responses).map(([checklistItemId, r]) => ({
      checklistItemId,
      result: r.result,
      notes: r.notes || undefined,
    }));

    try {
      const res = await fetch(`${API_URL}/api/v1/quality/sop-audits/${detail.id}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: responseList,
          findings: completingFindings || undefined,
        }),
      });
      const json = await res.json();
      if (json.data) {
        setDetail(null);
        fetchAudits();
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const setResponse = (itemId: string, field: 'result' | 'notes', value: string) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value, result: prev[itemId]?.result || 'pass' },
    }));
  };

  const stats = {
    total: audits.length,
    completed: audits.filter(a => a.status === 'completed').length,
    failed: audits.filter(a => a.status === 'failed').length,
    avgScore: audits.filter(a => a.score != null).length > 0
      ? Math.round(audits.filter(a => a.score != null).reduce((s, a) => s + (a.score || 0), 0) / audits.filter(a => a.score != null).length)
      : null,
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  // Group items by section
  const groupedItems = detail?.checklist?.items?.reduce((acc, item) => {
    const section = item.section || 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>) || {};

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>GDP Audits</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 14 }}>SOP compliance audits and GDP reviews</p>
        </div>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowStart(true)}>
          <span className="material-icons" style={{ fontSize: 18 }}>add</span> Start New Audit
        </button>
      </div>

      {/* Stats */}
      <div className="vn-stats" style={{ marginBottom: 24 }}>
        <div className="vn-stat"><div className="vn-stat-icon primary"><span className="material-icons">fact_check</span></div><div><div className="vn-stat-value">{stats.total}</div><div className="vn-stat-label">Total Audits</div></div></div>
        <div className="vn-stat"><div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div><div><div className="vn-stat-value">{stats.completed}</div><div className="vn-stat-label">Completed</div></div></div>
        <div className="vn-stat"><div className="vn-stat-icon error"><span className="material-icons">cancel</span></div><div><div className="vn-stat-value">{stats.failed}</div><div className="vn-stat-label">Failed</div></div></div>
        <div className="vn-stat"><div className="vn-stat-icon info"><span className="material-icons">speed</span></div><div><div className="vn-stat-value">{stats.avgScore != null ? `${stats.avgScore}%` : 'N/A'}</div><div className="vn-stat-label">Avg Score</div></div></div>
      </div>

      {/* Filters */}
      <div className="vn-filters" style={{ marginBottom: 16 }}>
        <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select className="vn-filter-select" value={checklistFilter} onChange={e => setChecklistFilter(e.target.value)}>
          <option value="">All Checklists</option>
          {checklists.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      {/* Audit Detail View */}
      {detail ? (
        <div className="vn-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                {detail.auditNumber} - {detail.checklist.title}
              </h2>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <span className={`vn-chip ${STATUS_CHIPS[detail.status] || ''}`}>{detail.status.replace(/_/g, ' ')}</span>
                <span className={`vn-chip ${CATEGORY_CHIPS[detail.checklist.category] || ''}`}>{detail.checklist.category.replace(/_/g, ' ')}</span>
                {detail.score != null && <span className="vn-chip">{Math.round(detail.score)}% score</span>}
              </div>
            </div>
            <button className="vn-btn" onClick={() => setDetail(null)}>
              <span className="material-icons" style={{ fontSize: 18 }}>close</span> Close
            </button>
          </div>

          {detail.status === 'in_progress' ? (
            <>
              {Object.entries(groupedItems).map(([section, items]) => (
                <div key={section} style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>{section}</h3>
                  {items.sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
                    <div key={item.id} style={{
                      padding: 12,
                      marginBottom: 8,
                      borderRadius: 8,
                      border: `1px solid ${item.isCritical ? 'var(--color-error)' : 'var(--border-color)'}`,
                      background: 'var(--bg-secondary)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                            {item.isCritical && <span style={{ color: 'var(--color-error)', marginRight: 4 }}>*</span>}
                            {item.question}
                          </p>
                          {item.guidance && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>{item.guidance}</p>}
                          {item.isCritical && <span style={{ fontSize: 10, color: 'var(--color-error)' }}>Critical - failure will fail the entire audit</span>}
                          {item.evidenceRequired && <span style={{ fontSize: 10, color: 'var(--color-warning)', display: 'block' }}>Evidence required</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {['pass', 'fail', 'na', 'observation'].map(r => (
                            <button
                              key={r}
                              className={`vn-btn ${responses[item.id]?.result === r ? (r === 'pass' ? 'vn-btn-success' : r === 'fail' ? 'vn-btn-danger' : 'vn-btn-primary') : ''}`}
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => setResponse(item.id, 'result', r)}
                            >
                              {r === 'na' ? 'N/A' : r.charAt(0).toUpperCase() + r.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      {responses[item.id]?.result === 'fail' && (
                        <textarea
                          className="vn-input"
                          style={{ marginTop: 8, fontSize: 12 }}
                          rows={2}
                          placeholder="Notes / corrective action needed..."
                          value={responses[item.id]?.notes || ''}
                          onChange={e => setResponse(item.id, 'notes', e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}

              <div className="vn-field" style={{ marginBottom: 16 }}>
                <label className="vn-field-label">Overall Findings</label>
                <textarea className="vn-input" rows={3} value={completingFindings} onChange={e => setCompletingFindings(e.target.value)} placeholder="Summarize audit findings..." />
              </div>

              <button className="vn-btn vn-btn-primary" onClick={completeAudit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Audit'}
              </button>
            </>
          ) : (
            /* Completed/failed audit view */
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div className="vn-card" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-success)' }}>{detail.passCount}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Passed</div>
                </div>
                <div className="vn-card" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-error)' }}>{detail.failCount}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Failed</div>
                </div>
                <div className="vn-card" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-secondary)' }}>{detail.naCount}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>N/A</div>
                </div>
              </div>
              {detail.findings && (
                <div className="vn-alert vn-alert-info" style={{ marginBottom: 16 }}>
                  <strong>Findings:</strong> {detail.findings}
                </div>
              )}
              {detail.correctiveActions && (
                <div className="vn-alert vn-alert-warning" style={{ marginBottom: 16 }}>
                  <strong>Corrective Actions:</strong> {detail.correctiveActions}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Audit List */
        <div className="vn-table-wrap">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="loading-spinner" /></div>
          ) : audits.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>No audits found. Start a new audit to begin.</div>
          ) : (
            <table className="vn-table">
              <thead><tr>
                <th>Audit #</th><th>Checklist</th><th>Category</th><th>Status</th><th>Score</th><th>Auditor</th><th>Date</th><th></th>
              </tr></thead>
              <tbody>
                {audits.map(a => (
                  <tr key={a.id}>
                    <td><span className="vn-table-id">{a.auditNumber}</span></td>
                    <td>{a.checklist.title}</td>
                    <td><span className={`vn-chip ${CATEGORY_CHIPS[a.checklist.category] || ''}`}>{a.checklist.category.replace(/_/g, ' ')}</span></td>
                    <td><span className={`vn-chip ${STATUS_CHIPS[a.status] || ''}`}>{a.status.replace(/_/g, ' ')}</span></td>
                    <td>
                      {a.score != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.round(a.score)}%`,
                              height: '100%',
                              borderRadius: 3,
                              background: a.score >= 80 ? 'var(--color-success)' : a.score >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                            }} />
                          </div>
                          <span style={{ fontSize: 12 }}>{Math.round(a.score)}%</span>
                        </div>
                      ) : <span className="vn-table-secondary">-</span>}
                    </td>
                    <td><span className="vn-table-secondary">{a.auditorName || '-'}</span></td>
                    <td><span className="vn-table-secondary">{formatDate(a.auditDate)}</span></td>
                    <td>
                      <button className="vn-btn" style={{ fontSize: 11 }} onClick={() => openDetail(a.id)}>
                        {a.status === 'in_progress' ? 'Continue' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Start Audit Modal */}
      {showStart && (
        <div className="vn-modal-backdrop" onClick={() => setShowStart(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="vn-modal-header">
              <h3>Start New Audit</h3>
              <button onClick={() => setShowStart(false)}><span className="material-icons">close</span></button>
            </div>
            <div className="vn-modal-body">
              <div className="vn-field">
                <label className="vn-field-label">Checklist *</label>
                <select className="vn-input" value={startChecklistId} onChange={e => setStartChecklistId(e.target.value)}>
                  <option value="">Select a checklist...</option>
                  {checklists.map(c => <option key={c.id} value={c.id}>{c.title} ({c.category})</option>)}
                </select>
              </div>
              <div className="vn-field" style={{ marginTop: 12 }}>
                <label className="vn-field-label">Auditor Name</label>
                <input className="vn-input" value={startAuditorName} onChange={e => setStartAuditorName(e.target.value)} placeholder="Who is performing this audit?" />
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn" onClick={() => setShowStart(false)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={startAudit} disabled={!startChecklistId}>Start Audit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
