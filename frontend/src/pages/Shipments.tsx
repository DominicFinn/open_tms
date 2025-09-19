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
  customerId: string;
  originId: string;
  destinationId: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Shipments() {
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [reference, setReference] = React.useState('');
  const [customerId, setCustomerId] = React.useState('');
  const [originId, setOriginId] = React.useState('');
  const [destinationId, setDestinationId] = React.useState('');
  const [status, setStatus] = React.useState('draft');
  const [pickupDate, setPickupDate] = React.useState('');
  const [deliveryDate, setDeliveryDate] = React.useState('');
  const [editingShipment, setEditingShipment] = React.useState<Shipment | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shipmentsRes, customersRes, locationsRes] = await Promise.all([
        fetch(API_URL + '/api/v1/shipments'),
        fetch(API_URL + '/api/v1/customers'),
        fetch(API_URL + '/api/v1/locations')
      ]);
      
      const [shipmentsData, customersData, locationsData] = await Promise.all([
        shipmentsRes.json(),
        customersRes.json(),
        locationsRes.json()
      ]);
      
      setShipments(shipmentsData.data || []);
      setCustomers(customersData.data || []);
      setLocations(locationsData.data || []);
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
      const shipmentData = {
        reference,
        customerId,
        originId,
        destinationId,
        status,
        pickupDate: pickupDate || undefined,
        deliveryDate: deliveryDate || undefined,
        items: []
      };

      if (editingShipment) {
        // Update existing shipment
        await fetch(API_URL + `/api/v1/shipments/${editingShipment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shipmentData)
        });
        setEditingShipment(null);
      } else {
        // Create new shipment
        await fetch(API_URL + '/api/v1/shipments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shipmentData)
        });
      }
      clearForm();
      await loadData();
    } catch (error) {
      console.error('Failed to save shipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setReference('');
    setCustomerId('');
    setOriginId('');
    setDestinationId('');
    setStatus('draft');
    setPickupDate('');
    setDeliveryDate('');
  };

  const editShipment = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setReference(shipment.reference);
    setCustomerId(shipment.customerId);
    setOriginId(shipment.originId);
    setDestinationId(shipment.destinationId);
    setStatus(shipment.status);
    setPickupDate(shipment.pickupDate ? shipment.pickupDate.split('T')[0] : '');
    setDeliveryDate(shipment.deliveryDate ? shipment.deliveryDate.split('T')[0] : '');
  };

  const cancelEdit = () => {
    setEditingShipment(null);
    clearForm();
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
        <h2>Shipments</h2>
        <form onSubmit={submit} style={{ marginBottom: 'var(--spacing-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
            <div className="text-field">
              <input 
                value={reference} 
                onChange={e => setReference(e.target.value)} 
                placeholder=" " 
                required 
                disabled={loading}
              />
              <label>Reference</label>
            </div>
            <div className="text-field">
              <select 
                value={customerId} 
                onChange={e => setCustomerId(e.target.value)} 
                required
                disabled={loading}
              >
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label>Customer</label>
            </div>
            <div className="text-field">
              <select 
                value={originId} 
                onChange={e => setOriginId(e.target.value)} 
                required
                disabled={loading}
              >
                <option value="">Select origin</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <label>Origin</label>
            </div>
            <div className="text-field">
              <select 
                value={destinationId} 
                onChange={e => setDestinationId(e.target.value)} 
                required
                disabled={loading}
              >
                <option value="">Select destination</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <label>Destination</label>
            </div>
            <div className="text-field">
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value)} 
                disabled={loading}
              >
                <option value="draft">Draft</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <label>Status</label>
            </div>
            <div className="text-field">
              <input 
                value={pickupDate} 
                onChange={e => setPickupDate(e.target.value)} 
                placeholder=" " 
                type="date"
                disabled={loading}
              />
              <label>Pickup Date</label>
            </div>
            <div className="text-field">
              <input 
                value={deliveryDate} 
                onChange={e => setDeliveryDate(e.target.value)} 
                placeholder=" " 
                type="date"
                disabled={loading}
              />
              <label>Delivery Date</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
            <button className="button" type="submit" disabled={loading}>
              <span className="material-icons" style={{ fontSize: '18px' }}>
                {editingShipment ? 'save' : 'add'}
              </span>
              {editingShipment ? 'Update' : 'Add'} Shipment
            </button>
            {editingShipment && (
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
                <th>Reference</th>
                <th>Customer</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Pickup Date</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map(s => (
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
                  <td>{s.origin?.name || s.originId}</td>
                  <td>{s.destination?.name || s.destinationId}</td>
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
                      <button 
                        className="icon-btn" 
                        onClick={() => editShipment(s)}
                        disabled={loading}
                        title="Edit shipment"
                      >
                        <span className="material-icons">edit</span>
                      </button>
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
