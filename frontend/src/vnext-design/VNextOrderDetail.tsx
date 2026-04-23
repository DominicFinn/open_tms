import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

interface LineItem {
  id: string;
  sku?: string;
  description?: string;
  quantity?: number;
  weight?: number;
}

interface TrackableUnit {
  id: string;
  identifier?: string;
  unitType?: string;
  lineItems: any[];
}

interface OrderShipment {
  shipment: { id: string; reference?: string; status?: string };
}

interface AuditLog {
  id: string;
  action?: string;
  description?: string;
  createdAt?: string;
  userName?: string;
}

interface OrderData {
  id: string;
  orderNumber?: string;
  poNumber?: string;
  status: string;
  deliveryStatus?: string;
  importSource?: string;
  customer?: { name: string };
  origin?: { name: string; city: string; state: string };
  destination?: { name: string; city: string; state: string };
  requestedPickupDate?: string;
  requestedDeliveryDate?: string;
  serviceLevel?: string;
  temperatureControl?: boolean;
  requiresHazmat?: boolean;
  specialInstructions?: string;
  notes?: string;
  lineItems: LineItem[];
  trackableUnits: TrackableUnit[];
  orderShipments: OrderShipment[];
  auditLogs: AuditLog[];
  createdAt?: string;
  updatedAt?: string;
}

function statusChipColor(status: string): string {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  if (s === 'readytoship' || s === 'ready') return 'success';
  if (s === 'pendingapproval' || s === 'pending') return 'warning';
  if (s === 'shipped' || s === 'intransit') return 'info';
  if (s === 'delivered') return 'success';
  if (s === 'cancelled' || s === 'canceled') return 'error';
  if (s === 'draft') return 'secondary';
  return 'secondary';
}

function deliveryStatusColor(status: string): string {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  if (s === 'delivered') return 'success';
  if (s === 'intransit') return 'info';
  if (s === 'pending') return 'warning';
  if (s === 'failed' || s === 'exception') return 'error';
  return 'secondary';
}

