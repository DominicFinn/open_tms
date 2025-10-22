import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import LocationSearch from './LocationSearch';

interface Customer {
  id: string;
  name: string;
}

interface OrgSettings {
  trackingMode: 'group' | 'item';
  trackableUnitType: string;
  customUnitName?: string;
}

interface LineItem {
  sku: string;
  description?: string;
  quantity: number;
  weight?: number;
  weightUnit: string;
  hazmat: boolean;
  temperature?: string;
}

interface TrackableUnit {
  identifier: string;
  unitType: string;
  customTypeName?: string;
  lineItems: LineItem[];
  notes?: string;
}

interface OrderCreationFormProps {
  onOrderCreated?: (order: any) => void;
  onCancel?: () => void;
}

export default function OrderCreationFormWithUnits({
  onOrderCreated,
  onCancel
}: OrderCreationFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);

  // Order info
  const [orderNumber, setOrderNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [customerId, setCustomerId] = useState('');

  // Location handling
  const [useExistingOrigin, setUseExistingOrigin] = useState(true);
  const [useExistingDestination, setUseExistingDestination] = useState(true);
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [originData, setOriginData] = useState({
    name: '', address1: '', address2: '', city: '', state: '', postalCode: '', country: 'USA'
  });
  const [destinationData, setDestinationData] = useState({
    name: '', address1: '', address2: '', city: '', state: '', postalCode: '', country: 'USA'
  });

  // Dates
  const [requestedPickupDate, setRequestedPickupDate] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');

  // Trackable units
  const [trackableUnits, setTrackableUnits] = useState<TrackableUnit[]>([]);
  const [currentUnitIndex, setCurrentUnitIndex] = useState<number | null>(null);

  // Current line item being added
  const [currentItem, setCurrentItem] = useState<LineItem>({
    sku: '', description: '', quantity: 1, weight: undefined, weightUnit: 'kg',
    hazmat: false, temperature: 'ambient'
  });

  const [specialInstructions, setSpecialInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Special requirements
  const [serviceLevel, setServiceLevel] = useState<'FTL' | 'LTL'>('LTL');
  const [temperatureControl, setTemperatureControl] = useState<'ambient' | 'refrigerated' | 'frozen'>('ambient');
  const [requiresHazmat, setRequiresHazmat] = useState(false);

  useEffect(() => {
    loadCustomers();
    loadOrgSettings();
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

  const loadOrgSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/organization/settings`);
      const data = await response.json();
      setOrgSettings(data.data);
    } catch (error) {
      console.error('Failed to load organization settings:', error);
    }
  };

  const generateOrderNumber = () => {
    const timestamp = Date.now().toString().slice(-8);
    setOrderNumber(`ORD-${timestamp}`);
  };

  const getUnitLabel = () => {
    if (!orgSettings) return 'Unit';
    if (orgSettings.trackableUnitType === 'custom' && orgSettings.customUnitName) {
      return orgSettings.customUnitName;
    }
    return orgSettings.trackableUnitType.charAt(0).toUpperCase() + orgSettings.trackableUnitType.slice(1);
  };

  const addTrackableUnit = () => {
    const unitLabel = getUnitLabel();
    const nextNumber = trackableUnits.length + 1;

    const newUnit: TrackableUnit = {
      identifier: `${unitLabel.toUpperCase()}-${String(nextNumber).padStart(3, '0')}`,
      unitType: orgSettings?.trackableUnitType || 'box',
      customTypeName: orgSettings?.trackableUnitType === 'custom' ? orgSettings.customUnitName : undefined,
      lineItems: [],
      notes: ''
    };

    setTrackableUnits([...trackableUnits, newUnit]);
    setCurrentUnitIndex(trackableUnits.length);
    setError(null);
  };

  const removeTrackableUnit = (index: number) => {
    setTrackableUnits(trackableUnits.filter((_, i) => i !== index));
    if (currentUnitIndex === index) {
      setCurrentUnitIndex(null);
    } else if (currentUnitIndex !== null && currentUnitIndex > index) {
      setCurrentUnitIndex(currentUnitIndex - 1);
    }
  };

  const addLineItemToUnit = () => {
    if (currentUnitIndex === null) {
      setError('Please select a trackable unit first');
      return;
    }
    if (!currentItem.sku.trim()) {
      setError('Please enter a SKU');
      return;
    }
    if (currentItem.quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    const updatedUnits = [...trackableUnits];
    updatedUnits[currentUnitIndex].lineItems.push(currentItem);
    setTrackableUnits(updatedUnits);

    setCurrentItem({
      sku: '', description: '', quantity: 1, weight: undefined, weightUnit: 'kg',
      hazmat: false, temperature: 'ambient'
    });
    setError(null);
  };

  const removeLineItem = (unitIndex: number, itemIndex: number) => {
    const updatedUnits = [...trackableUnits];
    updatedUnits[unitIndex].lineItems = updatedUnits[unitIndex].lineItems.filter((_, i) => i !== itemIndex);
    setTrackableUnits(updatedUnits);
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
    if (useExistingOrigin && !originId) {
      setError('Please select an origin location');
      return false;
    }
    if (!useExistingOrigin && (!originData.name || !originData.address1 || !originData.city || !originData.country)) {
      setError('Please fill in all required origin location fields');
      return false;
    }
    if (useExistingDestination && !destinationId) {
      setError('Please select a destination location');
      return false;
    }
    if (!useExistingDestination && (!destinationData.name || !destinationData.address1 || !destinationData.city || !destinationData.country)) {
      setError('Please fill in all required destination location fields');
      return false;
    }
    if (trackableUnits.length === 0) {
      setError(`Please add at least one ${getUnitLabel()}`);
      return false;
    }
    for (let i = 0; i < trackableUnits.length; i++) {
      if (trackableUnits[i].lineItems.length === 0) {
        setError(`${trackableUnits[i].identifier} must have at least one line item`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const orderData: any = {
        orderNumber,
        poNumber: poNumber || undefined,
        customerId,
        requestedPickupDate: requestedPickupDate ? new Date(requestedPickupDate).toISOString() : undefined,
        requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate).toISOString() : undefined,
        serviceLevel,
        temperatureControl,
        requiresHazmat,
        trackableUnits,
        specialInstructions: specialInstructions || undefined,
        notes: notes || undefined,
        importSource: 'manual'
      };

      if (useExistingOrigin) {
        orderData.originId = originId;
      } else {
        orderData.originData = originData;
      }

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

  const getTotalLineItems = () => {
    return trackableUnits.reduce((total, unit) => total + unit.lineItems.length, 0);
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
        <input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="input" required />
        <label>Order Number *</label>
      </div>

      <div className="input-wrapper">
        <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="input" />
        <label>PO Number (Optional)</label>
      </div>

      <div className="input-wrapper">
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input" required>
          <option value="">Select customer...</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.name}</option>
          ))}
        </select>
        <label>Customer *</label>
      </div>

      <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Origin Location</h3>

      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--spacing-2)' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input type="radio" checked={useExistingOrigin} onChange={() => setUseExistingOrigin(true)} style={{ marginRight: '8px' }} />
          Use existing location
        </label>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input type="radio" checked={!useExistingOrigin} onChange={() => setUseExistingOrigin(false)} style={{ marginRight: '8px' }} />
          Enter new location
        </label>
      </div>

      {useExistingOrigin ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <LocationSearch value={originId} onChange={setOriginId} label="Origin Location *" />
        </div>
      ) : (
        <>
          <div className="input-wrapper">
            <input type="text" value={originData.name} onChange={(e) => setOriginData({ ...originData, name: e.target.value })} className="input" required />
            <label>Location Name *</label>
          </div>
          <div className="input-wrapper">
            <input type="text" value={originData.address1} onChange={(e) => setOriginData({ ...originData, address1: e.target.value })} className="input" required />
            <label>Address 1 *</label>
          </div>
          <div className="input-wrapper">
            <input type="text" value={originData.city} onChange={(e) => setOriginData({ ...originData, city: e.target.value })} className="input" required />
            <label>City *</label>
          </div>
          <div className="input-wrapper">
            <input type="text" value={originData.state} onChange={(e) => setOriginData({ ...originData, state: e.target.value })} className="input" />
            <label>State/Province</label>
          </div>
          <div className="input-wrapper">
            <input type="text" value={originData.country} onChange={(e) => setOriginData({ ...originData, country: e.target.value })} className="input" required />
            <label>Country *</label>
          </div>
        </>
      )}

      <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Destination Location</h3>

      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--spacing-2)' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input type="radio" checked={useExistingDestination} onChange={() => setUseExistingDestination(true)} style={{ marginRight: '8px' }} />
          Use existing location
        </label>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input type="radio" checked={!useExistingDestination} onChange={() => setUseExistingDestination(false)} style={{ marginRight: '8px' }} />
          Enter new location
        </label>
      </div>

      {useExistingDestination ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <LocationSearch value={destinationId} onChange={setDestinationId} label="Destination Location *" />
        </div>
      ) : (
        <>
          <div className="input-wrapper">
            <input type="text" value={destinationData.name} onChange={(e) => setDestinationData({ ...destinationData, name: e.target.value })} className="input" required />
            <label>Location Name *</label>
          </div>
          <div className="input-wrapper">
            <input type="text" value={destinationData.address1} onChange={(e) => setDestinationData({ ...destinationData, address1: e.target.value })} className="input" required />
            <label>Address 1 *</label>
          </div>
          <div className="input-wrapper">
            <input type="text" value={destinationData.city} onChange={(e) => setDestinationData({ ...destinationData, city: e.target.value })} className="input" required />
            <label>City *</label>
          </div>
          <div className="input-wrapper">
            <input type="text" value={destinationData.state} onChange={(e) => setDestinationData({ ...destinationData, state: e.target.value })} className="input" />
            <label>State/Province</label>
          </div>
          <div className="input-wrapper">
            <input type="text" value={destinationData.country} onChange={(e) => setDestinationData({ ...destinationData, country: e.target.value })} className="input" required />
            <label>Country *</label>
          </div>
        </>
      )}

      <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Dates</h3>

      <div className="input-wrapper">
        <input type="date" value={requestedPickupDate} onChange={(e) => setRequestedPickupDate(e.target.value)} className="input" />
        <label>Requested Pickup Date</label>
      </div>

      <div className="input-wrapper">
        <input type="date" value={requestedDeliveryDate} onChange={(e) => setRequestedDeliveryDate(e.target.value)} className="input" />
        <label>Requested Delivery Date</label>
      </div>

      <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Special Requirements</h3>

      <div className="input-wrapper">
        <select value={serviceLevel} onChange={(e) => setServiceLevel(e.target.value as 'FTL' | 'LTL')} className="input" required>
          <option value="LTL">LTL (Less Than Truck Load)</option>
          <option value="FTL">FTL (Full Truck Load)</option>
        </select>
        <label>Service Level *</label>
      </div>

      <div className="input-wrapper">
        <select value={temperatureControl} onChange={(e) => setTemperatureControl(e.target.value as 'ambient' | 'refrigerated' | 'frozen')} className="input" required>
          <option value="ambient">Ambient</option>
          <option value="refrigerated">Refrigerated</option>
          <option value="frozen">Frozen</option>
        </select>
        <label>Temperature Control *</label>
      </div>

      <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={requiresHazmat}
            onChange={(e) => setRequiresHazmat(e.target.checked)}
            style={{ width: 'auto' }}
          />
          <span>Requires Hazmat Certification</span>
        </label>
      </div>

      <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{getUnitLabel()}s ({trackableUnits.length}) - {getTotalLineItems()} items total</span>
        <button type="button" onClick={addTrackableUnit} className="button">
          <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
          Add {getUnitLabel()}
        </button>
      </h3>

      {trackableUnits.length === 0 && (
        <div style={{ gridColumn: '1 / -1', padding: 'var(--spacing-3)', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: '8px' }}>
          <p style={{ color: 'var(--color-grey)' }}>No {getUnitLabel()}s added yet. Click "Add {getUnitLabel()}" to get started.</p>
        </div>
      )}

      {trackableUnits.map((unit, unitIndex) => (
        <div key={unitIndex} style={{
          gridColumn: '1 / -1',
          padding: 'var(--spacing-2)',
          backgroundColor: currentUnitIndex === unitIndex ? 'var(--color-primary-bg)' : 'var(--color-surface)',
          border: currentUnitIndex === unitIndex ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
          borderRadius: '8px',
          marginBottom: 'var(--spacing-2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-1)' }}>
            <div>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons" style={{ color: 'var(--color-primary)' }}>
                  {orgSettings?.trackingMode === 'group' ? 'inventory_2' : 'widgets'}
                </span>
                {unit.identifier}
                <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--color-grey)' }}>
                  ({unit.lineItems.length} items)
                </span>
              </h4>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setCurrentUnitIndex(unitIndex)}
                className="button button-sm button-outline"
                disabled={currentUnitIndex === unitIndex}
              >
                {currentUnitIndex === unitIndex ? 'Selected' : 'Select'}
              </button>
              <button
                type="button"
                onClick={() => removeTrackableUnit(unitIndex)}
                className="button button-sm button-outline"
                style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
              </button>
            </div>
          </div>

          {unit.lineItems.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 'var(--spacing-1)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Weight</th>
                    <th>Temp</th>
                    <th>Hazmat</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {unit.lineItems.map((item, itemIndex) => (
                    <tr key={itemIndex}>
                      <td>{item.sku}</td>
                      <td>{item.description || '—'}</td>
                      <td>{item.quantity}</td>
                      <td>{item.weight ? `${item.weight} ${item.weightUnit}` : '—'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{item.temperature || 'Ambient'}</td>
                      <td>{item.hazmat ? '⚠️ Yes' : 'No'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => removeLineItem(unitIndex, itemIndex)}
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
        </div>
      ))}

      {currentUnitIndex !== null && (
        <div style={{
          gridColumn: '1 / -1',
          padding: 'var(--spacing-2)',
          backgroundColor: 'var(--color-success-bg)',
          borderLeft: '4px solid var(--color-success)',
          borderRadius: '4px',
          marginBottom: 'var(--spacing-2)'
        }}>
          <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons">add_shopping_cart</span>
            Add Item to {trackableUnits[currentUnitIndex].identifier}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-1)' }}>
            <div className="input-wrapper">
              <input type="text" value={currentItem.sku} onChange={(e) => setCurrentItem({ ...currentItem, sku: e.target.value })} className="input" />
              <label>SKU *</label>
            </div>

            <div className="input-wrapper">
              <input type="text" value={currentItem.description} onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })} className="input" />
              <label>Description</label>
            </div>

            <div className="input-wrapper">
              <input type="number" min="1" value={currentItem.quantity} onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 1 })} className="input" />
              <label>Quantity *</label>
            </div>

            <div className="input-wrapper">
              <input type="number" step="0.01" value={currentItem.weight || ''} onChange={(e) => setCurrentItem({ ...currentItem, weight: parseFloat(e.target.value) || undefined })} className="input" />
              <label>Weight (kg)</label>
            </div>

            <div className="input-wrapper">
              <select value={currentItem.temperature} onChange={(e) => setCurrentItem({ ...currentItem, temperature: e.target.value })} className="input">
                <option value="ambient">Ambient</option>
                <option value="refrigerated">Refrigerated</option>
                <option value="frozen">Frozen</option>
              </select>
              <label>Temperature</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={currentItem.hazmat} onChange={(e) => setCurrentItem({ ...currentItem, hazmat: e.target.checked })} style={{ marginRight: '8px' }} />
                Hazmat
              </label>
            </div>
          </div>

          <button type="button" onClick={addLineItemToUnit} className="button" style={{ marginTop: 'var(--spacing-1)' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Add Item
          </button>
        </div>
      )}

      <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Additional Information</h3>

      <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
        <textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} className="input" rows={3} />
        <label>Special Instructions</label>
      </div>

      <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} />
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
