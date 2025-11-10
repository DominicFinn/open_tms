import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../api';

interface OrderLineItem {
  id: string;
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

interface TrackableUnit {
  id: string;
  identifier: string;
  unitType: string;
  customTypeName?: string;
  sequenceNumber: number;
  barcode?: string;
  notes?: string;
  lineItems: OrderLineItem[];
}

interface Order {
  id: string;
  orderNumber: string;
  poNumber?: string;
  status: string;
  importSource: string;
  customer: {
    id: string;
    name: string;
    contactEmail?: string;
  };
  origin?: {
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
  };
  destination?: {
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
  };
  originData?: any;
  destinationData?: any;
  originValidated: boolean;
  destinationValidated: boolean;
  orderDate: string;
  requestedPickupDate?: string;
  requestedDeliveryDate?: string;
  // Delivery status fields
  deliveryStatus: string;
  deliveredAt?: string;
  deliveryConfirmedBy?: string;
  deliveryMethod?: string;
  deliveryNotes?: string;
  exceptionType?: string;
  exceptionNotes?: string;
  exceptionResolvedAt?: string;
  deliveryStop?: {
    id: string;
    sequenceNumber: number;
    location: {
      id: string;
      name: string;
      city: string;
    };
    status: string;
  };
  trackableUnits: TrackableUnit[];
  lineItems: OrderLineItem[];
  specialInstructions?: string;
  notes?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

const statusColors: { [key: string]: string } = {
  pending: 'var(--color-warning)',
  validated: 'var(--color-success)',
  location_error: 'var(--color-error)',
  converted: 'var(--color-info)',
  assigned: 'var(--color-success)',
  pending_lane: 'var(--color-warning)',
  cancelled: 'var(--color-grey)',
  archived: 'var(--color-grey)'
};

const deliveryStatusColors: { [key: string]: string } = {
  unassigned: 'var(--color-grey)',
  assigned: 'var(--color-info)',
  in_transit: 'var(--color-primary)',
  delivered: 'var(--color-success)',
  exception: 'var(--color-error)',
  cancelled: 'var(--color-grey)'
};

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/orders/${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load order');
      }

      setOrder(result.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!order) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/orders/${order.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to archive order');
      }

