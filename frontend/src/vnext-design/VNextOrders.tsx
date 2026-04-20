import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface Order {
  id: string;
  orderNumber?: string;
  poNumber?: string;
  status: string;
  deliveryStatus?: string;
  customerId?: string;
  customer?: { name: string };
  origin?: { name: string; city: string; state: string };
  destination?: { name: string; city: string; state: string };
  requestedPickupDate?: string;
  requestedDeliveryDate?: string;
  serviceLevel?: string;
  temperatureControl?: boolean;
  requiresHazmat?: boolean;
}

function orderStatusColor(status: string): string {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  if (s === 'readytoship' || s === 'ready') return 'success';
  if (s === 'pendingapproval' || s === 'pending') return 'warning';
  if (s === 'shipped' || s === 'intransit') return 'info';
  if (s === 'delivered') return 'success';
  if (s === 'cancelled' || s === 'canceled') return 'error';
  return 'secondary';
}

function formatDate(d?: string): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function VNextOrders() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerFilter, setCustomerFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/orders`);
        if (!res.ok) throw new Error(`Failed to load orders (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setOrders(json.data || []);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/customers`)
      .then(r => r.json())
      .then(json => setCustomers((json.data || []).filter((c: any) => !c.archived)))
      .catch(() => {});
  }, []);

  const filtered = orders.filter(o => {
    if (statusFilter !== 'all') {
      const sNorm = o.status?.toLowerCase().replace(/[_ ]/g, '');
      const map: Record<string, string> = { ready: 'readytoship', pending: 'pendingapproval', shipped: 'shipped', draft: 'draft', delivered: 'delivered', cancelled: 'cancelled' };
      if (sNorm !== map[statusFilter]) return false;
    }
    if (customerFilter !== 'all' && o.customerId !== customerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const orderNum = (o.orderNumber || o.id || '').toLowerCase();
      const customerName = o.customer?.name?.toLowerCase() || '';
      const originLabel = o.origin ? `${o.origin.city}, ${o.origin.state}`.toLowerCase() : '';
      const destLabel = o.destination ? `${o.destination.city}, ${o.destination.state}`.toLowerCase() : '';
      return orderNum.includes(q) || customerName.includes(q) || originLabel.includes(q) || destLabel.includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="vn-empty"><span className="material-icons" style={{animation:'spin 1s linear infinite'}}>refresh</span><h3>Loading...</h3></div>
    );
  }

  if (error) {
    return (
      <div className="vn-alert vn-alert-error"><span className="material-icons">error</span><div className="vn-alert-content">{error}</div></div>
    );
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Orders</h1>
          <p>{orders.length} orders</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline">
            <span className="material-icons">upload_file</span>
            Import
          </button>
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            New Order
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">inventory_2</span></div>
          <div>
            <div className="vn-stat-value">{orders.filter(o => o.status?.toLowerCase().replace(/[_ ]/g, '') === 'readytoship').length}</div>
            <div className="vn-stat-label">Ready to Ship</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">hourglass_empty</span></div>
          <div>
            <div className="vn-stat-value">{orders.filter(o => o.status?.toLowerCase().replace(/[_ ]/g, '') === 'pendingapproval').length}</div>
            <div className="vn-stat-label">Pending Approval</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">local_shipping</span></div>
          <div>
            <div className="vn-stat-value">{orders.filter(o => o.status?.toLowerCase() === 'shipped').length}</div>
            <div className="vn-stat-label">Shipped</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">inventory</span></div>
          <div>
            <div className="vn-stat-value">{orders.filter(o => o.status?.toLowerCase() === 'delivered').length}</div>
            <div className="vn-stat-label">Delivered</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="vn-tabs" style={{ marginBottom: 16 }}>
        {[
          { key: 'all', label: 'All Orders', count: orders.length },
          { key: 'ready', label: 'Ready to Ship', count: orders.filter(o => o.status?.toLowerCase().replace(/[_ ]/g, '') === 'readytoship').length },
          { key: 'pending', label: 'Pending', count: orders.filter(o => o.status?.toLowerCase().replace(/[_ ]/g, '') === 'pendingapproval').length },
          { key: 'shipped', label: 'Shipped', count: orders.filter(o => o.status?.toLowerCase() === 'shipped').length },
        ].map(tab => (
          <button
            key={tab.key}
            className={`vn-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.key); setStatusFilter(tab.key === 'all' ? 'all' : tab.key); }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group" style={{ flex: 1 }}>
            <span className="material-icons">search</span>
            <input
              className="vn-filter-input"
              placeholder="Search orders by ID, customer, route, commodity..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <select className="vn-filter-select">
            <option>All Modes</option>
            <option>FTL</option>
            <option>LTL</option>
            <option>Reefer</option>
            <option>Flatbed</option>
          </select>
          <select className="vn-filter-select" value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}>
            <option value="all">All Customers</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Service Level</th>
                <th>Requirements</th>
                <th>Req. Pickup</th>
                <th>Req. Delivery</th>
                <th>Delivery Status</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const sNorm = o.status?.toLowerCase().replace(/[_ ]/g, '');
                return (
                <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className="vn-table-id">{o.orderNumber || o.id}</span>
                    {o.poNumber && <div className="vn-table-secondary">PO# {o.poNumber}</div>}
                  </td>
                  <td>{o.customer?.name || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="vn-route-dot origin" style={{ width: 8, height: 8 }} />
                      <span style={{ fontSize: 13 }}>{o.origin ? `${o.origin.city}, ${o.origin.state}` : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span className="vn-route-dot destination" style={{ width: 8, height: 8 }} />
                      <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{o.destination ? `${o.destination.city}, ${o.destination.state}` : '—'}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{o.serviceLevel || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {o.temperatureControl && <span className="vn-chip vn-chip-secondary">Temp Ctrl</span>}
                      {o.requiresHazmat && <span className="vn-chip vn-chip-warning">Hazmat</span>}
                      {!o.temperatureControl && !o.requiresHazmat && '—'}
                    </div>
                  </td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(o.requestedPickupDate)}</td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(o.requestedDeliveryDate)}</td>
                  <td>{o.deliveryStatus || '—'}</td>
                  <td><span className={`vn-chip vn-chip-${orderStatusColor(o.status)}`}>{o.status}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {sNorm === 'readytoship' && (
                        <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={() => navigate('/carrier-bidding')}>
                          <span className="material-icons">local_shipping</span>
                          Ship
                        </button>
                      )}
                      {sNorm === 'pendingapproval' && (
                        <button className="vn-btn vn-btn-success vn-btn-sm">
                          <span className="material-icons">check</span>
                          Approve
                        </button>
                      )}
                      <button className="vn-btn-icon"><span className="material-icons" style={{ fontSize: 18 }}>more_vert</span></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
