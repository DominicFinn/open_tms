import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface Lane {
  id: string;
  name: string;
  originId: string;
  destinationId: string;
  origin: { name: string; city: string; state: string };
  destination: { name: string; city: string; state: string };
  distance: number | null;
  notes: string | null;
  status: string;
  serviceLevel: string | null;
  laneCarriers: any[];
  stops: any[];
  _count?: { shipments: number };
}

export default function VNextLanes() {
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    async function fetchLanes() {
      try {
        const res = await fetch(`${API_URL}/api/v1/lanes`);
        if (!res.ok) throw new Error(`Failed to fetch lanes (${res.status})`);
        const json = await res.json();
        setLanes(json.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load lanes');
      } finally {
        setLoading(false);
      }
    }
    fetchLanes();
  }, []);

  const stats = {
    total: lanes.length,
    active: lanes.filter(l => l.status === 'ACTIVE').length,
    avgDistance: lanes.length > 0 ? Math.round(lanes.reduce((s, l) => s + (l.distance || 0), 0) / lanes.length) : 0,
    totalCarriers: lanes.reduce((s, l) => s + (l.laneCarriers?.length || 0), 0),
  };

  const filtered = lanes.filter(l => {
    if (statusFilter === 'active' && l.status !== 'ACTIVE') return false;
    if (statusFilter === 'inactive' && l.status === 'ACTIVE') return false;
    if (search) {
      const q = search.toLowerCase();
      const originLabel = `${l.origin?.city || ''}, ${l.origin?.state || ''}`;
      const destLabel = `${l.destination?.city || ''}, ${l.destination?.state || ''}`;
      return originLabel.toLowerCase().includes(q) || destLabel.toLowerCase().includes(q) || (l.name || '').toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  if (error) {
    return <div className="vn-alert vn-alert-error">{error}</div>;
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Lanes</h1>
          <p>{lanes.length} lanes configured</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            New Lane
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">route</span></div>
          <div>
            <div className="vn-stat-value">{stats.total}</div>
            <div className="vn-stat-label">Total Lanes</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{stats.active}</div>
            <div className="vn-stat-label">Active</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">straighten</span></div>
          <div>
            <div className="vn-stat-value">{stats.avgDistance.toLocaleString()} km</div>
            <div className="vn-stat-label">Avg Distance</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">local_shipping</span></div>
          <div>
            <div className="vn-stat-value">{stats.totalCarriers}</div>
            <div className="vn-stat-label">Carriers Assigned</div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group" style={{ flex: 1 }}>
            <span className="material-icons">search</span>
            <input
              className="vn-filter-input"
              placeholder="Search by lane ID, origin, or destination..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses ({stats.total})</option>
            <option value="active">Active ({stats.active})</option>
            <option value="inactive">Inactive ({lanes.filter(l => l.status !== 'ACTIVE').length})</option>
          </select>
        </div>

        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Lane</th>
                <th>Distance</th>
                <th>Carriers</th>
                <th>Shipments</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span className="vn-route-dot origin" style={{ width: 10, height: 10 }} />
                        <span style={{ width: 2, height: 14, background: 'var(--outline-variant)', borderRadius: 1 }} />
                        <span className="vn-route-dot destination" style={{ width: 10, height: 10 }} />
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--on-surface)', fontSize: 14 }}>{l.origin?.city}, {l.origin?.state} &rarr; {l.destination?.city}, {l.destination?.state}</span>
                        <div className="vn-table-secondary">{l.name || l.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{l.distance ? `${l.distance.toLocaleString()} km` : '—'}</td>
                  <td style={{ fontSize: 13 }}>{l.laneCarriers?.length || 0}</td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{l._count?.shipments ?? 0}</td>
                  <td><span className={`vn-chip vn-chip-${l.status === 'ACTIVE' ? 'success' : 'error'}`}>{l.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="vn-empty">
                      <span className="material-icons">search_off</span>
                      <h3>No lanes found</h3>
                      <p>Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
