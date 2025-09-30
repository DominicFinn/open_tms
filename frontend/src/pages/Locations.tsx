import React from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h2>Locations</h2>
          <Link to="/locations/create" className="button">
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Create Location
          </Link>
        </div>

        {/* Search and Filters */}
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-2)',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div className="text-field" style={{ minWidth: '300px', flex: 1 }}>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search locations by name, address, city..."
              style={{ width: '100%' }}
            />
            <label>Search</label>
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--outline)',
              borderRadius: '4px',
              backgroundColor: 'var(--surface)',
              color: 'var(--on-surface)',
              minWidth: '120px'
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--outline)',
              borderRadius: '4px',
              backgroundColor: 'var(--surface)',
              color: 'var(--on-surface)',
              minWidth: '120px'
            }}
          >
            <option value="all">All Countries</option>
            {uniqueCountries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="button outlined"
              style={{ whiteSpace: 'nowrap' }}
            >
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
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '400px', margin: 'var(--spacing-2)' }}>
            <h3>Delete Location</h3>
            <p>Are you sure you want to delete this location? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end', marginTop: 'var(--spacing-2)' }}>
              <button 
                className="button outlined" 
                onClick={() => setShowDeleteConfirm(null)}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="button" 
                onClick={() => deleteLocation(showDeleteConfirm)}
                disabled={loading}
                style={{ backgroundColor: 'var(--error)', color: 'var(--on-error)' }}
              >
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
