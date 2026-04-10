import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Constants ────────────────────────────────────────────── */

const SEVERITY_CHIP: Record<string, string> = { high: 'error', medium: 'warning', low: 'secondary' };
const STATUS_CHIP: Record<string, string> = { new: 'info', investigating: 'warning', escalated: 'error', resolved: 'success', closed: 'secondary' };
const CATEGORIES = ['Delivery Delay', 'Freight Damage', 'Delivery', 'Documentation', 'Equipment', 'Communication', 'Compliance', 'Billing', 'Weather', 'General'];

/* ── Helpers ──────────────────────────────────────────────── */

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function signalColor(score: number): string {
  if (score >= 70) return 'var(--success)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--error)';
}

/* ── Main Component ───────────────────────────────────────── */

export default function VNextTriageSearch() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search & filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [showNoise, setShowNoise] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const limit = 25;

  /* ── Fetch ────────────────────────────────────────────── */

  const doSearch = async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    if (priority) params.set('priority', priority);
    if (category) params.set('category', category);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (customerId) params.set('customerId', customerId);
    if (carrierId) params.set('carrierId', carrierId);
    if (showNoise) params.set('isNoise', 'true');
    try {
      const res = await fetch(`${API_URL}/api/v1/issues?${params}`);
      const json = await res.json();
      if (json.data) {
        setIssues(json.data.issues || []);
        setTotal(json.data.total || 0);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to search issues');
    }
    setLoading(false);
  };

  useEffect(() => { doSearch(); }, [page, showNoise]);

  const handleSearchSubmit = () => { setPage(0); doSearch(); };

  /* ── Render ──────────────────────────────────────────── */

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Search Issues</h1>
          <p>Find and filter issues across all time</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline" onClick={() => navigate('/triage/boards/new')}>
            <span className="material-icons">bookmark_add</span>
            Save as Board
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="vn-card" style={{ marginBottom: 20 }}>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              className="vn-input"
              style={{ flex: 1, fontSize: 16 }}
              placeholder="Search by title, description, or issue number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearchSubmit(); }}
            />
            <button className="vn-btn vn-btn-primary" onClick={handleSearchSubmit}>
              <span className="material-icons">search</span>
              Search
            </button>
          </div>

          {/* Quick filters */}
          <div className="vn-filters" style={{ borderBottom: 'none', padding: 0 }}>
            <select className="vn-filter-select" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {['new', 'investigating', 'escalated', 'resolved', 'closed'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="vn-filter-select" value={severity} onChange={e => setSeverity(e.target.value)}>
              <option value="">All Severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select className="vn-filter-select" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="">All Priorities</option>
              {[1, 2, 3, 4, 5].map(p => (
                <option key={p} value={p}>P{p}</option>
              ))}
            </select>
            <select className="vn-filter-select" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="vn-checkbox" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={showNoise} onChange={e => setShowNoise(e.target.checked)} />
              Show noise
            </label>
            <button
              className="vn-btn vn-btn-ghost vn-btn-sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ marginLeft: 'auto' }}
            >
              <span className="material-icons" style={{ fontSize: 16 }}>
                {showAdvanced ? 'expand_less' : 'tune'}
              </span>
              {showAdvanced ? 'Hide' : 'Advanced'}
            </button>
          </div>
        </div>

        {/* Advanced filters panel (collapsible) */}
        {showAdvanced && (
          <div style={{
            padding: '16px 20px', borderTop: '1px solid var(--outline-variant)',
            background: 'var(--surface-container)',
          }}>
            <div className="vn-form-grid" style={{ gap: '0 16px' }}>
              <div className="vn-field">
                <label className="vn-field-label">Date From</label>
                <input
                  type="date"
                  className="vn-input"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Date To</label>
                <input
                  type="date"
                  className="vn-input"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Customer ID</label>
                <input
                  className="vn-input"
                  placeholder="Filter by customer..."
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Carrier ID</label>
                <input
                  className="vn-input"
                  placeholder="Filter by carrier..."
                  value={carrierId}
                  onChange={e => setCarrierId(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={handleSearchSubmit}>
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="vn-alert vn-alert-warning" style={{ marginBottom: 16 }}>
          <span className="material-icons">warning</span>
          <div className="vn-alert-content">{error}</div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <div className="vn-card">
          <div style={{
            padding: '12px 20px', borderBottom: '1px solid var(--outline-variant)',
            fontSize: 13, color: 'var(--on-surface-variant)',
          }}>
            {total} result{total !== 1 ? 's' : ''}
          </div>
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Issue #</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Priority</th>
                  <th>Category</th>
                  <th>Assignee</th>
                  <th>Signal</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(issue => (
                  <tr
                    key={issue.id}
                    onClick={() => navigate(`/triage/issues/${issue.id}`)}
                    style={{ cursor: 'pointer', opacity: issue.isNoise ? 0.5 : 1 }}
                  >
                    <td><span className="vn-table-id">{issue.issueNumber}</span></td>
                    <td style={{ maxWidth: 280 }}>
                      {issue.title}
                      {issue.isNoise && (
                        <span className="vn-chip vn-chip-secondary" style={{ fontSize: 10, marginLeft: 6 }}>noise</span>
                      )}
                    </td>
                    <td>
                      <span className={`vn-chip vn-chip-${STATUS_CHIP[issue.status] || 'secondary'}`} style={{ textTransform: 'capitalize' }}>
                        {issue.status}
                      </span>
                    </td>
                    <td>
                      <span className={`vn-chip vn-chip-${SEVERITY_CHIP[issue.severity] || 'secondary'}`} style={{ textTransform: 'capitalize' }}>
                        {issue.severity}
                      </span>
                    </td>
                    <td>
                      {issue.priority != null ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                          P{issue.priority}
                        </span>
                      ) : '\u2014'}
                    </td>
                    <td>{issue.category || '\u2014'}</td>
                    <td>
                      {issue.assigneeName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: 'var(--primary)', color: 'var(--on-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 600,
                          }}>
                            {(issue.assigneeName || '').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <span style={{ fontSize: 12 }}>{issue.assigneeName}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--on-surface-variant)', fontSize: 12 }}>\u2014</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          width: 24, height: 4, borderRadius: 2,
                          background: 'var(--outline-variant)', overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${issue.signalScore || 0}%`, height: '100%',
                            borderRadius: 2, background: signalColor(issue.signalScore || 0),
                          }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{issue.signalScore ?? '\u2014'}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{timeAgo(issue.createdAt)}</td>
                  </tr>
                ))}
                {issues.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--on-surface-variant)' }}>
                      No issues found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div style={{ padding: 16, display: 'flex', justifyContent: 'center', gap: 8, borderTop: '1px solid var(--outline-variant)' }}>
              <button
                className="vn-btn vn-btn-outline vn-btn-sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <span style={{ fontSize: 13, alignSelf: 'center', color: 'var(--on-surface-variant)' }}>
                Page {page + 1} of {Math.ceil(total / limit)}
              </span>
              <button
                className="vn-btn vn-btn-outline vn-btn-sm"
                disabled={(page + 1) * limit >= total}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
