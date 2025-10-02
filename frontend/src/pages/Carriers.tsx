import React from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface Carrier {
  id: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Carriers() {
  const [carriers, setCarriers] = React.useState<Carrier[]>([]);
  const [filteredCarriers, setFilteredCarriers] = React.useState<Carrier[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const loadCarriers = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL + '/api/v1/carriers');
      const result = await response.json();
      setCarriers(result.data || []);
    } catch (error) {
      console.error('Failed to load carriers:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadCarriers();
  }, []);

  // Filter carriers based on search term and status
  React.useEffect(() => {
    let filtered = carriers;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(carrier =>
        carrier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (carrier.contactEmail && carrier.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (carrier.mcNumber && carrier.mcNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (carrier.dotNumber && carrier.dotNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (carrier.city && carrier.city.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(carrier => {
        if (statusFilter === 'active') return !carrier.archived;
        if (statusFilter === 'archived') return carrier.archived;
        return true;
      });
    }

    setFilteredCarriers(filtered);
  }, [carriers, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  const deleteCarrier = async (id: string) => {
    setLoading(true);
    try {
      await fetch(API_URL + `/api/v1/carriers/${id}`, {
        method: 'DELETE'
      });
      await loadCarriers();
    } catch (error) {
      console.error('Failed to delete carrier:', error);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h2>Carriers</h2>
          <Link to="/carriers/create" className="button">
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Create Carrier
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
              placeholder="Search carriers by name, email, MC/DOT number, or city..."
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
              ? `${filteredCarriers.length} of ${carriers.length} carriers ${hasActiveFilters ? '(filtered)' : ''}`
              : `${carriers.length} carriers`
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
                <th>MC Number</th>
                <th>DOT Number</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCarriers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--spacing-4)', color: 'var(--on-surface-variant)' }}>
                    {hasActiveFilters ? 'No carriers match your current filters' : 'No carriers found'}
                  </td>
                </tr>
              ) : (
                filteredCarriers.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.mcNumber || '—'}</td>
                    <td>{c.dotNumber || '—'}</td>
                    <td>
                      {c.contactName && <div>{c.contactName}</div>}
                      {c.contactEmail && <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>{c.contactEmail}</div>}
                      {c.contactPhone && <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>{c.contactPhone}</div>}
                      {!c.contactName && !c.contactEmail && !c.contactPhone && '—'}
                    </td>
                    <td>
                      {c.city && c.state ? `${c.city}, ${c.state}` : c.city || c.state || '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                        <Link
                          to={`/carriers/${c.id}/edit`}
                          className="icon-btn"
                          title="Edit carrier"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <span className="material-icons">edit</span>
                        </Link>
                        <button
                          className="icon-btn"
                          onClick={() => setShowDeleteConfirm(c.id)}
                          disabled={loading}
                          title="Delete carrier"
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
            <h3>Delete Carrier</h3>
            <p>Are you sure you want to delete this carrier? This action cannot be undone.</p>
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
                onClick={() => deleteCarrier(showDeleteConfirm)}
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
