import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../../api';
import { carrierFetch, getCarrierToken } from './CarrierDashboard';

export default function CarrierTenderView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bid form
  const [rate, setRate] = useState('');
  const [transitDays, setTransitDays] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!getCarrierToken()) {
      navigate('/carrier-portal/login');
      return;
    }
    fetchTender();
  }, [id]);

  async function fetchTender() {
    setLoading(true);
    const res = await carrierFetch(`${API_URL}/api/v1/carrier-portal/tenders/${id}`);
    const json = await res.json();
    if (json.error) {
      setError(json.error);
    } else {
      setData(json.data);
      if (json.data?.tender?.equipmentType) {
        setEquipmentType(json.data.tender.equipmentType);
      }
    }
    setLoading(false);
  }

  async function handleBid(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const res = await carrierFetch(`${API_URL}/api/v1/carrier-portal/tenders/${id}/bid`, {
      method: 'POST',
      body: JSON.stringify({
        rate: parseFloat(rate),
        transitDays: transitDays ? parseInt(transitDays) : undefined,
        equipmentType: equipmentType || undefined,
        notes: notes || undefined,
      }),
    });
    const json = await res.json();

    if (json.error) {
      setError(json.error);
    } else {
      setSuccess('Bid submitted successfully!');
      await fetchTender();
    }
    setSubmitting(false);
  }

  async function handleDecline() {
    if (!confirm('Decline this tender? You will not be able to bid on it afterwards.')) return;
    setSubmitting(true);
    const res = await carrierFetch(`${API_URL}/api/v1/carrier-portal/tenders/${id}/decline`, {
      method: 'POST',
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
    } else {
      navigate('/carrier-portal');
    }
    setSubmitting(false);
  }

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{animation:'spin 1s linear infinite'}}>refresh</span><h3>Loading...</h3></div>;
  if (!data?.tender) return <div className="vn-alert vn-alert-error">{error || 'Tender not found'}</div>;

  const { tender, offer } = data;
  const existingBid = offer?.bids?.find((b: any) => b.status === 'submitted' || b.status === 'accepted');
  const canBid = ['sent', 'viewed'].includes(offer?.status) && !existingBid && tender.status === 'open';
  const timeLeft = offer?.expiresAt
    ? Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 60000))
    : null;

  return (
    <div>
      {/* Header */}
      <div className="vn-page-header">
        <div>
          <h1>{tender.reference}</h1>
          <p style={{ color: 'var(--on-surface-variant)', margin: 0 }}>
            {tender.shipment.origin.city}{tender.shipment.origin.state ? `, ${tender.shipment.origin.state}` : ''}
            {' → '}
            {tender.shipment.destination.city}{tender.shipment.destination.state ? `, ${tender.shipment.destination.state}` : ''}
          </p>
        </div>
        {timeLeft !== null && tender.status === 'open' && (
          <div style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            background: timeLeft < 30 ? 'var(--error)' : 'var(--primary)',
            color: '#fff', fontWeight: 600,
          }}>
            {timeLeft > 60 ? `${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m` : `${timeLeft}m`} remaining
          </div>
        )}
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>{error}</div>}
      {success && <div className="vn-alert vn-alert-success" style={{ marginBottom: 'var(--spacing-2)' }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
        {/* Shipment Details */}
        <div className="vn-card">
          <div className="vn-card-header"><h2>Shipment Details</h2></div>
          <div className="vn-card-body">
            <div style={{ display: 'grid', gap: 'var(--spacing-1)', fontSize: '14px' }}>
              <div><strong>Reference:</strong> {tender.shipment.reference}</div>
              <div><strong>Customer:</strong> {tender.shipment.customer?.name}</div>
              <div>
                <strong>Origin:</strong> {tender.shipment.origin.name}, {tender.shipment.origin.city}
                {tender.shipment.origin.state ? `, ${tender.shipment.origin.state}` : ''}
              </div>
              <div>
                <strong>Destination:</strong> {tender.shipment.destination.name}, {tender.shipment.destination.city}
                {tender.shipment.destination.state ? `, ${tender.shipment.destination.state}` : ''}
              </div>
              {tender.shipment.pickupDate && (
                <div><strong>Pickup:</strong> {new Date(tender.shipment.pickupDate).toLocaleDateString()}</div>
              )}
              {tender.shipment.deliveryDate && (
                <div><strong>Delivery:</strong> {new Date(tender.shipment.deliveryDate).toLocaleDateString()}</div>
              )}
              {tender.equipmentType && <div><strong>Equipment:</strong> {tender.equipmentType}</div>}
              {tender.specialInstructions && (
                <div style={{ marginTop: 'var(--spacing-1)', padding: 'var(--spacing-1)', background: 'var(--surface-container)', borderRadius: 'var(--radius-sm)' }}>
                  <strong>Special Instructions:</strong><br/>{tender.specialInstructions}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bid Form or Status */}
        <div className="vn-card">
          {existingBid ? (
            <>
              <div className="vn-card-header"><h2>Your Bid</h2></div>
              <div className="vn-card-body">
                <div style={{ textAlign: 'center', padding: 'var(--spacing-3)' }}>
                  <div style={{ fontSize: '36px', fontWeight: 700 }}>${existingBid.rate.toLocaleString()}</div>
                  <span className={`vn-chip vn-chip-${existingBid.status === 'accepted' ? 'success' : existingBid.status === 'rejected' ? 'error' : 'info'}`}>
                    {existingBid.status}
                  </span>
                  {existingBid.status === 'accepted' && (
                    <div className="vn-alert vn-alert-success" style={{ marginTop: 'var(--spacing-2)' }}>
                      Congratulations! Your bid was accepted.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : canBid ? (
            <>
              <div className="vn-card-header"><h2>Submit Your Bid</h2></div>
              <div className="vn-card-body">
                {tender.targetRate && (
                  <div style={{
                    padding: 'var(--spacing-1)', background: 'var(--surface-container)',
                    borderRadius: 'var(--radius-sm)', marginBottom: 'var(--spacing-2)',
                    fontSize: '13px', textAlign: 'center',
                  }}>
                    Target Rate: <strong>${tender.targetRate.toLocaleString()}</strong>
                  </div>
                )}
                <form onSubmit={handleBid}>
                  <div className="vn-field" style={{ marginBottom: 'var(--spacing-2)' }}>
                    <label className="vn-field-label">Your Rate ($) *</label>
                    <input className="vn-input" type="number" min="0" step="0.01" value={rate}
                      onChange={e => setRate(e.target.value)} required placeholder="Enter your rate" />
                  </div>
                  <div className="vn-field" style={{ marginBottom: 'var(--spacing-2)' }}>
                    <label className="vn-field-label">Transit Days</label>
                    <input className="vn-input" type="number" min="1" value={transitDays}
                      onChange={e => setTransitDays(e.target.value)} placeholder="Estimated transit" />
                  </div>
                  <div className="vn-field" style={{ marginBottom: 'var(--spacing-2)' }}>
                    <label className="vn-field-label">Equipment Type</label>
                    <input className="vn-input" value={equipmentType}
                      onChange={e => setEquipmentType(e.target.value)} placeholder="e.g. 53' Dry Van" />
                  </div>
                  <div className="vn-field" style={{ marginBottom: 'var(--spacing-2)' }}>
                    <label className="vn-field-label">Notes</label>
                    <textarea className="vn-textarea" rows={2} value={notes}
                      onChange={e => setNotes(e.target.value)} placeholder="Additional comments" />
                  </div>
                  <div className="vn-form-actions">
                    <button type="button" className="vn-btn vn-btn-danger" onClick={handleDecline} disabled={submitting}>
                      Decline
                    </button>
                    <button type="submit" className="vn-btn vn-btn-success" disabled={submitting || !rate}>
                      {submitting ? 'Submitting...' : 'Submit Bid'}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <>
              <div className="vn-card-header"><h2>Tender Status</h2></div>
              <div className="vn-card-body">
                <div style={{ textAlign: 'center', padding: 'var(--spacing-3)', color: 'var(--on-surface-variant)' }}>
                  {tender.status === 'awarded' ? 'This tender has been awarded.' :
                   tender.status === 'cancelled' ? 'This tender was cancelled.' :
                   tender.status === 'expired' ? 'This tender has expired.' :
                   offer?.status === 'expired' ? 'Your offer has expired.' :
                   'Bidding is not available.'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button className="vn-btn vn-btn-outline" onClick={() => navigate('/carrier-portal')}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
