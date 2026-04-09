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

  if (loading) return <div style={{ textAlign: 'center', padding: '60px' }}><span className="loading-spinner" /></div>;

  const activeOffers = offers.filter(o => ['sent', 'viewed'].includes(o.status));
  const submittedBids = bids.filter(b => b.status === 'submitted');
  const wonBids = bids.filter(b => b.status === 'accepted');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Welcome, {user.name || 'Carrier'}</h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>{user.carrierName}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
        <div className="card" style={{ textAlign: 'center', borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Active Tenders</div>
          <div style={{ fontSize: '32px', fontWeight: 700 }}>{activeOffers.length}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderLeft: '4px solid var(--color-warning)' }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Pending Bids</div>
          <div style={{ fontSize: '32px', fontWeight: 700 }}>{submittedBids.length}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Loads Won</div>
          <div style={{ fontSize: '32px', fontWeight: 700 }}>{wonBids.length}</div>
        </div>
      </div>

      {/* Active Tender Offers */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h3 style={{ margin: '0 0 var(--spacing-2)' }}>
          <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-primary)' }}>gavel</span>
          Active Tenders
        </h3>
        {activeOffers.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--spacing-3)' }}>
            No active tenders at this time
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--spacing-2)' }}>
            {activeOffers.map(offer => {
              const t = offer.tender;
              const timeLeft = offer.expiresAt
                ? Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 60000))
                : null;
              return (
                <div key={offer.id} style={{
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{t.reference}</div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      {t.shipment.origin.city}{t.shipment.origin.state ? `, ${t.shipment.origin.state}` : ''}
                      {' → '}
                      {t.shipment.destination.city}{t.shipment.destination.state ? `, ${t.shipment.destination.state}` : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {t.equipmentType || 'No equipment specified'}
                      {t.targetRate ? ` | Target: $${t.targetRate.toLocaleString()}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                    {timeLeft !== null && (
                      <div style={{
                        fontSize: '13px', fontWeight: 600,
                        color: timeLeft < 30 ? 'var(--color-error)' : 'var(--color-text-secondary)',
                      }}>
                        {timeLeft > 60 ? `${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m` : `${timeLeft}m`} left
                      </div>
                    )}
                    <Link to={`/carrier-portal/tenders/${t.id}`} className="button" style={{ fontSize: '13px', padding: '6px 16px' }}>
                      View & Bid
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Bids */}
      <div className="card">
        <h3 style={{ margin: '0 0 var(--spacing-2)' }}>
          <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-warning)' }}>receipt</span>
          Recent Bids
        </h3>
        {bids.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--spacing-3)' }}>No bids submitted yet</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
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
                      <span className={`chip chip-${b.status === 'accepted' ? 'success' : b.status === 'rejected' ? 'error' : 'info'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>{new Date(b.submittedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export { carrierFetch, getCarrierToken, getCarrierUser };
