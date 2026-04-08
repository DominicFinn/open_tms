import React from 'react';
import { useNavigate } from 'react-router-dom';

const CARRIERS = [
  { name: 'Swift Transport', price: '$2,850', serviceLevel: 'Standard', assigned: true },
  { name: 'Midwest Freight Co', price: '$3,100', serviceLevel: 'Expedited', assigned: false },
];

const RECENT_SHIPMENTS = [
  { ref: 'SHP-4821', status: 'In Transit', statusColor: 'info', pickup: 'Apr 6, 2026', delivery: 'Apr 8, 2026' },
  { ref: 'SHP-4790', status: 'Delivered', statusColor: 'success', pickup: 'Mar 28, 2026', delivery: 'Mar 30, 2026' },
  { ref: 'SHP-4755', status: 'Delivered', statusColor: 'success', pickup: 'Mar 15, 2026', delivery: 'Mar 17, 2026' },
];

export default function VNextLaneDetail() {
  const navigate = useNavigate();

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/vnext')}>
          <span className="material-icons">arrow_back</span>
          Lanes
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ Chicago, IL → Dallas, TX</span>
      </div>

      {/* Page Header */}
      <div className="vn-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h1>Chicago, IL → Dallas, TX</h1>
          <span className="vn-chip vn-chip-success">Active</span>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline vn-btn-sm">
            <span className="material-icons">edit</span>
            Edit
          </button>
          <button className="vn-btn vn-btn-outline vn-btn-sm">
            <span className="material-icons">archive</span>
            Archive
          </button>
        </div>
      </div>

      <div className="vn-detail-grid">
        {/* Main Area */}
        <div className="vn-detail-main">
          {/* Map Placeholder */}
          <div className="vn-map tall" style={{
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface-container)',
            border: '1px solid var(--outline-variant)',
            borderRadius: 'var(--border-radius)',
          }}>
            <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: 48, opacity: 0.4 }}>map</span>
              <div style={{ fontSize: 14, marginTop: 8 }}>Lane Route: Chicago, IL → St. Louis, MO → Dallas, TX</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>632 miles</div>
            </div>
          </div>

          {/* Carriers */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header">
              <h2>Carriers</h2>
              <button className="vn-btn vn-btn-outline vn-btn-sm">
                <span className="material-icons">add</span>
                Add Carrier
              </button>
            </div>
            <div className="vn-card-body vn-card-flush">
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr>
                      <th>Carrier</th>
                      <th>Price</th>
                      <th>Service Level</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CARRIERS.map((c, i) => (
                      <tr key={i}>
                        <td><span style={{ fontWeight: 500 }}>{c.name}</span></td>
                        <td>{c.price}</td>
                        <td>{c.serviceLevel}</td>
                        <td>
                          {c.assigned
                            ? <span className="vn-chip vn-chip-success">Assigned</span>
                            : <span className="vn-chip vn-chip-secondary">Available</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Shipments */}
          <div className="vn-card">
            <div className="vn-card-header">
              <h2>Recent Shipments</h2>
              <button className="vn-btn vn-btn-ghost vn-btn-sm">
                View All
                <span className="material-icons">arrow_forward</span>
              </button>
            </div>
            <div className="vn-card-body vn-card-flush">
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Status</th>
                      <th>Pickup Date</th>
                      <th>Delivery Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_SHIPMENTS.map((s, i) => (
                      <tr key={i} style={{ cursor: 'pointer' }} onClick={() => navigate('/vnext/shipments/' + s.ref)}>
                        <td><span className="vn-table-id">{s.ref}</span></td>
                        <td><span className={`vn-chip vn-chip-${s.statusColor}`}>{s.status}</span></td>
                        <td style={{ fontSize: 13 }}>{s.pickup}</td>
                        <td style={{ fontSize: 13 }}>{s.delivery}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="vn-detail-sidebar">
          {/* Lane Info */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Lane Info</h2></div>
            <div className="vn-card-body">
              <div className="vn-info-grid">
                <div className="vn-info-item"><label>Distance</label><span>632 miles</span></div>
                <div className="vn-info-item"><label>Status</label><span>Active</span></div>
                <div className="vn-info-item"><label>Service Level</label><span>Standard FTL</span></div>
                <div className="vn-info-item"><label>Created</label><span>Jan 15, 2026</span></div>
              </div>
            </div>
          </div>

          {/* Origin */}
          <div className="vn-card">
            <div className="vn-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className="vn-route-dot origin" />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>Origin</span>
              </div>
              <div className="vn-info-item" style={{ marginBottom: 8 }}>
                <label>Facility</label><span>Acme Chicago Warehouse</span>
              </div>
              <div className="vn-info-item">
                <label>Address</label><span>1400 S Cicero Ave, Chicago, IL 60804</span>
              </div>
            </div>
          </div>

          {/* Destination */}
          <div className="vn-card">
            <div className="vn-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className="vn-route-dot destination" />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>Destination</span>
              </div>
              <div className="vn-info-item" style={{ marginBottom: 8 }}>
                <label>Facility</label><span>Acme Dallas DC</span>
              </div>
              <div className="vn-info-item">
                <label>Address</label><span>2200 N Stemmons Fwy, Dallas, TX 75207</span>
              </div>
            </div>
          </div>

          {/* Stops */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Stops</h2></div>
            <div className="vn-card-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--warning)', color: 'var(--on-warning, #fff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>1</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--on-surface)' }}>St. Louis, MO</div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>Consolidation Yard</div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>297 mi from origin</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
