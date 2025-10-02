import React from 'react';
import { useNavigate } from 'react-router-dom';
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
}

interface Customer {
  id: string;
  name: string;
  contactEmail?: string;
}

interface Carrier {
  id: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
}

interface LaneCarrier {
  id: string;
  price?: number;
  currency: string;
  serviceLevel?: string;
  notes?: string;
  assigned: boolean;
  carrier: Carrier;
}

interface CustomerLane {
  id: string;
  customer: Customer;
}

interface LaneStop {
  id: string;
  laneId: string;
  locationId: string;
  order: number;
  notes?: string;
  location: Location;
}

interface Lane {
  id: string;
  name: string;
  origin: Location;
  destination: Location;
  distance?: number;
  notes?: string;
  status: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  stops: LaneStop[];
  customerLanes: CustomerLane[];
  laneCarriers: LaneCarrier[];
}

export default function Lanes() {
  const navigate = useNavigate();
  const [lanes, setLanes] = React.useState<Lane[]>([]);
  const [filteredLanes, setFilteredLanes] = React.useState<Lane[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [carriers, setCarriers] = React.useState<Carrier[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filter and search state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [customerFilter, setCustomerFilter] = React.useState('all');
  const [hasStopsFilter, setHasStopsFilter] = React.useState('all');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lanesRes, customersRes, carriersRes] = await Promise.all([
        fetch(API_URL + '/api/v1/lanes'),
        fetch(API_URL + '/api/v1/customers'),
        fetch(API_URL + '/api/v1/carriers')
      ]);
      
      const [lanesData, customersData, carriersData] = await Promise.all([
        lanesRes.json(),
        customersRes.json(),
        carriersRes.json()
      ]);
      
      const lanesWithDefaults = lanesData.data || [];
      setLanes(lanesWithDefaults);
      setFilteredLanes(lanesWithDefaults);
      setCustomers(customersData.data || []);
      setCarriers(carriersData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load data. Please refresh the page.');
      // Set empty arrays as fallback to prevent undefined errors
      setLanes([]);
      setFilteredLanes([]);
      setCustomers([]);
      setCarriers([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  // Filter and search logic
  React.useEffect(() => {
    let filtered = lanes;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lane =>
        lane.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lane.origin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lane.destination.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lane.origin.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lane.destination.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lane.notes && lane.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lane => lane.status === statusFilter);
    }

    // Customer filter
    if (customerFilter !== 'all') {
      filtered = filtered.filter(lane =>
        lane.customerLanes.some(cl => cl.customer.id === customerFilter)
      );
    }

    // Stops filter
    if (hasStopsFilter !== 'all') {
      if (hasStopsFilter === 'with-stops') {
        filtered = filtered.filter(lane => lane.stops.length > 0);
      } else if (hasStopsFilter === 'no-stops') {
        filtered = filtered.filter(lane => lane.stops.length === 0);
      }
    }

    setFilteredLanes(filtered);
  }, [lanes, searchTerm, statusFilter, customerFilter, hasStopsFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCustomerFilter('all');
    setHasStopsFilter('all');
  };

  const editLane = (lane: Lane) => {
    navigate(`/lanes/${lane.id}/edit`);
  };

  const deleteLane = async (id: string) => {
    setLoading(true);
    try {
      await fetch(API_URL + `/api/v1/lanes/${id}`, {
        method: 'DELETE'
      });
      await loadData();
    } catch (error) {
      console.error('Failed to delete lane:', error);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(null);
    }
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || customerFilter !== 'all' || hasStopsFilter !== 'all';

  return (
    <div>
      {/* Header with Create Button */}
      <div className="card" style={{ marginBottom: 'var(--spacing-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Lanes</h2>
          <button
            className="button"
            onClick={() => navigate('/lanes/create')}
            disabled={loading}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Create New Lane
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="card" style={{ marginBottom: 'var(--spacing-2)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto auto',
          gap: 'var(--spacing-2)',
          alignItems: 'end'
        }}>
          {/* Search Input */}
          <div className="text-field">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder=" "
              disabled={loading}
            />
            <label>Search lanes, locations, or notes...</label>
          </div>

          {/* Status Filter */}
          <div className="text-field">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={loading}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <label>Status</label>
          </div>

          {/* Customer Filter */}
          <div className="text-field">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              disabled={loading}
            >
              <option value="all">All Customers</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <label>Customer</label>
          </div>

          {/* Stops Filter */}
          <div className="text-field">
            <select
              value={hasStopsFilter}
              onChange={(e) => setHasStopsFilter(e.target.value)}
              disabled={loading}
            >
              <option value="all">All Lanes</option>
              <option value="with-stops">With Stops</option>
              <option value="no-stops">Direct Routes</option>
            </select>
            <label>Route Type</label>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              className="button outlined"
              onClick={clearFilters}
              disabled={loading}
              title="Clear all filters"
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>clear</span>
              Clear
            </button>
          )}
        </div>

        {/* Results Summary */}
        <div style={{
          marginTop: 'var(--spacing-2)',
          paddingTop: 'var(--spacing-2)',
          borderTop: '1px solid var(--outline-variant)',
          fontSize: '0.875rem',
          color: 'var(--on-surface-variant)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>
            Showing {filteredLanes.length} of {lanes.length} lanes
            {hasActiveFilters && ' (filtered)'}
          </span>
          {hasActiveFilters && (
            <span style={{ fontStyle: 'italic' }}>
              Active filters applied
            </span>
          )}
        </div>
      </div>

      {/* Lanes List */}
      <div className="card">
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', marginBottom: 'var(--spacing-2)' }}>
            <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
            Loading...
          </div>
        )}
        
        {error && (
          <div style={{
            backgroundColor: 'var(--error-container)',
            color: 'var(--on-error-container)',
            padding: 'var(--spacing-2)',
            borderRadius: '4px',
            marginBottom: 'var(--spacing-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-1)'
          }}>
            <span className="material-icons">error</span>
            {error}
            <button 
              onClick={loadData}
              style={{ 
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              Retry
            </button>
          </div>
        )}
        
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Lane Name</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Stops</th>
                <th>Distance</th>
                <th>Customers</th>
                <th>Carriers</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLanes.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
                    <div style={{ color: 'var(--on-surface-variant)' }}>
                      {hasActiveFilters ? (
                        <>
                          <span className="material-icons" style={{ fontSize: '48px', opacity: 0.5 }}>
                            search_off
                          </span>
                          <div style={{ marginTop: 'var(--spacing-1)' }}>
                            No lanes match your current filters
                          </div>
                          <button
                            className="button outlined"
                            onClick={clearFilters}
                            style={{ marginTop: 'var(--spacing-2)' }}
                          >
                            Clear Filters
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="material-icons" style={{ fontSize: '48px', opacity: 0.5 }}>
                            route
                          </span>
                          <div style={{ marginTop: 'var(--spacing-1)' }}>
                            No lanes found. Create your first lane to get started.
                          </div>
                          <button
                            className="button"
                            onClick={() => navigate('/lanes/create')}
                            style={{ marginTop: 'var(--spacing-2)' }}
                          >
                            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
                            Create First Lane
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLanes.map(lane => (
                  <tr key={lane.id}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{lane.name}</div>
                      {lane.notes && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
                          {lane.notes}
                        </div>
                      )}
                    </td>
                  <td>
                    <div>{lane.origin.name}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
                      {lane.origin.city}{lane.origin.state && `, ${lane.origin.state}`}
                    </div>
                  </td>
                  <td>
                    <div>{lane.destination.name}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
                      {lane.destination.city}{lane.destination.state && `, ${lane.destination.state}`}
                    </div>
                  </td>
                  <td>
                    {lane.stops && lane.stops.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                        {lane.stops
                          .sort((a, b) => a.order - b.order)
                          .map((stop, index) => (
                            <span
                              key={stop.id}
                              className="chip chip-outline"
                              style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                              title={`Stop ${stop.order}: ${stop.location.name}${stop.notes ? ' - ' + stop.notes : ''}`}
                            >
                              {index + 1}. {stop.location.city}
                            </span>
                          ))
                        }
                      </div>
                    ) : (
                      <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>
                        No stops
                      </span>
                    )}
                  </td>
                  <td>{lane.distance ? `${lane.distance} km` : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {lane.customerLanes?.map(cl => (
                        <span key={cl.id} className="chip chip-primary">
                          {cl.customer.name}
                        </span>
                      )) || []}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {lane.laneCarriers?.map(lc => (
                        <span key={lc.id} className="chip chip-secondary">
                          {lc.carrier.name}
                          {lc.price && ` - $${lc.price}`}
                        </span>
                      )) || []}
                    </div>
                  </td>
                  <td>
                    <span className={`chip ${
                      lane.status === 'active' ? 'chip-success' : 'chip-error'
                    }`}>
                      {lane.status}
                    </span>
                  </td>
                  <td>{new Date(lane.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                      <button
                        className="icon-btn"
                        onClick={() => navigate(`/lanes/${lane.id}`)}
                        disabled={loading}
                        title="View lane details"
                      >
                        <span className="material-icons">visibility</span>
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => editLane(lane)}
                        disabled={loading}
                        title="Edit lane"
                      >
                        <span className="material-icons">edit</span>
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => setShowDeleteConfirm(lane.id)}
                        disabled={loading}
                        title="Delete lane"
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
            <h3>Delete Lane</h3>
            <p>Are you sure you want to delete this lane? This action cannot be undone.</p>
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
                onClick={() => deleteLane(showDeleteConfirm)}
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
