import React, { useEffect, useState, useMemo } from 'react';
import { API_URL } from '../api';
import { VnPageHeader, VnChip } from './components';

/* ── Types ────────────────────────────────────────────────── */

interface CapaRow {
  id: string;
  reportNumber: string;
  title: string;
  status: string;
  priority: string;
  rootCauseCategory: string | null;
  issue: {
    title: string;
    category: string;
    priority: string;
  } | null;
  followUpStats: {
    total: number;
    completed: number;
    overdue: number;
    effective: number;
    completionRate: number;
  };
  createdAt: string;
}

type SortField =
  | 'reportNumber'
  | 'title'
  | 'status'
  | 'priority'
  | 'completionRate'
  | 'overdue'
  | 'createdAt';

type SortOrder = 'asc' | 'desc';

/* ── Helpers ──────────────────────────────────────────────── */

function statusChipVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary' {
  switch (status) {
    case 'closed': return 'success';
    case 'open': return 'info';
    case 'in_progress': return 'primary';
    case 'draft': return 'secondary';
    default: return 'secondary';
  }
}

function priorityChipVariant(priority: string): 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary' {
  switch (priority) {
    case 'critical': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'low': return 'secondary';
    default: return 'secondary';
  }
}

function formatLabel(str: string | null): string {
  if (!str) return '--';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getSortValue(row: CapaRow, field: SortField): number | string {
  switch (field) {
    case 'reportNumber': return row.reportNumber.toLowerCase();
    case 'title': return row.title.toLowerCase();
    case 'status': return row.status;
    case 'priority': {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[row.priority] ?? 4;
    }
    case 'completionRate': return row.followUpStats.completionRate;
    case 'overdue': return row.followUpStats.overdue;
    case 'createdAt': return new Date(row.createdAt).getTime();
    default: return 0;
  }
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextQualityCapaEffectiveness() {
  const [data, setData] = useState<CapaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_URL}/api/v1/quality/reports/capa-effectiveness`);
        if (!res.ok) throw new Error(`Failed to load CAPA effectiveness report (${res.status})`);
        const json = await res.json();
        if (!cancelled) setData(json.data || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const aVal = getSortValue(a, sortBy);
      const bVal = getSortValue(b, sortBy);
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [data, sortBy, sortOrder]);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  }

  function sortIndicator(field: SortField) {
    if (sortBy !== field) return null;
    return (
      <span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginLeft: 2 }}>
        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
      </span>
    );
  }

  /* ── Loading ────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  /* ── Error ──────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="vn-alert vn-alert-error">
        <span className="material-icons">error</span>
        <div className="vn-alert-content">{error}</div>
      </div>
    );
  }

  /* ── Aggregate stats ────────────────────────────────────── */
  const totalCapas = data.length;
  const avgCompletionRate = totalCapas > 0
    ? data.reduce((s, r) => s + r.followUpStats.completionRate, 0) / totalCapas
    : 0;
  const totalOverdue = data.reduce((s, r) => s + r.followUpStats.overdue, 0);

  const thStyle: React.CSSProperties = { cursor: 'pointer', textAlign: 'right' };

  return (
    <>
      <VnPageHeader
        title="CAPA Effectiveness Report"
        subtitle="Corrective and preventive action completion and effectiveness tracking"
      />

      {/* Stats row */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">assignment</span>
          </div>
          <div>
            <div className="vn-stat-value">{totalCapas}</div>
            <div className="vn-stat-label">Total CAPAs</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{avgCompletionRate.toFixed(0)}%</div>
            <div className="vn-stat-label">Avg Completion Rate</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error">
            <span className="material-icons">schedule</span>
          </div>
          <div>
            <div className="vn-stat-value">{totalOverdue}</div>
            <div className="vn-stat-label">Overdue Follow-Ups</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="vn-card" style={{ marginTop: 24 }}>
        {sorted.length === 0 ? (
          <div className="vn-empty">
            <span className="material-icons">assignment</span>
            <h3>No CAPA data</h3>
            <p>No CAPA reports are available yet.</p>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('reportNumber')}>
                    Report # {sortIndicator('reportNumber')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('title')}>
                    Title {sortIndicator('title')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('status')}>
                    Status {sortIndicator('status')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('priority')}>
                    Priority {sortIndicator('priority')}
                  </th>
                  <th>Root Cause</th>
                  <th>Issue Category</th>
                  <th style={thStyle}>Follow-Ups</th>
                  <th style={{ ...thStyle, cursor: 'pointer', minWidth: 140 }} onClick={() => handleSort('completionRate')}>
                    Completion Rate {sortIndicator('completionRate')}
                  </th>
                  <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('overdue')}>
                    Overdue {sortIndicator('overdue')}
                  </th>
                  <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('createdAt')}>
                    Created {sortIndicator('createdAt')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(row => {
                  const hasOverdue = row.followUpStats.overdue > 0;
                  const lowCompletion = row.followUpStats.completionRate < 50;
                  const rowWarning = hasOverdue || lowCompletion;

                  return (
                    <tr
                      key={row.id}
                      style={rowWarning ? { background: 'var(--warning-container, var(--surface-container))' } : undefined}
                    >
                      <td>
                        <div className="vn-table-id">{row.reportNumber}</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{row.title}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <VnChip variant={statusChipVariant(row.status)}>
                          {formatLabel(row.status)}
                        </VnChip>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <VnChip variant={priorityChipVariant(row.priority)}>
                          {formatLabel(row.priority)}
                        </VnChip>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {formatLabel(row.rootCauseCategory)}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {row.issue ? formatLabel(row.issue.category) : '--'}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>{row.followUpStats.completed}</span>
                        <span style={{ color: 'var(--on-surface-variant)' }}> / {row.followUpStats.total}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div style={{
                            width: 60,
                            height: 6,
                            borderRadius: 3,
                            background: 'var(--outline-variant)',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${Math.min(row.followUpStats.completionRate, 100)}%`,
                              height: '100%',
                              borderRadius: 3,
                              background: row.followUpStats.completionRate >= 80
                                ? 'var(--success)'
                                : row.followUpStats.completionRate >= 50
                                  ? 'var(--warning)'
                                  : 'var(--error)',
                            }} />
                          </div>
                          <span style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: row.followUpStats.completionRate < 50
                              ? 'var(--error)'
                              : 'var(--on-surface)',
                            minWidth: 36,
                            textAlign: 'right',
                          }}>
                            {row.followUpStats.completionRate.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>
                        {row.followUpStats.overdue > 0
                          ? <VnChip variant="warning">{row.followUpStats.overdue}</VnChip>
                          : <span style={{ color: 'var(--on-surface-variant)' }}>0</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {formatDate(row.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
