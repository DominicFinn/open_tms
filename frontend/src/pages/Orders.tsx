import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface OrderLineItem {
  id: string;
  sku: string;
  description?: string;
  quantity: number;
  weight?: number;
  hazmat: boolean;
}

interface TrackableUnit {
  id: string;
  identifier: string;
  unitType: string;
  customTypeName?: string;
  sequenceNumber: number;
  lineItems: OrderLineItem[];
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
  serviceLevel: string;
  temperatureControl: string;
  requiresHazmat: boolean;
  trackableUnits: TrackableUnit[];
  lineItems: OrderLineItem[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CompatibilityCheck {
  compatible: boolean;
  warnings: string[];
  errors: string[];
  orders: {
    id: string;
    orderNumber: string;
    customerId: string;
    customerName: string;
    originName: string;
    destinationName: string;
    serviceLevel: string;
    temperatureControl: string;
    requiresHazmat: boolean;
    status: string;
  }[];
}

const statusChipClass: { [key: string]: string } = {
  pending: 'chip chip-warning',
  validated: 'chip chip-success',
  location_error: 'chip chip-error',
  converted: 'chip chip-info',
  assigned: 'chip chip-success',
  cancelled: 'chip chip-primary',
  archived: 'chip chip-primary'
};

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = React.useState<Order[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [sourceFilter, setSourceFilter] = React.useState('all');

  // Multi-select state
  const [selectedOrderIds, setSelectedOrderIds] = React.useState<Set<string>>(new Set());
  const [showConversionWizard, setShowConversionWizard] = React.useState(false);
  const [compatibility, setCompatibility] = React.useState<CompatibilityCheck | null>(null);
  const [conversionMode, setConversionMode] = React.useState<'combine' | 'individual'>('combine');
  const [wizardLoading, setWizardLoading] = React.useState(false);
  const [wizardError, setWizardError] = React.useState<string | null>(null);

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

  const getStatusChip = (status: string) => (
    <span className={statusChipClass[status] || 'chip chip-primary'}>
      {status.replace(/_/g, ' ')}
    </span>
  );

  const getLocationDisplay = (location?: any, locationData?: any, validated?: boolean) => {
    if (location) {
      return `${location.name} (${location.city}, ${location.state || location.country})`;
    }
    if (locationData && !validated) {
      return (
        <span style={{ color: 'var(--warning)' }}>
          <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle' }}>warning</span>
          {' '}Not validated
        </span>
      );
    }
    return <span className="text-muted">Not specified</span>;
  };

  // Multi-select helpers
  const selectableOrders = filteredOrders.filter(
    o => o.status !== 'converted' && o.status !== 'assigned' && o.status !== 'archived' && o.status !== 'cancelled'
  );

  const toggleSelect = (id: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === selectableOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(selectableOrders.map(o => o.id)));
    }
  };

