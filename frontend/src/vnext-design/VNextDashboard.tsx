import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

export default function VNextDashboard() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [shipRes, ordRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/shipments`),
          fetch(`${API_URL}/api/v1/orders`),
        ]);
        if (!shipRes.ok) throw new Error('Failed to load shipments');
        if (!ordRes.ok) throw new Error('Failed to load orders');
        const shipJson = await shipRes.json();
        const ordJson = await ordRes.json();
        if (!cancelled) {
          setShipments(shipJson.data || []);
          setOrders(ordJson.data || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ color: 'var(--error)' }}>error</span>
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  const activeShipments = shipments.filter((s: any) => s.status !== 'delivered' && s.status !== 'cancelled');
  const inTransit = shipments.filter((s: any) => s.status === 'in_transit');
  const delivered = shipments.filter((s: any) => s.status === 'delivered');
  const pendingOrders = orders.filter((o: any) => o.status === 'pending' || o.status === 'new');
  const onTimeCount = delivered.length;
  const totalForRate = delivered.length || 1;
  const onTimeRate = ((onTimeCount / totalForRate) * 100).toFixed(1);

  const recentShipments = shipments.slice(0, 5);

  const statusToChip = (status: string) => {
    switch (status) {
      case 'in_transit': return { label: 'In Transit', color: 'info' };
      case 'delivered': return { label: 'Delivered', color: 'success' };
      case 'pickup': case 'picked_up': return { label: 'Pickup', color: 'warning' };
      case 'booked': return { label: 'Booked', color: 'secondary' };
      default: return { label: status || 'Unknown', color: 'secondary' };
    }
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{today}</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline">
            <span className="material-icons">download</span>
            Export
          </button>
          <button className="vn-btn vn-btn-primary" onClick={() => navigate('/shipments')}>
            <span className="material-icons">add</span>
            New Shipment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/shipments')}>
          <div className="vn-stat-icon primary">
            <span className="material-icons">local_shipping</span>
          </div>
          <div>
            <div className="vn-stat-value">{activeShipments.length}</div>
            <div className="vn-stat-label">Active Shipments</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/orders')}>
          <div className="vn-stat-icon info">
            <span className="material-icons">receipt_long</span>
          </div>
          <div>
            <div className="vn-stat-value">{pendingOrders.length}</div>
            <div className="vn-stat-label">Pending Orders</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/shipments')}>
          <div className="vn-stat-icon warning">
            <span className="material-icons">local_shipping</span>
          </div>
          <div>
            <div className="vn-stat-value">{inTransit.length}</div>
            <div className="vn-stat-label">In Transit</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/shipments')}>
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{delivered.length}</div>
            <div className="vn-stat-label">Delivered</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">percent</span>
          </div>
          <div>
            <div className="vn-stat-value">{onTimeRate}%</div>
            <div className="vn-stat-label">On-Time Delivery</div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="vn-grid-2" style={{ marginBottom: 24 }}>
        {/* Recent Shipments */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Recent Shipments</h2>
            <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/shipments')}>
              View All
              <span className="material-icons">arrow_forward</span>
            </button>
          </div>
          <div className="vn-card-body vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Shipment</th>
                    <th>Route</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentShipments.map((s: any) => {
                    const chip = statusToChip(s.status);
                    const origin = s.originCity && s.originState ? `${s.originCity}, ${s.originState}` : s.originCity || 'N/A';
                    const dest = s.destinationCity && s.destinationState ? `${s.destinationCity}, ${s.destinationState}` : s.destinationCity || 'N/A';
                    return (
                      <tr key={s.id} onClick={() => navigate(`/shipments/${s.id}`)} style={{ cursor: 'pointer' }}>
                        <td><span className="vn-table-id">{s.referenceNumber || `SHP-${s.id}`}</span></td>
                        <td>
                          <div style={{ fontSize: 13 }}>{origin}</div>
                          <div className="vn-table-secondary">to {dest}</div>
                        </td>
                        <td><span className={`vn-chip vn-chip-${chip.color}`}>{chip.label}</span></td>
                      </tr>
                    );
                  })}
                  {recentShipments.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--on-surface-variant)' }}>No shipments found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Issues */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Active Issues</h2>
            <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/issues')}>
              View Board
              <span className="material-icons">arrow_forward</span>
            </button>
          </div>
          <div className="vn-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { title: 'Delayed pickup at Chicago warehouse', severity: 'error', shipment: 'SHP-4821', time: '2h ago' },
              { title: 'Missing BOL for Dallas delivery', severity: 'warning', shipment: 'SHP-4815', time: '4h ago' },
              { title: 'Carrier unresponsive — ETA update needed', severity: 'error', shipment: 'SHP-4812', time: '6h ago' },
              { title: 'Temperature excursion alert', severity: 'warning', shipment: 'SHP-4808', time: '8h ago' },
            ].map((issue, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid var(--outline-variant)',
                cursor: 'pointer',
              }}>
                <span className="material-icons" style={{
                  color: issue.severity === 'error' ? 'var(--error)' : 'var(--warning)',
                  fontSize: 20,
                }}>
                  {issue.severity === 'error' ? 'error' : 'warning'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--on-surface)' }}>{issue.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{issue.shipment} · {issue.time}</div>
                </div>
                <span className="material-icons" style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}>chevron_right</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* On-time delivery progress */}
      <div className="vn-card">
        <div className="vn-card-header">
          <h2>Delivery Performance — This Week</h2>
        </div>
        <div className="vn-card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(() => {
              const total = shipments.length || 1;
              const deliveredCount = delivered.length;
              const inTransitCount = inTransit.length;
              const otherCount = total - deliveredCount - inTransitCount;
              return [
                { label: 'Delivered', value: parseFloat(((deliveredCount / total) * 100).toFixed(1)), count: deliveredCount, variant: 'success' },
                { label: 'In Transit', value: parseFloat(((inTransitCount / total) * 100).toFixed(1)), count: inTransitCount, variant: 'warning' },
                { label: 'Other', value: parseFloat(((otherCount / total) * 100).toFixed(1)), count: otherCount, variant: 'error' },
              ];
            })().map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                  <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{row.label}</span>
                  <span style={{ color: 'var(--on-surface-variant)' }}>{row.count} shipments ({row.value}%)</span>
                </div>
                <div className="vn-progress">
                  <div className={`vn-progress-bar ${row.variant}`} style={{ width: `${row.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
