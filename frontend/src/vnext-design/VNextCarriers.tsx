import React, { useState } from 'react';

const CARRIERS = [
  { id: 'CAR-101', name: 'Swift Transport', mc: 'MC-482910', dot: '2841029', modes: ['FTL', 'LTL'], rating: 4.8, onTime: 97, loads: 342, insurance: '$1M', status: 'Active', statusColor: 'success', contact: 'Mike Johnson', phone: '(555) 234-5678', email: 'dispatch@swift.com', lanes: ['Chicago-Dallas', 'Chicago-Atlanta', 'Dallas-Houston'] },
  { id: 'CAR-102', name: 'Desert Freight', mc: 'MC-551203', dot: '3102845', modes: ['FTL'], rating: 4.5, onTime: 94, loads: 186, insurance: '$1M', status: 'Active', statusColor: 'success', contact: 'Lisa Chen', phone: '(555) 345-6789', email: 'ops@desertfreight.com', lanes: ['LA-Phoenix', 'Phoenix-Denver'] },
  { id: 'CAR-103', name: 'Southeast Express', mc: 'MC-329104', dot: '1982045', modes: ['FTL', 'Reefer'], rating: 4.7, onTime: 96, loads: 528, insurance: '$2M', status: 'Active', statusColor: 'success', contact: 'James Wilson', phone: '(555) 456-7890', email: 'dispatch@seexpress.com', lanes: ['Atlanta-Miami', 'Atlanta-Charlotte', 'Nashville-Memphis'] },
  { id: 'CAR-104', name: 'NorthEast Carriers', mc: 'MC-671023', dot: '3450129', modes: ['LTL', 'Reefer'], rating: 4.3, onTime: 91, loads: 124, insurance: '$1M', status: 'Active', statusColor: 'success', contact: 'Amy Brown', phone: '(555) 567-8901', email: 'amy@necarriers.com', lanes: ['NYC-Boston', 'NYC-Philadelphia'] },
  { id: 'CAR-105', name: 'Mountain Haul', mc: 'MC-812034', dot: '2910384', modes: ['Flatbed', 'FTL'], rating: 4.6, onTime: 95, loads: 215, insurance: '$2M', status: 'Active', statusColor: 'success', contact: 'Bob Torres', phone: '(555) 678-9012', email: 'bob@mountainhaul.com', lanes: ['Denver-SLC', 'Denver-Phoenix'] },
  { id: 'CAR-106', name: 'Pacific Lines', mc: 'MC-419205', dot: '2034918', modes: ['LTL'], rating: 4.2, onTime: 89, loads: 98, insurance: '$500K', status: 'Probation', statusColor: 'warning', contact: 'Sarah Kim', phone: '(555) 789-0123', email: 'sarah@pacificlines.com', lanes: ['Seattle-Portland', 'Portland-SF'] },
  { id: 'CAR-107', name: 'Lone Star Freight', mc: 'MC-902134', dot: '3891024', modes: ['FTL', 'Flatbed'], rating: 4.9, onTime: 98, loads: 412, insurance: '$2M', status: 'Active', statusColor: 'success', contact: 'Carlos Ruiz', phone: '(555) 890-1234', email: 'carlos@lonestar.com', lanes: ['Houston-SA', 'Houston-Dallas', 'Dallas-Austin'] },
  { id: 'CAR-108', name: 'Midwest Transit', mc: 'MC-340921', dot: '1892034', modes: ['Reefer'], rating: 3.9, onTime: 85, loads: 67, insurance: '$500K', status: 'Inactive', statusColor: 'error', contact: 'Dan Miller', phone: '(555) 901-2345', email: 'dan@midwesttransit.com', lanes: ['Minneapolis-Milwaukee', 'Chicago-Minneapolis'] },
];

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="vn-rating" title={`${rating} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`material-icons ${i >= full && !(i === full && half) ? 'empty' : ''}`}>
          {i < full ? 'star' : i === full && half ? 'star_half' : 'star_outline'}
        </span>
      ))}
      <span style={{ fontSize: 13, marginLeft: 4, color: 'var(--on-surface-variant)' }}>{rating}</span>
    </div>
  );
}

function OnTimeBar({ pct }: { pct: number }) {
  const variant = pct >= 95 ? 'success' : pct >= 90 ? 'warning' : 'error';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="vn-progress" style={{ flex: 1, height: 6 }}>
        <div className={`vn-progress-bar ${variant}`} style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, minWidth: 36, color: `var(--${variant})` }}>{pct}%</span>
    </div>
  );
}

export default function VNextCarriers() {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = CARRIERS.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.mc.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Carriers</h1>
          <p>{CARRIERS.length} carriers in your network</p>
        </div>
        <div className="vn-page-actions">
          <div style={{ display: 'flex', border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
            <button className="vn-btn-icon" style={{ borderRadius: 0, background: viewMode === 'cards' ? 'var(--surface-container)' : 'transparent' }} onClick={() => setViewMode('cards')}>
              <span className="material-icons" style={{ fontSize: 20 }}>grid_view</span>
            </button>
            <button className="vn-btn-icon" style={{ borderRadius: 0, background: viewMode === 'table' ? 'var(--surface-container)' : 'transparent' }} onClick={() => setViewMode('table')}>
              <span className="material-icons" style={{ fontSize: 20 }}>view_list</span>
            </button>
          </div>
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            Add Carrier
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{CARRIERS.filter(c => c.status === 'Active').length}</div>
            <div className="vn-stat-label">Active Carriers</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">star</span></div>
          <div>
            <div className="vn-stat-value">{(CARRIERS.reduce((s, c) => s + c.rating, 0) / CARRIERS.length).toFixed(1)}</div>
            <div className="vn-stat-label">Avg Rating</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">local_shipping</span></div>
          <div>
            <div className="vn-stat-value">{CARRIERS.reduce((s, c) => s + c.loads, 0).toLocaleString()}</div>
            <div className="vn-stat-label">Total Loads (YTD)</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">schedule</span></div>
          <div>
            <div className="vn-stat-value">{Math.round(CARRIERS.reduce((s, c) => s + c.onTime, 0) / CARRIERS.length)}%</div>
            <div className="vn-stat-label">Avg On-Time</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <div className="vn-filter-group">
          <span className="material-icons">search</span>
          <input
            className="vn-filter-input"
            placeholder="Search carriers by name, MC#, or contact..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ minWidth: 360 }}
          />
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {filtered.map(c => (
            <div key={c.id} className="vn-card" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
              <div className="vn-card-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, background: 'var(--primary)', color: 'var(--on-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span className="material-icons">local_shipping</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--on-surface)' }}>{c.name}</span>
                      <span className={`vn-chip vn-chip-${c.statusColor}`}>{c.status}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                      {c.mc} · DOT# {c.dot}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  {c.modes.map(m => <span key={m} className="vn-chip vn-chip-secondary">{m}</span>)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Rating</div>
                    <Stars rating={c.rating} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 4 }}>On-Time Delivery</div>
                    <OnTimeBar pct={c.onTime} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                  <span>{c.loads} loads (YTD)</span>
                  <span>Insurance: {c.insurance}</span>
                </div>

                {expandedId === c.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--outline-variant)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div className="vn-info-item"><label>Contact</label><span>{c.contact}</span></div>
                      <div className="vn-info-item"><label>Phone</label><span>{c.phone}</span></div>
                      <div className="vn-info-item" style={{ gridColumn: '1 / -1' }}><label>Email</label><span style={{ color: 'var(--info)' }}>{c.email}</span></div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 6 }}>Primary Lanes</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {c.lanes.map(l => <span key={l} className="vn-chip vn-chip-secondary">{l}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="vn-card">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>MC / DOT</th>
                  <th>Modes</th>
                  <th>Rating</th>
                  <th>On-Time</th>
                  <th>Loads (YTD)</th>
                  <th>Insurance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{c.name}</span>
                      <div className="vn-table-secondary">{c.contact} · {c.phone}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{c.mc}</div>
                      <div className="vn-table-secondary">DOT# {c.dot}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {c.modes.map(m => <span key={m} className="vn-chip vn-chip-secondary">{m}</span>)}
                      </div>
                    </td>
                    <td><Stars rating={c.rating} /></td>
                    <td style={{ minWidth: 120 }}><OnTimeBar pct={c.onTime} /></td>
                    <td style={{ fontWeight: 600 }}>{c.loads}</td>
                    <td>{c.insurance}</td>
                    <td><span className={`vn-chip vn-chip-${c.statusColor}`}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