  const openConversionWizard = async () => {
    if (selectedOrderIds.size === 0) return;

    setShowConversionWizard(true);
    setWizardError(null);
    setCompatibility(null);
    setWizardLoading(true);
    setConversionMode(selectedOrderIds.size > 1 ? 'combine' : 'individual');

    try {
      const response = await fetch(API_URL + '/api/v1/orders/check-compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: Array.from(selectedOrderIds) })
      });
      const result = await response.json();
      if (!response.ok) {
        setWizardError(result.error || 'Failed to check compatibility');
      } else {
        setCompatibility(result.data);
      }
    } catch (err: any) {
      setWizardError(err.message || 'Failed to check compatibility');
    } finally {
      setWizardLoading(false);
    }
  };

  const handleBatchConvert = async () => {
    setWizardLoading(true);
    setWizardError(null);

    try {
      const response = await fetch(API_URL + '/api/v1/orders/batch-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selectedOrderIds),
          mode: conversionMode
        })
      });
      const result = await response.json();

      if (!response.ok) {
        setWizardError(result.error || 'Failed to convert orders');
        return;
      }

      const data = result.data;

      if (data.success && data.shipmentIds.length === 1) {
        setShowConversionWizard(false);
        setSelectedOrderIds(new Set());
        navigate(`/shipments/${data.shipmentIds[0]}`);
      } else if (data.shipmentIds.length > 0) {
        setShowConversionWizard(false);
        setSelectedOrderIds(new Set());
        alert(data.message);
        loadOrders();
      } else {
        setWizardError(data.message || 'Conversion failed');
      }
    } catch (err: any) {
      setWizardError(err.message || 'Failed to convert orders');
    } finally {
      setWizardLoading(false);
    }
  };

  const closeWizard = () => {
    setShowConversionWizard(false);
    setCompatibility(null);
    setWizardError(null);
  };

  return (
    <div>
      <div className="card">
        <div className="page-header">
          <h2>Orders</h2>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
            {selectedOrderIds.size > 0 && (
              <button
                onClick={openConversionWizard}
                className="button button-primary"
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>local_shipping</span>
                Convert {selectedOrderIds.size} Order{selectedOrderIds.size > 1 ? 's' : ''} to Shipment
              </button>
            )}
            <Link to="/orders/create" className="button">
              <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
              Create Order
            </Link>
            <Link to="/orders/import/csv" className="button button-outline">
              <span className="material-icons" style={{ fontSize: '18px' }}>upload_file</span>
              Import CSV
            </Link>
            <Link to="/orders/import/edi" className="button button-outline">
              <span className="material-icons" style={{ fontSize: '18px' }}>swap_horiz</span>
              Import EDI
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
              <option value="assigned">Assigned</option>
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
            <div className="loading-spinner" style={{ margin: '0 auto var(--spacing-1)' }}></div>
            <p className="text-muted">Loading orders...</p>
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
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectableOrders.length > 0 && selectedOrderIds.size === selectableOrders.length}
                      onChange={toggleSelectAll}
                      title="Select all convertible orders"
                    />
                  </th>
                  <th>Order Number</th>
                  <th>Customer</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Units / Items</th>
                  <th>Order Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const isSelectable = order.status !== 'converted' && order.status !== 'assigned' && order.status !== 'archived' && order.status !== 'cancelled';
                  const isSelected = selectedOrderIds.has(order.id);
                  return (
                    <tr key={order.id} style={isSelected ? { backgroundColor: 'var(--primary-container)' } : undefined}>
                      <td>
                        {isSelectable ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(order.id)}
                          />
                        ) : (
                          <span className="text-muted" style={{ fontSize: '12px' }}>--</span>
                        )}
                      </td>
                      <td>
                        <Link to={`/orders/${order.id}`} style={{ fontWeight: '500' }}>
                          {order.orderNumber}
                        </Link>
                        {order.poNumber && (
                          <div className="text-sm text-muted">
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
                      <td>{getStatusChip(order.status)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{order.importSource}</td>
                      <td style={{ textAlign: 'center' }}>
                        {order.trackableUnits.length > 0 ? (
                          <div>
                            <div style={{ fontWeight: '500' }}>
                              {order.trackableUnits.length} {order.trackableUnits.length === 1 ? 'unit' : 'units'}
                            </div>
                            <div className="text-sm text-muted">
                              {order.trackableUnits.reduce((total, unit) => total + unit.lineItems.length, 0)} items
                            </div>
                          </div>
                        ) : order.lineItems.length > 0 ? (
                          <span>{order.lineItems.length} items (legacy)</span>
                        ) : (
                          <span className="text-muted">--</span>
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
                                className="button button-sm button-danger"
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
                            >
                              <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Conversion Wizard Modal */}
      {showConversionWizard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--overlay-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--spacing-2)'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--border-radius-md, 12px)',
            padding: 'var(--spacing-3)',
            maxWidth: '720px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: 'var(--modal-shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
              <h2 style={{ margin: 0 }}>
                <span className="material-icons" style={{ verticalAlign: 'middle', marginRight: '8px' }}>local_shipping</span>
                Convert Orders to Shipment
              </h2>
              <button onClick={closeWizard} className="button button-sm button-outline">
                <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {wizardLoading && !compatibility && (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
                <div className="loading-spinner" style={{ margin: '0 auto var(--spacing-1)' }}></div>
                <p className="text-muted">Checking order compatibility...</p>
              </div>
            )}

            {wizardError && (
              <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>
                <span className="material-icons">error</span>
                {wizardError}
              </div>
            )}

            {compatibility && (
              <>
                {/* Selected Orders Summary */}
                <div style={{ marginBottom: 'var(--spacing-2)' }}>
                  <h3 style={{ marginBottom: 'var(--spacing-1)' }}>
                    Selected Orders ({compatibility.orders.length})
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Customer</th>
                          <th>Origin</th>
                          <th>Destination</th>
                          <th>Service</th>
                          <th>Temp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compatibility.orders.map(o => (
                          <tr key={o.id}>
                            <td style={{ fontWeight: '500' }}>{o.orderNumber}</td>
                            <td>{o.customerName}</td>
                            <td style={{ fontSize: '13px' }}>{o.originName}</td>
                            <td style={{ fontSize: '13px' }}>{o.destinationName}</td>
                            <td><span className="chip chip-primary">{o.serviceLevel}</span></td>
                            <td style={{ textTransform: 'capitalize' }}>{o.temperatureControl}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Warnings */}
                {compatibility.warnings.length > 0 && (
                  <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-2)' }}>
                    <span className="material-icons">warning</span>
                    <div>
                      <strong>Warnings</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                        {compatibility.warnings.map((w, i) => (
                          <li key={i} style={{ fontSize: '13px' }}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Errors */}
                {compatibility.errors.length > 0 && (
                  <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>
                    <span className="material-icons">error</span>
                    <div>
                      <strong>Cannot Combine</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                        {compatibility.errors.map((e, i) => (
                          <li key={i} style={{ fontSize: '13px' }}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Conversion Mode Selection */}
                {selectedOrderIds.size > 1 && (
                  <div style={{ marginBottom: 'var(--spacing-2)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-1)' }}>Conversion Mode</h3>
                    <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: 'var(--spacing-1) var(--spacing-2)',
                        border: `2px solid ${conversionMode === 'combine' ? 'var(--color-primary)' : 'var(--outline-variant)'}`,
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: compatibility.compatible ? 'pointer' : 'not-allowed',
                        opacity: compatibility.compatible ? 1 : 0.5,
                        flex: 1,
                        backgroundColor: conversionMode === 'combine' ? 'var(--primary-container)' : 'transparent'
                      }}>
                        <input
                          type="radio"
                          name="conversionMode"
                          value="combine"
                          checked={conversionMode === 'combine'}
                          onChange={() => setConversionMode('combine')}
                          disabled={!compatibility.compatible}
                        />
                        <div>
                          <div style={{ fontWeight: '500' }}>
                            <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle' }}>merge</span>
                            {' '}Combine into 1 Shipment
                          </div>
                          <div className="text-sm text-muted">Batch all selected orders into a single shipment</div>
                        </div>
                      </label>

                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: 'var(--spacing-1) var(--spacing-2)',
                        border: `2px solid ${conversionMode === 'individual' ? 'var(--color-primary)' : 'var(--outline-variant)'}`,
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: 'pointer',
                        flex: 1,
                        backgroundColor: conversionMode === 'individual' ? 'var(--primary-container)' : 'transparent'
                      }}>
                        <input
                          type="radio"
                          name="conversionMode"
                          value="individual"
                          checked={conversionMode === 'individual'}
                          onChange={() => setConversionMode('individual')}
                        />
                        <div>
                          <div style={{ fontWeight: '500' }}>
                            <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle' }}>call_split</span>
                            {' '}Convert Individually
                          </div>
                          <div className="text-sm text-muted">Create a separate shipment for each order</div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end', marginTop: 'var(--spacing-2)', borderTop: '1px solid var(--outline-variant)', paddingTop: 'var(--spacing-2)' }}>
                  <button onClick={closeWizard} className="button button-outline">
                    Cancel
                  </button>
                  <button
                    onClick={handleBatchConvert}
                    className="button button-primary"
                    disabled={wizardLoading || (conversionMode === 'combine' && !compatibility.compatible)}
                  >
                    {wizardLoading ? (
                      <>
                        <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                        Converting...
                      </>
                    ) : (
                      <>
                        <span className="material-icons" style={{ fontSize: '18px' }}>local_shipping</span>
                        {conversionMode === 'combine'
                          ? `Combine into 1 Shipment`
                          : `Create ${selectedOrderIds.size} Shipment${selectedOrderIds.size > 1 ? 's' : ''}`
                        }
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
