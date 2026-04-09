import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../../api';
import { carrierFetch, getCarrierToken } from './CarrierDashboard';

interface OfferHistory {
  id: string;
  status: string;
  outcome: string;
  bidRate: number | null;
  bidStatus: string | null;
  tenderStatus: string;
  tenderReference: string;
  route: string | null;
  customerName: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  tender: {
    id: string;
    reference: string;
    status: string;
    targetRate: number | null;
    equipmentType: string | null;
    shipment: {
      pickupDate: string | null;
      deliveryDate: string | null;
    };
  };
}

const outcomeColors: Record<string, string> = {
  won: 'success',
  lost: 'error',
  pending: 'info',
  active: 'primary',
  expired: 'warning',
  cancelled: 'secondary',
};

const outcomeLabels: Record<string, string> = {
  won: 'Won',
  lost: 'Lost',
  pending: 'Bid Pending',
  active: 'Active',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export default function CarrierTenderHistory() {
  const [offers, setOffers] = useState<OfferHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!getCarrierToken()) {
      navigate('/carrier-portal/login');
      return;
    }
    carrierFetch(`${API_URL}/api/v1/carrier-portal/history`)
      .then(r => r.json())
      .then(json => {
        setOffers(json.data || []);
        setLoading(false);
      });
  }, []);

  const filtered = outcomeFilter
    ? offers.filter(o => o.outcome === outcomeFilter)
    : offers;

  // Summary counts
  const counts = {
    total: offers.length,
    won: offers.filter(o => o.outcome === 'won').length,
    lost: offers.filter(o => o.outcome === 'lost').length,
    pending: offers.filter(o => o.outcome === 'pending').length,
    active: offers.filter(o => o.outcome === 'active').length,
    expired: offers.filter(o => o.outcome === 'expired').length,
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px' }}><span className="loading-spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Tender History</h1>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer', borderLeft: outcomeFilter === '' ? '4px solid var(--color-primary)' : undefined }}
          onClick={() => setOutcomeFilter('')}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Total</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{counts.total}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer', borderLeft: outcomeFilter === 'won' ? '4px solid var(--color-success)' : undefined }}
          onClick={() => setOutcomeFilter(outcomeFilter === 'won' ? '' : 'won')}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Won</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-success)' }}>{counts.won}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer', borderLeft: outcomeFilter === 'lost' ? '4px solid var(--color-error)' : undefined }}
          onClick={() => setOutcomeFilter(outcomeFilter === 'lost' ? '' : 'lost')}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Lost</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-error)' }}>{counts.lost}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer', borderLeft: outcomeFilter === 'pending' ? '4px solid var(--color-info)' : undefined }}
          onClick={() => setOutcomeFilter(outcomeFilter === 'pending' ? '' : 'pending')}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Pending</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{counts.pending}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer', borderLeft: outcomeFilter === 'active' ? '4px solid var(--color-primary)' : undefined }}
          onClick={() => setOutcomeFilter(outcomeFilter === 'active' ? '' : 'active')}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Active</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)' }}>{counts.active}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer', borderLeft: outcomeFilter === 'expired' ? '4px solid var(--color-warning)' : undefined }}
          onClick={() => setOutcomeFilter(outcomeFilter === 'expired' ? '' : 'expired')}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Expired</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{counts.expired}</div>
        </div>
      </div>

      {/* Win rate */}
      {counts.won + counts.lost > 0 && (
        <div className="card" style={{ marginBottom: 'var(--spacing-3)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Win Rate</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-success)' }}>
              {Math.round((counts.won / (counts.won + counts.lost)) * 100)}%
            </div>
          </div>
          <div style={{ flex: 1, height: '8px', background: 'var(--color-error)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round((counts.won / (counts.won + counts.lost)) * 100)}%`,
              height: '100%',
              background: 'var(--color-success)',
              borderRadius: '4px',
            }} />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {counts.won}W / {counts.lost}L
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tender</th>
              <th>Route</th>
              <th>Customer</th>
              <th>Equipment</th>
              <th>Target Rate</th>
              <th>Your Bid</th>
              <th>Outcome</th>
              <th>Tender Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
                  {outcomeFilter ? `No ${outcomeLabels[outcomeFilter]?.toLowerCase()} tenders` : 'No tender history yet'}
                </td>
              </tr>
            ) : filtered.map(o => (
              <tr key={o.id} onClick={() => {
                if (['active', 'pending'].includes(o.outcome)) {
                  navigate(`/carrier-portal/tenders/${o.tender.id}`);
                }
              }} style={{ cursor: ['active', 'pending'].includes(o.outcome) ? 'pointer' : 'default' }}>
                <td style={{ fontWeight: 600 }}>{o.tenderReference}</td>
                <td>{o.route || '--'}</td>
                <td>{o.customerName || '--'}</td>
                <td>{o.tender.equipmentType || '--'}</td>
                <td>{o.tender.targetRate ? `$${o.tender.targetRate.toLocaleString()}` : '--'}</td>
                <td style={{ fontWeight: o.bidRate ? 700 : 400 }}>
                  {o.bidRate ? `$${o.bidRate.toLocaleString()}` : '--'}
                </td>
                <td>
                  <span className={`chip chip-${outcomeColors[o.outcome] || 'secondary'}`}>
                    {outcomeLabels[o.outcome] || o.outcome}
                  </span>
                </td>
                <td>
                  <span className={`chip chip-${o.tenderStatus === 'awarded' ? 'success' : o.tenderStatus === 'open' ? 'primary' : 'secondary'}`}>
                    {o.tenderStatus}
                  </span>
                </td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
