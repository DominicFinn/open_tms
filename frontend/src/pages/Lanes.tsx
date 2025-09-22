import React from 'react';
import { API_URL } from '../api';

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
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [carriers, setCarriers] = React.useState<Carrier[]>([]);
  const [originId, setOriginId] = React.useState('');
  const [destinationId, setDestinationId] = React.useState('');
  const [distance, setDistance] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [editingLane, setEditingLane] = React.useState<Lane | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lanesRes, locationsRes, customersRes, carriersRes] = await Promise.all([
        fetch(API_URL + '/api/v1/lanes'),
        fetch(API_URL + '/api/v1/locations'),
        fetch(API_URL + '/api/v1/customers'),
        fetch(API_URL + '/api/v1/carriers')
      ]);
      
      const [lanesData, locationsData, customersData, carriersData] = await Promise.all([
        lanesRes.json(),
        locationsRes.json(),
        customersRes.json(),
        carriersRes.json()
      ]);
      
      setLanes(lanesData.data || []);
      setLocations(locationsData.data || []);
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const laneData = {
        originId,
        destinationId,
        distance: distance ? parseFloat(distance) : undefined,
        notes: notes || undefined
      };

      if (editingLane) {
        // Update existing lane
        await fetch(API_URL + `/api/v1/lanes/${editingLane.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(laneData)
        });
        setEditingLane(null);
      } else {
        // Create new lane
        await fetch(API_URL + '/api/v1/lanes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(laneData)
        });
      }
      clearForm();
      await loadData();
    } catch (error) {
      console.error('Failed to save lane:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setOriginId('');
    setDestinationId('');
    setDistance('');
    setNotes('');
  };

  const editLane = (lane: Lane) => {
    setEditingLane(lane);
    setOriginId(lane.origin.id);
    setDestinationId(lane.destination.id);
    setDistance(lane.distance?.toString() || '');
    setNotes(lane.notes || '');
  };

  const cancelEdit = () => {
    setEditingLane(null);
    clearForm();
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
      <div className="card">
        <h2>Lanes</h2>
        <form onSubmit={submit} style={{ marginBottom: 'var(--spacing-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
            <div className="text-field">
              <select 
                value={originId} 
                onChange={e => setOriginId(e.target.value)} 
                required
                disabled={loading}
              >
                <option value="">Select origin</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} - {l.city}</option>)}
              </select>
              <label>Origin Location</label>
            </div>
            <div className="text-field">
              <select 
                value={destinationId} 
                onChange={e => setDestinationId(e.target.value)} 
                required
                disabled={loading}
              >
                <option value="">Select destination</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} - {l.city}</option>)}
              </select>
              <label>Destination Location</label>
            </div>
            <div className="text-field">
              <input 
                value={distance} 
                onChange={e => setDistance(e.target.value)} 
                placeholder=" " 
                type="number"
                step="0.1"
                disabled={loading}
              />
              <label>Distance (km)</label>
            </div>
            <div className="text-field">
              <input 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder=" " 
                disabled={loading}
              />
              <label>Notes</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
            <button className="button" type="submit" disabled={loading}>
              <span className="material-icons" style={{ fontSize: '18px' }}>
                {editingLane ? 'save' : 'add'}
              </span>
              {editingLane ? 'Update' : 'Add'} Lane
            </button>
            {editingLane && (
              <button type="button" className="button outlined" onClick={cancelEdit} disabled={loading}>
                <span className="material-icons" style={{ fontSize: '18px' }}>cancel</span>
                Cancel
              </button>
            )}
          </div>
        </form>
        
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
