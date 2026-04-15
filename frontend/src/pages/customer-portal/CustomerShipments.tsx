import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';

interface Shipment {
  id: string; reference: string; status: string;
  originCity?: string; originState?: string; destinationCity?: string; destinationState?: string;
  carrierName?: string; pickupDate?: string; deliveryDate?: string; updatedAt: string;
}

function statusChip(s: string): string {
  const m: Record<string, string> = { in_transit: 'info', delivered: 'success', booked: 'warning', exception: 'error', at_pickup: 'warning', at_delivery: 'warning' };
  return m[s] || 'secondary';
}

export default function CustomerShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    customerFetch(`${API_URL}/api/v1/customer-portal/shipments?${params}`)
      .then(r => r.json())
      .then(json => setShipments(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Shipments</h1>
      <div className="vn-card">
        <div className="vn-filters" style={{ padding: '8px 16px' }}>
          <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="booked">Booked</option>
            <option value="in_transit">In Transit</option>
            <option value="at_pickup">At Pickup</option>
            <option value="at_delivery">At Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="exception">Exception</option>
          </select>
        </div>
        <div className="vn-table-wrap">
          {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" /></div> : (
            <table className="vn-table">
              <thead><tr><th>Reference</th><th>Origin</th><th>Destination</th><th>Carrier</th><th>Pickup</th><th>Delivery</th><th>Status</th></tr></thead>
              <tbody>
                {shipments.map(s => (
                  <tr key={s.id}>
                    <td><Link to={`/customer-portal/shipments/${s.id}`} style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.reference}</Link></td>
                    <td style={{ fontSize: 13 }}>{s.originCity ? `${s.originCity}, ${s.originState}` : '-'}</td>
                    <td style={{ fontSize: 13 }}>{s.destinationCity ? `${s.destinationCity}, ${s.destinationState}` : '-'}</td>
                    <td style={{ fontSize: 13 }}>{s.carrierName || '-'}</td>
                    <td style={{ fontSize: 13 }}>{s.pickupDate ? new Date(s.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</td>
                    <td style={{ fontSize: 13 }}>{s.deliveryDate ? new Date(s.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</td>
                    <td><span className={`vn-chip vn-chip-${statusChip(s.status)}`}>{s.status}</span></td>
                  </tr>
                ))}
                {shipments.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--on-surface-variant)' }}>No shipments found</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
