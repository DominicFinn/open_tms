import React, { useState } from 'react';

const CUSTOMERS = [
  { id: 'CUS-001', name: 'Acme Corp', contact: 'John Smith', email: 'john@acmecorp.com', shipments: 128, revenue: 485000, status: 'Active', statusColor: 'success' },
  { id: 'CUS-002', name: 'Global Widgets', contact: 'Sarah Lee', email: 'sarah@globalwidgets.com', shipments: 74, revenue: 312000, status: 'Active', statusColor: 'success' },
  { id: 'CUS-003', name: 'TechStart Inc', contact: 'Mike Chen', email: 'mike@techstart.io', shipments: 45, revenue: 198000, status: 'Active', statusColor: 'success' },
  { id: 'CUS-004', name: 'FreshFoods LLC', contact: 'Amy Rivera', email: 'amy@freshfoods.com', shipments: 92, revenue: 410000, status: 'Active', statusColor: 'success' },
  { id: 'CUS-005', name: 'Industrial Co', contact: 'Bob Torres', email: 'bob@industrial.com', shipments: 61, revenue: 275000, status: 'Active', statusColor: 'success' },
  { id: 'CUS-006', name: 'RetailMax', contact: 'Lisa Park', email: 'lisa@retailmax.com', shipments: 33, revenue: 142000, status: 'Inactive', statusColor: 'error' },
  { id: 'CUS-007', name: 'BioPharm Inc', contact: 'Dan Miller', email: 'dan@biopharminc.com', shipments: 56, revenue: 389000, status: 'Active', statusColor: 'success' },
  { id: 'CUS-008', name: 'AutoParts Plus', contact: 'Karen Wu', email: 'karen@autopartsplus.com', shipments: 18, revenue: 67000, status: 'Inactive', statusColor: 'error' },
];

const stats = {
  total: CUSTOMERS.length,
  active: CUSTOMERS.filter(c => c.status === 'Active').length,
  totalRevenue: CUSTOMERS.reduce((s, c) => s + c.revenue, 0),
  avgOrderValue: Math.round(CUSTOMERS.reduce((s, c) => s + c.revenue, 0) / CUSTOMERS.reduce((s, c) => s + c.shipments, 0)),
};

function formatCurrency(val: number) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

export default function VNextCustomers() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const filtered = CUSTOMERS.filter(c => {
    if (statusFilter === 'active' && c.status !== 'Active') return false;
    if (statusFilter === 'inactive' && c.status !== 'Inactive') return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Customers</h1>
          <p>{CUSTOMERS.length} customers in your account</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            New Customer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">people</span></div>
          <div>
            <div className="vn-stat-value">{stats.total}</div>
            <div className="vn-stat-label">Total Customers</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{stats.active}</div>
            <div className="vn-stat-label">Active</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">payments</span></div>
          <div>
            <div className="vn-stat-value">{formatCurrency(stats.totalRevenue)}</div>
            <div className="vn-stat-label">Total Revenue</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">receipt_long</span></div>
          <div>
            <div className="vn-stat-value">{formatCurrency(stats.avgOrderValue)}</div>
            <div className="vn-stat-label">Avg Order Value</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group" style={{ flex: 1 }}>
            <span className="material-icons">search</span>
            <input
              className="vn-filter-input"
              placeholder="Search by name, contact, or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses ({stats.total})</option>
            <option value="active">Active ({stats.active})</option>
            <option value="inactive">Inactive ({CUSTOMERS.filter(c => c.status === 'Inactive').length})</option>
          </select>
          <div style={{ display: 'flex', border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
            <button
              className="vn-btn-icon"
              style={{ borderRadius: 0, background: viewMode === 'cards' ? 'var(--surface-container)' : 'transparent' }}
              onClick={() => setViewMode('cards')}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>grid_view</span>
            </button>
            <button
              className="vn-btn-icon"
              style={{ borderRadius: 0, background: viewMode === 'table' ? 'var(--surface-container)' : 'transparent' }}
              onClick={() => setViewMode('table')}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card View */}
      {viewMode === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16, marginTop: 16 }}>
          {filtered.map(c => (
            <div key={c.id} className="vn-card" style={{ cursor: 'pointer' }}>
              <div className="vn-card-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, background: 'var(--primary)', color: 'var(--on-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontSize: 20, fontWeight: 700,
                  }}>
                    {c.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--on-surface)' }}>{c.name}</span>
                      <span className={`vn-chip vn-chip-${c.statusColor}`}>{c.status}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                      <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'text-bottom', marginRight: 4 }}>mail</span>
                      {c.email}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 14, borderTop: '1px solid var(--outline-variant)' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 2 }}>Contact</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--on-surface)' }}>{c.contact}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 2 }}>Shipments</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>{c.shipments}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 2 }}>Revenue</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(c.revenue)}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="vn-card" style={{ gridColumn: '1 / -1' }}>
              <div className="vn-empty">
                <span className="material-icons">search_off</span>
                <h3>No customers found</h3>
                <p>Try adjusting your search or filters</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="vn-card" style={{ marginTop: 16 }}>
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Shipments</th>
                  <th>Revenue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, background: 'var(--primary)', color: 'var(--on-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          fontSize: 15, fontWeight: 700,
                        }}>
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{c.name}</span>
                          <div className="vn-table-secondary">{c.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{c.contact}</div>
                      <div className="vn-table-secondary">{c.email}</div>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{c.shipments}</td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{formatCurrency(c.revenue)}</td>
                    <td><span className={`vn-chip vn-chip-${c.statusColor}`}>{c.status}</span></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="vn-empty">
                        <span className="material-icons">search_off</span>
                        <h3>No customers found</h3>
                        <p>Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
