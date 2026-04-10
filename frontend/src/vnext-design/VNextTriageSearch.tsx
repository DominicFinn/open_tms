import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

const SEVERITY_CHIP: Record<string, string> = { high: 'error', medium: 'warning', low: 'secondary' };
const STATUS_CHIP: Record<string, string> = { new: 'info', investigating: 'warning', escalated: 'error', resolved: 'success', closed: 'secondary' };
const CATEGORIES = ['Delivery Delay', 'Freight Damage', 'Delivery', 'Documentation', 'Equipment', 'Communication', 'Compliance', 'Billing', 'Weather', 'General'];

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function VNextTriageSearch() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [category, setCategory] = useState('');
  const [showNoise, setShowNoise] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 25;

  const doSearch = async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    if (category) params.set('category', category);
    if (showNoise) params.set('isNoise', 'true');
    try {
      const res = await fetch(`${API_URL}/api/v1/issues?${params}`).then(r => r.json());
      if (res.data) { setIssues(res.data.issues || []); setTotal(res.data.total || 0); }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { doSearch(); }, [page, showNoise]);

  return (
    <>
      <div className="vn-page-header">
        <div><h1>Search Issues</h1><p>Find and filter issues across all time</p></div>
      </div>

      {/* Search bar */}
      <div className="vn-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="vn-input" style={{ flex: 1, fontSize: 16 }} placeholder="Search by title, description, or issue number..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(0); doSearch(); } }} />
          <button className="vn-btn vn-btn-primary" onClick={() => { setPage(0); doSearch(); }}>
            <span className="material-icons">search</span> Search
          </button>
        </div>

        {/* Filters */}
        <div className="vn-filters" style={{ borderBottom: 'none', padding: 0 }}>
          <select className="vn-filter-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {['new', 'investigating', 'escalated', 'resolved', 'closed'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="vn-filter-select" value={severity} onChange={e => setSeverity(e.target.value)}>
            <option value="">All Severities</option>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
          <select className="vn-filter-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={showNoise} onChange={e => setShowNoise(e.target.checked)} /> Show noise
          </label>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="loading-spinner" /></div>
      ) : (
        <div className="vn-card">
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--outline-variant)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
            {total} result{total !== 1 ? 's' : ''}
          </div>
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr><th>Issue</th><th>Title</th><th>Status</th><th>Severity</th><th>Category</th><th>Signal</th><th>Created</th></tr>
              </thead>
              <tbody>
                {issues.map(issue => (
                  <tr key={issue.id} onClick={() => navigate(`/triage/issues/${issue.id}`)} style={{ cursor: 'pointer', opacity: issue.isNoise ? 0.5 : 1 }}>
                    <td><span className="vn-table-id">{issue.issueNumber}</span></td>
                    <td style={{ maxWidth: 300 }}>{issue.title}</td>
                    <td><span className={`vn-chip vn-chip-${STATUS_CHIP[issue.status] || 'secondary'}`} style={{ textTransform: 'capitalize' }}>{issue.status}</span></td>
                    <td><span className={`vn-chip vn-chip-${SEVERITY_CHIP[issue.severity] || 'secondary'}`}>{issue.severity}</span></td>
                    <td>{issue.category || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 24, height: 4, borderRadius: 2, background: 'var(--outline-variant)', overflow: 'hidden' }}>
                          <div style={{ width: `${issue.signalScore}%`, height: '100%', borderRadius: 2, background: issue.signalScore >= 70 ? 'var(--success)' : issue.signalScore >= 40 ? 'var(--warning)' : 'var(--error)' }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{issue.signalScore}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{timeAgo(issue.createdAt)}</td>
                  </tr>
                ))}
                {issues.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--on-surface-variant)' }}>No issues found</td></tr>}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {total > limit && (
            <div style={{ padding: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button className="vn-btn vn-btn-outline vn-btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span style={{ fontSize: 13, alignSelf: 'center', color: 'var(--on-surface-variant)' }}>Page {page + 1} of {Math.ceil(total / limit)}</span>
              <button className="vn-btn vn-btn-outline vn-btn-sm" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
