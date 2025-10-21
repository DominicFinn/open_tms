import React from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface OrderLineItem {
  id: string;
  sku: string;
  description?: string;
  quantity: number;
  weight?: number;
  hazmat: boolean;
}

interface Order {
  id: string;
  orderNumber: string;
  poNumber?: string;
  status: string;
  importSource: string;
  customer: {
    id: string;
    name: string;
  };
  origin?: {
    id: string;
    name: string;
    city: string;
    state?: string;
    country: string;
  };
  destination?: {
    id: string;
    name: string;
    city: string;
    state?: string;
    country: string;
  };
  originData?: any;
  destinationData?: any;
  originValidated: boolean;
  destinationValidated: boolean;
  orderDate: string;
  requestedPickupDate?: string;
  requestedDeliveryDate?: string;
  lineItems: OrderLineItem[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

const statusColors: { [key: string]: string } = {
  pending: 'var(--color-warning)',
  validated: 'var(--color-success)',
  location_error: 'var(--color-error)',
  converted: 'var(--color-info)',
  cancelled: 'var(--color-grey)',
  archived: 'var(--color-grey)'
};

export default function Orders() {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = React.useState<Order[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [sourceFilter, setSourceFilter] = React.useState('all');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL + '/api/v1/orders');
      const result = await response.json();
      setOrders(result.data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadOrders();
  }, []);

  // Filter orders
  React.useEffect(() => {
    let filtered = orders;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.poNumber && order.poNumber.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(order => order.importSource === sourceFilter);
    }

    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter, sourceFilter]);

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || sourceFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSourceFilter('all');
  };

  const deleteOrder = async (id: string) => {
    setLoading(true);
    try {
      await fetch(API_URL + `/api/v1/orders/${id}`, {
        method: 'DELETE'
      });
      await loadOrders();
    } catch (error) {
      console.error('Failed to delete order:', error);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const color = statusColors[status] || 'var(--color-grey)';
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500',
          backgroundColor: `${color}15`,
          color: color,
          textTransform: 'capitalize'
        }}
      >
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getLocationDisplay = (location?: any, locationData?: any, validated?: boolean) => {
    if (location) {
      return `${location.name} (${location.city}, ${location.state || location.country})`;
    }
    if (locationData && !validated) {
      return (
        <span style={{ color: 'var(--color-warning)' }}>
          <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle' }}>warning</span>
          {' '}Not validated
        </span>
      );
    }
    return <span style={{ color: 'var(--color-grey)' }}>Not specified</span>;
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h2>Orders</h2>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
            <Link to="/orders/create" className="button">
              <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
              Create Order
            </Link>
            <Link to="/orders/import/csv" className="button button-outline">
              <span className="material-icons" style={{ fontSize: '18px' }}>upload_file</span>
              Import CSV
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-1)',
          marginBottom: 'var(--spacing-2)'
        }}>
          <div className="input-wrapper">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
            />
            <label>Search</label>
          </div>

          <div className="input-wrapper">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="validated">Validated</option>
              <option value="location_error">Location Error</option>
              <option value="converted">Converted</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <label>Status</label>
          </div>

          <div className="input-wrapper">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Sources</option>
              <option value="manual">Manual</option>
              <option value="csv">CSV</option>
              <option value="edi">EDI</option>
            </select>
            <label>Source</label>
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="button button-outline" style={{ height: 'fit-content', alignSelf: 'end' }}>
              Clear Filters
            </button>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <div className="loading-spinner"></div>
            <p>Loading orders...</p>
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <p>No orders found. Create your first order to get started.</p>
            <Link to="/orders/create" className="button" style={{ marginTop: 'var(--spacing-2)' }}>
              Create Order
            </Link>
          </div>
        )}

        {!loading && filteredOrders.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Customer</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Line Items</th>
                  <th>Order Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/orders/${order.id}`} style={{ fontWeight: '500', color: 'var(--color-primary)' }}>
                        {order.orderNumber}
                      </Link>
                      {order.poNumber && (
                        <div style={{ fontSize: '12px', color: 'var(--color-grey)' }}>
                          PO: {order.poNumber}
                        </div>
                      )}
                    </td>
                    <td>{order.customer.name}</td>
                    <td style={{ fontSize: '14px' }}>
                      {getLocationDisplay(order.origin, order.originData, order.originValidated)}
                    </td>
                    <td style={{ fontSize: '14px' }}>
                      {getLocationDisplay(order.destination, order.destinationData, order.destinationValidated)}
                    </td>
                    <td>{getStatusBadge(order.status)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{order.importSource}</td>
                    <td style={{ textAlign: 'center' }}>
                      {order.lineItems.length > 0 ? (
                        <span>{order.lineItems.length} items</span>
                      ) : (
                        <span style={{ color: 'var(--color-grey)' }}>—</span>
                      )}
                    </td>
                    <td>{new Date(order.orderDate).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link
                          to={`/orders/${order.id}`}
                          className="button button-sm button-outline"
                          title="View Details"
                        >
                          <span className="material-icons" style={{ fontSize: '16px' }}>visibility</span>
                        </Link>
                        {showDeleteConfirm === order.id ? (
                          <>
                            <button
                              onClick={() => deleteOrder(order.id)}
                              className="button button-sm"
                              style={{ backgroundColor: 'var(--color-error)', color: 'white' }}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="button button-sm button-outline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(order.id)}
                            className="button button-sm button-outline"
                            title="Archive Order"
                            style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                          >
                            <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
