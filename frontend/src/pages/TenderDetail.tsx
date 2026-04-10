import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../api';

interface Bid {
  id: string;
  rate: number;
  currency: string;
  transitDays: number | null;
  equipmentType: string | null;
  notes: string | null;
  status: string;
  sourceType: string;
  submittedAt: string;
  carrier: { id: string; name: string };
}

interface Offer {
  id: string;
  sequence: number;
  status: string;
  sentAt: string | null;
  expiresAt: string | null;
  viewedAt: string | null;
  ediSent: boolean;
  carrier: { id: string; name: string; scacCode: string | null; contactEmail: string | null };
  bids: Bid[];
}

interface Tender {
  id: string;
  reference: string;
  status: string;
  strategy: string;
  tenderDurationMinutes: number;
  targetRate: number | null;
  currency: string;
  equipmentType: string | null;
  notes: string | null;
  specialInstructions: string | null;
  openedAt: string | null;
  closedAt: string | null;
  awardedAt: string | null;
  createdAt: string;
  shipment: {
    id: string;
    reference: string;
    status: string;
    pickupDate: string | null;
    deliveryDate: string | null;
    customer: { id: string; name: string };
    origin: { id: string; name: string; city: string; state: string | null };
    destination: { id: string; name: string; city: string; state: string | null };
  };
  offers: Offer[];
  bids: Bid[];
}

const statusColors: Record<string, string> = {
  draft: 'secondary', open: 'primary', evaluating: 'warning',
  awarded: 'success', cancelled: 'error', expired: 'error',
  pending: 'secondary', sent: 'info', viewed: 'primary',
  submitted: 'info', accepted: 'success', rejected: 'error', withdrawn: 'warning',
};

