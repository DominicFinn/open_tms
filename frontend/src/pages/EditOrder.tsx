import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface LineItem {
  id?: string;
  sku: string;
  description?: string;
  quantity: number;
  weight?: number;
  weightUnit?: string;
  length?: number;
  width?: number;
  height?: number;
  dimUnit?: string;
  hazmat?: boolean;
  temperature?: string;
}

interface TrackableUnit {
  id?: string;
  identifier: string;
  unitType: string;
  customTypeName?: string;
  barcode?: string;
  notes?: string;
  sequenceNumber?: number;
  lineItems: LineItem[];
}

interface Order {
  id: string;
  orderNumber: string;
  poNumber?: string;
  status: string;
  customer: {
    id: string;
    name: string;
  };
  origin?: {
    id: string;
    name: string;
    address1: string;
    city: string;
    state?: string;
    country: string;
  };
  destination?: {
    id: string;
    name: string;
    address1: string;
    city: string;
    state?: string;
    country: string;
  };
  requestedPickupDate?: string;
  requestedDeliveryDate?: string;
  specialInstructions?: string;
  notes?: string;
  trackableUnits: TrackableUnit[];
  lineItems: LineItem[];
}

export default function EditOrder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  // Editable fields
  const [orderNumber, setOrderNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [requestedPickupDate, setRequestedPickupDate] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [trackableUnits, setTrackableUnits] = useState<TrackableUnit[]>([]);

  // UI state
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [addingItemToUnit, setAddingItemToUnit] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<LineItem>({
    sku: '',
    quantity: 1,
    weightUnit: 'kg',
    dimUnit: 'cm',
    hazmat: false
  });

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${id}`);
      const result = await response.json();

      if (result.error) {
        setError(result.error);
        return;
      }

      const orderData = result.data;
      setOrder(orderData);
      setOrderNumber(orderData.orderNumber);
      setPoNumber(orderData.poNumber || '');
      setRequestedPickupDate(orderData.requestedPickupDate ? orderData.requestedPickupDate.split('T')[0] : '');
      setRequestedDeliveryDate(orderData.requestedDeliveryDate ? orderData.requestedDeliveryDate.split('T')[0] : '');
      setSpecialInstructions(orderData.specialInstructions || '');
      setNotes(orderData.notes || '');
      setTrackableUnits(orderData.trackableUnits);
    } catch (err) {
      setError('Failed to load order');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMetadata = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          poNumber: poNumber || undefined,
          requestedPickupDate: requestedPickupDate ? new Date(requestedPickupDate).toISOString() : undefined,
          requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate).toISOString() : undefined,
          specialInstructions: specialInstructions || undefined,
          notes: notes || undefined
        })
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        alert('Order updated successfully');
      }
    } catch (err) {
      setError('Failed to update order');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUnit = async (unitId: string, data: { identifier?: string; notes?: string }) => {
    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${id}/trackable-units/${unitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        // Update local state
        setTrackableUnits(trackableUnits.map(u =>
          u.id === unitId ? { ...u, ...data } : u
        ));
        setEditingUnitId(null);
      }
    } catch (err) {
      setError('Failed to update unit');
      console.error(err);
    }
  };

  const handleGenerateBarcode = async (unitId: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${id}/trackable-units/${unitId}/generate-barcode`, {
        method: 'POST'
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        // Update local state
        setTrackableUnits(trackableUnits.map(u =>
          u.id === unitId ? { ...u, barcode: result.data.barcode } : u
        ));
      }
    } catch (err) {
      setError('Failed to generate barcode');
      console.error(err);
    }
  };

  const handleRemoveUnit = async (unitId: string) => {
    if (!confirm('Are you sure you want to remove this trackable unit? All line items in this unit will be deleted.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${id}/trackable-units/${unitId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        setTrackableUnits(trackableUnits.filter(u => u.id !== unitId));
      }
    } catch (err) {
      setError('Failed to remove unit');
      console.error(err);
    }
  };

  const handleAddItemToUnit = async (unitId: string) => {
    if (!newItem.sku || newItem.quantity < 1) {
      alert('Please fill in required fields (SKU and Quantity)');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${id}/trackable-units/${unitId}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        // Update local state
        setTrackableUnits(trackableUnits.map(u =>
          u.id === unitId ? { ...u, lineItems: [...u.lineItems, result.data] } : u
        ));
        setAddingItemToUnit(null);
        setNewItem({
          sku: '',
          quantity: 1,
          weightUnit: 'kg',
          dimUnit: 'cm',
          hazmat: false
        });
      }
    } catch (err) {
      setError('Failed to add line item');
      console.error(err);
    }
  };

  const handleRemoveLineItem = async (itemId: string, unitId: string) => {
    if (!confirm('Are you sure you want to remove this line item?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${id}/line-items/${itemId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        // Update local state
        setTrackableUnits(trackableUnits.map(u =>
          u.id === unitId ? { ...u, lineItems: u.lineItems.filter(item => item.id !== itemId) } : u
        ));
      }
    } catch (err) {
      setError('Failed to remove line item');
      console.error(err);
    }
  };

  const handleMoveItem = async (itemId: string, currentUnitId: string, targetUnitId: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${id}/line-items/${itemId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUnitId })
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        // Refresh order to get updated state
        fetchOrder();
      }
    } catch (err) {
      setError('Failed to move line item');
      console.error(err);
    }
  };

  const handleMergeUnits = async (sourceUnitId: string) => {
    const targetUnit = trackableUnits.find(u => u.id !== sourceUnitId);
    if (!targetUnit) {
      alert('Need at least 2 units to merge');
      return;
    }

    const targetUnitId = prompt(`Merge ${trackableUnits.find(u => u.id === sourceUnitId)?.identifier} into which unit? Enter target unit ID:\n\nAvailable units:\n${trackableUnits.filter(u => u.id !== sourceUnitId).map(u => `${u.identifier} (${u.id})`).join('\n')}`);

    if (!targetUnitId) return;

    if (!confirm(`Merge all items from this unit into ${trackableUnits.find(u => u.id === targetUnitId)?.identifier}? This will delete the source unit.`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${id}/trackable-units/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUnitId, targetUnitId })
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        fetchOrder();
      }
    } catch (err) {
      setError('Failed to merge units');
      console.error(err);
    }
  };

  const handleSplitUnit = async (unitId: string) => {
    const unit = trackableUnits.find(u => u.id === unitId);
    if (!unit || unit.lineItems.length < 2) {
      alert('Unit must have at least 2 items to split');
      return;
    }

    const newIdentifier = prompt(`Enter identifier for the new unit (items will be moved from ${unit.identifier}):`);
    if (!newIdentifier) return;

    // For simplicity, let user enter comma-separated item indices
    const itemIndices = prompt(`Enter comma-separated item numbers to move to new unit (1-${unit.lineItems.length}):`);
    if (!itemIndices) return;

    const indices = itemIndices.split(',').map(i => parseInt(i.trim()) - 1);
    const itemIdsToMove = indices.map(i => unit.lineItems[i]?.id).filter(Boolean);

    if (itemIdsToMove.length === 0) {
      alert('No valid items selected');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/v1/orders/${id}/trackable-units/${unitId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIdsToMove,
          newIdentifier
        })
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        fetchOrder();
      }
    } catch (err) {
      setError('Failed to split unit');
      console.error(err);
    }
  };

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  if (!order) {
    return <div className="card">Order not found</div>;
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
          <h2>Edit Order</h2>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
            <button onClick={() => navigate(`/orders/${id}`)} className="button button-outlined">
              Cancel
            </button>
            <button onClick={handleSaveMetadata} disabled={saving} className="button button-primary">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: 'var(--spacing-2)',
            backgroundColor: 'var(--color-error-container)',
            color: 'var(--color-on-error-container)',
            borderRadius: 'var(--radius-medium)',
            marginBottom: 'var(--spacing-3)'
          }}>
            {error}
          </div>
        )}

        {/* Order Metadata */}
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <h3>Order Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-3)' }}>
            <div>
              <label>Order Number *</label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <label>PO Number</label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
            </div>
            <div>
              <label>Requested Pickup Date</label>
              <input
                type="date"
                value={requestedPickupDate}
                onChange={(e) => setRequestedPickupDate(e.target.value)}
              />
            </div>
            <div>
              <label>Requested Delivery Date</label>
              <input
                type="date"
                value={requestedDeliveryDate}
                onChange={(e) => setRequestedDeliveryDate(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: 'var(--spacing-3)' }}>
            <label>Special Instructions</label>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={3}
            />
          </div>
          <div style={{ marginTop: 'var(--spacing-3)' }}>
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Trackable Units */}
        <div>
          <h3>Trackable Units</h3>
          {trackableUnits.map(unit => (
            <div key={unit.id} style={{
              border: '1px solid var(--color-outline)',
              borderRadius: 'var(--radius-large)',
              padding: 'var(--spacing-3)',
              marginBottom: 'var(--spacing-3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-2)' }}>
                {editingUnitId === unit.id ? (
                  <div style={{ flex: 1, display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                    <input
                      type="text"
                      defaultValue={unit.identifier}
                      id={`unit-identifier-${unit.id}`}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="button button-primary"
                      onClick={() => {
                        const newIdentifier = (document.getElementById(`unit-identifier-${unit.id}`) as HTMLInputElement).value;
                        handleUpdateUnit(unit.id!, { identifier: newIdentifier });
                      }}
                    >
                      Save
                    </button>
                    <button
                      className="button button-outlined"
                      onClick={() => setEditingUnitId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <h4 style={{ margin: 0 }}>
                        <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 'var(--spacing-1)' }}>
                          {unit.unitType === 'pallet' || unit.unitType === 'tote' ? 'inventory_2' : 'widgets'}
                        </span>
                        {unit.identifier}
                      </h4>
                      <div style={{ fontSize: '14px', color: 'var(--color-grey)', marginTop: 'var(--spacing-1)' }}>
                        {unit.customTypeName || unit.unitType} • {unit.lineItems.length} items
                        {unit.barcode && ` • Barcode: ${unit.barcode}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                      <button
                        className="button button-outlined button-small"
                        onClick={() => setEditingUnitId(unit.id!)}
                        title="Edit Unit"
                      >
                        <span className="material-icons">edit</span>
                      </button>
                      <button
                        className="button button-outlined button-small"
                        onClick={() => handleGenerateBarcode(unit.id!)}
                        title="Generate Barcode"
                      >
                        <span className="material-icons">qr_code</span>
                      </button>
                      <button
                        className="button button-outlined button-small"
                        onClick={() => handleSplitUnit(unit.id!)}
                        title="Split Unit"
                      >
                        <span className="material-icons">call_split</span>
                      </button>
                      <button
                        className="button button-outlined button-small"
                        onClick={() => handleMergeUnits(unit.id!)}
                        title="Merge Unit"
                      >
                        <span className="material-icons">merge</span>
                      </button>
                      <button
                        className="button button-outlined button-small"
                        onClick={() => handleRemoveUnit(unit.id!)}
                        style={{ color: 'var(--color-error)' }}
                        title="Delete Unit"
                      >
                        <span className="material-icons">delete</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Line Items Table */}
              {unit.lineItems.length > 0 && (
                <table className="data-table" style={{ marginTop: 'var(--spacing-2)' }}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Weight</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unit.lineItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.sku}</td>
                        <td>{item.description || '—'}</td>
                        <td>{item.quantity}</td>
                        <td>{item.weight ? `${item.weight} ${item.weightUnit}` : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                            <button
                              className="button button-outlined button-small"
                              onClick={() => handleRemoveLineItem(item.id!, unit.id!)}
                              style={{ color: 'var(--color-error)' }}
                            >
                              <span className="material-icons">delete</span>
                            </button>
                            <select
                              className="button button-outlined button-small"
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleMoveItem(item.id!, unit.id!, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              style={{ padding: '4px 8px' }}
                            >
                              <option value="">Move to...</option>
                              {trackableUnits.filter(u => u.id !== unit.id).map(u => (
                                <option key={u.id} value={u.id}>{u.identifier}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Add Item Form */}
              {addingItemToUnit === unit.id ? (
                <div style={{
                  marginTop: 'var(--spacing-2)',
                  padding: 'var(--spacing-2)',
                  backgroundColor: 'var(--color-surface-variant)',
                  borderRadius: 'var(--radius-medium)'
                }}>
                  <h5>Add Line Item</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--spacing-2)' }}>
                    <div>
                      <label>SKU *</label>
                      <input
                        type="text"
                        value={newItem.sku}
                        onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Quantity *</label>
                      <input
                        type="number"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div>
                      <label>Weight</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newItem.weight || ''}
                        onChange={(e) => setNewItem({ ...newItem, weight: parseFloat(e.target.value) || undefined })}
                      />
                    </div>
                    <div>
                      <label>Description</label>
                      <input
                        type="text"
                        value={newItem.description || ''}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
                    <button
                      className="button button-primary"
                      onClick={() => handleAddItemToUnit(unit.id!)}
                    >
                      Add Item
                    </button>
                    <button
                      className="button button-outlined"
                      onClick={() => setAddingItemToUnit(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="button button-outlined"
                  style={{ marginTop: 'var(--spacing-2)' }}
                  onClick={() => setAddingItemToUnit(unit.id!)}
                >
                  <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: 'var(--spacing-1)' }}>add</span>
                  Add Line Item
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
