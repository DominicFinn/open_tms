import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { VnPageHeader, VnTabs, VnFilterBar, VnChip } from './components';

interface QualitySummary {
  [key: string]: unknown;
  id: string;
  orgId: string;
  dimensionType: string;
  dimensionId: string;
  dimensionName: string;
  totalIssues: number;
  exceptionCount: number;
  delayCount: number;
  damageCount: number;
  complianceCount: number;
  otherCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  capaCount: number;
  avgResolutionHours: number | null;
  lastIssueAt: string | null;
}

type DimensionTab = 'carrier' | 'lane' | 'location' | 'customer';

type SortField =
  | 'dimensionName'
  | 'totalIssues'
  | 'criticalCount'
  | 'highCount'
  | 'exceptionCount'
  | 'delayCount'
  | 'damageCount'
  | 'complianceCount'
  | 'capaCount'
  | 'avgResolutionHours'
  | 'lastIssueAt';

type SortOrder = 'asc' | 'desc';

function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return 'N/A';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const TABS: { key: DimensionTab; label: string; icon: string }[] = [
  { key: 'carrier', label: 'Carriers', icon: 'local_shipping' },
  { key: 'lane', label: 'Lanes', icon: 'route' },
  { key: 'location', label: 'Locations', icon: 'location_on' },
  { key: 'customer', label: 'Customers', icon: 'business' },
];

export default function VNextQualityIssueSummaries() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DimensionTab>('carrier');
  const [summaries, setSummaries] = useState<QualitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('totalIssues');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const params = new URLSearchParams({
          dimensionType: activeTab,
          sortBy: sortBy,
          sortOrder: sortOrder,
          limit: '50',
        });
        const res = await fetch(`${API_URL}/api/v1/quality/summaries?${params}`);
        if (!res.ok) throw new Error(`Failed to load summaries (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setSummaries(json.data || []);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load quality summaries');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, sortBy, sortOrder]);

  const filtered = useMemo(() => {
    if (!search) return summaries;
    const q = search.toLowerCase();
    return summaries.filter(s => s.dimensionName.toLowerCase().includes(q));
  }, [summaries, search]);

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

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vn-alert vn-alert-error">
        <span className="material-icons">error</span>
        <div className="vn-alert-content">{error}</div>
      </div>
    );
  }

  return (
    <>
      <VnPageHeader
        title="Issue Analysis"
        subtitle="Quality metrics by carrier, lane, location, and customer"
      />

      <VnTabs
        tabs={TABS.map(t => ({ key: t.key, label: t.label, icon: t.icon }))}
        activeTab={activeTab}
        onTabChange={(key) => {
          setActiveTab(key as DimensionTab);
          setSearch('');
        }}
      />

      <div className="vn-card" style={{ marginTop: 24 }}>
        <VnFilterBar
          searchPlaceholder={`Search ${TABS.find(t => t.key === activeTab)?.label.toLowerCase() || ''}...`}
          searchValue={search}
          onSearchChange={setSearch}
        />

        {filtered.length === 0 ? (
          <div className="vn-empty">
            <span className="material-icons">analytics</span>
            <h3>No data found</h3>
            <p>
              {search
                ? `No ${TABS.find(t => t.key === activeTab)?.label.toLowerCase() || 'results'} match your search.`
                : `No quality issue data available for ${TABS.find(t => t.key === activeTab)?.label.toLowerCase() || 'this dimension'} yet.`}
            </p>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('dimensionName')}>
                    Name {sortIndicator('dimensionName')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('totalIssues')}>
                    Total Issues {sortIndicator('totalIssues')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('criticalCount')}>
                    Critical {sortIndicator('criticalCount')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('highCount')}>
                    High {sortIndicator('highCount')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('exceptionCount')}>
                    Exceptions {sortIndicator('exceptionCount')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('delayCount')}>
                    Delays {sortIndicator('delayCount')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('damageCount')}>
                    Damage {sortIndicator('damageCount')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('complianceCount')}>
                    Compliance {sortIndicator('complianceCount')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('capaCount')}>
                    CAPA Required {sortIndicator('capaCount')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('avgResolutionHours')}>
                    Avg Resolution {sortIndicator('avgResolutionHours')}
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('lastIssueAt')}>
                    Last Issue {sortIndicator('lastIssueAt')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{s.dimensionName}</span>
                      <div className="vn-table-secondary">
                        {s.openCount} open / {s.inProgressCount} in progress / {s.resolvedCount} resolved
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {s.totalIssues}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {s.criticalCount > 0
                        ? <VnChip variant="error">{s.criticalCount}</VnChip>
                        : <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>0</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {s.highCount > 0
                        ? <VnChip variant="warning">{s.highCount}</VnChip>
                        : <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>0</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>{s.exceptionCount}</td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>{s.delayCount}</td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>{s.damageCount}</td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>{s.complianceCount}</td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>
                      {s.capaCount > 0
                        ? <span style={{ fontWeight: 600, color: 'var(--error)' }}>{s.capaCount}</span>
                        : '0'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                      {formatHours(s.avgResolutionHours)}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                      {timeAgo(s.lastIssueAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
