import React, { useEffect, useState, useMemo } from 'react';
import { API_URL } from '../api';
import { VnPageHeader, VnChip } from './components';

/* ── Types ────────────────────────────────────────────────── */

interface LaneScore {
  dimensionName: string;
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  exceptionCount: number;
  delayCount: number;
  damageCount: number;
  complianceCount: number;
  capaCount: number;
  avgResolutionHours: number | null;
  lastIssueAt: string | null;
  openCount: number;
  closedCount: number;
}

type SortField =
  | 'dimensionName'
  | 'totalIssues'
  | 'criticalCount'
  | 'highCount'
  | 'exceptionCount'
  | 'delayCount'
  | 'damageCount'
  | 'capaRate'
  | 'avgResolutionHours'
  | 'openCount';

type SortOrder = 'asc' | 'desc';

/* ── Helpers ──────────────────────────────────────────────── */

function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '--';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function capaRate(row: LaneScore): number {
  if (row.totalIssues === 0) return 0;
  return (row.capaCount / row.totalIssues) * 100;
}

function getSortValue(row: LaneScore, field: SortField): number | string {
  switch (field) {
    case 'dimensionName': return row.dimensionName.toLowerCase();
    case 'capaRate': return capaRate(row);
    case 'avgResolutionHours': return row.avgResolutionHours ?? -1;
    default: return (row as Record<string, unknown>)[field] as number;
  }
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextQualityLaneAnalysis() {
  const [data, setData] = useState<LaneScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('totalIssues');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_URL}/api/v1/quality/reports/lane-analysis`);
        if (!res.ok) throw new Error(`Failed to load lane analysis (${res.status})`);
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

  /* ── Summary stats ──────────────────────────────────────── */
  const totalLanes = data.length;
  const totalIssuesAll = data.reduce((s, r) => s + r.totalIssues, 0);
  const lanesWithCritical = data.filter(r => r.criticalCount > 0).length;

  const thStyle: React.CSSProperties = { cursor: 'pointer', textAlign: 'right' };

  return (
    <>
      <VnPageHeader
        title="Lane Quality Analysis"
        subtitle="Quality performance metrics across all lanes"
      />

      {/* Stats row */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">route</span>
          </div>
          <div>
            <div className="vn-stat-value">{totalLanes}</div>
            <div className="vn-stat-label">Lanes</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning">
            <span className="material-icons">report_problem</span>
          </div>
          <div>
            <div className="vn-stat-value">{totalIssuesAll}</div>
            <div className="vn-stat-label">Total Issues</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error">
            <span className="material-icons">error</span>
          </div>
          <div>
            <div className="vn-stat-value">{lanesWithCritical}</div>
            <div className="vn-stat-label">Lanes with Critical</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="vn-card" style={{ marginTop: 24 }}>
        {sorted.length === 0 ? (
          <div className="vn-empty">
            <span className="material-icons">route</span>
            <h3>No lane data</h3>
            <p>No lane quality data is available yet.</p>
          </div>
        ) : (
          <>
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('dimensionName')}>
                      Lane {sortIndicator('dimensionName')}
                    </th>
                    <th style={thStyle} onClick={() => handleSort('totalIssues')}>
                      Total Issues {sortIndicator('totalIssues')}
                    </th>
                    <th style={{ ...thStyle, textAlign: 'center' }} onClick={() => handleSort('criticalCount')}>
                      Critical {sortIndicator('criticalCount')}
                    </th>
                    <th style={{ ...thStyle, textAlign: 'center' }} onClick={() => handleSort('highCount')}>
                      High {sortIndicator('highCount')}
                    </th>
                    <th style={thStyle} onClick={() => handleSort('exceptionCount')}>
                      Exceptions {sortIndicator('exceptionCount')}
                    </th>
                    <th style={thStyle} onClick={() => handleSort('delayCount')}>
                      Delays {sortIndicator('delayCount')}
                    </th>
                    <th style={thStyle} onClick={() => handleSort('damageCount')}>
                      Damage {sortIndicator('damageCount')}
                    </th>
                    <th style={thStyle} onClick={() => handleSort('capaRate')}>
                      CAPA Rate {sortIndicator('capaRate')}
                    </th>
                    <th style={thStyle} onClick={() => handleSort('avgResolutionHours')}>
                      Avg Resolution {sortIndicator('avgResolutionHours')}
                    </th>
                    <th style={thStyle} onClick={() => handleSort('openCount')}>
                      Open Issues {sortIndicator('openCount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="vn-table-id">{row.dimensionName}</div>
                        <div className="vn-table-secondary">
                          {row.closedCount} closed
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.totalIssues}</td>
                      <td style={{ textAlign: 'center' }}>
                        {row.criticalCount > 0
                          ? <VnChip variant="error">{row.criticalCount}</VnChip>
                          : <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>0</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {row.highCount > 3
                          ? <VnChip variant="warning">{row.highCount}</VnChip>
                          : <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>{row.highCount}</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{row.exceptionCount}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{row.delayCount}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{row.damageCount}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>
                        {row.totalIssues > 0
                          ? `${capaRate(row).toFixed(1)}%`
                          : '--'}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {formatHours(row.avgResolutionHours)}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>
                        {row.openCount > 0
                          ? <span style={{ fontWeight: 600, color: 'var(--error)' }}>{row.openCount}</span>
                          : <span style={{ color: 'var(--on-surface-variant)' }}>0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{
              padding: '12px 20px',
              fontSize: 13,
              color: 'var(--on-surface-variant)',
              borderTop: '1px solid var(--outline-variant)',
              fontStyle: 'italic',
            }}>
              Lanes with zero issues are not shown
            </div>
          </>
        )}
      </div>
    </>
  );
}
