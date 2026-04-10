import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../api';

/**
 * Online Bill of Lading view.
 *
 * Renders the immutable BOL document in the browser using the vnext design
 * system. The data comes from the metadata snapshot captured at generation
 * time, so the document never changes after creation.
 *
 * Print-optimised via the `.bol-print` CSS block in vnext.css — users can
 * hit Ctrl/Cmd+P for a clean, professional printout.
 */
export default function VNextBolView() {
  const { id } = useParams();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/documents/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setDoc(json.data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="loading-spinner" />
    </div>
  );

  if (error || !doc) return (
    <div className="vn-alert vn-alert-error" style={{ margin: 24 }}>
      <span className="material-icons">error</span>
      <div className="vn-alert-content">{error || 'Document not found'}</div>
    </div>
  );

  const meta = doc.metadata || {};
  const branding = meta.branding || {};
  const shipment = meta.shipment || {};
  const origin = shipment.origin || {};
  const destination = shipment.destination || {};
  const carrier = meta.carrier || {};
  const customer = meta.customer || {};
  const vehicle = meta.vehicle;
  const driver = meta.driver;
  const stops = meta.stops || [];
  const orders = meta.orders || [];
  const totals = meta.totals || {};
  const specialInstructions = meta.specialInstructions || '';

  return (
    <>
      {/* Action bar — hidden when printing */}
      <div className="bol-actions no-print">
        <div className="vn-page-header" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to={doc.shipmentId ? `/shipments/${doc.shipmentId}` : '/documents'} className="vn-btn vn-btn-ghost vn-btn-sm">
              <span className="material-icons">arrow_back</span>
              Back
            </Link>
            <h1 style={{ fontSize: 20 }}>Bill of Lading</h1>
            <span className="vn-chip vn-chip-info">Immutable Document</span>
          </div>
          <div className="vn-page-actions">
            <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => window.print()}>
              <span className="material-icons">print</span>
              Print
            </button>
            <a href={`${API_URL}/api/v1/documents/${id}/download`} target="_blank" rel="noopener noreferrer">
              <button className="vn-btn vn-btn-primary vn-btn-sm">
                <span className="material-icons">download</span>
                Download PDF
              </button>
            </a>
          </div>
        </div>
      </div>

      {/* BOL Document — the printable area */}
      <div className="bol-document">

        {/* Header */}
        <div className="bol-header">
          {branding.orgName && (
            <div className="bol-org-name">{branding.orgName}</div>
          )}
          <h1 className="bol-title">BILL OF LADING</h1>
          <div className="bol-meta-row">
            <div className="bol-meta-item">
              <span className="bol-meta-label">BOL Number</span>
              <span className="bol-meta-value">{meta.bolNumber}</span>
            </div>
            <div className="bol-meta-item">
              <span className="bol-meta-label">Date</span>
              <span className="bol-meta-value">{meta.date}</span>
            </div>
            <div className="bol-meta-item">
              <span className="bol-meta-label">Shipment Ref</span>
              <span className="bol-meta-value">{shipment.reference}</span>
            </div>
            <div className="bol-meta-item">
              <span className="bol-meta-label">Status</span>
              <span className="bol-meta-value">{shipment.status}</span>
            </div>
          </div>
        </div>

        {/* Parties — origin / destination side-by-side */}
        <div className="bol-parties">
          <div className="bol-party">
            <h2 className="bol-section-title">
              <span className="material-icons no-print" style={{ fontSize: 18 }}>warehouse</span>
              Shipper (Origin)
            </h2>
            <div className="bol-address">
              <strong>{origin.name}</strong><br />
              {origin.address1}<br />
              {origin.address2 && <>{origin.address2}<br /></>}
              {origin.city}, {origin.state} {origin.postalCode}<br />
              {origin.country}
            </div>
          </div>
          <div className="bol-party">
            <h2 className="bol-section-title">
              <span className="material-icons no-print" style={{ fontSize: 18 }}>local_shipping</span>
              Consignee (Destination)
            </h2>
            <div className="bol-address">
              <strong>{destination.name}</strong><br />
              {destination.address1}<br />
              {destination.address2 && <>{destination.address2}<br /></>}
              {destination.city}, {destination.state} {destination.postalCode}<br />
              {destination.country}
            </div>
          </div>
        </div>

        {/* Carrier info */}
        <div className="bol-section">
          <h2 className="bol-section-title">
            <span className="material-icons no-print" style={{ fontSize: 18 }}>local_shipping</span>
            Carrier
          </h2>
          <div className="bol-info-grid">
            <div className="bol-info-item"><label>Carrier</label><span>{carrier.name || '—'}</span></div>
            <div className="bol-info-item"><label>MC #</label><span>{carrier.mcNumber || '—'}</span></div>
            <div className="bol-info-item"><label>DOT #</label><span>{carrier.dotNumber || '—'}</span></div>
            <div className="bol-info-item"><label>Contact</label><span>{carrier.contactName || '—'}</span></div>
            <div className="bol-info-item"><label>Phone</label><span>{carrier.contactPhone || '—'}</span></div>
            <div className="bol-info-item"><label>Email</label><span>{carrier.contactEmail || '—'}</span></div>
          </div>
        </div>

        {/* Vehicle & Driver */}
        {vehicle && (
          <div className="bol-section">
            <h2 className="bol-section-title">Vehicle & Driver</h2>
            <div className="bol-info-grid">
              <div className="bol-info-item"><label>Vehicle</label><span>{vehicle.plate} ({vehicle.type})</span></div>
              <div className="bol-info-item"><label>Driver</label><span>{driver?.name || '—'}</span></div>
              <div className="bol-info-item"><label>Driver Phone</label><span>{driver?.phone || '—'}</span></div>
            </div>
          </div>
        )}

        {/* Customer & Dates */}
        <div className="bol-section">
          <h2 className="bol-section-title">Shipment Details</h2>
          <div className="bol-info-grid">
            <div className="bol-info-item"><label>Customer</label><span>{customer.name || '—'}</span></div>
            <div className="bol-info-item"><label>Pickup Date</label><span>{shipment.pickupDate || '—'}</span></div>
            <div className="bol-info-item"><label>Delivery Date</label><span>{shipment.deliveryDate || '—'}</span></div>
          </div>
        </div>

        {/* Stops */}
        {stops.length > 0 && (
          <div className="bol-section">
            <h2 className="bol-section-title">Stops</h2>
            <table className="bol-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>City / State</th>
                  <th>Est. Arrival</th>
                  <th>Instructions</th>
                </tr>
              </thead>
              <tbody>
                {stops.map((s: any, i: number) => (
                  <tr key={i}>
                    <td>{s.sequenceNumber}</td>
                    <td>{s.stopType}</td>
                    <td>{s.location?.name}</td>
                    <td>{s.location?.city}, {s.location?.state}</td>
                    <td>{s.estimatedArrival || '—'}</td>
                    <td>{s.instructions || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Orders & Items */}
        {orders.length > 0 && (
          <div className="bol-section">
            <h2 className="bol-section-title">Orders & Items</h2>

            {orders.map((order: any, oi: number) => (
              <div key={oi} className="bol-order">
                <div className="bol-order-header">
                  <strong>Order: {order.orderNumber}</strong>
                  {order.poNumber && <span style={{ color: 'var(--on-surface-variant)' }}> (PO: {order.poNumber})</span>}
                  <div className="bol-order-tags">
                    {order.serviceLevel && <span className="bol-tag">{order.serviceLevel}</span>}
                    {order.temperatureControl && <span className="bol-tag">Temp: {order.temperatureControl}</span>}
                    {order.requiresHazmat && <span className="bol-tag bol-tag-hazmat">HAZMAT</span>}
                  </div>
                </div>

                {/* Trackable units */}
                {order.trackableUnits?.length > 0 && (
                  <table className="bol-table bol-table-nested">
                    <thead>
                      <tr><th>Unit ID</th><th>Type</th><th>Barcode</th></tr>
                    </thead>
                    <tbody>
                      {order.trackableUnits.map((u: any, ui: number) => (
                        <tr key={ui}>
                          <td>{u.identifier}</td>
                          <td>{u.unitType}</td>
                          <td style={{ fontFamily: 'monospace' }}>{u.barcode || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Line items */}
                {order.lineItems?.length > 0 && (
                  <table className="bol-table bol-table-nested">
                    <thead>
                      <tr><th>SKU</th><th>Description</th><th>Qty</th><th>Weight</th><th>Dimensions</th><th>Hazmat</th></tr>
                    </thead>
                    <tbody>
                      {order.lineItems.map((li: any, li_i: number) => (
                        <tr key={li_i}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{li.sku}</td>
                          <td>{li.description}</td>
                          <td>{li.quantity}</td>
                          <td>{li.weight} {li.weightUnit}</td>
                          <td>{li.length}x{li.width}x{li.height} {li.dimUnit}</td>
                          <td>{li.hazmat ? <span style={{ color: 'var(--error)', fontWeight: 600 }}>YES</span> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div className="bol-totals">
          <div className="bol-total-item">
            <span className="bol-total-label">Orders</span>
            <span className="bol-total-value">{totals.orderCount ?? 0}</span>
          </div>
          <div className="bol-total-item">
            <span className="bol-total-label">Units</span>
            <span className="bol-total-value">{totals.unitCount ?? 0}</span>
          </div>
          <div className="bol-total-item">
            <span className="bol-total-label">Items</span>
            <span className="bol-total-value">{totals.itemCount ?? 0}</span>
          </div>
          <div className="bol-total-item">
            <span className="bol-total-label">Total Weight</span>
            <span className="bol-total-value">{totals.totalWeight ?? 0} kg</span>
          </div>
        </div>

        {/* Special Instructions */}
        {specialInstructions && (
          <div className="bol-section">
            <h2 className="bol-section-title">
              <span className="material-icons no-print" style={{ fontSize: 18 }}>warning_amber</span>
              Special Instructions
            </h2>
            <p className="bol-instructions">{specialInstructions}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="bol-signatures">
          <div className="bol-sig-block">
            <div className="bol-sig-role">Shipper</div>
            <div className="bol-sig-line" />
            <div className="bol-sig-caption">Signature / Date</div>
          </div>
          <div className="bol-sig-block">
            <div className="bol-sig-role">Carrier</div>
            <div className="bol-sig-line" />
            <div className="bol-sig-caption">Signature / Date</div>
          </div>
          <div className="bol-sig-block">
            <div className="bol-sig-role">Consignee</div>
            <div className="bol-sig-line" />
            <div className="bol-sig-caption">Signature / Date</div>
          </div>
        </div>

        {/* Footer */}
        <div className="bol-footer">
          <div>Generated by {branding.orgName || 'Open TMS'}</div>
          <div>Document ID: {doc.id}</div>
          <div>Created: {new Date(doc.createdAt).toLocaleString()}</div>
        </div>
      </div>
    </>
  );
}
