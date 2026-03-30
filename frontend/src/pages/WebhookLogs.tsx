import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface WebhookLog {
  id: string;
  method: string;
  path: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  deviceId: string | null;
  eventType: string | null;
  hasLocation: boolean;
  lat: number | null;
  lng: number | null;
  status: 'success' | 'error' | 'skipped' | 'not_found';
  shipmentFound: boolean;
  shipmentUpdated: boolean;
  shipmentId: string | null;
  shipmentReference: string | null;
  shipmentEventId: string | null;
  errorMessage: string | null;
  responseCode: number | null;
  receivedAt: string;
  processedAt: string | null;
  rawPayload: any | null;
  apiKey: {
    id: string;
    name: string;
    keyPrefix: string;
  } | null;
}

interface Stats {
  totals: {
    total: number;
    success: number;
    errors: number;
    skipped: number;
    notFound: number;
    updates: number;
  };
  timeSeries: Array<{
    time: string;
    success: number;
    error: number;
    updates: number;
  }>;
}

interface SimpleChartProps {
  data: Array<{ time: string; success: number; error: number; updates: number }>;
  height?: number;
}

function SimpleLineChart({ data, height = 200 }: SimpleChartProps) {
  if (data.length === 0) return null;

  const padding = 40;
  const chartHeight = height - padding;
  const chartWidth = 600;
  const maxValue = Math.max(
    ...data.map(d => Math.max(d.success, d.error, d.updates)),
    1
  );

  const getX = (index: number) => {
    return padding + (index / (data.length - 1 || 1)) * (chartWidth - padding);
  };

  const getY = (value: number) => {
    return padding + chartHeight - (value / maxValue) * chartHeight;
  };

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
  };

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`} style={{ maxWidth: '100%', overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding + chartHeight - (ratio * chartHeight);
        return (
          <g key={ratio}>
            <line
              x1={padding}
              y1={y}
              x2={chartWidth}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.5"
            />
            <text
              x={padding - 10}
              y={y + 4}
              fontSize="10"
              fill="var(--color-grey)"
              textAnchor="end"
            >
              {Math.round(maxValue * ratio)}
            </text>
          </g>
        );
      })}

      {/* Success line */}
      {data.length > 1 && (
        <polyline
          points={data.map((d, i) => `${getX(i)},${getY(d.success)}`).join(' ')}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="2"
        />
      )}

      {/* Error line */}
      {data.length > 1 && (
        <polyline
          points={data.map((d, i) => `${getX(i)},${getY(d.error)}`).join(' ')}
          fill="none"
          stroke="var(--color-error)"
          strokeWidth="2"
        />
      )}

      {/* Updates line */}
      {data.length > 1 && (
        <polyline
          points={data.map((d, i) => `${getX(i)},${getY(d.updates)}`).join(' ')}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
        />
      )}

      {/* Data points */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={getX(i)} cy={getY(d.success)} r="3" fill="var(--color-success)" />
          <circle cx={getX(i)} cy={getY(d.error)} r="3" fill="var(--color-error)" />
          <circle cx={getX(i)} cy={getY(d.updates)} r="3" fill="var(--color-primary)" />
        </g>
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => {
        if (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) {
          return (
            <text
              key={i}
              x={getX(i)}
              y={height - 10}
              fontSize="10"
              fill="var(--color-grey)"
              textAnchor="middle"
            >
              {formatTime(d.time)}
            </text>
          );
        }
        return null;
      })}

      {/* Legend */}
      <g transform={`translate(${chartWidth - 120}, 20)`}>
        <circle cx="5" cy="5" r="4" fill="var(--color-success)" />
        <text x="12" y="8" fontSize="11" fill="var(--color-text)">Success</text>
        <circle cx="5" cy="20" r="4" fill="var(--color-error)" />
        <text x="12" y="23" fontSize="11" fill="var(--color-text)">Errors</text>
        <circle cx="5" cy="35" r="4" fill="var(--color-primary)" />
        <text x="12" y="38" fontSize="11" fill="var(--color-text)">Updates</text>
      </g>
    </svg>
  );
}

export default function WebhookLogs() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  useEffect(() => {
    loadLogs();
    loadStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/webhook-logs?page=${page}&limit=50`);
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setLogs(result.data || []);
      if (result.pagination) {
        setTotalPages(result.pagination.totalPages);
      }
    } catch (err: any) {
      setError('Failed to load webhook logs');
      console.error('Failed to load webhook logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/webhook-logs/stats?groupBy=hour`);
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
      skipped: 'badge-warning',
      not_found: 'badge-info'
    };
    return colors[status] || 'badge';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div>
      <h1>Webhook Logs</h1>

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
            <div style={{ color: 'var(--color-grey)', fontSize: '14px' }}>Total Webhooks</div>
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
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: 'var(--spacing-1)' }}>
              {stats.totals.updates}
            </div>
            <div style={{ color: 'var(--color-grey)', fontSize: '14px' }}>Shipment Updates</div>
          </div>
        </div>
      )}

      {/* Chart */}
      {stats && stats.timeSeries.length > 0 ? (
        <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
          <h2>Activity Over Time</h2>
          <div style={{ overflowX: 'auto', padding: 'var(--spacing-2)' }}>
            <SimpleLineChart data={stats.timeSeries} />
          </div>
        </div>
      ) : stats && stats.totals.total === 0 ? (
        <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <span className="material-icons" style={{ fontSize: '48px', color: 'var(--color-grey)', marginBottom: 'var(--spacing-2)' }}>show_chart</span>
            <h3>No Webhook Data Yet</h3>
            <p style={{ color: 'var(--color-grey)' }}>
              Webhook activity will appear here once your integrations start sending data
            </p>
          </div>
        </div>
      ) : null}

      {/* Logs Table */}
      {loading && logs.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <div className="loading-spinner"></div>
            <p>Loading webhook logs...</p>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <span className="material-icons" style={{ fontSize: '48px', color: 'var(--color-grey)', marginBottom: 'var(--spacing-2)' }}>webhook</span>
            <h3>No Webhook Logs</h3>
            <p style={{ color: 'var(--color-grey)', marginBottom: 'var(--spacing-3)' }}>
              Webhook requests will be logged here when they are received
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Device</th>
                <th>Status</th>
                <th>Shipment</th>
                <th>Location</th>
                <th>Updated</th>
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
                    {formatDate(log.receivedAt)}
                  </td>
                  <td>
                    {log.deviceName || 'N/A'}
                    {log.apiKey && (
                      <div style={{ fontSize: '12px', color: 'var(--color-grey)' }}>
                        {log.apiKey.name}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                  <td>
                    {log.shipmentFound ? (
                      <div>
                        <div style={{ fontSize: '14px' }}>{log.shipmentReference || 'Found'}</div>
                        {log.shipmentId && (
                          <div style={{ fontSize: '12px', color: 'var(--color-grey)' }}>
                            {log.shipmentId.substring(0, 8)}...
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-grey)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {log.hasLocation ? (
                      <span className="material-icons" style={{ fontSize: '18px', color: 'var(--color-success)' }} title="Location provided">
                        location_on
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-grey)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {log.shipmentUpdated ? (
                      <span className="material-icons" style={{ fontSize: '18px', color: 'var(--color-success)' }} title="Shipment updated">
                        check_circle
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
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
              <h2>Webhook Log Details</h2>
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
                <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>Request Info</h3>
                <div style={{ display: 'grid', gap: 'var(--spacing-1)', fontSize: '14px' }}>
                  <div><strong>Time:</strong> {formatDate(selectedLog.receivedAt)}</div>
                  <div><strong>Method:</strong> {selectedLog.method}</div>
                  <div><strong>IP:</strong> {selectedLog.ipAddress || 'N/A'}</div>
                  {selectedLog.apiKey && (
                    <div><strong>API Key:</strong> {selectedLog.apiKey.name} ({selectedLog.apiKey.keyPrefix}...)</div>
                  )}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>Payload</h3>
                <div style={{ fontSize: '14px' }}>
                  <div><strong>Device:</strong> {selectedLog.deviceName || 'N/A'}</div>
                  <div><strong>Event Type:</strong> {selectedLog.eventType || 'N/A'}</div>
                  <div><strong>Has Location:</strong> {selectedLog.hasLocation ? 'Yes' : 'No'}</div>
                  {selectedLog.lat && selectedLog.lng && (
                    <div><strong>Coordinates:</strong> {selectedLog.lat}, {selectedLog.lng}</div>
                  )}
                </div>
              </div>

              {selectedLog.shipmentFound && (
                <div>
                  <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>Shipment</h3>
                  <div style={{ fontSize: '14px' }}>
                    <div><strong>Reference:</strong> {selectedLog.shipmentReference || 'N/A'}</div>
                    {selectedLog.shipmentId && (
                      <div><strong>ID:</strong> {selectedLog.shipmentId}</div>
                    )}
                    <div><strong>Updated:</strong> {selectedLog.shipmentUpdated ? 'Yes' : 'No'}</div>
                    {selectedLog.shipmentEventId && (
                      <div><strong>Event ID:</strong> {selectedLog.shipmentEventId}</div>
                    )}
                  </div>
                </div>
              )}

              {selectedLog.errorMessage && (
                <div>
                  <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>Error</h3>
                  <div style={{ padding: 'var(--spacing-2)', backgroundColor: 'var(--color-error-bg)', borderRadius: '4px', color: 'var(--color-error)' }}>
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}

              {selectedLog.rawPayload && (
                <div>
                  <h3 style={{ fontSize: '14px', marginBottom: 'var(--spacing-1)' }}>Raw Payload</h3>
                  <pre style={{
                    padding: 'var(--spacing-2)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '12px',
                    maxHeight: '300px'
                  }}>
                    {JSON.stringify(selectedLog.rawPayload, null, 2)}
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