function formatDate(d?: string): string {
  if (!d) return '\u2014';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d?: string): string {
  if (!d) return '\u2014';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function VNextOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/orders/${id}`);
        if (!res.ok) throw new Error(`Failed to load order (${res.status})`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!cancelled) {
          setOrder(json.data);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading order...</h3>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="vn-alert vn-alert-error">
        <span className="material-icons">error</span>
        <div className="vn-alert-content">{error || 'Order not found'}</div>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/orders')}>
          <span className="material-icons">arrow_back</span>
          Orders
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ {order.orderNumber || order.id}</span>
      </div>

      {/* Page Header */}
      <div className="vn-page-header">
        <div>
          <h1>{order.orderNumber || order.id}</h1>
          <div className="vn-page-header-meta">
            <span className={`vn-chip vn-chip-${statusChipColor(order.status)}`}>{order.status}</span>
            {order.deliveryStatus && (
              <span className={`vn-chip vn-chip-${deliveryStatusColor(order.deliveryStatus)}`}>{order.deliveryStatus}</span>
            )}
            {order.poNumber && (
              <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>PO# {order.poNumber}</span>
            )}
          </div>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => navigate(`/orders/${order.id}/edit`)}>
            <span className="material-icons">edit</span>
            Edit
          </button>
          <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => navigate(`/documents?orderId=${order.id}`)}>
            <span className="material-icons">description</span>
            Documents
          </button>
        </div>
      </div>

      <div className="vn-detail-grid">
        {/* Main Area */}
        <div className="vn-detail-main">
          {/* Info Grid */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header"><h2>Order Information</h2></div>
            <div className="vn-card-body">
              <div className="vn-info-grid">
                <div className="vn-info-item"><label>Customer</label><span>{order.customer?.name || '\u2014'}</span></div>
                <div className="vn-info-item"><label>PO Number</label><span>{order.poNumber || '\u2014'}</span></div>
                <div className="vn-info-item"><label>Service Level</label><span>{order.serviceLevel || '\u2014'}</span></div>
                <div className="vn-info-item"><label>Import Source</label><span>{order.importSource || '\u2014'}</span></div>
                <div className="vn-info-item"><label>Requested Pickup</label><span>{formatDate(order.requestedPickupDate)}</span></div>
                <div className="vn-info-item"><label>Requested Delivery</label><span>{formatDate(order.requestedDeliveryDate)}</span></div>
                <div className="vn-info-item">
                  <label>Requirements</label>
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {order.temperatureControl && <span className="vn-chip vn-chip-secondary">Temp Control</span>}
                    {order.requiresHazmat && <span className="vn-chip vn-chip-warning">Hazmat</span>}
                    {!order.temperatureControl && !order.requiresHazmat && '\u2014'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Route */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="vn-route-dot origin" />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>
                        {order.origin?.name || 'Origin'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                        {order.origin ? `${order.origin.city}, ${order.origin.state}` : 'Not set'}
                      </div>
                    </div>
                  </div>
                  <div style={{ borderLeft: '2px dashed var(--outline-variant)', marginLeft: 5, height: 16 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span className="vn-route-dot destination" />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>
                        {order.destination?.name || 'Destination'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                        {order.destination ? `${order.destination.city}, ${order.destination.state}` : 'Not set'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header">
              <h2>Line Items</h2>
              <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{order.lineItems?.length || 0} items</span>
            </div>
            <div className="vn-card-body vn-card-flush">
              {order.lineItems && order.lineItems.length > 0 ? (
                <div className="vn-table-wrap">
                  <table className="vn-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lineItems.map((li) => (
                        <tr key={li.id}>
                          <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{li.sku || '\u2014'}</span></td>
                          <td>{li.description || '\u2014'}</td>
                          <td>{li.quantity ?? '\u2014'}</td>
                          <td>{li.weight ? `${li.weight} lbs` : '\u2014'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: 13 }}>
                  No line items
                </div>
              )}
            </div>
          </div>

          {/* Trackable Units */}
          {order.trackableUnits && order.trackableUnits.length > 0 && (
            <div className="vn-card" style={{ marginBottom: 24 }}>
              <div className="vn-card-header">
                <h2>Trackable Units</h2>
                <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{order.trackableUnits.length} units</span>
              </div>
              <div className="vn-card-body vn-card-flush">
                <div className="vn-table-wrap">
                  <table className="vn-table">
                    <thead>
                      <tr>
                        <th>Identifier</th>
                        <th>Type</th>
                        <th>Line Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.trackableUnits.map((tu) => (
                        <tr key={tu.id}>
                          <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{tu.identifier || '\u2014'}</span></td>
                          <td>{tu.unitType || '\u2014'}</td>
                          <td>{tu.lineItems?.length || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Linked Shipments */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header">
              <h2>Shipments</h2>
              <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{order.orderShipments?.length || 0} shipments</span>
            </div>
            <div className="vn-card-body vn-card-flush">
              {order.orderShipments && order.orderShipments.length > 0 ? (
                <div className="vn-table-wrap">
                  <table className="vn-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.orderShipments.map((os) => (
                        <tr key={os.shipment.id}>
                          <td><span className="vn-table-id">{os.shipment.reference || os.shipment.id}</span></td>
                          <td>
                            <span className={`vn-chip vn-chip-${statusChipColor(os.shipment.status || '')}`}>
                              {os.shipment.status || '\u2014'}
                            </span>
                          </td>
                          <td>
                            <Link to={`/shipments/${os.shipment.id}`} className="vn-btn vn-btn-ghost vn-btn-sm">
                              <span className="material-icons" style={{ fontSize: 18 }}>open_in_new</span>
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: 13 }}>
                  No shipments linked
                </div>
              )}
            </div>
          </div>

          {/* Audit Log */}
          {order.auditLogs && order.auditLogs.length > 0 && (
            <div className="vn-card">
              <div className="vn-card-header"><h2>Audit Log</h2></div>
              <div className="vn-card-body">
                <div className="vn-timeline">
                  {order.auditLogs.map((log) => (
                    <div className="vn-timeline-item" key={log.id}>
                      <div className="vn-timeline-dot info" />
                      <div className="vn-timeline-time">{formatDateTime(log.createdAt)}</div>
                      <div className="vn-timeline-title">{log.action || 'Action'}</div>
                      <div className="vn-timeline-desc">{log.description || ''}</div>
                      {log.userName && (
                        <div className="vn-timeline-location">
                          <span className="material-icons">person</span>
                          {log.userName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="vn-detail-sidebar">
          {/* Order Status */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Status</h2></div>
            <div className="vn-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="vn-info-item">
                  <label>Order Status</label>
                  <span className={`vn-chip vn-chip-${statusChipColor(order.status)}`}>{order.status}</span>
                </div>
                <div className="vn-info-item">
                  <label>Delivery Status</label>
                  <span>{order.deliveryStatus ? (
                    <span className={`vn-chip vn-chip-${deliveryStatusColor(order.deliveryStatus)}`}>{order.deliveryStatus}</span>
                  ) : '\u2014'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Dates</h2></div>
            <div className="vn-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="vn-info-item"><label>Created</label><span>{formatDateTime(order.createdAt)}</span></div>
                <div className="vn-info-item"><label>Updated</label><span>{formatDateTime(order.updatedAt)}</span></div>
                <div className="vn-info-item"><label>Req. Pickup</label><span>{formatDate(order.requestedPickupDate)}</span></div>
                <div className="vn-info-item"><label>Req. Delivery</label><span>{formatDate(order.requestedDeliveryDate)}</span></div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Notes</h2></div>
            <div className="vn-card-body">
              {order.specialInstructions && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Special Instructions</div>
                  <p style={{ fontSize: 13, color: 'var(--on-surface)', margin: 0 }}>{order.specialInstructions}</p>
                </div>
              )}
              {order.notes && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Notes</div>
                  <p style={{ fontSize: 13, color: 'var(--on-surface)', margin: 0 }}>{order.notes}</p>
                </div>
              )}
              {!order.specialInstructions && !order.notes && (
                <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', margin: 0 }}>No notes</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
