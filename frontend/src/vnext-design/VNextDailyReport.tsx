import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

function statusChip(status: string): { label: string; color: string } {
  switch ((status || '').toLowerCase()) {
    case 'in_transit': return { label: 'In Transit', color: 'info' };
    case 'delivered': return { label: 'Delivered', color: 'success' };
    case 'delayed': return { label: 'Delayed', color: 'warning' };
    case 'picked_up': case 'pickup': return { label: 'Pickup', color: 'warning' };
    case 'cancelled': return { label: 'Cancelled', color: 'error' };
    case 'booked': return { label: 'Booked', color: 'secondary' };
    default: return { label: status || 'Unknown', color: 'secondary' };
  }
}

export default function VNextDailyReport() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayISO = new Date().toISOString().split('T')[0];

  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        // Try the daily summary endpoint first, fall back to shipments list
        let data: any[] = [];
        const summaryRes = await fetch(`${API_URL}/api/v1/reports/daily/summary?date=${todayISO}`);
        if (summaryRes.ok) {
          const summaryJson = await summaryRes.json();
          // If the endpoint returns shipments data, use it
          if (summaryJson.data && Array.isArray(summaryJson.data)) {
            data = summaryJson.data;
          } else if (summaryJson.data?.shipments && Array.isArray(summaryJson.data.shipments)) {
            data = summaryJson.data.shipments;
          }
        }
        // Fallback: fetch all shipments if summary didn't provide data
        if (data.length === 0) {
          const shipRes = await fetch(`${API_URL}/api/v1/shipments`);
          if (!shipRes.ok) throw new Error('Failed to load shipments');
          const shipJson = await shipRes.json();
          data = shipJson.data || [];
        }
        if (!cancelled) setShipments(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [todayISO]);

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

  const inTransit = shipments.filter((s: any) => s.status === 'in_transit');
  const delivered = shipments.filter((s: any) => s.status === 'delivered');
  const totalCount = shipments.length || 1;
  const deliveredPct = parseFloat(((delivered.length / totalCount) * 100).toFixed(1));
  const inTransitPct = parseFloat(((inTransit.length / totalCount) * 100).toFixed(1));

  // Deliveries due: in_transit or delivered today
  const deliveriesDue = shipments.filter((s: any) => s.status === 'in_transit' || s.status === 'delivered').slice(0, 10);

  return (
    <>
      {/* Page Header */}
      <div className="vn-page-header">
        <div>
          <h1>Daily Report</h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: 14, marginTop: 4 }}>{today}</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline">
            <span className="material-icons">download</span>
            Export PDF
          </button>
          <button className="vn-btn vn-btn-outline">
            <span className="material-icons">email</span>
            Email Report
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">local_shipping</span>
          </div>
          <div>
            <div className="vn-stat-value">{shipments.length}</div>
            <div className="vn-stat-label">Total Shipments</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{deliveredPct}%</div>
            <div className="vn-stat-label">Delivered</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">inventory_2</span>
          </div>
          <div>
            <div className="vn-stat-value">{inTransit.length}</div>
            <div className="vn-stat-label">In Transit</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{delivered.length}</div>
            <div className="vn-stat-label">Delivered Today</div>
          </div>
        </div>
      </div>

      {/* Two-Column Grid */}
      <div className="vn-grid-2" style={{ marginBottom: 24 }}>
        {/* Shipments In Transit */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Shipments In Transit</h2>
            <span className="vn-chip vn-chip-info">{inTransit.length} active</span>
          </div>
          <div className="vn-card-body vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Origin</th>
                    <th>Destination</th>
                    <th>ETA</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inTransit.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--on-surface-variant)' }}>No shipments in transit</td></tr>
                  )}
                  {inTransit.slice(0, 10).map((s: any, i: number) => {
                    const chip = statusChip(s.status);
                    const origin = s.originCity && s.originState ? `${s.originCity}, ${s.originState}` : s.originCity || 'N/A';
                    const dest = s.destinationCity && s.destinationState ? `${s.destinationCity}, ${s.destinationState}` : s.destinationCity || 'N/A';
                    const eta = s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A';
                    return (
                      <tr key={s.id || i}>
                        <td><span className="vn-table-id">{s.referenceNumber || `SHP-${s.id}`}</span></td>
                        <td style={{ fontSize: 13 }}>{origin}</td>
                        <td style={{ fontSize: 13 }}>{dest}</td>
                        <td style={{ fontSize: 13 }}>{eta}</td>
                        <td><span className={`vn-chip vn-chip-${chip.color}`}>{chip.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Deliveries Due Today */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Deliveries Due Today</h2>
            <span className="vn-chip vn-chip-success">{deliveriesDue.length} expected</span>
          </div>
          <div className="vn-card-body vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Destination</th>
                    <th>Carrier</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveriesDue.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--on-surface-variant)' }}>No deliveries due today</td></tr>
                  )}
                  {deliveriesDue.map((d: any, i: number) => {
                    const chip = statusChip(d.status);
                    const dest = d.destinationCity && d.destinationState ? `${d.destinationCity}, ${d.destinationState}` : d.destinationCity || 'N/A';
                    const carrier = d.carrier?.name || d.carrierName || 'N/A';
                    return (
                      <tr key={d.id || i}>
                        <td><span className="vn-table-id">{d.referenceNumber || `SHP-${d.id}`}</span></td>
                        <td style={{ fontSize: 13 }}>{dest}</td>
                        <td style={{ fontSize: 13 }}>{carrier}</td>
                        <td><span className={`vn-chip vn-chip-${chip.color}`}>{chip.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Performance */}
      <div className="vn-card">
        <div className="vn-card-header">
          <h2>Delivery Performance</h2>
        </div>
        <div className="vn-card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Delivered', value: deliveredPct, variant: 'success' },
              { label: 'In Transit', value: inTransitPct, variant: 'info' },
              { label: 'Other', value: parseFloat((100 - deliveredPct - inTransitPct).toFixed(1)), variant: 'warning' },
            ].map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                  <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{row.label}</span>
                  <span style={{ color: 'var(--on-surface-variant)' }}>{row.value}%</span>
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
