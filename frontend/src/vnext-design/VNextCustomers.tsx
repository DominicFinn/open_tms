import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface Customer {
  id: string;
  name: string;
  contactEmail: string | null;
  archived: boolean;
  _count?: { shipments: number; orders: number };
}

function formatCurrency(val: number) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

export default function VNextCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const res = await fetch(`${API_URL}/api/v1/customers`);
        if (!res.ok) throw new Error(`Failed to fetch customers (${res.status})`);
        const json = await res.json();
        setCustomers(json.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load customers');
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, []);

  const stats = {
    total: customers.length,
    active: customers.filter(c => !c.archived).length,
    totalShipments: customers.reduce((s, c) => s + (c._count?.shipments || 0), 0),
    totalOrders: customers.reduce((s, c) => s + (c._count?.orders || 0), 0),
  };

  const filtered = customers.filter(c => {
    if (statusFilter === 'active' && c.archived) return false;
    if (statusFilter === 'inactive' && !c.archived) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.contactEmail || '').toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  if (error) {
    return <div className="vn-alert vn-alert-error">{error}</div>;
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Customers</h1>
          <p>{customers.length} customers in your account</p>
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
          <div className="vn-stat-icon info"><span className="material-icons">local_shipping</span></div>
          <div>
            <div className="vn-stat-value">{stats.totalShipments}</div>
            <div className="vn-stat-label">Total Shipments</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">receipt_long</span></div>
          <div>
            <div className="vn-stat-value">{stats.totalOrders}</div>
            <div className="vn-stat-label">Total Orders</div>
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
            <option value="inactive">Inactive ({customers.filter(c => c.archived).length})</option>
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
                      <span className={`vn-chip vn-chip-${c.archived ? 'error' : 'success'}`}>{c.archived ? 'Inactive' : 'Active'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                      <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'text-bottom', marginRight: 4 }}>mail</span>
                      {c.contactEmail || '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 14, borderTop: '1px solid var(--outline-variant)' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 2 }}>Shipments</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>{c._count?.shipments ?? 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 2 }}>Orders</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>{c._count?.orders ?? 0}</div>
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
                  <th>Email</th>
                  <th>Shipments</th>
                  <th>Orders</th>
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
                      <div className="vn-table-secondary">{c.contactEmail || '—'}</div>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{c._count?.shipments ?? 0}</td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{c._count?.orders ?? 0}</td>
                    <td><span className={`vn-chip vn-chip-${c.archived ? 'error' : 'success'}`}>{c.archived ? 'Inactive' : 'Active'}</span></td>
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
