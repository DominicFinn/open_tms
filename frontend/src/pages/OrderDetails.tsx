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

interface TimelineEntry {
  id: string;
  timestamp: string;
  action: string;
  description: string;
  fromStatus: string | null;
  toStatus: string | null;
  method: string | null;
  actor: string | null;
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

const statusChipClass: { [key: string]: string } = {
  pending: 'chip chip-warning',
  validated: 'chip chip-success',
  location_error: 'chip chip-error',
  converted: 'chip chip-info',
  assigned: 'chip chip-success',
  pending_lane: 'chip chip-warning',
  cancelled: 'chip chip-primary',
  archived: 'chip chip-primary'
};

const deliveryStatusChipClass: { [key: string]: string } = {
  unassigned: 'chip chip-primary',
  assigned: 'chip chip-info',
  in_transit: 'chip chip-warning',
  delivered: 'chip chip-success',
  exception: 'chip chip-error',
  cancelled: 'chip chip-primary'
};

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [generatingLabels, setGeneratingLabels] = useState(false);

  // Split modal state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitGroups, setSplitGroups] = useState<{ trackableUnitIds: string[]; legacyItemIds: string[] }[]>([
    { trackableUnitIds: [], legacyItemIds: [] },
    { trackableUnitIds: [], legacyItemIds: [] }
  ]);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);

  useEffect(() => {
    loadOrder();
    loadTimeline();
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

  const loadTimeline = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/orders/${id}/status-timeline`);
      const result = await response.json();
      if (response.ok && result.data) {
        setTimeline(result.data);
      }
    } catch {
      // Timeline is non-critical, silently fail
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

  const handleGenerateLabels = async () => {
    if (!order) return;
    setGeneratingLabels(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/documents/generate/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const result = await response.json();
      if (result.error) {
        alert(`Error: ${result.error}`);
        return;
      }
      window.open(`${API_URL}/api/v1/documents/${result.data.id}/download`, '_blank');
    } catch {
      alert('Failed to generate labels');
    } finally {
      setGeneratingLabels(false);
    }
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

  const openSplitModal = () => {
    if (!order) return;
    // Initialize with 2 groups, all items unassigned
    setSplitGroups([
      { trackableUnitIds: [], legacyItemIds: [] },
      { trackableUnitIds: [], legacyItemIds: [] }
    ]);
    setSplitError(null);
    setShowSplitModal(true);
  };

  const addSplitGroup = () => {
    setSplitGroups(prev => [...prev, { trackableUnitIds: [], legacyItemIds: [] }]);
  };

  const removeSplitGroup = (index: number) => {
    if (splitGroups.length <= 2) return;
    setSplitGroups(prev => prev.filter((_, i) => i !== index));
  };

  const assignUnitToGroup = (unitId: string, groupIndex: number) => {
    setSplitGroups(prev => {
      const next = prev.map(g => ({
        trackableUnitIds: g.trackableUnitIds.filter(id => id !== unitId),
        legacyItemIds: [...g.legacyItemIds]
      }));
      next[groupIndex].trackableUnitIds.push(unitId);
      return next;
    });
  };

  const assignLegacyItemToGroup = (itemId: string, groupIndex: number) => {
    setSplitGroups(prev => {
      const next = prev.map(g => ({
        trackableUnitIds: [...g.trackableUnitIds],
        legacyItemIds: g.legacyItemIds.filter(id => id !== itemId)
      }));
      next[groupIndex].legacyItemIds.push(itemId);
      return next;
    });
  };

  const handleSplitOrder = async () => {
    if (!order) return;

    // Validate all items are assigned
    const allAssignedUnits = splitGroups.flatMap(g => g.trackableUnitIds);
    const allAssignedLegacy = splitGroups.flatMap(g => g.legacyItemIds);
    const totalUnits = order.trackableUnits.length;
    const totalLegacy = order.lineItems.length;

    if (allAssignedUnits.length + allAssignedLegacy.length === 0) {
      setSplitError('Assign items to shipment groups before splitting.');
      return;
    }

    // Check each group has at least one item
    const emptyGroups = splitGroups.filter(g => g.trackableUnitIds.length === 0 && g.legacyItemIds.length === 0);
    if (emptyGroups.length > 0) {
      setSplitError('Each shipment group must have at least one item.');
      return;
    }

    setSplitLoading(true);
    setSplitError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/orders/${order.id}/split-to-shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: splitGroups })
      });

      const result = await response.json();

      if (!response.ok || !result.data?.success) {
        setSplitError(result.error || result.data?.message || 'Failed to split order');
        return;
      }

      setShowSplitModal(false);
      alert(`Order split into ${result.data.shipmentIds.length} shipments successfully!`);
      loadOrder();
    } catch (err: any) {
      setSplitError(err.message || 'Failed to split order');
    } finally {
      setSplitLoading(false);
    }
  };

  const getStatusChip = (status: string) => (
    <span className={statusChipClass[status] || 'chip chip-primary'}>
      {status.replace(/_/g, ' ')}
    </span>
  );

  const getDeliveryStatusChip = (status: string) => (
    <span className={deliveryStatusChipClass[status] || 'chip chip-primary'}>
      {status.replace(/_/g, ' ')}
    </span>
  );

  const getLocationDisplay = (location?: any, locationData?: any, validated?: boolean) => {
    if (location) {
      return (
        <div>
          <div style={{ fontWeight: '500' }}>{location.name}</div>
          <div className="text-sm text-muted">
            {location.address1}
            {location.address2 && `, ${location.address2}`}
          </div>
          <div className="text-sm text-muted">
            {location.city}, {location.state || location.country} {location.postalCode}
          </div>
        </div>
      );
    }
    if (locationData && !validated) {
      return (
        <div style={{ color: 'var(--warning)' }}>
          <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle' }}>warning</span>
          {' '}Location not validated
          <div className="text-sm" style={{ marginTop: '4px' }}>
            {locationData.name} - {locationData.city}, {locationData.country}
          </div>
        </div>
      );
    }
    return <span className="text-muted">Not specified</span>;
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
          <div style={{ display: 'flex', gap: 'var(--spacing-1)', alignItems: 'center', flexWrap: 'wrap' }}>
            {getStatusChip(order.status)}
            <button
              onClick={handleGenerateLabels}
              disabled={generatingLabels}
              className="button button-sm button-outline no-print"
            >
              <span className="material-icons" style={{ fontSize: '16px' }}>label</span>
              {generatingLabels ? 'Generating...' : 'Labels'}
            </button>
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
                    {(order.trackableUnits.length > 1 || order.lineItems.length > 1 ||
                      (order.trackableUnits.length > 0 && order.lineItems.length > 0)) && (
                      <button
                        onClick={openSplitModal}
                        className="button button-sm button-outline no-print"
                      >
                        <span className="material-icons" style={{ fontSize: '16px' }}>call_split</span>
                        Split to Shipments
                      </button>
                    )}
                  </>
                )}
              </>
            )}
            {showDeleteConfirm ? (
              <>
                <button onClick={handleDelete} className="button button-sm button-danger no-print">
                  Confirm Archive
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="button button-sm button-outline no-print">
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setShowDeleteConfirm(true)} className="button button-sm button-outline no-print">
                <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                Archive
              </button>
            )}
          </div>
        </div>

        {/* Order Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Customer</div>
            <div style={{ fontWeight: '500' }}>{order.customer.name}</div>
            {order.customer.contactEmail && (
              <div style={{ fontSize: '14px', color: 'var(--color-grey)' }}>{order.customer.contactEmail}</div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Import Source</div>
            <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>{order.importSource}</div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Order Date</div>
            <div style={{ fontWeight: '500' }}>{new Date(order.orderDate).toLocaleDateString()}</div>
          </div>

          {order.requestedPickupDate && (
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Requested Pickup</div>
              <div style={{ fontWeight: '500' }}>{new Date(order.requestedPickupDate).toLocaleDateString()}</div>
            </div>
          )}

          {order.requestedDeliveryDate && (
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Requested Delivery</div>
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
          {getDeliveryStatusChip(order.deliveryStatus)}
        </div>

        {/* Status Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Status</div>
            <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>{order.deliveryStatus.replace('_', ' ')}</div>
          </div>

          {order.deliveryMethod && (
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Confirmation Method</div>
              <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>{order.deliveryMethod.replace('_', ' ')}</div>
            </div>
          )}

          {order.deliveredAt && (
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Delivered At</div>
              <div style={{ fontWeight: '500' }}>{new Date(order.deliveredAt).toLocaleString()}</div>
            </div>
          )}

          {order.deliveryConfirmedBy && (
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Confirmed By</div>
              <div style={{ fontWeight: '500' }}>{order.deliveryConfirmedBy}</div>
            </div>
          )}
        </div>

        {/* Delivery Stop Info (Multi-leg shipment) */}
        {order.deliveryStop && (
          <div className="alert alert-info" style={{ marginBottom: 'var(--spacing-2)' }}>
            <span className="material-icons">flag</span>
            <div>
              <strong>Multi-Leg Shipment — Stop #{order.deliveryStop.sequenceNumber}</strong>
              <div className="text-sm">Delivery at: {order.deliveryStop.location.name}, {order.deliveryStop.location.city}</div>
              <div className="text-sm">Stop Status: <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{order.deliveryStop.status}</span></div>
            </div>
          </div>
        )}

        {/* Exception Info */}
        {order.deliveryStatus === 'exception' && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>
            <span className="material-icons">warning</span>
            <div>
              <strong>Delivery Exception</strong>
              {order.exceptionType && (
                <div className="text-sm">Type: <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{order.exceptionType.replace(/_/g, ' ')}</span></div>
              )}
              {order.exceptionNotes && (
                <div className="text-sm">Details: {order.exceptionNotes}</div>
              )}
              {order.exceptionResolvedAt && (
                <div className="text-sm">Resolved: {new Date(order.exceptionResolvedAt).toLocaleString()}</div>
              )}
            </div>
          </div>
        )}

        {/* Delivery Notes */}
        {order.deliveryNotes && (
          <div style={{ padding: 'var(--spacing-1) var(--spacing-2)', backgroundColor: 'var(--surface-container)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--outline-variant)', marginBottom: 'var(--spacing-2)' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Delivery Notes</div>
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
                  >
                    <span className="material-icons" style={{ fontSize: '16px' }}>warning</span>
                    Report Exception
                  </button>
                </>
              )}
            </>
          )}
          {order.deliveryStatus === 'delivered' && (
            <div className="alert alert-success" style={{ marginBottom: 0 }}>
              <span className="material-icons">check_circle</span>
              <span style={{ fontWeight: '500' }}>Order delivered successfully</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      {timeline.length > 0 && (
        <div className="card">
          <h3>Status Timeline</h3>
          <div style={{ position: 'relative', paddingLeft: '32px' }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute',
              left: '11px',
              top: '8px',
              bottom: '8px',
              width: '2px',
              backgroundColor: 'var(--outline-variant)'
            }} />

            {timeline.map((entry, idx) => {
              const isLatest = idx === timeline.length - 1;
              const dotColor =
                entry.toStatus === 'delivered' ? 'var(--color-success)' :
                entry.toStatus === 'exception' ? 'var(--color-error)' :
                entry.toStatus === 'in_transit' ? 'var(--color-warning)' :
                entry.toStatus === 'assigned' ? 'var(--color-info)' :
                entry.action === 'created' ? 'var(--color-primary)' :
                'var(--outline)';

              return (
                <div key={entry.id} style={{ position: 'relative', paddingBottom: idx < timeline.length - 1 ? '16px' : '0' }}>
                  {/* Dot */}
                  <div style={{
                    position: 'absolute',
                    left: '-25px',
                    top: '4px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: isLatest ? dotColor : 'var(--surface)',
                    border: `3px solid ${dotColor}`,
                    zIndex: 1
                  }} />

                  {/* Content */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: isLatest ? '600' : '400' }}>
                      {entry.description}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      {entry.method && <span style={{ textTransform: 'capitalize' }}>{entry.method.replace(/_/g, ' ')}</span>}
                      {entry.actor && <span>by {entry.actor}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trackable Units */}
      {order.trackableUnits.length > 0 && (
        <div className="card">
          <div className="page-header">
            <h3 style={{ margin: 0 }}>Trackable Units ({order.trackableUnits.length})</h3>
            <div className="text-sm text-muted">{getTotalItems()} items total • {getTotalQuantity()} units total</div>
          </div>

          {order.trackableUnits.map((unit) => (
            <div
              key={unit.id}
              style={{ padding: 'var(--spacing-2)', backgroundColor: 'var(--surface-container)', border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)', marginBottom: 'var(--spacing-2)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-1)' }}>
                <div>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-icons">
                      {unit.unitType === 'pallet' || unit.unitType === 'tote' ? 'inventory_2' : 'widgets'}
                    </span>
                    {unit.identifier}
                  </h4>
                  <div className="text-sm text-muted" style={{ marginTop: '4px' }}>
                    {unit.customTypeName || unit.unitType.charAt(0).toUpperCase() + unit.unitType.slice(1)}
                    {' • '}
                    {unit.lineItems.length} {unit.lineItems.length === 1 ? 'item' : 'items'}
                    {' • '}
                    Sequence #{unit.sequenceNumber}
                  </div>
                  {unit.barcode && (
                    <div className="text-sm text-muted" style={{ marginTop: '4px' }}>
                      <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle' }}>qr_code</span>
                      {' '}{unit.barcode}
                    </div>
                  )}
                  {unit.notes && (
                    <div className="text-sm text-muted" style={{ fontStyle: 'italic', marginTop: '4px' }}>
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
                            <span className="chip chip-error">⚠ Yes</span>
                          ) : (
                            <span className="text-muted">No</span>
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
          <div className="page-header">
            <h3 style={{ margin: 0 }}>Line Items (Legacy)</h3>
            <span className="chip chip-warning">Not in trackable units</span>
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
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>
                Special Instructions
              </div>
              <div style={{ padding: 'var(--spacing-1)', backgroundColor: 'var(--surface-container)', borderRadius: 'var(--border-radius-sm)' }}>
                {order.specialInstructions}
              </div>
            </div>
          )}
          {order.notes && (
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>
                Notes
              </div>
              <div style={{ padding: 'var(--spacing-1)', backgroundColor: 'var(--surface-container)', borderRadius: 'var(--border-radius-sm)' }}>
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
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Created</div>
            <div>{new Date(order.createdAt).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Last Updated</div>
            <div>{new Date(order.updatedAt).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Order ID</div>
            <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>{order.id}</div>
          </div>
        </div>
      </div>

      {/* Split Order Modal */}
      {showSplitModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--spacing-2)'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--border-radius-md, 12px)',
            padding: 'var(--spacing-3)',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
              <h2 style={{ margin: 0 }}>
                <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px' }}>call_split</span>
                Split Order into Shipments
              </h2>
              <button onClick={() => setShowSplitModal(false)} className="button button-sm button-outline">
                <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            <p className="text-muted" style={{ marginBottom: 'var(--spacing-2)' }}>
              Assign trackable units and items to different shipment groups. Each group becomes a separate shipment.
            </p>

            {splitError && (
              <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>
                <span className="material-icons">error</span>
                {splitError}
              </div>
            )}

            {/* Shipment Groups */}
            {splitGroups.map((group, gIdx) => (
              <div key={gIdx} style={{
                border: '2px solid var(--outline-variant)',
                borderRadius: 'var(--border-radius-sm)',
                padding: 'var(--spacing-2)',
                marginBottom: 'var(--spacing-1)',
                backgroundColor: 'var(--surface-container)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-1)' }}>
                  <h4 style={{ margin: 0 }}>
                    <span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle' }}>local_shipping</span>
                    {' '}Shipment {gIdx + 1}
                    <span className="text-sm text-muted" style={{ fontWeight: 'normal', marginLeft: '8px' }}>
                      ({group.trackableUnitIds.length} units, {group.legacyItemIds.length} items)
                    </span>
                  </h4>
                  {splitGroups.length > 2 && (
                    <button
                      onClick={() => removeSplitGroup(gIdx)}
                      className="button button-sm button-outline"
                      title="Remove group"
                    >
                      <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                    </button>
                  )}
                </div>

                {group.trackableUnitIds.length === 0 && group.legacyItemIds.length === 0 && (
                  <div className="text-muted text-sm" style={{ fontStyle: 'italic', padding: '8px 0' }}>
                    No items assigned. Use dropdowns below to assign items.
                  </div>
                )}

                {group.trackableUnitIds.map(uid => {
                  const unit = order.trackableUnits.find(u => u.id === uid);
                  if (!unit) return null;
                  return (
                    <div key={uid} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      backgroundColor: 'var(--surface)',
                      borderRadius: 'var(--border-radius-sm)',
                      marginBottom: '4px',
                      border: '1px solid var(--outline-variant)'
                    }}>
                      <span className="material-icons" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>inventory_2</span>
                      <span style={{ fontWeight: '500', flex: 1 }}>
                        {unit.identifier}
                        <span className="text-sm text-muted" style={{ fontWeight: 'normal', marginLeft: '8px' }}>
                          {unit.unitType} - {unit.lineItems.length} items
                        </span>
                      </span>
                    </div>
                  );
                })}

                {group.legacyItemIds.map(lid => {
                  const item = order.lineItems.find(i => i.id === lid);
                  if (!item) return null;
                  return (
                    <div key={lid} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      backgroundColor: 'var(--surface)',
                      borderRadius: 'var(--border-radius-sm)',
                      marginBottom: '4px',
                      border: '1px solid var(--outline-variant)'
                    }}>
                      <span className="material-icons" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>widgets</span>
                      <span style={{ fontWeight: '500', flex: 1 }}>
                        {item.sku}
                        <span className="text-sm text-muted" style={{ fontWeight: 'normal', marginLeft: '8px' }}>
                          qty: {item.quantity}{item.weight ? ` - ${item.weight}kg` : ''}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

            <button onClick={addSplitGroup} className="button button-sm button-outline" style={{ marginBottom: 'var(--spacing-2)' }}>
              <span className="material-icons" style={{ fontSize: '16px' }}>add</span>
              Add Shipment Group
            </button>

            {/* Assignment Controls */}
            <div style={{
              border: '1px solid var(--outline-variant)',
              borderRadius: 'var(--border-radius-sm)',
              padding: 'var(--spacing-2)',
              marginBottom: 'var(--spacing-2)'
            }}>
              <h4 style={{ margin: '0 0 var(--spacing-1) 0' }}>Assign Items to Groups</h4>

              {/* Trackable Units */}
              {order.trackableUnits.map(unit => {
                const assignedGroup = splitGroups.findIndex(g => g.trackableUnitIds.includes(unit.id));
                return (
                  <div key={unit.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px',
                    borderBottom: '1px solid var(--outline-variant)'
                  }}>
                    <span className="material-icons" style={{ fontSize: '18px' }}>inventory_2</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500' }}>{unit.identifier}</div>
                      <div className="text-sm text-muted">
                        {unit.customTypeName || unit.unitType} - {unit.lineItems.length} items
                      </div>
                    </div>
                    <select
                      value={assignedGroup >= 0 ? assignedGroup : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== '') assignUnitToGroup(unit.id, parseInt(val));
                      }}
                      className="input"
                      style={{ width: '160px', margin: 0 }}
                    >
                      <option value="">Unassigned</option>
                      {splitGroups.map((_, idx) => (
                        <option key={idx} value={idx}>Shipment {idx + 1}</option>
                      ))}
                    </select>
                  </div>
                );
              })}

              {/* Legacy Items */}
              {order.lineItems.map(item => {
                const assignedGroup = splitGroups.findIndex(g => g.legacyItemIds.includes(item.id));
                return (
                  <div key={item.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px',
                    borderBottom: '1px solid var(--outline-variant)'
                  }}>
                    <span className="material-icons" style={{ fontSize: '18px' }}>widgets</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500' }}>{item.sku}</div>
                      <div className="text-sm text-muted">
                        Qty: {item.quantity}{item.weight ? ` - ${item.weight}kg` : ''}
                      </div>
                    </div>
                    <select
                      value={assignedGroup >= 0 ? assignedGroup : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== '') assignLegacyItemToGroup(item.id, parseInt(val));
                      }}
                      className="input"
                      style={{ width: '160px', margin: 0 }}
                    >
                      <option value="">Unassigned</option>
                      {splitGroups.map((_, idx) => (
                        <option key={idx} value={idx}>Shipment {idx + 1}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end', borderTop: '1px solid var(--outline-variant)', paddingTop: 'var(--spacing-2)' }}>
              <button onClick={() => setShowSplitModal(false)} className="button button-outline">
                Cancel
              </button>
              <button
                onClick={handleSplitOrder}
                className="button button-primary"
                disabled={splitLoading}
              >
                {splitLoading ? (
                  <>
                    <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                    Splitting...
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: '18px' }}>call_split</span>
                    Split into {splitGroups.length} Shipments
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
