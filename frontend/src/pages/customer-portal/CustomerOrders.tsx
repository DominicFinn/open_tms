import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';

interface Order {
  id: string; orderNumber: string; poNumber?: string; status: string;
  deliveryStatus: string; customerName: string; serviceLevel?: string;
  originCity?: string; originState?: string; destinationCity?: string; destinationState?: string;
  trackableUnitCount: number; lineItemCount: number; createdAt: string;
}

function statusChip(s: string): string {
  const m: Record<string, string> = { validated: 'info', assigned: 'primary', in_transit: 'info', delivered: 'success', exception: 'error' };
  return m[s] || 'secondary';
}

export default function CustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    customerFetch(`${API_URL}/api/v1/customer-portal/orders?${params}`)
      .then(r => r.json())
      .then(json => { setOrders(json.data?.orders || []); setTotal(json.data?.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Orders</h1>
        <Link to="/customer-portal/orders/create" className="vn-btn vn-btn-primary vn-btn-sm">
          <span className="material-icons">add</span> New Order
        </Link>
      </div>
      <div className="vn-card">
        <div className="vn-filters" style={{ padding: '8px 16px' }}>
          <div className="vn-filter-group" style={{ flex: 1 }}>
            <span className="material-icons">search</span>
            <input className="vn-filter-input" placeholder="Search by order or PO number..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%' }} />
          </div>
          <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="validated">Validated</option>
            <option value="assigned">Assigned</option>
            <option value="delivered">Delivered</option>
            <option value="exception">Exception</option>
          </select>
        </div>
        <div className="vn-table-wrap">
          {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" /></div> : (
            <table className="vn-table">
              <thead><tr><th>Order</th><th>PO</th><th>Route</th><th>Service</th><th>Items</th><th>Status</th><th>Delivery</th></tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td><span className="vn-table-id">{o.orderNumber}</span></td>
                    <td style={{ fontSize: 13 }}>{o.poNumber || '-'}</td>
                    <td style={{ fontSize: 13 }}>{o.originCity ? `${o.originCity}, ${o.originState}` : '-'} - {o.destinationCity ? `${o.destinationCity}, ${o.destinationState}` : '-'}</td>
                    <td><span className="vn-chip vn-chip-secondary">{o.serviceLevel || '-'}</span></td>
                    <td style={{ fontSize: 13 }}>{o.lineItemCount} items</td>
                    <td><span className={`vn-chip vn-chip-${statusChip(o.status)}`}>{o.status}</span></td>
                    <td><span className={`vn-chip vn-chip-${statusChip(o.deliveryStatus)}`}>{o.deliveryStatus}</span></td>
                  </tr>
                ))}
                {orders.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--on-surface-variant)' }}>No orders found</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        {total > 0 && <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--on-surface-variant)' }}>{total} total orders</div>}
      </div>
    </div>
  );
}
