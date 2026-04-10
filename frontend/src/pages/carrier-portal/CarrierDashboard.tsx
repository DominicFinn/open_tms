import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../../api';

function getCarrierToken() {
  return localStorage.getItem('carrier_token') || '';
}

function getCarrierUser() {
  try {
    return JSON.parse(localStorage.getItem('carrier_user') || '{}');
  } catch { return {}; }
}

function carrierFetch(url: string, opts?: RequestInit) {
  return fetch(url, {
    ...opts,
    headers: {
      ...opts?.headers,
      Authorization: `Bearer ${getCarrierToken()}`,
      'Content-Type': 'application/json',
    },
  });
}

interface TenderOffer {
  id: string;
  status: string;
  expiresAt: string | null;
  tender: {
    id: string;
    reference: string;
    status: string;
    targetRate: number | null;
    equipmentType: string | null;
    tenderDurationMinutes: number;
    shipment: {
      reference: string;
      pickupDate: string | null;
      deliveryDate: string | null;
      origin: { city: string; state: string | null };
      destination: { city: string; state: string | null };
    };
  };
}

interface Bid {
  id: string;
  rate: number;
  status: string;
  submittedAt: string;
  tender: { id: string; reference: string; status: string };
}

export default function CarrierDashboard() {
  const [offers, setOffers] = useState<TenderOffer[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = getCarrierUser();

  useEffect(() => {
    if (!getCarrierToken()) {
      navigate('/carrier-portal/login');
      return;
    }
    Promise.all([
      carrierFetch(`${API_URL}/api/v1/carrier-portal/tenders`).then(r => r.json()),
      carrierFetch(`${API_URL}/api/v1/carrier-portal/bids`).then(r => r.json()),
    ]).then(([offersRes, bidsRes]) => {
      setOffers(offersRes.data || []);
      setBids(bidsRes.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{animation:'spin 1s linear infinite'}}>refresh</span><h3>Loading...</h3></div>;

  const activeOffers = offers.filter(o => ['sent', 'viewed'].includes(o.status));
  const submittedBids = bids.filter(b => b.status === 'submitted');
  const wonBids = bids.filter(b => b.status === 'accepted');

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Welcome, {user.name || 'Carrier'}</h1>
          <p style={{ color: 'var(--on-surface-variant)', margin: 0 }}>{user.carrierName}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="vn-stats" style={{ marginBottom: 'var(--spacing-3)' }}>
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">gavel</span>
          </div>
          <div>
            <div className="vn-stat-value">{activeOffers.length}</div>
            <div className="vn-stat-label">Active Tenders</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning">
            <span className="material-icons">pending</span>
          </div>
          <div>
            <div className="vn-stat-value">{submittedBids.length}</div>
            <div className="vn-stat-label">Pending Bids</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">emoji_events</span>
          </div>
          <div>
            <div className="vn-stat-value">{wonBids.length}</div>
            <div className="vn-stat-label">Loads Won</div>
          </div>
        </div>
      </div>

      {/* Active Tender Offers */}
      <div className="vn-card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <div className="vn-card-header">
          <h2>
            <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--primary)' }}>gavel</span>
            Active Tenders
          </h2>
        </div>
        <div className="vn-card-body">
          {activeOffers.length === 0 ? (
            <div className="vn-empty">
              <span className="material-icons">inbox</span>
              <h3>No active tenders at this time</h3>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--spacing-2)' }}>
              {activeOffers.map(offer => {
                const t = offer.tender;
                const timeLeft = offer.expiresAt
                  ? Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 60000))
                  : null;
                return (
                  <div key={offer.id} style={{
                    border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{t.reference}</div>
                      <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                        {t.shipment.origin.city}{t.shipment.origin.state ? `, ${t.shipment.origin.state}` : ''}
                        {' → '}
                        {t.shipment.destination.city}{t.shipment.destination.state ? `, ${t.shipment.destination.state}` : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                        {t.equipmentType || 'No equipment specified'}
                        {t.targetRate ? ` | Target: $${t.targetRate.toLocaleString()}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                      {timeLeft !== null && (
                        <div style={{
                          fontSize: '13px', fontWeight: 600,
                          color: timeLeft < 30 ? 'var(--error)' : 'var(--on-surface-variant)',
                        }}>
                          {timeLeft > 60 ? `${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m` : `${timeLeft}m`} left
                        </div>
                      )}
                      <Link to={`/carrier-portal/tenders/${t.id}`} className="vn-btn vn-btn-primary" style={{ fontSize: '13px', padding: '6px 16px' }}>
                        View & Bid
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Bids */}
      <div className="vn-card">
        <div className="vn-card-header">
          <h2>
            <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--warning)' }}>receipt</span>
            Recent Bids
          </h2>
        </div>
        {bids.length === 0 ? (
          <div className="vn-card-body">
            <div className="vn-empty">
              <span className="material-icons">receipt_long</span>
              <h3>No bids submitted yet</h3>
            </div>
          </div>
        ) : (
          <div className="vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Tender</th>
                    <th>Rate</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.slice(0, 10).map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 500 }}>{b.tender.reference}</td>
                      <td style={{ fontWeight: 700 }}>${b.rate.toLocaleString()}</td>
                      <td>
                        <span className={`vn-chip vn-chip-${b.status === 'accepted' ? 'success' : b.status === 'rejected' ? 'error' : 'info'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td>{new Date(b.submittedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { carrierFetch, getCarrierToken, getCarrierUser };
