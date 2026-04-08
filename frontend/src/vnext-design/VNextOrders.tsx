import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ORDERS = [
  { id: 'ORD-7051', customer: 'Acme Corp', origin: 'Chicago, IL', dest: 'Dallas, TX', commodity: 'General Merchandise', weight: '42,000 lbs', pieces: 24, mode: 'FTL', status: 'Ready to Ship', statusColor: 'success', created: 'Apr 7', reqDelivery: 'Apr 10', value: '$18,400' },
  { id: 'ORD-7050', customer: 'Global Widgets', origin: 'Los Angeles, CA', dest: 'Phoenix, AZ', commodity: 'Electronics', weight: '12,500 lbs', pieces: 8, mode: 'LTL', status: 'Pending Approval', statusColor: 'warning', created: 'Apr 7', reqDelivery: 'Apr 11', value: '$42,000' },
  { id: 'ORD-7049', customer: 'TechStart Inc', origin: 'Atlanta, GA', dest: 'Miami, FL', commodity: 'Server Equipment', weight: '38,200 lbs', pieces: 16, mode: 'FTL', status: 'Shipped', statusColor: 'info', created: 'Apr 6', reqDelivery: 'Apr 9', value: '$95,000' },
  { id: 'ORD-7048', customer: 'FreshFoods LLC', origin: 'New York, NY', dest: 'Boston, MA', commodity: 'Perishable Goods', weight: '28,000 lbs', pieces: 32, mode: 'Reefer', status: 'Ready to Ship', statusColor: 'success', created: 'Apr 6', reqDelivery: 'Apr 8', value: '$8,200' },
  { id: 'ORD-7047', customer: 'Industrial Co', origin: 'Denver, CO', dest: 'Salt Lake City, UT', commodity: 'Steel Beams', weight: '55,000 lbs', pieces: 6, mode: 'Flatbed', status: 'Draft', statusColor: 'secondary', created: 'Apr 6', reqDelivery: 'Apr 12', value: '$33,500' },
  { id: 'ORD-7046', customer: 'RetailMax', origin: 'Houston, TX', dest: 'San Antonio, TX', commodity: 'Consumer Goods', weight: '33,500 lbs', pieces: 40, mode: 'FTL', status: 'Shipped', statusColor: 'info', created: 'Apr 5', reqDelivery: 'Apr 7', value: '$12,800' },
  { id: 'ORD-7045', customer: 'BioPharm Inc', origin: 'Minneapolis, MN', dest: 'Milwaukee, WI', commodity: 'Pharmaceuticals', weight: '15,000 lbs', pieces: 12, mode: 'Reefer', status: 'Delivered', statusColor: 'success', created: 'Apr 4', reqDelivery: 'Apr 6', value: '$125,000' },
  { id: 'ORD-7044', customer: 'AutoParts Plus', origin: 'Detroit, MI', dest: 'Columbus, OH', commodity: 'Auto Parts', weight: '44,000 lbs', pieces: 50, mode: 'FTL', status: 'Cancelled', statusColor: 'error', created: 'Apr 4', reqDelivery: 'Apr 7', value: '$22,400' },
];

export default function VNextOrders() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  const filtered = ORDERS.filter(o => {
    if (statusFilter !== 'all') {
      const map: Record<string, string> = { ready: 'Ready to Ship', pending: 'Pending Approval', shipped: 'Shipped', draft: 'Draft', delivered: 'Delivered', cancelled: 'Cancelled' };
      if (o.status !== map[statusFilter]) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.origin.toLowerCase().includes(q) || o.dest.toLowerCase().includes(q) || o.commodity.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Orders</h1>
          <p>{ORDERS.length} orders this week</p>
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
            <div className="vn-stat-value">{ORDERS.filter(o => o.status === 'Ready to Ship').length}</div>
            <div className="vn-stat-label">Ready to Ship</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">hourglass_empty</span></div>
          <div>
            <div className="vn-stat-value">{ORDERS.filter(o => o.status === 'Pending Approval').length}</div>
            <div className="vn-stat-label">Pending Approval</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">local_shipping</span></div>
          <div>
            <div className="vn-stat-value">{ORDERS.filter(o => o.status === 'Shipped').length}</div>
            <div className="vn-stat-label">Shipped</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">payments</span></div>
          <div>
            <div className="vn-stat-value">$357K</div>
            <div className="vn-stat-label">Total Value</div>
            <div className="vn-stat-change up"><span className="material-icons">trending_up</span>+18% vs last week</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="vn-tabs" style={{ marginBottom: 16 }}>
        {[
          { key: 'all', label: 'All Orders', count: ORDERS.length },
          { key: 'ready', label: 'Ready to Ship', count: ORDERS.filter(o => o.status === 'Ready to Ship').length },
          { key: 'pending', label: 'Pending', count: ORDERS.filter(o => o.status === 'Pending Approval').length },
          { key: 'shipped', label: 'Shipped', count: ORDERS.filter(o => o.status === 'Shipped').length },
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
          <select className="vn-filter-select">
            <option>All Customers</option>
            <option>Acme Corp</option>
            <option>Global Widgets</option>
            <option>TechStart Inc</option>
            <option>FreshFoods LLC</option>
          </select>
        </div>

        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Commodity</th>
                <th>Mode</th>
                <th>Weight / Pieces</th>
                <th>Req. Delivery</th>
                <th>Value</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td>
                    <span className="vn-table-id">{o.id}</span>
                    <div className="vn-table-secondary">Created {o.created}</div>
                  </td>
                  <td>{o.customer}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="vn-route-dot origin" style={{ width: 8, height: 8 }} />
                      <span style={{ fontSize: 13 }}>{o.origin}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span className="vn-route-dot destination" style={{ width: 8, height: 8 }} />
                      <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{o.dest}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{o.commodity}</td>
                  <td><span className="vn-chip vn-chip-secondary">{o.mode}</span></td>
                  <td>
                    <div style={{ fontSize: 13 }}>{o.weight}</div>
                    <div className="vn-table-secondary">{o.pieces} pieces</div>
                  </td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{o.reqDelivery}</td>
                  <td style={{ fontSize: 14, fontWeight: 600 }}>{o.value}</td>
                  <td><span className={`vn-chip vn-chip-${o.statusColor}`}>{o.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {o.status === 'Ready to Ship' && (
                        <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={() => navigate('/carrier-bidding')}>
                          <span className="material-icons">local_shipping</span>
                          Ship
                        </button>
                      )}
                      {o.status === 'Pending Approval' && (
                        <button className="vn-btn vn-btn-success vn-btn-sm">
                          <span className="material-icons">check</span>
                          Approve
                        </button>
                      )}
                      <button className="vn-btn-icon"><span className="material-icons" style={{ fontSize: 18 }}>more_vert</span></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
