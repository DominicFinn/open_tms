import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../api';

interface PendingLaneRequest {
  id: string;
  orderId: string;
  originId: string;
  destinationId: string;
  serviceLevel: string;
  requiresTemperatureControl: boolean;
  requiresHazmat: boolean;
  status: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  createdLaneId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    customer: {
      id: string;
      name: string;
    };
  };
  origin: {
    id: string;
    name: string;
    city: string;
    state?: string;
    country: string;
  };
  destination: {
    id: string;
    name: string;
    city: string;
    state?: string;
    country: string;
  };
}

export default function PendingLaneRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<PendingLaneRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter === 'all'
        ? `${API_URL}/api/v1/pending-lane-requests`
        : `${API_URL}/api/v1/pending-lane-requests/status/${statusFilter}`;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load pending requests');
      }

      setRequests(result.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!confirm('Approve this lane request? This indicates approval to create the lane.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/pending-lane-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve request');
      }

      alert('Request approved! You can now create the lane.');
      loadRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to approve request');
    }
  };

  const handleReject = async (requestId: string) => {
    const notes = prompt('Reason for rejection (optional):');
    if (notes === null) return; // User cancelled

    try {
      const response = await fetch(`${API_URL}/api/v1/pending-lane-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || undefined })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reject request');
      }

      alert('Request rejected');
      loadRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to reject request');
    }
  };

  const handleCreateLane = (request: PendingLaneRequest) => {
    // Navigate to lane creation with pre-filled data
    const params = new URLSearchParams({
      originId: request.originId,
      destinationId: request.destinationId,
      serviceLevel: request.serviceLevel,
      supportsTemperatureControl: request.requiresTemperatureControl.toString(),
      supportsHazmat: request.requiresHazmat.toString(),
      pendingRequestId: request.id
    });

    navigate(`/lanes/create?${params.toString()}`);
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'var(--color-warning)',
      approved: 'var(--color-success)',
      rejected: 'var(--color-error)',
      lane_created: 'var(--color-info)'
    };

    const color = colors[status] || 'var(--color-grey)';

    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        backgroundColor: `${color}15`,
        color: color,
        textTransform: 'capitalize'
      }}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="card">
        <p>Loading pending lane requests...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h2>Pending Lane Requests</h2>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: 'var(--color-grey)' }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-outline)',
                  fontSize: '14px'
                }}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="lane_created">Lane Created</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>
        </div>

        {error && (
          <div style={{
            padding: 'var(--spacing-2)',
            backgroundColor: 'var(--color-error-container)',
            color: 'var(--color-on-error-container)',
            borderRadius: 'var(--radius-medium)',
            marginBottom: 'var(--spacing-2)'
          }}>
            {error}
          </div>
        )}

        {requests.length === 0 ? (
          <div style={{
            padding: 'var(--spacing-3)',
            textAlign: 'center',
            color: 'var(--color-grey)',
            backgroundColor: 'var(--color-surface-variant)',
            borderRadius: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: '48px', opacity: 0.5 }}>
              check_circle
            </span>
            <p>No {statusFilter !== 'all' && statusFilter} pending lane requests</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Route</th>
                  <th>Requirements</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(request => (
                  <tr key={request.id}>
                    <td>{getStatusBadge(request.status)}</td>
                    <td>
                      <Link to={`/orders/${request.order.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                        {request.order.orderNumber}
                      </Link>
                    </td>
                    <td>{request.order.customer.name}</td>
                    <td>
                      <div style={{ fontSize: '14px' }}>
                        <div style={{ fontWeight: '500' }}>
                          {request.origin.city}, {request.origin.state || request.origin.country}
                        </div>
                        <div style={{ color: 'var(--color-grey)', margin: '4px 0' }}>↓</div>
                        <div style={{ fontWeight: '500' }}>
                          {request.destination.city}, {request.destination.state || request.destination.country}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        <div><strong>{request.serviceLevel}</strong></div>
                        {request.requiresTemperatureControl && (
                          <div style={{ color: 'var(--color-info)' }}>
                            <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle' }}>ac_unit</span>
                            Temp Control
                          </div>
                        )}
                        {request.requiresHazmat && (
                          <div style={{ color: 'var(--color-warning)' }}>
                            <span className="material-icons" style={{ fontSize: '14px', verticalAlign: 'middle' }}>warning</span>
                            Hazmat
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {request.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleCreateLane(request)}
                              className="button button-sm"
                              style={{ fontSize: '12px', padding: '4px 8px' }}
                            >
                              <span className="material-icons" style={{ fontSize: '14px' }}>add</span>
                              Create Lane
                            </button>
                            <button
                              onClick={() => handleApprove(request.id)}
                              className="button button-sm button-outline"
                              style={{ fontSize: '12px', padding: '4px 8px' }}
                            >
                              <span className="material-icons" style={{ fontSize: '14px' }}>check</span>
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(request.id)}
                              className="button button-sm button-outline"
                              style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--color-error)' }}
                            >
                              <span className="material-icons" style={{ fontSize: '14px' }}>close</span>
                              Reject
                            </button>
                          </>
                        )}
                        {request.status === 'approved' && (
                          <button
                            onClick={() => handleCreateLane(request)}
                            className="button button-sm"
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                          >
                            <span className="material-icons" style={{ fontSize: '14px' }}>add</span>
                            Create Lane
                          </button>
                        )}
                        {request.status === 'lane_created' && request.createdLaneId && (
                          <Link
                            to={`/lanes/${request.createdLaneId}/edit`}
                            className="button button-sm button-outline"
                            style={{ fontSize: '12px', padding: '4px 8px', textDecoration: 'none' }}
                          >
                            <span className="material-icons" style={{ fontSize: '14px' }}>visibility</span>
                            View Lane
                          </Link>
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
