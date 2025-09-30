import React from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface Customer {
  id: string;
  name: string;
  contactEmail?: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Customers() {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = React.useState<Customer[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL + '/api/v1/customers');
      const result = await response.json();
      setCustomers(result.data || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadCustomers();
  }, []);

  // Filter customers based on search term and status
  React.useEffect(() => {
    let filtered = customers;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.contactEmail && customer.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(customer => {
        if (statusFilter === 'active') return !customer.archived;
        if (statusFilter === 'archived') return customer.archived;
        return true;
      });
    }

    setFilteredCustomers(filtered);
  }, [customers, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  const deleteCustomer = async (id: string) => {
    setLoading(true);
    try {
      await fetch(API_URL + `/api/v1/customers/${id}`, {
        method: 'DELETE'
      });
      await loadCustomers();
    } catch (error) {
      console.error('Failed to delete customer:', error);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h2>Customers</h2>
          <Link to="/customers/create" className="button">
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Create Customer
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
              placeholder="Search customers by name or email..."
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
              ? `${filteredCustomers.length} of ${customers.length} customers ${hasActiveFilters ? '(filtered)' : ''}`
              : `${customers.length} customers`
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
                <th>Email</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 'var(--spacing-4)', color: 'var(--on-surface-variant)' }}>
                    {hasActiveFilters ? 'No customers match your current filters' : 'No customers found'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.contactEmail || '—'}</td>
                    <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                        <Link
                          to={`/customers/${c.id}/edit`}
                          className="icon-btn"
                          title="Edit customer"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <span className="material-icons">edit</span>
                        </Link>
                        <button
                          className="icon-btn"
                          onClick={() => setShowDeleteConfirm(c.id)}
                          disabled={loading}
                          title="Delete customer"
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
            <h3>Delete Customer</h3>
            <p>Are you sure you want to delete this customer? This action cannot be undone.</p>
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
                onClick={() => deleteCustomer(showDeleteConfirm)}
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
