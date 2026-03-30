import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface OutboundIntegrationLog {
  id: string;
  integrationId: string;
  shipmentId: string | null;
  shipmentReference: string | null;
  url: string;
  method: string;
  status: 'success' | 'error' | 'pending';
  responseCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  ediPayload: string | null;
  payloadSize: number | null;
  retryCount: number;
  sentAt: string;
  respondedAt: string | null;
  integration: {
    id: string;
    name: string;
    url: string;
  };
  shipment: {
    id: string;
    reference: string;
  } | null;
}

export default function OutboundIntegrationLogs() {
  const [logs, setLogs] = useState<OutboundIntegrationLog[]>([]);
  const [stats, setStats] = useState<{ totals: { total: number; success: number; errors: number; pending: number } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<OutboundIntegrationLog | null>(null);

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/outbound-integration-logs?page=${page}&limit=50`);
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setLogs(result.data || []);
      if (result.pagination) {
        setTotalPages(result.pagination.totalPages);
      }
    } catch (err: any) {
      setError('Failed to load logs');
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/outbound-integration-logs/stats`);
      const result = await response.json();

      if (!result.error && result.data) {
        setStats(result.data);
      }
    } catch (err: any) {
      console.error('Failed to load stats:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      success: 'badge-success',
      error: 'badge-error',
      pending: 'badge-warning'
    };
    return colors[status] || 'badge';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div>
      <h1>Outbound Integration Logs</h1>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-3)' }}>
          <span className="material-icons">error</span>
          {error}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
          <div className="card">
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: 'var(--spacing-1)' }}>
              {stats.totals.total}
            </div>
            <div style={{ color: 'var(--color-grey)', fontSize: '14px' }}>Total Sent</div>
          </div>
          <div className="card">
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-success)', marginBottom: 'var(--spacing-1)' }}>
              {stats.totals.success}
            </div>
            <div style={{ color: 'var(--color-grey)', fontSize: '14px' }}>Successful</div>
          </div>
          <div className="card">
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-error)', marginBottom: 'var(--spacing-1)' }}>
              {stats.totals.errors}
            </div>
            <div style={{ color: 'var(--color-grey)', fontSize: '14px' }}>Errors</div>
          </div>
          <div className="card">
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-warning)', marginBottom: 'var(--spacing-1)' }}>
              {stats.totals.pending}
            </div>
            <div style={{ color: 'var(--color-grey)', fontSize: '14px' }}>Pending</div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      {loading && logs.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <div className="loading-spinner"></div>
            <p>Loading logs...</p>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <span className="material-icons" style={{ fontSize: '48px', color: 'var(--color-grey)', marginBottom: 'var(--spacing-2)' }}>description</span>
            <h3>No Logs Yet</h3>
            <p style={{ color: 'var(--color-grey)' }}>
              Logs will appear here when shipments are created and EDI 856 documents are sent
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Integration</th>
                <th>Shipment</th>
                <th>Status</th>
                <th>Response</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedLog(log)}
                >
                  <td style={{ fontSize: '14px' }}>
                    {formatDate(log.sentAt)}
                  </td>
                  <td>
                    <div style={{ fontSize: '14px' }}>{log.integration.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-grey)' }}>
                      {log.url.length > 40 ? log.url.substring(0, 40) + '...' : log.url}
                    </div>
                  </td>
                  <td>
                    {log.shipmentReference ? (
                      <div style={{ fontSize: '14px' }}>{log.shipmentReference}</div>
                    ) : (
                      <span style={{ color: 'var(--color-grey)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                  <td>
                    {log.responseCode ? (
                      <span style={{ fontSize: '14px', color: log.responseCode < 400 ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {log.responseCode}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-grey)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--color-error)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.errorMessage || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-3)', paddingTop: 'var(--spacing-3)', borderTop: '1px solid var(--color-border)' }}>
              <button
                className="button button-outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 var(--spacing-2)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="button button-outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div
          style={{
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
            padding: 'var(--spacing-3)'
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
              <h2>EDI 856 Log Details</h2>
              <button
                className="button button-outline"
                onClick={() => setSelectedLog(null)}
                style={{ minWidth: 'auto', padding: 'var(--spacing-1)' }}
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>Status</h3>
                <span className={`badge ${getStatusBadge(selectedLog.status)}`}>
                  {selectedLog.status}
                </span>
              </div>

              <div>
                <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>Integration</h3>
                <div style={{ fontSize: '14px' }}>
                  <div><strong>Name:</strong> {selectedLog.integration.name}</div>
                  <div><strong>URL:</strong> {selectedLog.url}</div>
                </div>
              </div>

              {selectedLog.shipmentReference && (
                <div>
                  <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>Shipment</h3>
                  <div style={{ fontSize: '14px' }}>
                    <div><strong>Reference:</strong> {selectedLog.shipmentReference}</div>
                  </div>
                </div>
              )}

              <div>
                <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>Request</h3>
                <div style={{ fontSize: '14px' }}>
                  <div><strong>Time:</strong> {formatDate(selectedLog.sentAt)}</div>
                  <div><strong>Method:</strong> {selectedLog.method}</div>
                  {selectedLog.payloadSize && (
                    <div><strong>Payload Size:</strong> {selectedLog.payloadSize} bytes</div>
                  )}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>Response</h3>
                <div style={{ fontSize: '14px' }}>
                  {selectedLog.responseCode && (
                    <div><strong>Status Code:</strong> {selectedLog.responseCode}</div>
                  )}
                  {selectedLog.respondedAt && (
                    <div><strong>Responded At:</strong> {formatDate(selectedLog.respondedAt)}</div>
                  )}
                  {selectedLog.responseBody && (
                    <div style={{ marginTop: 'var(--spacing-1)' }}>
                      <strong>Response Body:</strong>
                      <pre style={{
                        padding: 'var(--spacing-2)',
                        backgroundColor: 'var(--color-surface)',
                        borderRadius: '4px',
                        overflow: 'auto',
                        fontSize: '12px',
                        maxHeight: '200px',
                        marginTop: 'var(--spacing-1)'
                      }}>
                        {selectedLog.responseBody.substring(0, 2000)}
                        {selectedLog.responseBody.length > 2000 && '... (truncated)'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {selectedLog.errorMessage && (
                <div>
                  <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>Error</h3>
                  <div style={{ padding: 'var(--spacing-2)', backgroundColor: 'var(--color-error-bg)', borderRadius: '4px', color: 'var(--color-error)' }}>
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}

              {selectedLog.ediPayload && (
                <div>
                  <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>EDI 856 Payload</h3>
                  <pre style={{
                    padding: 'var(--spacing-2)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    maxHeight: '400px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}>
                    {selectedLog.ediPayload}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

