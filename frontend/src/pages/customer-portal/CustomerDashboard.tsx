import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../api';

export function getCustomerToken(): string {
  return localStorage.getItem('customer_token') || '';
}

export function getCustomerUser(): any {
  try { return JSON.parse(localStorage.getItem('customer_user') || '{}'); } catch { return {}; }
}

export function customerFetch(url: string, opts?: RequestInit) {
  return fetch(url, {
    ...opts,
    headers: { ...opts?.headers, Authorization: `Bearer ${getCustomerToken()}`, 'Content-Type': 'application/json' },
  });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface DashboardData {
  stats: {
    activeShipments: number;
    recentDeliveries: number;
    openIssues: number;
    outstandingInvoiceCount: number;
    outstandingBalanceCents: number;
  };
  recentShipments: Array<{
    id: string; reference: string; status: string;
    originCity?: string; originState?: string;
    destinationCity?: string; destinationState?: string;
    carrierName?: string; pickupDate?: string; deliveryDate?: string;
  }>;
}

function statusChip(s: string): string {
  const m: Record<string, string> = { in_transit: 'info', delivered: 'success', booked: 'warning', exception: 'error', at_pickup: 'warning', at_delivery: 'warning' };
  return m[s] || 'secondary';
}

export default function CustomerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const user = getCustomerUser();

  useEffect(() => {
    customerFetch(`${API_URL}/api/v1/customer-portal/dashboard`)
      .then(r => r.json())
      .then(json => setData(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><div className="loading-spinner" /></div>;
  if (!data) return <div className="vn-alert vn-alert-error">Failed to load dashboard</div>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Welcome back{user.name ? `, ${user.name}` : ''}</h1>
      <p style={{ color: 'var(--on-surface-variant)', fontSize: 14, marginBottom: 24 }}>{user.customerName}</p>

      <div className="vn-stats" style={{ marginBottom: 24 }}>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}>
            <span className="material-icons">local_shipping</span>
          </div>
          <div>
            <div className="vn-stat-value">{data.stats.activeShipments}</div>
            <div className="vn-stat-label">Active Shipments</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--success-container, #e8f5e9)', color: 'var(--color-success)' }}>
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{data.stats.recentDeliveries}</div>
            <div className="vn-stat-label">Delivered</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--warning-container, #fff3e0)', color: 'var(--color-warning)' }}>
            <span className="material-icons">bug_report</span>
          </div>
          <div>
            <div className="vn-stat-value">{data.stats.openIssues}</div>
            <div className="vn-stat-label">Open Issues</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--info-container, #e3f2fd)', color: 'var(--color-info)' }}>
            <span className="material-icons">receipt</span>
          </div>
          <div>
            <div className="vn-stat-value">{data.stats.outstandingInvoiceCount}</div>
            <div className="vn-stat-label">Outstanding Invoices</div>
            <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{formatCents(data.stats.outstandingBalanceCents)}</div>
          </div>
        </div>
      </div>

      <div className="vn-card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline-variant)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Recent Shipments</h3>
        </div>
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Route</th>
                <th>Carrier</th>
                <th>Pickup</th>
                <th>Delivery</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentShipments.map(s => (
                <tr key={s.id}>
                  <td><Link to={`/customer-portal/shipments/${s.id}`} style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.reference}</Link></td>
                  <td style={{ fontSize: 13 }}>{s.originCity}, {s.originState} - {s.destinationCity}, {s.destinationState}</td>
                  <td style={{ fontSize: 13 }}>{s.carrierName || '-'}</td>
                  <td style={{ fontSize: 13 }}>{s.pickupDate ? new Date(s.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</td>
                  <td style={{ fontSize: 13 }}>{s.deliveryDate ? new Date(s.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</td>
                  <td><span className={`vn-chip vn-chip-${statusChip(s.status)}`}>{s.status}</span></td>
                </tr>
              ))}
              {data.recentShipments.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: 24 }}>No recent shipments</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
