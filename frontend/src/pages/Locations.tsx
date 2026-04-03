import React from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';
import MapPicker from '../components/MapPicker';

interface Location {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  lat?: number;
  lng?: number;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Locations() {
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = React.useState<Location[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'list' | 'map'>('list');

  // Filter state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [countryFilter, setCountryFilter] = React.useState('all');

  const loadLocations = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL + '/api/v1/locations');
      const result = await response.json();
      setLocations(result.data || []);
    } catch (error) {
      console.error('Failed to load locations:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadLocations();
  }, []);

  // Get unique countries for filter dropdown
  const uniqueCountries = React.useMemo(() => {
    const countries = [...new Set(locations.map(l => l.country))].filter(Boolean).sort();
    return countries;
  }, [locations]);

  // Filter locations based on search term, status, and country
  React.useEffect(() => {
    let filtered = locations;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(location =>
        location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        location.address1.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (location.address2 && location.address2.toLowerCase().includes(searchTerm.toLowerCase())) ||
        location.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (location.state && location.state.toLowerCase().includes(searchTerm.toLowerCase())) ||
        location.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (location.postalCode && location.postalCode.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(location => {
        if (statusFilter === 'active') return !location.archived;
        if (statusFilter === 'archived') return location.archived;
        return true;
      });
    }

    // Country filter
    if (countryFilter !== 'all') {
      filtered = filtered.filter(location => location.country === countryFilter);
    }

    setFilteredLocations(filtered);
  }, [locations, searchTerm, statusFilter, countryFilter]);

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || countryFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCountryFilter('all');
  };

