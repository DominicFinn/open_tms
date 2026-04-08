import React, { useState } from 'react';

const LOCATIONS = [
  { id: 'LOC-001', name: 'Chicago Distribution Center', address: '1400 W Carroll Ave', city: 'Chicago', state: 'IL', country: 'US', lat: 41.8827, lng: -87.6588, status: 'Active', statusColor: 'success' },
  { id: 'LOC-002', name: 'Dallas Warehouse', address: '2500 Irving Blvd', city: 'Dallas', state: 'TX', country: 'US', lat: 32.7942, lng: -96.8289, status: 'Active', statusColor: 'success' },
  { id: 'LOC-003', name: 'Los Angeles Terminal', address: '800 E 7th St', city: 'Los Angeles', state: 'CA', country: 'US', lat: 34.0375, lng: -118.2428, status: 'Active', statusColor: 'success' },
  { id: 'LOC-004', name: 'Atlanta Hub', address: '3200 Peachtree Rd NE', city: 'Atlanta', state: 'GA', country: 'US', lat: 33.8440, lng: -84.3620, status: 'Active', statusColor: 'success' },
  { id: 'LOC-005', name: 'New York Cross-Dock', address: '55 Water St', city: 'New York', state: 'NY', country: 'US', lat: 40.7033, lng: -74.0099, status: 'Active', statusColor: 'success' },
  { id: 'LOC-006', name: 'Denver Cold Storage', address: '4700 Brighton Blvd', city: 'Denver', state: 'CO', country: 'US', lat: 39.7793, lng: -104.9713, status: 'Active', statusColor: 'success' },
  { id: 'LOC-007', name: 'Seattle Port Facility', address: '1000 Alaskan Way', city: 'Seattle', state: 'WA', country: 'US', lat: 47.6062, lng: -122.3405, status: 'Archived', statusColor: 'error' },
  { id: 'LOC-008', name: 'Miami Import Yard', address: '2200 NW 21st Terrace', city: 'Miami', state: 'FL', country: 'US', lat: 25.7985, lng: -80.2278, status: 'Active', statusColor: 'success' },
  { id: 'LOC-009', name: 'Phoenix Staging Area', address: '1601 W Jackson St', city: 'Phoenix', state: 'AZ', country: 'US', lat: 33.4342, lng: -112.0880, status: 'Active', statusColor: 'success' },
  { id: 'LOC-010', name: 'Minneapolis Yard (Old)', address: '100 N 6th St', city: 'Minneapolis', state: 'MN', country: 'US', lat: null, lng: null, status: 'Archived', statusColor: 'error' },
];

const stats = {
  total: LOCATIONS.length,
  active: LOCATIONS.filter(l => l.status === 'Active').length,
  withCoords: LOCATIONS.filter(l => l.lat !== null && l.lng !== null).length,
  archived: LOCATIONS.filter(l => l.status === 'Archived').length,
};

export default function VNextLocations() {
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');

  const filtered = LOCATIONS.filter(l => {
    if (countryFilter !== 'all' && l.country !== countryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || l.state.toLowerCase().includes(q) || l.address.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Locations</h1>
          <p>{LOCATIONS.length} locations managed</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            New Location
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">place</span></div>
          <div>
            <div className="vn-stat-value">{stats.total}</div>
            <div className="vn-stat-label">Total Locations</div>
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
          <div className="vn-stat-icon info"><span className="material-icons">my_location</span></div>
          <div>
            <div className="vn-stat-value">{stats.withCoords}</div>
            <div className="vn-stat-label">With Coordinates</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">archive</span></div>
          <div>
            <div className="vn-stat-value">{stats.archived}</div>
            <div className="vn-stat-label">Archived</div>
          </div>
        </div>
      </div>

      {/* Map view */}
      {viewMode === 'map' && (
        <div style={{ marginBottom: 24 }}>
          <div className="vn-map tall" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <span className="material-icons" style={{ fontSize: 48, color: 'var(--on-surface-variant)', opacity: 0.5 }}>map</span>
            <span style={{ fontSize: 14, color: 'var(--on-surface-variant)' }}>Map view — {filtered.filter(l => l.lat !== null).length} locations with coordinates would render here</span>
          </div>
        </div>
      )}

      {/* Table Card */}
      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group" style={{ flex: 1 }}>
            <span className="material-icons">search</span>
            <input
              className="vn-filter-input"
              placeholder="Search by name, address, city, state..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <select className="vn-filter-select" value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
            <option value="all">All Countries</option>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="MX">Mexico</option>
          </select>
          <div style={{ display: 'flex', border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
            <button
              className="vn-btn-icon"
              style={{ borderRadius: 0, background: viewMode === 'table' ? 'var(--surface-container)' : 'transparent' }}
              onClick={() => setViewMode('table')}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>view_list</span>
            </button>
            <button
              className="vn-btn-icon"
              style={{ borderRadius: 0, background: viewMode === 'map' ? 'var(--surface-container)' : 'transparent' }}
              onClick={() => setViewMode('map')}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>map</span>
            </button>
          </div>
        </div>

        {viewMode === 'table' && (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>City / State</th>
                  <th>Country</th>
                  <th>Coordinates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{l.name}</span>
                      <div className="vn-table-secondary">{l.id}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{l.address}</td>
                    <td style={{ fontSize: 13 }}>{l.city}, {l.state}</td>
                    <td><span className="vn-chip vn-chip-secondary">{l.country}</span></td>
                    <td>
                      {l.lat !== null && l.lng !== null ? (
                        <span className="vn-chip vn-chip-secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                          {l.lat.toFixed(3)}, {l.lng.toFixed(3)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>No coordinates</span>
                      )}
                    </td>
                    <td><span className={`vn-chip vn-chip-${l.statusColor}`}>{l.status}</span></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="vn-empty">
                        <span className="material-icons">search_off</span>
                        <h3>No locations found</h3>
                        <p>Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
