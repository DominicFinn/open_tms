import React from 'react';
import { API_URL } from '../api';
import LaneCreationForm from '../components/LaneCreationForm';

interface Location {
  id: string;
  name: string;
  city: string;
  state?: string;
  country: string;
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
  carrier: Carrier;
}

interface CustomerLane {
  id: string;
  customer: Customer;
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
  customerLanes: CustomerLane[];
  laneCarriers: LaneCarrier[];
}

export default function Lanes() {
  const [lanes, setLanes] = React.useState<Lane[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [carriers, setCarriers] = React.useState<Carrier[]>([]);
  const [editingLane, setEditingLane] = React.useState<Lane | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showCreateForm, setShowCreateForm] = React.useState(false);

  const loadData = async () => {
    setLoading(true);
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
      
      setLanes(lanesData.data || []);
      setCustomers(customersData.data || []);
      setCarriers(carriersData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleLaneCreated = (lane: Lane) => {
    setLanes(prev => [...prev, lane]);
    setShowCreateForm(false);
  };

  const handleLaneUpdated = (updatedLane: Lane) => {
    setLanes(prev => prev.map(lane => lane.id === updatedLane.id ? updatedLane : lane));
    setEditingLane(null);
  };

  const editLane = (lane: Lane) => {
    setEditingLane(lane);
    setShowCreateForm(true);
  };

  const cancelEdit = () => {
    setEditingLane(null);
    setShowCreateForm(false);
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

  return (
    <div>
      {/* Header with Create Button */}
      <div className="card" style={{ marginBottom: 'var(--spacing-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Lanes</h2>
          <button 
            className="button" 
            onClick={() => setShowCreateForm(true)}
            disabled={loading}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Create New Lane
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <LaneCreationForm
          editingLane={editingLane}
          onLaneCreated={handleLaneCreated}
          onLaneUpdated={handleLaneUpdated}
          onCancel={cancelEdit}
        />
      )}

      {/* Lanes List */}
      <div className="card">
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', marginBottom: 'var(--spacing-2)' }}>
            <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
            Loading...
          </div>
        )}
        
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Lane Name</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Distance</th>
                <th>Customers</th>
                <th>Carriers</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lanes.map(lane => (
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
                  <td>{lane.distance ? `${lane.distance} km` : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {lane.customerLanes.map(cl => (
                        <span key={cl.id} className="chip chip-primary">
                          {cl.customer.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {lane.laneCarriers.map(lc => (
                        <span key={lc.id} className="chip chip-secondary">
                          {lc.carrier.name}
                          {lc.price && ` - $${lc.price}`}
                        </span>
                      ))}
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
              ))}
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
