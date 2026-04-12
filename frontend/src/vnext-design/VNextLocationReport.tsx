import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import { LOCATION_TYPE_META, getLocationTypeMeta } from './locationTypesMeta';

interface LocationRow {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  locationType: string | null;
  appointmentRequired: boolean;
  shipmentsOutbound: number;
  shipmentsInbound: number;
  ordersOutbound: number;
  ordersInbound: number;
  shipmentsInTransitTo: number;
}

interface TypeBreakdownEntry {
  count: number;
  shipmentsInbound: number;
  shipmentsOutbound: number;
  ordersInbound: number;
  ordersOutbound: number;
}

interface ReportData {
  summary: {
    totalLocations: number;
    totalShipmentsInbound: number;
    totalShipmentsOutbound: number;
    totalOrdersInbound: number;
    totalOrdersOutbound: number;
    totalInTransit: number;
  };
  typeBreakdown: Record<string, TypeBreakdownEntry>;
  locations: LocationRow[];
}

type SortField = 'name' | 'locationType' | 'shipmentsInbound' | 'shipmentsOutbound' | 'ordersInbound' | 'ordersOutbound' | 'shipmentsInTransitTo';

export default function VNextLocationReport() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('shipmentsInbound');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Active tab
  const [tab, setTab] = useState<'activity' | 'breakdown'>('activity');

  useEffect(() => {
    fetchReport();
  }, [typeFilter, dateFrom, dateTo]);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('locationType', typeFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const qs = params.toString();
      const res = await fetch(`${API_URL}/api/v1/reports/locations/activity${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error(`Failed to fetch report (${res.status})`);
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function sortIcon(field: SortField) {
    if (sortField !== field) return 'unfold_more';
    return sortDir === 'asc' ? 'expand_less' : 'expand_more';
  }

  // Filter & sort locations
  const filteredLocations = (data?.locations || [])
    .filter(l => {
      if (!search) return true;
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || (l.state || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

  if (loading && !data) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading report...</h3>
      </div>
    );
  }

  if (error) return <div className="vn-alert vn-alert-error">{error}</div>;
  if (!data) return null;

  const { summary, typeBreakdown } = data;

  // Find the max volume for the bar chart scaling
  const maxTypeVolume = Math.max(
    1,
    ...Object.values(typeBreakdown).map(t => t.shipmentsInbound + t.shipmentsOutbound)
  );

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Location Activity</h1>
          <p>Shipment and order volume across your network</p>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">place</span></div>
          <div>
            <div className="vn-stat-value">{summary.totalLocations}</div>
            <div className="vn-stat-label">Locations</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">call_received</span></div>
          <div>
            <div className="vn-stat-value">{summary.totalShipmentsInbound}</div>
            <div className="vn-stat-label">Shipments Inbound</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">call_made</span></div>
          <div>
            <div className="vn-stat-value">{summary.totalShipmentsOutbound}</div>
            <div className="vn-stat-label">Shipments Outbound</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">local_shipping</span></div>
          <div>
            <div className="vn-stat-value">{summary.totalInTransit}</div>
            <div className="vn-stat-label">In Transit</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="vn-tabs" style={{ marginBottom: '1rem' }}>
        <button className={`vn-tab${tab === 'activity' ? ' active' : ''}`} onClick={() => setTab('activity')}>
          <span className="material-icons" style={{ fontSize: 18 }}>table_chart</span>
          Location Activity
        </button>
        <button className={`vn-tab${tab === 'breakdown' ? ' active' : ''}`} onClick={() => setTab('breakdown')}>
          <span className="material-icons" style={{ fontSize: 18 }}>donut_small</span>
          Type Breakdown
        </button>
      </div>

      {/* ── Activity Tab ── */}
      {tab === 'activity' && (
        <div className="vn-card">
          <div className="vn-filters">
            <div className="vn-filter-group" style={{ flex: 1 }}>
              <span className="material-icons">search</span>
              <input
                className="vn-filter-input"
                placeholder="Search by name, city, state..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <select className="vn-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {Object.entries(LOCATION_TYPE_META).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
            <input
              type="date"
              className="vn-filter-input"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ width: 140 }}
              title="From date"
            />
            <input
              type="date"
              className="vn-filter-input"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ width: 140 }}
              title="To date"
            />
          </div>

          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                    Location <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle' }}>{sortIcon('name')}</span>
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('locationType')}>
                    Type <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle' }}>{sortIcon('locationType')}</span>
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('shipmentsInbound')}>
                    Shipments In <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle' }}>{sortIcon('shipmentsInbound')}</span>
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('shipmentsOutbound')}>
                    Shipments Out <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle' }}>{sortIcon('shipmentsOutbound')}</span>
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('ordersInbound')}>
                    Orders In <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle' }}>{sortIcon('ordersInbound')}</span>
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('ordersOutbound')}>
                    Orders Out <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle' }}>{sortIcon('ordersOutbound')}</span>
                  </th>
                  <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('shipmentsInTransitTo')}>
                    In Transit <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle' }}>{sortIcon('shipmentsInTransitTo')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLocations.map(loc => {
                  const meta = getLocationTypeMeta(loc.locationType);
                  return (
                    <tr key={loc.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="material-icons" style={{ fontSize: 20, color: 'var(--on-surface-variant)' }}>
                            {meta?.icon || 'place'}
                          </span>
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{loc.name}</span>
                            <div className="vn-table-secondary">{loc.city}{loc.state ? `, ${loc.state}` : ''} &middot; {loc.country}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {meta ? (
                          <span className={`vn-chip ${meta.chip}`} style={{ fontSize: 11 }}>
                            <span className="material-icons" style={{ fontSize: 14 }}>{meta.icon}</span>
                            {meta.label}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>Unclassified</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{loc.shipmentsInbound}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{loc.shipmentsOutbound}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{loc.ordersInbound}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{loc.ordersOutbound}</td>
                      <td style={{ textAlign: 'right' }}>
                        {loc.shipmentsInTransitTo > 0 ? (
                          <span className="vn-chip vn-chip-warning" style={{ fontSize: 11 }}>
                            <span className="material-icons" style={{ fontSize: 14 }}>local_shipping</span>
                            {loc.shipmentsInTransitTo}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--on-surface-variant)' }}>0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredLocations.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="vn-empty">
                        <span className="material-icons">search_off</span>
                        <h3>No locations found</h3>
                        <p>Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Type Breakdown Tab ── */}
      {tab === 'breakdown' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Locations by type */}
          <div className="vn-card">
            <div className="vn-card-body" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--on-surface)' }}>
                <span className="material-icons" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>pie_chart</span>
                Locations by Type
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(typeBreakdown)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([type, entry]) => {
                    const meta = getLocationTypeMeta(type === 'unclassified' ? null : type);
                    const label = meta?.label || 'Unclassified';
                    const icon = meta?.icon || 'help_outline';
                    const pct = summary.totalLocations > 0 ? (entry.count / summary.totalLocations) * 100 : 0;
                    return (
                      <div key={type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="material-icons" style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}>{icon}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{label}</span>
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                            {entry.count} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-container)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: 'var(--primary)', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Volume by type */}
          <div className="vn-card">
            <div className="vn-card-body" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--on-surface)' }}>
                <span className="material-icons" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>bar_chart</span>
                Shipment Volume by Type
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(typeBreakdown)
                  .sort(([, a], [, b]) => (b.shipmentsInbound + b.shipmentsOutbound) - (a.shipmentsInbound + a.shipmentsOutbound))
                  .map(([type, entry]) => {
                    const meta = getLocationTypeMeta(type === 'unclassified' ? null : type);
                    const label = meta?.label || 'Unclassified';
                    const icon = meta?.icon || 'help_outline';
                    const total = entry.shipmentsInbound + entry.shipmentsOutbound;
                    const inPct = maxTypeVolume > 0 ? (entry.shipmentsInbound / maxTypeVolume) * 100 : 0;
                    const outPct = maxTypeVolume > 0 ? (entry.shipmentsOutbound / maxTypeVolume) * 100 : 0;
                    return (
                      <div key={type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="material-icons" style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}>{icon}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{label}</span>
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{total} shipments</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4, height: 8 }}>
                          <div style={{ flex: `0 0 ${inPct}%`, borderRadius: 4, background: 'var(--success)', transition: 'flex 0.3s ease' }}
                            title={`Inbound: ${entry.shipmentsInbound}`} />
                          <div style={{ flex: `0 0 ${outPct}%`, borderRadius: 4, background: 'var(--info)', transition: 'flex 0.3s ease' }}
                            title={`Outbound: ${entry.shipmentsOutbound}`} />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: 2, fontSize: 11, color: 'var(--on-surface-variant)' }}>
                          <span>In: {entry.shipmentsInbound}</span>
                          <span>Out: {entry.shipmentsOutbound}</span>
                          <span>Orders In: {entry.ordersInbound}</span>
                          <span>Orders Out: {entry.ordersOutbound}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
