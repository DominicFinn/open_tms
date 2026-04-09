import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../api';
import { carrierFetch, getCarrierToken } from './CarrierDashboard';

interface Bid {
  id: string;
  rate: number;
  currency: string;
  transitDays: number | null;
  equipmentType: string | null;
  status: string;
  sourceType: string;
  submittedAt: string;
  tender: { id: string; reference: string; status: string };
}

const statusColors: Record<string, string> = {
  submitted: 'info', accepted: 'success', rejected: 'error', withdrawn: 'warning', expired: 'error',
};

export default function CarrierBidHistory() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getCarrierToken()) {
      navigate('/carrier-portal/login');
      return;
    }
    carrierFetch(`${API_URL}/api/v1/carrier-portal/bids`)
      .then(r => r.json())
      .then(json => {
        setBids(json.data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px' }}><span className="loading-spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Bid History</h1>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tender</th>
              <th>Rate</th>
              <th>Transit</th>
              <th>Equipment</th>
              <th>Source</th>
              <th>Status</th>
              <th>Tender Status</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {bids.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
                  No bids submitted yet
                </td>
              </tr>
            ) : bids.map(b => (
              <tr key={b.id}>
                <td style={{ fontWeight: 600 }}>{b.tender.reference}</td>
                <td style={{ fontWeight: 700 }}>${b.rate.toLocaleString()}</td>
                <td>{b.transitDays ? `${b.transitDays} days` : '--'}</td>
                <td>{b.equipmentType || '--'}</td>
                <td>{b.sourceType}</td>
                <td><span className={`chip chip-${statusColors[b.status] || 'secondary'}`}>{b.status}</span></td>
                <td><span className={`chip chip-${statusColors[b.tender.status] || 'secondary'}`}>{b.tender.status}</span></td>
                <td>{new Date(b.submittedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
