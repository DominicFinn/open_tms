import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import RouteSelection from './RouteSelection';

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

interface ShipmentCreationFormProps {
  onShipmentCreated?: (shipment: Shipment) => void;
  onShipmentUpdated?: (shipment: Shipment) => void;
  editingShipment?: Shipment | null;
  onCancel?: () => void;
}

export default function ShipmentCreationForm({
  onShipmentCreated,
  onShipmentUpdated,
  editingShipment,
  onCancel
}: ShipmentCreationFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reference, setReference] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [useLane, setUseLane] = useState(true);
  const [laneId, setLaneId] = useState('');
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [status, setStatus] = useState('draft');
  const [pickupDate, setPickupDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when editing
  useEffect(() => {
    if (editingShipment) {
      setReference(editingShipment.reference);
      setCustomerId(editingShipment.customerId);

      // Determine route type based on whether laneId exists
      if (editingShipment.laneId) {
        setUseLane(true);
        setLaneId(editingShipment.laneId);
      } else {
        setUseLane(false);
        setLaneId('');
      }

      setOriginId(editingShipment.originId);
      setDestinationId(editingShipment.destinationId);
      setStatus(editingShipment.status);
      setPickupDate(editingShipment.pickupDate ? editingShipment.pickupDate.split('T')[0] : '');
      setDeliveryDate(editingShipment.deliveryDate ? editingShipment.deliveryDate.split('T')[0] : '');
    } else {
      clearForm();
    }
  }, [editingShipment]);

  // Load customers
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/customers`);
      const data = await response.json();
      setCustomers(data.data || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const clearForm = () => {
    setReference('');
    setCustomerId('');
    setUseLane(true);
    setLaneId('');
    setOriginId('');
    setDestinationId('');
    setStatus('draft');
    setPickupDate('');
    setDeliveryDate('');
    setError(null);
  };

  const validateForm = () => {
    if (!reference.trim()) {
      setError('Please enter a reference');
      return false;
    }
    if (!customerId) {
      setError('Please select a customer');
      return false;
    }

    if (useLane) {
      if (!laneId) {
        setError('Please select a lane');
        return false;
      }
    } else {
      if (!originId || !destinationId) {
        setError('Please select both origin and destination');
        return false;
      }
      if (originId === destinationId) {
        setError('Origin and destination must be different');
        return false;
      }
    }

    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const shipmentData = {
        reference,
        customerId,
        ...(useLane
          ? { laneId }
          : { originId, destinationId }
        ),
        status,
        pickupDate: pickupDate || undefined,
        deliveryDate: deliveryDate || undefined,
        items: []
      };

      const url = editingShipment
        ? `${API_URL}/api/v1/shipments/${editingShipment.id}`
        : `${API_URL}/api/v1/shipments`;

      const method = editingShipment ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save shipment');
      }

      const result = await response.json();
      const savedShipment = result.data;

      if (editingShipment && onShipmentUpdated) {
        onShipmentUpdated(savedShipment);
        // Don't clear form for updates - let the parent handle closing
      } else if (onShipmentCreated) {
        onShipmentCreated(savedShipment);
        clearForm();
      }
    } catch (error) {
      console.error('Failed to save shipment:', error);
      setError(error instanceof Error ? error.message : 'Failed to save shipment');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    clearForm();
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="card">
      <h2>{editingShipment ? 'Edit Shipment' : 'Create New Shipment'}</h2>

      <form onSubmit={submit} style={{ marginBottom: 'var(--spacing-2)' }}>
        {/* Basic Information */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-2)'
        }}>
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
        </div>

        {/* Route Selection */}
        <div style={{ marginBottom: 'var(--spacing-2)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-1)', fontSize: '1.1rem' }}>
            Route Selection
          </h3>
          <RouteSelection
            useLane={useLane}
            onUseLaneChange={setUseLane}
            laneId={laneId}
            onLaneChange={setLaneId}
            originId={originId}
            onOriginChange={setOriginId}
            destinationId={destinationId}
            onDestinationChange={setDestinationId}
            disabled={loading}
          />
        </div>

        {/* Status and Dates */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr 1fr',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-2)'
        }}>
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
            <label>Pickup Date (optional)</label>
          </div>
          <div className="text-field">
            <input
              value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)}
              placeholder=" "
              type="date"
              disabled={loading}
            />
            <label>Delivery Date (optional)</label>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: 'var(--error-container)',
            color: 'var(--on-error-container)',
            padding: 'var(--spacing-1)',
            borderRadius: '4px',
            marginBottom: 'var(--spacing-2)',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
          <button
            className="button"
            type="submit"
            disabled={loading || !reference || !customerId}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {editingShipment ? 'save' : 'add'}
            </span>
            {loading ? 'Saving...' : (editingShipment ? 'Update Shipment' : 'Create Shipment')}
          </button>

          <button
            type="button"
            className="button outlined"
            onClick={handleCancel}
            disabled={loading}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>cancel</span>
            Cancel
          </button>
        </div>
      </form>

      {/* Help Text */}
      <div style={{
        backgroundColor: 'var(--surface-variant)',
        padding: 'var(--spacing-2)',
        borderRadius: '4px',
        fontSize: '0.875rem',
        color: 'var(--on-surface-variant)'
      }}>
        <h4 style={{ margin: '0 0 var(--spacing-1) 0', fontSize: '0.875rem' }}>
          💡 Tips for creating shipments:
        </h4>
        <ul style={{ margin: 0, paddingLeft: 'var(--spacing-2)' }}>
          <li>Use lanes for commonly shipped routes with predefined stops</li>
          <li>Use origin/destination for one-off or custom routes</li>
          <li>Set pickup and delivery dates to track shipment timeline</li>
          <li>Reference should be unique and easy to identify</li>
        </ul>
      </div>
    </div>
  );
}