export default function TenderDetail() {
  const { id } = useParams<{ id: string }>();
  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState<string | null>(null);

  useEffect(() => {
    fetchTender();
  }, [id]);

  async function fetchTender() {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/v1/tenders/${id}`);
    const json = await res.json();
    setTender(json.data);
    setLoading(false);
  }

  async function handleOpen() {
    setActionLoading(true);
    await fetch(`${API_URL}/api/v1/tenders/${id}/open`, { method: 'POST' });
    await fetchTender();
    setActionLoading(false);
  }

  async function handleCancel() {
    if (!confirm('Cancel this tender? All pending offers will be cancelled.')) return;
    setActionLoading(true);
    await fetch(`${API_URL}/api/v1/tenders/${id}/cancel`, { method: 'POST' });
    await fetchTender();
    setActionLoading(false);
  }

  async function handleAward(bidId: string) {
    setActionLoading(true);
    await fetch(`${API_URL}/api/v1/tenders/${id}/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidId }),
    });
    setShowAwardModal(null);
    await fetchTender();
    setActionLoading(false);
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px' }}><div className="vn-empty"><span className="material-icons" style={{animation:'spin 1s linear infinite'}}>refresh</span><h3>Loading...</h3></div></div>;
  if (!tender) return <div className="vn-alert vn-alert-error">Tender not found</div>;

  const lowestBid = tender.bids.length > 0
    ? Math.min(...tender.bids.filter(b => b.status === 'submitted').map(b => b.rate))
    : null;

  return (
    <div>
      {/* Header */}
      <div className="vn-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <Link to="/tenders" style={{ color: 'var(--on-surface-variant)', textDecoration: 'none' }}>Tenders</Link>
            <span style={{ color: 'var(--on-surface-variant)' }}>/</span>
            <h1 style={{ margin: 0 }}>{tender.reference}</h1>
            <span className={`vn-chip vn-chip-${statusColors[tender.status]}`}>{tender.status}</span>
            <span className={`vn-chip vn-chip-${tender.strategy === 'broadcast' ? 'info' : 'secondary'}`}>{tender.strategy}</span>
          </div>
          <p style={{ color: 'var(--on-surface-variant)', margin: '4px 0 0' }}>
            <Link to={`/shipments/${tender.shipment.id}`} style={{ color: 'var(--primary)' }}>
              {tender.shipment.reference}
            </Link>
            {' — '}
            {tender.shipment.origin.city}{tender.shipment.origin.state ? `, ${tender.shipment.origin.state}` : ''}
            {' → '}
            {tender.shipment.destination.city}{tender.shipment.destination.state ? `, ${tender.shipment.destination.state}` : ''}
          </p>
        </div>
        <div className="vn-page-actions">
          {tender.status === 'draft' && (
            <button className="vn-btn vn-btn-primary" onClick={handleOpen} disabled={actionLoading}>
              <span className="material-icons" style={{ fontSize: '18px', marginRight: '4px' }}>send</span>
              Open Tender
            </button>
          )}
          {['draft', 'open', 'evaluating'].includes(tender.status) && (
            <button className="vn-btn vn-btn-danger" onClick={handleCancel} disabled={actionLoading}>Cancel</button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="vn-stats" style={{ marginBottom: 'var(--spacing-3)' }}>
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">payments</span>
          </div>
          <div>
            <div className="vn-stat-value">{tender.targetRate ? `$${tender.targetRate.toLocaleString()}` : '--'}</div>
            <div className="vn-stat-label">Target Rate</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">local_shipping</span>
          </div>
          <div>
            <div className="vn-stat-value">{tender.offers.length}</div>
            <div className="vn-stat-label">Carriers</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning">
            <span className="material-icons">gavel</span>
          </div>
          <div>
            <div className="vn-stat-value">{tender.bids.filter(b => b.status === 'submitted').length}</div>
            <div className="vn-stat-label">Bids Received</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">trending_down</span>
          </div>
          <div>
            <div className="vn-stat-value" style={{ color: lowestBid && tender.targetRate && lowestBid <= tender.targetRate ? 'var(--success)' : 'var(--on-surface)' }}>
              {lowestBid ? `$${lowestBid.toLocaleString()}` : '--'}
            </div>
            <div className="vn-stat-label">Lowest Bid</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon secondary">
            <span className="material-icons">schedule</span>
          </div>
          <div>
            <div className="vn-stat-value">{tender.tenderDurationMinutes}m</div>
            <div className="vn-stat-label">Duration</div>
          </div>
        </div>
      </div>

      {/* Tender details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
        <div className="vn-card">
          <div className="vn-card-header"><h2>Tender Details</h2></div>
          <div style={{ display: 'grid', gap: 'var(--spacing-1)', fontSize: '14px', padding: 'var(--spacing-3)' }}>
            <div><strong>Customer:</strong> {tender.shipment.customer.name}</div>
            <div><strong>Equipment:</strong> {tender.equipmentType || 'Not specified'}</div>
            <div><strong>Pickup:</strong> {tender.shipment.pickupDate ? new Date(tender.shipment.pickupDate).toLocaleDateString() : 'TBD'}</div>
            <div><strong>Delivery:</strong> {tender.shipment.deliveryDate ? new Date(tender.shipment.deliveryDate).toLocaleDateString() : 'TBD'}</div>
            {tender.notes && <div><strong>Notes:</strong> {tender.notes}</div>}
            {tender.specialInstructions && <div><strong>Instructions:</strong> {tender.specialInstructions}</div>}
          </div>
        </div>
        <div className="vn-card">
          <div className="vn-card-header"><h2>Timeline</h2></div>
          <div style={{ display: 'grid', gap: 'var(--spacing-1)', fontSize: '14px', padding: 'var(--spacing-3)' }}>
            <div><strong>Created:</strong> {new Date(tender.createdAt).toLocaleString()}</div>
            {tender.openedAt && <div><strong>Opened:</strong> {new Date(tender.openedAt).toLocaleString()}</div>}
            {tender.awardedAt && <div><strong>Awarded:</strong> {new Date(tender.awardedAt).toLocaleString()}</div>}
            {tender.closedAt && <div><strong>Closed:</strong> {new Date(tender.closedAt).toLocaleString()}</div>}
          </div>
        </div>
      </div>

      {/* Carrier Offers */}
      <div className="vn-card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <div className="vn-card-header"><h2>Carrier Offers</h2></div>
        <div className="vn-card-flush">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  {tender.strategy === 'waterfall' && <th>#</th>}
                  <th>Carrier</th>
                  <th>SCAC</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Expires</th>
                  <th>Viewed</th>
                  <th>EDI</th>
                </tr>
              </thead>
              <tbody>
                {tender.offers.map(o => (
                  <tr key={o.id}>
                    {tender.strategy === 'waterfall' && <td>{o.sequence}</td>}
                    <td style={{ fontWeight: 500 }}>{o.carrier.name}</td>
                    <td>{o.carrier.scacCode || '--'}</td>
                    <td><span className={`vn-chip vn-chip-${statusColors[o.status]}`}>{o.status}</span></td>
                    <td>{o.sentAt ? new Date(o.sentAt).toLocaleString() : '--'}</td>
                    <td>{o.expiresAt ? new Date(o.expiresAt).toLocaleString() : '--'}</td>
                    <td>{o.viewedAt ? new Date(o.viewedAt).toLocaleString() : '--'}</td>
                    <td>{o.ediSent ? <span className="vn-chip vn-chip-success">Sent</span> : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bids */}
      <div className="vn-card">
        <div className="vn-card-header"><h2>Bids</h2></div>
        {tender.bids.length === 0 ? (
          <div className="vn-empty" style={{ padding: 'var(--spacing-3)' }}>
            <span className="material-icons">gavel</span>
            <h3>No bids received yet</h3>
          </div>
        ) : (
          <div className="vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Carrier</th>
                    <th>Rate</th>
                    <th>vs Target</th>
                    <th>Transit</th>
                    <th>Equipment</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tender.bids.map(b => {
                    const diff = tender.targetRate ? b.rate - tender.targetRate : null;
                    return (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 500 }}>{b.carrier.name}</td>
                        <td style={{ fontWeight: 700, fontSize: '15px' }}>${b.rate.toLocaleString()}</td>
                        <td>
                          {diff !== null && (
                            <span style={{ color: diff <= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                              {diff <= 0 ? '' : '+'}${diff.toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td>{b.transitDays ? `${b.transitDays} days` : '--'}</td>
                        <td>{b.equipmentType || '--'}</td>
                        <td>
                          <span className={`vn-chip vn-chip-${b.sourceType === 'edi_990' ? 'info' : 'secondary'}`}>
                            {b.sourceType === 'edi_990' ? 'EDI' : b.sourceType}
                          </span>
                        </td>
                        <td><span className={`vn-chip vn-chip-${statusColors[b.status]}`}>{b.status}</span></td>
                        <td>{new Date(b.submittedAt).toLocaleString()}</td>
                        <td>
                          {b.status === 'submitted' && ['open', 'evaluating'].includes(tender.status) && (
                            <button
                              className="vn-btn vn-btn-success"
                              style={{ padding: '4px 12px', fontSize: '12px' }}
                              onClick={() => setShowAwardModal(b.id)}
                              disabled={actionLoading}
                            >
                              Award
                            </button>
                          )}
                          {b.status === 'accepted' && (
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>Winner</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Award confirmation modal */}
      {showAwardModal && (
        <div className="vn-modal-backdrop" onClick={() => setShowAwardModal(null)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="vn-modal-header">
              <h2>Award Tender</h2>
              <button className="vn-modal-close" onClick={() => setShowAwardModal(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="vn-modal-body">
              <p>
                Award this tender to <strong>{tender.bids.find(b => b.id === showAwardModal)?.carrier.name}</strong> at{' '}
                <strong>${tender.bids.find(b => b.id === showAwardModal)?.rate.toLocaleString()}</strong>?
              </p>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '13px' }}>
                This will assign the carrier to the shipment and reject all other bids.
              </p>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setShowAwardModal(null)}>Cancel</button>
              <button className="vn-btn vn-btn-success" onClick={() => handleAward(showAwardModal)} disabled={actionLoading}>
                Confirm Award
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