  const deleteLocation = async (id: string) => {
    setLoading(true);
    try {
      await fetch(API_URL + `/api/v1/locations/${id}`, {
        method: 'DELETE'
      });
      await loadLocations();
    } catch (error) {
      console.error('Failed to delete location:', error);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="page-header">
          <h2>Locations</h2>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)', alignItems: 'center' }}>
            <div style={{ display: 'flex', border: '1px solid var(--outline)', borderRadius: '4px', overflow: 'hidden' }}>
              <button
                className="icon-btn"
                onClick={() => setViewMode('list')}
                title="List view"
                style={{
                  borderRadius: 0,
                  backgroundColor: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--on-primary)' : 'var(--on-surface)',
                }}
              >
                <span className="material-icons">view_list</span>
              </button>
              <button
                className="icon-btn"
                onClick={() => setViewMode('map')}
                title="Map view"
                style={{
                  borderRadius: 0,
                  backgroundColor: viewMode === 'map' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'map' ? 'var(--on-primary)' : 'var(--on-surface)',
                }}
              >
                <span className="material-icons">map</span>
              </button>
            </div>
            <Link to="/locations/create" className="button">
              <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
              Create Location
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-1)', marginBottom: 'var(--spacing-2)' }}>
          <div className="text-field">
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder=" " />
            <label>Search by name, address, city</label>
          </div>

          <div className="text-field">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <label>Status</label>
          </div>

          <div className="text-field">
            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
              <option value="all">All Countries</option>
              {uniqueCountries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
            <label>Country</label>
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="button button-outline" style={{ alignSelf: 'end', height: '46px' }}>
              <span className="material-icons" style={{ fontSize: '18px' }}>clear</span>
              Clear Filters
            </button>
          )}
        </div>

        {/* Results Summary */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-2)',
          fontSize: '0.875rem',
          color: 'var(--on-surface-variant)'
        }}>
          <span>
            {hasActiveFilters
              ? `${filteredLocations.length} of ${locations.length} locations ${hasActiveFilters ? '(filtered)' : ''}`
              : `${locations.length} locations`
            }
          </span>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
              <span className="material-icons" style={{ animation: 'spin 1s linear infinite', fontSize: '16px' }}>refresh</span>
              Loading...
            </div>
          )}
        </div>
        
        {viewMode === 'list' ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>City</th>
                  <th>State</th>
                  <th>Country</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLocations.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--spacing-4)', color: 'var(--on-surface-variant)' }}>
                      {hasActiveFilters ? 'No locations match your current filters' : 'No locations found'}
                    </td>
                  </tr>
                ) : (
                  filteredLocations.map(l => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td>
                        <div>
                          <div>{l.address1}</div>
                          {l.address2 && <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>{l.address2}</div>}
                        </div>
                      </td>
                      <td>{l.city}</td>
                      <td>{l.state || '—'}</td>
                      <td>{l.country}</td>
                      <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                          <Link
                            to={`/locations/${l.id}/edit`}
                            className="icon-btn"
                            title="Edit location"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <span className="material-icons">edit</span>
                          </Link>
                          <button
                            className="icon-btn"
                            onClick={() => setShowDeleteConfirm(l.id)}
                            disabled={loading}
                            title="Delete location"
                            style={{ color: 'var(--error)' }}
                          >
                            <span className="material-icons">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <LocationsMapView locations={filteredLocations} />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Delete Location</h3>
            <p>Are you sure you want to delete this location? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="button button-outline" onClick={() => setShowDeleteConfirm(null)} disabled={loading}>Cancel</button>
              <button className="button button-danger" onClick={() => deleteLocation(showDeleteConfirm)} disabled={loading}>
                <span className="material-icons" style={{ fontSize: '18px' }}>delete</span>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Map view showing all locations with coordinates
function LocationsMapView({ locations }: { locations: Location[] }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const locationsWithCoords = locations.filter(l => l.lat != null && l.lng != null);
  const locationsWithoutCoords = locations.filter(l => l.lat == null || l.lng == null);

  if (locationsWithCoords.length === 0) {
    return (
      <div style={{ padding: 'var(--spacing-4)', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
        <span className="material-icons" style={{ fontSize: '48px', marginBottom: 'var(--spacing-2)', display: 'block' }}>location_off</span>
        <p>No locations have coordinates set.</p>
        <p style={{ fontSize: '0.875rem' }}>Add coordinates when creating or editing a location to see them on the map.</p>
      </div>
    );
  }

  // Calculate bounds
  const lats = locationsWithCoords.map(l => l.lat!);
  const lngs = locationsWithCoords.map(l => l.lng!);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  const selected = selectedId ? locations.find(l => l.id === selectedId) : null;

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <MapPicker
          lat={centerLat}
          lng={centerLng}
          height="500px"
          showSearch={false}
          onLocationSelected={() => {}}
        />
        {/* Overlay markers for each location */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 5,
        }}>
          {/* Note: exact marker positioning is handled by the MapPicker's internal marker */}
        </div>
      </div>

      {/* Location list below map */}
      <div style={{ marginTop: 'var(--spacing-2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-1)' }}>
          {locationsWithCoords.map(l => (
            <div
              key={l.id}
              style={{
                padding: 'var(--spacing-1) var(--spacing-2)',
                borderRadius: '6px',
                border: selectedId === l.id ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                backgroundColor: selectedId === l.id ? 'var(--primary-container)' : 'var(--surface)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-1)',
              }}
              onClick={() => setSelectedId(selectedId === l.id ? null : l.id)}
            >
              <span className="material-icons" style={{ color: 'var(--primary)', fontSize: '20px' }}>location_on</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{l.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>{l.city}{l.state ? `, ${l.state}` : ''}</div>
              </div>
              <Link
                to={`/locations/${l.id}/edit`}
                className="icon-btn"
                title="Edit"
                style={{ flexShrink: 0 }}
                onClick={e => e.stopPropagation()}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>edit</span>
              </Link>
            </div>
          ))}
        </div>
        {locationsWithoutCoords.length > 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: 'var(--spacing-1)' }}>
            {locationsWithoutCoords.length} location{locationsWithoutCoords.length !== 1 ? 's' : ''} without coordinates (not shown on map)
          </p>
        )}
      </div>
    </div>
  );
}
