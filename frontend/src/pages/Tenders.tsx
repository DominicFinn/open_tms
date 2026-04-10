import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface Tender {
  id: string;
  reference: string;
  status: string;
  strategy: string;
  targetRate: number | null;
  currency: string;
  equipmentType: string | null;
  tenderDurationMinutes: number;
  openedAt: string | null;
  awardedAt: string | null;
  createdAt: string;
  shipment: {
    id: string;
    reference: string;
    origin: { name: string; city: string; state: string | null };
    destination: { name: string; city: string; state: string | null };
  };
  offers: Array<{ id: string; carrierId: string; status: string; carrier: { name: string } }>;
  bids: Array<{ id: string; rate: number; status: string; carrier: { name: string } }>;
}

const statusColors: Record<string, string> = {
  draft: 'secondary',
  open: 'primary',
  evaluating: 'warning',
  awarded: 'success',
  cancelled: 'error',
  expired: 'error',
};

interface Carrier {
  id: string;
  name: string;
}

export default function Tenders() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/api/v1/carriers`).then(r => r.json()).then(j => setCarriers(j.data || []));
  }, []);

  useEffect(() => {
    fetchTenders();
  }, [statusFilter, carrierFilter]);

  async function fetchTenders() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (carrierFilter) params.set('carrierId', carrierFilter);
    const res = await fetch(`${API_URL}/api/v1/tenders?${params}`);
    const json = await res.json();
    setTenders(json.data || []);
    setLoading(false);
  }

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Tenders</h1>
          <p style={{ color: 'var(--on-surface-variant)', margin: 0 }}>
            Manage carrier tender requests and bids
          </p>
        </div>
        <div className="vn-page-actions">
          <Link to="/tenders/create" className="vn-btn vn-btn-primary">
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '6px' }}>add</span>
            Create Tender
          </Link>
        </div>
      </div>

      <div className="vn-card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--spacing-1)' }}>
          <label style={{ fontWeight: 500, fontSize: '14px' }}>Status:</label>
          {['', 'draft', 'open', 'evaluating', 'awarded', 'cancelled', 'expired'].map(s => (
            <button
              key={s}
              className={statusFilter === s ? 'vn-btn vn-btn-primary' : 'vn-btn vn-btn-outline'}
              style={{ padding: '4px 12px', fontSize: '13px' }}
              onClick={() => setStatusFilter(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
          <label style={{ fontWeight: 500, fontSize: '14px' }}>Carrier:</label>
          <select
            className="vn-select"
            style={{ width: 'auto', minWidth: '200px', padding: '4px 8px', fontSize: '13px' }}
            value={carrierFilter}
            onChange={e => setCarrierFilter(e.target.value)}
          >
            <option value="">All Carriers</option>
            {carriers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {carrierFilter && (
            <button className="vn-btn vn-btn-outline" style={{ padding: '4px 12px', fontSize: '13px' }} onClick={() => setCarrierFilter('')}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-card-flush">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Shipment</th>
                  <th>Route</th>
                  <th>Strategy</th>
                  <th>Status</th>
                  <th>Carriers</th>
                  <th>Bids</th>
                  <th>Target Rate</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="vn-empty"><span className="material-icons" style={{animation:'spin 1s linear infinite'}}>refresh</span><h3>Loading...</h3></div>
                  </td></tr>
                ) : tenders.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--on-surface-variant)' }}>No tenders found</td></tr>
                ) : tenders.map(t => (
                  <tr key={t.id} onClick={() => navigate(`/tenders/${t.id}`)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600 }}>{t.reference}</td>
                    <td>
                      <Link to={`/shipments/${t.shipment.id}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)' }}>
                        {t.shipment.reference}
                      </Link>
                    </td>
                    <td>
                      {t.shipment.origin.city}{t.shipment.origin.state ? `, ${t.shipment.origin.state}` : ''}
                      {' → '}
                      {t.shipment.destination.city}{t.shipment.destination.state ? `, ${t.shipment.destination.state}` : ''}
                    </td>
                    <td>
                      <span className={`vn-chip vn-chip-${t.strategy === 'broadcast' ? 'info' : 'secondary'}`}>
                        {t.strategy}
                      </span>
                    </td>
                    <td>
                      <span className={`vn-chip vn-chip-${statusColors[t.status] || 'secondary'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.offers.length}</td>
                    <td>{t.bids.length}</td>
                    <td>{t.targetRate ? `$${t.targetRate.toLocaleString()}` : '--'}</td>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
