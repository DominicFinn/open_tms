import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import LocationSearch from './LocationSearch';

interface Customer {
  id: string;
  name: string;
  contactEmail?: string;
}

interface Location {
  id: string;
  name: string;
  address1: string;
  city: string;
  state?: string;
  country: string;
}

interface LineItem {
  sku: string;
  description?: string;
  quantity: number;
  weight?: number;
  weightUnit: string;
  length?: number;
  width?: number;
  height?: number;
  dimUnit: string;
  hazmat: boolean;
  temperature?: string;
}

interface OrderCreationFormProps {
  onOrderCreated?: (order: any) => void;
  onCancel?: () => void;
}

export default function OrderCreationForm({
  onOrderCreated,
  onCancel
}: OrderCreationFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [customerId, setCustomerId] = useState('');

  // Location handling
  const [useExistingOrigin, setUseExistingOrigin] = useState(true);
  const [useExistingDestination, setUseExistingDestination] = useState(true);
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');

  // New location data
  const [originData, setOriginData] = useState({
    name: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'USA'
  });
  const [destinationData, setDestinationData] = useState({
    name: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'USA'
  });

  // Dates
  const [requestedPickupDate, setRequestedPickupDate] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [currentItem, setCurrentItem] = useState<LineItem>({
    sku: '',
    description: '',
    quantity: 1,
    weight: undefined,
    weightUnit: 'kg',
    length: undefined,
    width: undefined,
    height: undefined,
    dimUnit: 'cm',
    hazmat: false,
    temperature: 'ambient'
  });

  const [specialInstructions, setSpecialInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCustomers();
    generateOrderNumber();
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

  const generateOrderNumber = () => {
    const timestamp = Date.now().toString().slice(-8);
    setOrderNumber(`ORD-${timestamp}`);
  };

  const addLineItem = () => {
    if (!currentItem.sku.trim()) {
      setError('Please enter a SKU');
      return;
    }
    if (currentItem.quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    setLineItems([...lineItems, currentItem]);
    setCurrentItem({
      sku: '',
      description: '',
      quantity: 1,
      weight: undefined,
      weightUnit: 'kg',
      length: undefined,
      width: undefined,
      height: undefined,
      dimUnit: 'cm',
      hazmat: false,
      temperature: 'ambient'
    });
    setError(null);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!orderNumber.trim()) {
      setError('Please enter an order number');
      return false;
    }
    if (!customerId) {
      setError('Please select a customer');
      return false;
    }

    // Validate origin
    if (useExistingOrigin && !originId) {
      setError('Please select an origin location');
      return false;
    }
    if (!useExistingOrigin && (!originData.name || !originData.address1 || !originData.city || !originData.country)) {
      setError('Please fill in all required origin location fields');
      return false;
    }

    // Validate destination
    if (useExistingDestination && !destinationId) {
      setError('Please select a destination location');
      return false;
    }
    if (!useExistingDestination && (!destinationData.name || !destinationData.address1 || !destinationData.city || !destinationData.country)) {
      setError('Please fill in all required destination location fields');
      return false;
    }

    if (lineItems.length === 0) {
      setError('Please add at least one line item');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const orderData: any = {
        orderNumber,
        poNumber: poNumber || undefined,
        customerId,
        requestedPickupDate: requestedPickupDate ? new Date(requestedPickupDate).toISOString() : undefined,
        requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate).toISOString() : undefined,
        lineItems,
        specialInstructions: specialInstructions || undefined,
        notes: notes || undefined,
        importSource: 'manual'
      };

      // Add origin
      if (useExistingOrigin) {
        orderData.originId = originId;
      } else {
        orderData.originData = originData;
      }

      // Add destination
      if (useExistingDestination) {
        orderData.destinationId = destinationId;
      } else {
        orderData.destinationData = destinationData;
      }

      const response = await fetch(`${API_URL}/api/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create order');
      }

      if (onOrderCreated) {
        onOrderCreated(result.data);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      {error && (
        <div className="alert alert-error" style={{ gridColumn: '1 / -1' }}>
          <span className="material-icons">error</span>
          {error}
        </div>
      )}

      <h3 style={{ gridColumn: '1 / -1', marginTop: 0 }}>Order Information</h3>

      <div className="input-wrapper">
        <input
          type="text"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          className="input"
          required
        />
        <label>Order Number *</label>
      </div>

      <div className="input-wrapper">
        <input
          type="text"
          value={poNumber}
          onChange={(e) => setPoNumber(e.target.value)}
          className="input"
        />
        <label>PO Number (Optional)</label>
      </div>

      <div className="input-wrapper">
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="input"
          required
        >
          <option value="">Select customer...</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <label>Customer *</label>
      </div>

      <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Origin Location</h3>

      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--spacing-2)' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="radio"
            checked={useExistingOrigin}
            onChange={() => setUseExistingOrigin(true)}
            style={{ marginRight: '8px' }}
          />
          Use existing location
        </label>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="radio"
            checked={!useExistingOrigin}
            onChange={() => setUseExistingOrigin(false)}
            style={{ marginRight: '8px' }}
          />
          Enter new location
        </label>
      </div>

      {useExistingOrigin ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <LocationSearch
            value={originId}
            onChange={setOriginId}
            label="Origin Location *"
          />
        </div>
      ) : (
        <>
          <div className="input-wrapper">
            <input
              type="text"
              value={originData.name}
              onChange={(e) => setOriginData({ ...originData, name: e.target.value })}
              className="input"
              required
            />
            <label>Location Name *</label>
          </div>
          <div className="input-wrapper">
            <input
              type="text"
              value={originData.address1}
              onChange={(e) => setOriginData({ ...originData, address1: e.target.value })}
              className="input"
              required
            />
            <label>Address 1 *</label>
          </div>
          <div className="input-wrapper">
            <input
              type="text"
              value={originData.city}
              onChange={(e) => setOriginData({ ...originData, city: e.target.value })}
              className="input"
              required
            />
            <label>City *</label>
          </div>
          <div className="input-wrapper">
            <input
              type="text"
              value={originData.state}
              onChange={(e) => setOriginData({ ...originData, state: e.target.value })}
              className="input"
            />
            <label>State/Province</label>
          </div>
          <div className="input-wrapper">
            <input
              type="text"
              value={originData.postalCode}
              onChange={(e) => setOriginData({ ...originData, postalCode: e.target.value })}
              className="input"
            />
            <label>Postal Code</label>
          </div>
          <div className="input-wrapper">
            <input
              type="text"
              value={originData.country}
              onChange={(e) => setOriginData({ ...originData, country: e.target.value })}
              className="input"
              required
            />
            <label>Country *</label>
          </div>
        </>
      )}

      <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Destination Location</h3>

      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--spacing-2)' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="radio"
            checked={useExistingDestination}
            onChange={() => setUseExistingDestination(true)}
            style={{ marginRight: '8px' }}
          />
          Use existing location
        </label>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="radio"
            checked={!useExistingDestination}
            onChange={() => setUseExistingDestination(false)}
            style={{ marginRight: '8px' }}
          />
          Enter new location
        </label>
      </div>

      {useExistingDestination ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <LocationSearch
            value={destinationId}
            onChange={setDestinationId}
            label="Destination Location *"
          />
        </div>
      ) : (
        <>
          <div className="input-wrapper">
            <input
              type="text"
              value={destinationData.name}
              onChange={(e) => setDestinationData({ ...destinationData, name: e.target.value })}
              className="input"
              required
            />
            <label>Location Name *</label>
          </div>
          <div className="input-wrapper">
            <input
              type="text"
              value={destinationData.address1}
              onChange={(e) => setDestinationData({ ...destinationData, address1: e.target.value })}
              className="input"
              required
            />
            <label>Address 1 *</label>
          </div>
          <div className="input-wrapper">
            <input
              type="text"
              value={destinationData.city}
              onChange={(e) => setDestinationData({ ...destinationData, city: e.target.value })}
              className="input"
              required
            />
            <label>City *</label>
          </div>
          <div className="input-wrapper">
            <input
              type="text"
              value={destinationData.state}
              onChange={(e) => setDestinationData({ ...destinationData, state: e.target.value })}
              className="input"
            />
            <label>State/Province</label>
          </div>
          <div className="input-wrapper">
            <input
              type="text"
              value={destinationData.postalCode}
              onChange={(e) => setDestinationData({ ...destinationData, postalCode: e.target.value })}
              className="input"
            />
            <label>Postal Code</label>
          </div>
          <div className="input-wrapper">
            <input
              type="text"
              value={destinationData.country}
              onChange={(e) => setDestinationData({ ...destinationData, country: e.target.value })}
              className="input"
              required
            />
            <label>Country *</label>
          </div>
        </>
      )}

      <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Dates</h3>

      <div className="input-wrapper">
        <input
          type="date"
          value={requestedPickupDate}
          onChange={(e) => setRequestedPickupDate(e.target.value)}
          className="input"
        />
        <label>Requested Pickup Date</label>
      </div>

      <div className="input-wrapper">
        <input
          type="date"
          value={requestedDeliveryDate}
          onChange={(e) => setRequestedDeliveryDate(e.target.value)}
          className="input"
        />
        <label>Requested Delivery Date</label>
      </div>

      <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Line Items *</h3>

      <div style={{ gridColumn: '1 / -1', padding: 'var(--spacing-2)', backgroundColor: 'var(--color-surface)', borderRadius: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-1)' }}>
          <div className="input-wrapper">
            <input
              type="text"
              value={currentItem.sku}
              onChange={(e) => setCurrentItem({ ...currentItem, sku: e.target.value })}
              className="input"
            />
            <label>SKU *</label>
          </div>

          <div className="input-wrapper">
            <input
              type="text"
              value={currentItem.description}
              onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
              className="input"
            />
            <label>Description</label>
          </div>

          <div className="input-wrapper">
            <input
              type="number"
              min="1"
              value={currentItem.quantity}
              onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 1 })}
              className="input"
            />
            <label>Quantity *</label>
          </div>

          <div className="input-wrapper">
            <input
              type="number"
              step="0.01"
              value={currentItem.weight || ''}
              onChange={(e) => setCurrentItem({ ...currentItem, weight: parseFloat(e.target.value) || undefined })}
              className="input"
            />
            <label>Weight (kg)</label>
          </div>

          <div className="input-wrapper">
            <select
              value={currentItem.temperature}
              onChange={(e) => setCurrentItem({ ...currentItem, temperature: e.target.value })}
              className="input"
            >
              <option value="ambient">Ambient</option>
              <option value="refrigerated">Refrigerated</option>
              <option value="frozen">Frozen</option>
            </select>
            <label>Temperature</label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={currentItem.hazmat}
                onChange={(e) => setCurrentItem({ ...currentItem, hazmat: e.target.checked })}
                style={{ marginRight: '8px' }}
              />
              Hazmat
            </label>
          </div>
        </div>

        <button type="button" onClick={addLineItem} className="button" style={{ marginTop: 'var(--spacing-1)' }}>
          <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
          Add Item
        </button>
      </div>

      {lineItems.length > 0 && (
        <div style={{ gridColumn: '1 / -1', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Weight</th>
                <th>Temperature</th>
                <th>Hazmat</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={index}>
                  <td>{item.sku}</td>
                  <td>{item.description || '—'}</td>
                  <td>{item.quantity}</td>
                  <td>{item.weight ? `${item.weight} ${item.weightUnit}` : '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{item.temperature || 'Ambient'}</td>
                  <td>{item.hazmat ? '⚠️ Yes' : 'No'}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      className="button button-sm button-outline"
                      style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                    >
                      <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Additional Information</h3>

      <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
        <textarea
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value)}
          className="input"
          rows={3}
        />
        <label>Special Instructions</label>
      </div>

      <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input"
          rows={3}
        />
        <label>Notes</label>
      </div>

      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end', marginTop: 'var(--spacing-2)' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} className="button button-outline" disabled={loading}>
            Cancel
          </button>
        )}
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Creating...' : 'Create Order'}
        </button>
      </div>
    </form>
  );
}
