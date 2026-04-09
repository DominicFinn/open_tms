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

  if (loading) return <div style={{ textAlign: 'center', padding: '60px' }}><span className="loading-spinner" /></div>;
  if (!data?.tender) return <div className="alert alert-error">{error || 'Tender not found'}</div>;

  const { tender, offer } = data;
  const existingBid = offer?.bids?.find((b: any) => b.status === 'submitted' || b.status === 'accepted');
  const canBid = ['sent', 'viewed'].includes(offer?.status) && !existingBid && tender.status === 'open';
  const timeLeft = offer?.expiresAt
    ? Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 60000))
    : null;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{tender.reference}</h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            {tender.shipment.origin.city}{tender.shipment.origin.state ? `, ${tender.shipment.origin.state}` : ''}
            {' → '}
            {tender.shipment.destination.city}{tender.shipment.destination.state ? `, ${tender.shipment.destination.state}` : ''}
          </p>
        </div>
        {timeLeft !== null && tender.status === 'open' && (
          <div style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            background: timeLeft < 30 ? 'var(--color-error)' : 'var(--color-primary)',
            color: '#fff', fontWeight: 600,
          }}>
            {timeLeft > 60 ? `${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m` : `${timeLeft}m`} remaining
          </div>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-2)' }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
        {/* Shipment Details */}
        <div className="card">
          <h3 style={{ margin: '0 0 var(--spacing-2)' }}>Shipment Details</h3>
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
              <div style={{ marginTop: 'var(--spacing-1)', padding: 'var(--spacing-1)', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)' }}>
                <strong>Special Instructions:</strong><br/>{tender.specialInstructions}
              </div>
            )}
          </div>
        </div>

        {/* Bid Form or Status */}
        <div className="card">
          {existingBid ? (
            <>
              <h3 style={{ margin: '0 0 var(--spacing-2)' }}>Your Bid</h3>
              <div style={{ textAlign: 'center', padding: 'var(--spacing-3)' }}>
                <div style={{ fontSize: '36px', fontWeight: 700 }}>${existingBid.rate.toLocaleString()}</div>
                <span className={`chip chip-${existingBid.status === 'accepted' ? 'success' : existingBid.status === 'rejected' ? 'error' : 'info'}`}>
                  {existingBid.status}
                </span>
                {existingBid.status === 'accepted' && (
                  <div className="alert alert-success" style={{ marginTop: 'var(--spacing-2)' }}>
                    Congratulations! Your bid was accepted.
                  </div>
                )}
              </div>
            </>
          ) : canBid ? (
            <>
              <h3 style={{ margin: '0 0 var(--spacing-2)' }}>Submit Your Bid</h3>
              {tender.targetRate && (
                <div style={{
                  padding: 'var(--spacing-1)', background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-sm)', marginBottom: 'var(--spacing-2)',
                  fontSize: '13px', textAlign: 'center',
                }}>
                  Target Rate: <strong>${tender.targetRate.toLocaleString()}</strong>
                </div>
              )}
              <form onSubmit={handleBid}>
                <div style={{ marginBottom: 'var(--spacing-2)' }}>
                  <label className="field-label">Your Rate ($) *</label>
                  <input className="text-field" type="number" min="0" step="0.01" value={rate}
                    onChange={e => setRate(e.target.value)} required placeholder="Enter your rate" />
                </div>
                <div style={{ marginBottom: 'var(--spacing-2)' }}>
                  <label className="field-label">Transit Days</label>
                  <input className="text-field" type="number" min="1" value={transitDays}
                    onChange={e => setTransitDays(e.target.value)} placeholder="Estimated transit" />
                </div>
                <div style={{ marginBottom: 'var(--spacing-2)' }}>
                  <label className="field-label">Equipment Type</label>
                  <input className="text-field" value={equipmentType}
                    onChange={e => setEquipmentType(e.target.value)} placeholder="e.g. 53' Dry Van" />
                </div>
                <div style={{ marginBottom: 'var(--spacing-2)' }}>
                  <label className="field-label">Notes</label>
                  <textarea className="text-field" rows={2} value={notes}
                    onChange={e => setNotes(e.target.value)} placeholder="Additional comments" />
                </div>
                <div className="form-actions">
                  <button type="button" className="button-danger" onClick={handleDecline} disabled={submitting}>
                    Decline
                  </button>
                  <button type="submit" className="button-success" disabled={submitting || !rate}>
                    {submitting ? 'Submitting...' : 'Submit Bid'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h3 style={{ margin: '0 0 var(--spacing-2)' }}>Tender Status</h3>
              <div style={{ textAlign: 'center', padding: 'var(--spacing-3)', color: 'var(--color-text-secondary)' }}>
                {tender.status === 'awarded' ? 'This tender has been awarded.' :
                 tender.status === 'cancelled' ? 'This tender was cancelled.' :
                 tender.status === 'expired' ? 'This tender has expired.' :
                 offer?.status === 'expired' ? 'Your offer has expired.' :
                 'Bidding is not available.'}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button className="button-outline" onClick={() => navigate('/carrier-portal')}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