      navigate('/orders');
    } catch (err: any) {
      setError(err.message || 'Failed to archive order');
    }
  };

  const handleConvertToShipment = async () => {
    if (!order) return;

    if (!confirm(`Convert order ${order.orderNumber} to a shipment? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/orders/${order.id}/convert-to-shipment`, {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to convert order to shipment');
      }

      // Navigate to the new shipment
      navigate(`/shipments/${result.data.shipmentId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to convert order to shipment');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!order) return;
    window.location.href = `${API_URL}/api/v1/orders/${order.id}/export/csv`;
  };

  const handleAssignToShipment = async () => {
    if (!order) return;

    if (!confirm(`Attempt to automatically assign order ${order.orderNumber} to a matching shipment?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/orders/${order.id}/assign-to-shipment`, {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign order to shipment');
      }

      // Show result message
      if (result.data.shipmentId) {
        if (confirm(`Order assigned to shipment! Would you like to view the shipment now?`)) {
          navigate(`/shipments/${result.data.shipmentId}`);
        } else {
          // Reload order to show updated status
          loadOrder();
        }
      } else if (result.data.pendingLaneRequestId) {
        alert(`No matching lane found. A pending lane request has been created. Please review pending lane requests to create the required lane.`);
        // Reload order to show updated status
        loadOrder();
      } else {
        alert(result.data.message);
        loadOrder();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to assign order to shipment');
    }
  };

  const handleMarkDelivered = async () => {
    if (!order) return;

    const notes = prompt('Delivery notes (optional):');
    if (notes === null) return; // User cancelled

    try {
      const response = await fetch(`${API_URL}/api/v1/orders/${order.id}/mark-delivered`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'manual',
          confirmedBy: 'user', // In future, use actual user ID
          notes: notes || undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to mark order as delivered');
      }

      alert('Order marked as delivered successfully!');
      loadOrder();
    } catch (err: any) {
      setError(err.message || 'Failed to mark order as delivered');
    }
  };

  const handleCreateException = async () => {
    if (!order) return;

    const exceptionType = prompt('Exception type (delay/damage/refused/address_issue/weather/other):');
    if (!exceptionType) return;

    const exceptionNotes = prompt('Exception details:');
    if (!exceptionNotes) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/orders/${order.id}/delivery-exception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionType,
          exceptionNotes,
          reportedBy: 'user'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create exception');
      }

      alert('Exception created successfully!');
      loadOrder();
    } catch (err: any) {
      setError(err.message || 'Failed to create exception');
    }
  };

  const handleResolveException = async () => {
    if (!order) return;

    const notes = prompt('Resolution notes (optional):');
    if (notes === null) return; // User cancelled

    try {
      const response = await fetch(`${API_URL}/api/v1/orders/${order.id}/resolve-exception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolvedBy: 'user',
          notes: notes || undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resolve exception');
      }

      alert('Exception resolved successfully!');
      loadOrder();
    } catch (err: any) {
      setError(err.message || 'Failed to resolve exception');
    }
  };

  const getStatusBadge = (status: string) => {
    const color = statusColors[status] || 'var(--color-grey)';
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '6px 16px',
          borderRadius: '16px',
          fontSize: '14px',
          fontWeight: '500',
          backgroundColor: `${color}15`,
          color: color,
          textTransform: 'capitalize'
        }}
      >
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getDeliveryStatusBadge = (status: string) => {
    const color = deliveryStatusColors[status] || 'var(--color-grey)';
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '6px 16px',
          borderRadius: '16px',
          fontSize: '14px',
          fontWeight: '500',
          backgroundColor: `${color}15`,
          color: color,
          textTransform: 'capitalize'
        }}
      >
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getLocationDisplay = (location?: any, locationData?: any, validated?: boolean) => {
    if (location) {
      return (
        <div>
          <div style={{ fontWeight: '500' }}>{location.name}</div>
          <div style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
            {location.address1}
            {location.address2 && `, ${location.address2}`}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
            {location.city}, {location.state || location.country} {location.postalCode}
          </div>
        </div>
      );
    }
    if (locationData && !validated) {
      return (
        <div style={{ color: 'var(--color-warning)' }}>
          <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle' }}>warning</span>
          {' '}Location not validated
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            {locationData.name} - {locationData.city}, {locationData.country}
          </div>
        </div>
      );
    }
    return <span style={{ color: 'var(--color-grey)' }}>Not specified</span>;
  };

  const getTotalItems = () => {
    if (!order) return 0;
    const unitsItems = order.trackableUnits.reduce((total, unit) => total + unit.lineItems.length, 0);
    return unitsItems + order.lineItems.length;
  };

  const getTotalQuantity = () => {
    if (!order) return 0;
    const unitsQty = order.trackableUnits.reduce((total, unit) =>
      total + unit.lineItems.reduce((sum, item) => sum + item.quantity, 0), 0
    );
    const legacyQty = order.lineItems.reduce((sum, item) => sum + item.quantity, 0);
    return unitsQty + legacyQty;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
        <div className="loading-spinner"></div>
        <p>Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="card">
        <div className="alert alert-error">
          <span className="material-icons">error</span>
          {error || 'Order not found'}
        </div>
        <Link to="/orders" className="button" style={{ marginTop: 'var(--spacing-2)' }}>
          Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-2)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', marginBottom: 'var(--spacing-1)' }}>
              <Link to="/orders" className="button button-sm button-outline">
                <span className="material-icons" style={{ fontSize: '16px' }}>arrow_back</span>
              </Link>
              <h2 style={{ margin: 0 }}>Order {order.orderNumber}</h2>
            </div>
            {order.poNumber && (
              <div style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
                PO Number: {order.poNumber}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)', alignItems: 'center' }}>
            {getStatusBadge(order.status)}
            <button
              onClick={handleExportCSV}
              className="button button-sm button-outline no-print"
            >
              <span className="material-icons" style={{ fontSize: '16px' }}>download</span>
              Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="button button-sm button-outline no-print"
            >
              <span className="material-icons" style={{ fontSize: '16px' }}>print</span>
              Print
            </button>
            {order.status !== 'converted' && order.status !== 'archived' && order.status !== 'assigned' && (
              <>
                <button
                  onClick={() => navigate(`/orders/${order.id}/edit`)}
                  className="button button-sm button-outline no-print"
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>edit</span>
                  Edit
                </button>
                {order.origin && order.destination && (
                  <>
                    <button
                      onClick={handleAssignToShipment}
                      className="button button-sm button-primary no-print"
                    >
                      <span className="material-icons" style={{ fontSize: '16px' }}>auto_awesome</span>
                      Assign to Shipment
                    </button>
                    <button
                      onClick={handleConvertToShipment}
                      className="button button-sm button-outline no-print"
                    >
                      <span className="material-icons" style={{ fontSize: '16px' }}>local_shipping</span>
                      Manual Convert
                    </button>
                  </>
                )}
              </>
            )}
            {showDeleteConfirm ? (
              <>
                <button
                  onClick={handleDelete}
                  className="button button-sm no-print"
                  style={{ backgroundColor: 'var(--color-error)', color: 'white' }}
                >
                  Confirm Archive
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="button button-sm button-outline no-print"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="button button-sm button-outline no-print"
                style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                Archive
              </button>
            )}
          </div>
        </div>

        {/* Order Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Customer</div>
            <div style={{ fontWeight: '500' }}>{order.customer.name}</div>
            {order.customer.contactEmail && (
              <div style={{ fontSize: '14px', color: 'var(--color-grey)' }}>{order.customer.contactEmail}</div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Import Source</div>
            <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>{order.importSource}</div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Order Date</div>
            <div style={{ fontWeight: '500' }}>{new Date(order.orderDate).toLocaleDateString()}</div>
          </div>

          {order.requestedPickupDate && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Requested Pickup</div>
              <div style={{ fontWeight: '500' }}>{new Date(order.requestedPickupDate).toLocaleDateString()}</div>
            </div>
          )}

          {order.requestedDeliveryDate && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Requested Delivery</div>
              <div style={{ fontWeight: '500' }}>{new Date(order.requestedDeliveryDate).toLocaleDateString()}</div>
            </div>
          )}
        </div>
      </div>

      {/* Locations */}
      <div className="card">
        <h3>Locations</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-2)' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '8px' }}>
              <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle' }}>trip_origin</span>
              {' '}Origin
            </div>
            {getLocationDisplay(order.origin, order.originData, order.originValidated)}
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '8px' }}>
              <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle' }}>place</span>
              {' '}Destination
            </div>
            {getLocationDisplay(order.destination, order.destinationData, order.destinationValidated)}
          </div>
        </div>
      </div>

      {/* Delivery Status */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h3 style={{ margin: 0 }}>Delivery Status</h3>
          {getDeliveryStatusBadge(order.deliveryStatus)}
        </div>

        {/* Status Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
            <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>{order.deliveryStatus.replace('_', ' ')}</div>
          </div>

          {order.deliveryMethod && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Confirmation Method</div>
              <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>{order.deliveryMethod.replace('_', ' ')}</div>
            </div>
          )}

          {order.deliveredAt && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Delivered At</div>
              <div style={{ fontWeight: '500' }}>{new Date(order.deliveredAt).toLocaleString()}</div>
            </div>
          )}

          {order.deliveryConfirmedBy && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Confirmed By</div>
              <div style={{ fontWeight: '500' }}>{order.deliveryConfirmedBy}</div>
            </div>
          )}
        </div>

        {/* Delivery Stop Info (Multi-leg shipment) */}
        {order.deliveryStop && (
          <div style={{
            padding: 'var(--spacing-2)',
            backgroundColor: 'var(--color-info-light)',
            border: '1px solid var(--color-info)',
            borderRadius: '8px',
            marginBottom: 'var(--spacing-2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', marginBottom: '4px' }}>
              <span className="material-icons" style={{ color: 'var(--color-info)', fontSize: '18px' }}>flag</span>
              <strong>Multi-Leg Shipment - Stop #{order.deliveryStop.sequenceNumber}</strong>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
              Delivery at: {order.deliveryStop.location.name}, {order.deliveryStop.location.city}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
              Stop Status: <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{order.deliveryStop.status}</span>
            </div>
          </div>
        )}

        {/* Exception Info */}
        {order.deliveryStatus === 'exception' && (
          <div style={{
            padding: 'var(--spacing-2)',
            backgroundColor: 'var(--color-error-light)',
            border: '1px solid var(--color-error)',
            borderRadius: '8px',
            marginBottom: 'var(--spacing-2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', marginBottom: '8px' }}>
              <span className="material-icons" style={{ color: 'var(--color-error)' }}>warning</span>
              <strong>Delivery Exception</strong>
            </div>
            {order.exceptionType && (
              <div style={{ marginBottom: '4px' }}>
                <strong>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{order.exceptionType.replace('_', ' ')}</span>
              </div>
            )}
            {order.exceptionNotes && (
              <div style={{ marginBottom: '4px' }}>
                <strong>Details:</strong> {order.exceptionNotes}
              </div>
            )}
            {order.exceptionResolvedAt && (
              <div style={{ fontSize: '14px', color: 'var(--color-success)' }}>
                Resolved: {new Date(order.exceptionResolvedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Delivery Notes */}
        {order.deliveryNotes && (
          <div style={{
            padding: 'var(--spacing-2)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            marginBottom: 'var(--spacing-2)'
          }}>
            <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Delivery Notes</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{order.deliveryNotes}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap' }} className="no-print">
          {order.deliveryStatus !== 'delivered' && order.deliveryStatus !== 'cancelled' && (
            <>
              {order.deliveryStatus === 'exception' ? (
                <button
                  onClick={handleResolveException}
                  className="button button-sm button-success"
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>check_circle</span>
                  Resolve Exception
                </button>
              ) : (
                <>
                  <button
                    onClick={handleMarkDelivered}
                    className="button button-sm button-success"
                  >
                    <span className="material-icons" style={{ fontSize: '16px' }}>check_circle</span>
                    Mark Delivered
                  </button>
                  <button
                    onClick={handleCreateException}
                    className="button button-sm button-outline"
                    style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                  >
                    <span className="material-icons" style={{ fontSize: '16px' }}>warning</span>
                    Report Exception
                  </button>
                </>
              )}
            </>
          )}
          {order.deliveryStatus === 'delivered' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-1)',
              padding: 'var(--spacing-1)',
              backgroundColor: 'var(--color-success-light)',
              borderRadius: '8px',
              color: 'var(--color-success)'
            }}>
              <span className="material-icons">check_circle</span>
              <span style={{ fontWeight: '500' }}>Order delivered successfully</span>
            </div>
          )}
        </div>
      </div>

      {/* Trackable Units */}
      {order.trackableUnits.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
            <h3 style={{ margin: 0 }}>
              Trackable Units ({order.trackableUnits.length})
            </h3>
            <div style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
              {getTotalItems()} items total • {getTotalQuantity()} units total
            </div>
          </div>

          {order.trackableUnits.map((unit) => (
            <div
              key={unit.id}
              style={{
                padding: 'var(--spacing-2)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                marginBottom: 'var(--spacing-2)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-1)' }}>
                <div>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-icons" style={{ color: 'var(--color-primary)' }}>
                      {unit.unitType === 'pallet' || unit.unitType === 'tote' ? 'inventory_2' : 'widgets'}
                    </span>
                    {unit.identifier}
                  </h4>
                  <div style={{ fontSize: '14px', color: 'var(--color-grey)', marginTop: '4px' }}>
                    {unit.customTypeName || unit.unitType.charAt(0).toUpperCase() + unit.unitType.slice(1)}
                    {' • '}
                    {unit.lineItems.length} {unit.lineItems.length === 1 ? 'item' : 'items'}
                    {' • '}
                    Sequence #{unit.sequenceNumber}
                  </div>
                  {unit.barcode && (
                    <div style={{ fontSize: '12px', color: 'var(--color-grey)', marginTop: '4px' }}>
                      <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle' }}>qr_code</span>
                      {' '}{unit.barcode}
                    </div>
                  )}
                  {unit.notes && (
                    <div style={{ fontSize: '14px', fontStyle: 'italic', color: 'var(--color-grey)', marginTop: '4px' }}>
                      {unit.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <div style={{ overflowX: 'auto', marginTop: 'var(--spacing-1)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Description</th>
                      <th>Quantity</th>
                      <th>Weight</th>
                      <th>Dimensions</th>
                      <th>Temperature</th>
                      <th>Hazmat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unit.lineItems.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: '500' }}>{item.sku}</td>
                        <td>{item.description || '—'}</td>
                        <td>{item.quantity}</td>
                        <td>{item.weight ? `${item.weight} ${item.weightUnit}` : '—'}</td>
                        <td>
                          {item.length && item.width && item.height
                            ? `${item.length} × ${item.width} × ${item.height} ${item.dimUnit}`
                            : '—'}
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{item.temperature || 'Ambient'}</td>
                        <td>
                          {item.hazmat ? (
                            <span style={{ color: 'var(--color-error)' }}>⚠️ Yes</span>
                          ) : (
                            <span style={{ color: 'var(--color-grey)' }}>No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legacy Line Items (if any) */}
      {order.lineItems.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-2)' }}>
            <h3 style={{ margin: 0 }}>Line Items (Legacy)</h3>
            <span style={{
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: 'var(--color-warning-bg)',
              color: 'var(--color-warning)'
            }}>
              Not in trackable units
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Weight</th>
                  <th>Dimensions</th>
                  <th>Temperature</th>
                  <th>Hazmat</th>
                </tr>
              </thead>
              <tbody>
                {order.lineItems.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: '500' }}>{item.sku}</td>
                    <td>{item.description || '—'}</td>
                    <td>{item.quantity}</td>
                    <td>{item.weight ? `${item.weight} ${item.weightUnit}` : '—'}</td>
                    <td>
                      {item.length && item.width && item.height
                        ? `${item.length} × ${item.width} × ${item.height} ${item.dimUnit}`
                        : '—'}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{item.temperature || 'Ambient'}</td>
                    <td>
                      {item.hazmat ? (
                        <span style={{ color: 'var(--color-error)' }}>⚠️ Yes</span>
                      ) : (
                        <span style={{ color: 'var(--color-grey)' }}>No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Additional Information */}
      {(order.specialInstructions || order.notes) && (
        <div className="card">
          <h3>Additional Information</h3>
          {order.specialInstructions && (
            <div style={{ marginBottom: 'var(--spacing-2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Special Instructions
              </div>
              <div style={{ padding: 'var(--spacing-1)', backgroundColor: 'var(--color-surface)', borderRadius: '4px' }}>
                {order.specialInstructions}
              </div>
            </div>
          )}
          {order.notes && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Notes
              </div>
              <div style={{ padding: 'var(--spacing-1)', backgroundColor: 'var(--color-surface)', borderRadius: '4px' }}>
                {order.notes}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="card">
        <h3>Metadata</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-2)' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Created</div>
            <div>{new Date(order.createdAt).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Last Updated</div>
            <div>{new Date(order.updatedAt).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-grey)', textTransform: 'uppercase', marginBottom: '4px' }}>Order ID</div>
            <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>{order.id}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
