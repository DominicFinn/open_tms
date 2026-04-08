import React, { useState } from 'react';

const LANES = [
  { id: 'LN-001', origin: 'Chicago, IL', dest: 'Dallas, TX', distance: 1290, carriers: 4, shipments: 86, status: 'Active', statusColor: 'success' },
  { id: 'LN-002', origin: 'Los Angeles, CA', dest: 'Phoenix, AZ', distance: 598, carriers: 2, shipments: 42, status: 'Active', statusColor: 'success' },
  { id: 'LN-003', origin: 'Atlanta, GA', dest: 'Miami, FL', distance: 1062, carriers: 3, shipments: 64, status: 'Active', statusColor: 'success' },
  { id: 'LN-004', origin: 'New York, NY', dest: 'Boston, MA', distance: 346, carriers: 2, shipments: 38, status: 'Active', statusColor: 'success' },
  { id: 'LN-005', origin: 'Denver, CO', dest: 'Salt Lake City, UT', distance: 812, carriers: 1, shipments: 21, status: 'Active', statusColor: 'success' },
  { id: 'LN-006', origin: 'Seattle, WA', dest: 'Portland, OR', distance: 280, carriers: 2, shipments: 29, status: 'Inactive', statusColor: 'error' },
  { id: 'LN-007', origin: 'Houston, TX', dest: 'San Antonio, TX', distance: 317, carriers: 3, shipments: 55, status: 'Active', statusColor: 'success' },
  { id: 'LN-008', origin: 'Minneapolis, MN', dest: 'Milwaukee, WI', distance: 539, carriers: 1, shipments: 12, status: 'Inactive', statusColor: 'error' },
];

const stats = {
  total: LANES.length,
  active: LANES.filter(l => l.status === 'Active').length,
  avgDistance: Math.round(LANES.reduce((s, l) => s + l.distance, 0) / LANES.length),
  topLane: LANES.reduce((top, l) => l.shipments > top.shipments ? l : top, LANES[0]),
};

export default function VNextLanes() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = LANES.filter(l => {
    if (statusFilter === 'active' && l.status !== 'Active') return false;
    if (statusFilter === 'inactive' && l.status !== 'Inactive') return false;
    if (search) {
      const q = search.toLowerCase();
      return l.origin.toLowerCase().includes(q) || l.dest.toLowerCase().includes(q) || l.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Lanes</h1>
          <p>{LANES.length} lanes configured</p>
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
          <div className="vn-stat-icon warning"><span className="material-icons">emoji_events</span></div>
          <div>
            <div className="vn-stat-value">{stats.topLane.shipments}</div>
            <div className="vn-stat-label">Top Lane ({stats.topLane.origin.split(',')[0]})</div>
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
            <option value="inactive">Inactive ({LANES.filter(l => l.status === 'Inactive').length})</option>
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
                        <span style={{ fontWeight: 600, color: 'var(--on-surface)', fontSize: 14 }}>{l.origin} &rarr; {l.dest}</span>
                        <div className="vn-table-secondary">{l.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{l.distance.toLocaleString()} km</td>
                  <td style={{ fontSize: 13 }}>{l.carriers}</td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{l.shipments}</td>
                  <td><span className={`vn-chip vn-chip-${l.statusColor}`}>{l.status}</span></td>
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
