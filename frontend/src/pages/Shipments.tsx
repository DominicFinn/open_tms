import React from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface Customer {
  id: string;
  name: string;
  contactEmail?: string;
}

interface Location {
  id: string;
  name: string;
  city: string;
  country: string;
}

interface Shipment {
  id: string;
  reference: string;
  status: string;
  pickupDate?: string;
  deliveryDate?: string;
  items?: any[];
  customer?: Customer;
  origin?: Location;
  destination?: Location;
  lane?: {
    id: string;
    name: string;
    origin: Location;
    destination: Location;
  };
  customerId: string;
  laneId?: string;
  originId: string;
  destinationId: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Shipments() {
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [filteredShipments, setFilteredShipments] = React.useState<Shipment[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [customerFilter, setCustomerFilter] = React.useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL + '/api/v1/shipments');
      const data = await response.json();
      setShipments(data.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  // Get unique customers and statuses for filter dropdowns
  const uniqueCustomers = React.useMemo(() => {
    const customers = shipments
      .filter(s => s.customer)
      .map(s => s.customer!)
      .filter((customer, index, arr) =>
        arr.findIndex(c => c.id === customer.id) === index
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    return customers;
  }, [shipments]);

  const uniqueStatuses = React.useMemo(() => {
    const statuses = [...new Set(shipments.map(s => s.status))].filter(Boolean).sort();
    return statuses;
  }, [shipments]);

  // Filter shipments based on search term, status, and customer
  React.useEffect(() => {
    let filtered = shipments;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(shipment =>
        shipment.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (shipment.customer && shipment.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (shipment.origin && shipment.origin.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (shipment.destination && shipment.destination.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (shipment.lane && shipment.lane.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(shipment => shipment.status === statusFilter);
    }

    // Customer filter
    if (customerFilter !== 'all') {
      filtered = filtered.filter(shipment => shipment.customer && shipment.customer.id === customerFilter);
    }

    setFilteredShipments(filtered);
  }, [shipments, searchTerm, statusFilter, customerFilter]);

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || customerFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCustomerFilter('all');
  };

  const deleteShipment = async (id: string) => {
    setLoading(true);
    try {
      await fetch(API_URL + `/api/v1/shipments/${id}`, {
        method: 'DELETE'
      });
      await loadData();
    } catch (error) {
      console.error('Failed to delete shipment:', error);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h2>Shipments</h2>
          <Link to="/shipments/create" className="button">
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Create Shipment
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
              placeholder="Search by reference, customer, origin, destination..."
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
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
              </option>
            ))}
          </select>

          <select
            value={customerFilter}
            onChange={e => setCustomerFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--outline)',
              borderRadius: '4px',
              backgroundColor: 'var(--surface)',
              color: 'var(--on-surface)',
              minWidth: '150px'
            }}
          >
            <option value="all">All Customers</option>
            {uniqueCustomers.map(customer => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
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
              ? `${filteredShipments.length} of ${shipments.length} shipments ${hasActiveFilters ? '(filtered)' : ''}`
              : `${shipments.length} shipments`
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
                <th>Reference</th>
                <th>Customer</th>
                <th>Origin / Lane</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Pickup Date</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--spacing-4)', color: 'var(--on-surface-variant)' }}>
                    {hasActiveFilters ? 'No shipments match your current filters' : 'No shipments found'}
                  </td>
                </tr>
              ) : (
                filteredShipments.map(s => (
                <tr key={s.id}>
                  <td>
                    <Link 
                      to={`/shipments/${s.id}`} 
                      style={{ 
                        color: 'var(--primary)', 
                        textDecoration: 'none',
                        fontWeight: '500'
                      }}
                    >
                      {s.reference}
                    </Link>
                  </td>
                  <td>{s.customer?.name || s.customerId}</td>
                  <td>
                    {s.lane ? (
                      <div>
                        <div style={{ fontWeight: '500' }}>{s.lane.name}</div>
                        <div style={{ fontSize: '0.9em', color: 'var(--on-surface-variant)' }}>
                          {s.origin?.city} → {s.destination?.city}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div>{s.origin?.name || s.originId}</div>
                        <div style={{ fontSize: '0.9em', color: 'var(--on-surface-variant)' }}>
                          {s.origin?.city}
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    {s.lane ? (
                      <div>
                        <div style={{ fontWeight: '500' }}>{s.destination?.name || s.destinationId}</div>
                        <div style={{ fontSize: '0.9em', color: 'var(--on-surface-variant)' }}>
                          {s.destination?.city}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div>{s.destination?.name || s.destinationId}</div>
                        <div style={{ fontSize: '0.9em', color: 'var(--on-surface-variant)' }}>
                          {s.destination?.city}
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${
                      s.status === 'delivered' ? 'chip-success' : 
                      s.status === 'in_transit' ? 'chip-warning' : 
                      s.status === 'cancelled' ? 'chip-error' :
                      'chip-primary'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td>{s.pickupDate ? new Date(s.pickupDate).toLocaleDateString() : '—'}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                      <Link
                        to={`/shipments/${s.id}/edit`}
                        className="icon-btn"
                        title="Edit shipment"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <span className="material-icons">edit</span>
                      </Link>
                      <button 
                        className="icon-btn" 
                        onClick={() => setShowDeleteConfirm(s.id)}
                        disabled={loading}
                        title="Delete shipment"
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
            <h3>Delete Shipment</h3>
            <p>Are you sure you want to delete this shipment? This action cannot be undone.</p>
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
                onClick={() => deleteShipment(showDeleteConfirm)}
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
