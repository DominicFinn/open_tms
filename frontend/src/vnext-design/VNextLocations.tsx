import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface ArrivalCriteriaSummary {
  id: string;
  criteriaType: string;
}

interface Location {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
  lat: number | null;
  lng: number | null;
  archived: boolean;
  arrivalCriteria?: ArrivalCriteriaSummary[];
}

export default function VNextLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');

  useEffect(() => {
    async function fetchLocations() {
      try {
        const res = await fetch(`${API_URL}/api/v1/locations`);
        if (!res.ok) throw new Error(`Failed to fetch locations (${res.status})`);
        const json = await res.json();
        setLocations(json.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load locations');
      } finally {
        setLoading(false);
      }
    }
    fetchLocations();
  }, []);

  const stats = {
    total: locations.length,
    active: locations.filter(l => !l.archived).length,
    withCoords: locations.filter(l => l.lat != null && l.lng != null).length,
    withCriteria: locations.filter(l => l.arrivalCriteria && l.arrivalCriteria.length > 0).length,
  };

  const filtered = locations.filter(l => {
    if (countryFilter !== 'all' && l.country !== countryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || l.state.toLowerCase().includes(q) || (l.address1 || '').toLowerCase().includes(q);
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
          <h1>Locations</h1>
          <p>{locations.length} locations managed</p>
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
          <div className="vn-stat-icon warning"><span className="material-icons">sensors</span></div>
          <div>
            <div className="vn-stat-value">{stats.withCriteria}</div>
            <div className="vn-stat-label">With Arrival Criteria</div>
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
                  <th>Arrival Criteria</th>
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
                    <td style={{ fontSize: 13 }}>{l.address1}{l.address2 ? `, ${l.address2}` : ''}</td>
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
                    <td>
                      {l.arrivalCriteria && l.arrivalCriteria.length > 0 ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {l.arrivalCriteria.map(c => {
                            const icon = c.criteriaType === 'geofence' ? 'gps_fixed' : c.criteriaType === 'wifi' ? 'wifi' : 'bluetooth';
                            const label = c.criteriaType === 'ble' ? 'BLE' : c.criteriaType.charAt(0).toUpperCase() + c.criteriaType.slice(1);
                            return (
                              <span key={c.id} className="vn-chip vn-chip-info" style={{ fontSize: 11 }}>
                                <span className="material-icons" style={{ fontSize: 14 }}>{icon}</span>
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>None</span>
                      )}
                    </td>
                    <td><span className={`vn-chip vn-chip-${l.archived ? 'error' : 'success'}`}>{l.archived ? 'Archived' : 'Active'}</span></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7}>
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
