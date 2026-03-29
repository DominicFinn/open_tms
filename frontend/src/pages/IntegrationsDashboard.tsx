import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface QueueStats {
  name: string;
  queued: number;
  active: number;
  deferred: number;
  failed: number;
  total: number;
  deadLetterQueue?: string;
}

interface ActivityBucket {
  hour: string;
  outboundSuccess: number;
  outboundError: number;
  inboundSuccess: number;
  inboundError: number;
}

interface IntegrationCounts {
  apiKeys: { total: number; active: number };
  outbound: { total: number; active: number; carrier: number; tracking: number };
  ediPartners: { total: number; active: number };
}

export default function IntegrationsDashboard() {
  const [queueStats, setQueueStats] = useState<QueueStats[]>([]);
  const [activity, setActivity] = useState<ActivityBucket[]>([]);
  const [counts, setCounts] = useState<IntegrationCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(24);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const [statsRes, activityRes, apiKeysRes, integrationsRes, ediRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/queues/stats`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/v1/queues/activity?hours=${timeRange}`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/v1/api-keys`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/v1/outbound-integrations`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/v1/edi-partners`).then(r => r.json()).catch(() => ({ data: [] })),
      ]);

      setQueueStats(statsRes.data || []);
      setActivity(activityRes.data || []);

      const apiKeys = apiKeysRes.data || [];
      const integrations = integrationsRes.data || [];
      const ediPartners = ediRes.data || [];

      setCounts({
        apiKeys: { total: apiKeys.length, active: apiKeys.filter((k: any) => k.active).length },
        outbound: {
          total: integrations.length,
          active: integrations.filter((i: any) => i.active).length,
          carrier: integrations.filter((i: any) => i.integrationType === 'carrier').length,
          tracking: integrations.filter((i: any) => i.integrationType === 'tracking').length,
        },
        ediPartners: { total: ediPartners.length, active: ediPartners.filter((p: any) => p.active).length },
      });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRetryFailed = async (queueName: string) => {
    setActionLoading(queueName + '-retry');
    try {
      const res = await fetch(`${API_URL}/api/v1/queues/${queueName}/retry-failed`, { method: 'POST' });
      const result = await res.json();
      if (result.data) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to retry:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurgeDlq = async (queueName: string) => {
    if (!confirm(`Purge all failed jobs from ${queueName}? This cannot be undone.`)) return;
    setActionLoading(queueName + '-purge');
    try {
      await fetch(`${API_URL}/api/v1/queues/${queueName}/purge-dlq`, { method: 'POST' });
      await loadData();
    } catch (err) {
      console.error('Failed to purge:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div>
        <h1>Integrations</h1>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
          <div className="loading-spinner"></div>
          <p>Loading integration health...</p>
        </div>
      </div>
    );
  }

  const totalFailed = queueStats.reduce((sum, q) => sum + q.failed, 0);
  const totalActive = queueStats.reduce((sum, q) => sum + q.active, 0);
  const totalQueued = queueStats.reduce((sum, q) => sum + q.queued, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
        <div>
          <h1 style={{ marginBottom: '4px' }}>Integrations</h1>
          <p style={{ color: 'var(--color-grey)', margin: 0 }}>
            Data flow monitoring and integration health
          </p>
        </div>
        <button className="button button-outline" onClick={loadData} style={{ gap: '4px' }}>
          <span className="material-icons" style={{ fontSize: '18px' }}>refresh</span>
          Refresh
        </button>
      </div>

      {/* Queue Health Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <span className="material-icons" style={{ fontSize: '32px', color: totalQueued > 0 ? 'var(--color-warning)' : 'var(--color-grey)' }}>schedule</span>
          <div style={{ fontSize: '28px', fontWeight: '600' }}>{totalQueued}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-grey)' }}>Queued</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <span className="material-icons" style={{ fontSize: '32px', color: totalActive > 0 ? 'var(--primary)' : 'var(--color-grey)' }}>sync</span>
          <div style={{ fontSize: '28px', fontWeight: '600' }}>{totalActive}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-grey)' }}>Processing</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <span className="material-icons" style={{ fontSize: '32px', color: totalFailed > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
            {totalFailed > 0 ? 'error' : 'check_circle'}
          </span>
          <div style={{ fontSize: '28px', fontWeight: '600', color: totalFailed > 0 ? 'var(--color-error)' : undefined }}>{totalFailed}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-grey)' }}>Dead Letter</div>
        </div>
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/integrations/outbound')}>
          <span className="material-icons" style={{ fontSize: '32px', color: 'var(--primary)' }}>send</span>
          <div style={{ fontSize: '28px', fontWeight: '600' }}>{counts?.outbound.active || 0}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-grey)' }}>Active Integrations</div>
        </div>
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/integrations/api-keys')}>
          <span className="material-icons" style={{ fontSize: '32px', color: 'var(--primary)' }}>vpn_key</span>
          <div style={{ fontSize: '28px', fontWeight: '600' }}>{counts?.apiKeys.active || 0}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-grey)' }}>API Keys</div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h2 style={{ margin: 0 }}>Data Flow Activity</h2>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
            {[24, 48, 72, 168].map(h => (
              <button
                key={h}
                className={`button ${timeRange === h ? '' : 'button-outline'}`}
                style={{ minWidth: 'auto', padding: '4px 12px', fontSize: '12px' }}
                onClick={() => setTimeRange(h)}
              >
                {h <= 48 ? `${h}h` : `${h / 24}d`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-2)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#4CAF50' }}></div>
            Outbound OK
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#f44336' }}></div>
            Outbound Error
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#2196F3' }}></div>
            Inbound OK
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#FF9800' }}></div>
            Inbound Error
          </div>
        </div>

        {activity.length > 0 ? (
          <ActivityChart data={activity} />
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)', color: 'var(--color-grey)' }}>
            <span className="material-icons" style={{ fontSize: '48px', marginBottom: '8px' }}>show_chart</span>
            <p>No activity data yet. Events will appear here as integrations process data.</p>
          </div>
        )}
      </div>

      {/* Queue Details */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2>Queue Status</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Queue</th>
              <th>Queued</th>
              <th>Active</th>
              <th>Deferred</th>
              <th>Dead Letter</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {queueStats.map(q => (
              <tr key={q.name}>
                <td>
                  <div style={{ fontWeight: '500' }}>{formatQueueName(q.name)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-grey)', fontFamily: 'monospace' }}>{q.name}</div>
                </td>
                <td>
                  <span className={q.queued > 0 ? 'badge badge-warning' : ''}>
                    {q.queued}
                  </span>
                </td>
                <td>
                  <span className={q.active > 0 ? 'badge badge-info' : ''}>
                    {q.active}
                  </span>
                </td>
                <td>{q.deferred}</td>
                <td>
                  {q.failed > 0 ? (
                    <span className="badge badge-error">{q.failed} poisoned</span>
                  ) : (
                    <span style={{ color: 'var(--color-grey)' }}>0</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {q.failed > 0 && (
                      <>
                        <button
                          className="button button-outline"
                          style={{ minWidth: 'auto', padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleRetryFailed(q.name)}
                          disabled={actionLoading === q.name + '-retry'}
                          title="Retry all failed jobs"
                        >
                          <span className="material-icons" style={{ fontSize: '14px' }}>replay</span>
                          {actionLoading === q.name + '-retry' ? '...' : 'Retry'}
                        </button>
                        <button
                          className="button button-outline"
                          style={{ minWidth: 'auto', padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handlePurgeDlq(q.name)}
                          disabled={actionLoading === q.name + '-purge'}
                          title="Purge dead letter queue"
                        >
                          <span className="material-icons" style={{ fontSize: '14px', color: 'var(--color-error)' }}>delete_sweep</span>
                          {actionLoading === q.name + '-purge' ? '...' : 'Purge'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {queueStats.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-grey)' }}>
                  Queue monitoring unavailable — queue may not be started
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Navigation */}
      <div className="card">
        <h2>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-2)' }}>
          <button className="button button-outline" onClick={() => navigate('/integrations/api-keys')} style={{ justifyContent: 'flex-start', gap: '8px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>vpn_key</span>
            Manage API Keys
          </button>
          <button className="button button-outline" onClick={() => navigate('/integrations/outbound')} style={{ justifyContent: 'flex-start', gap: '8px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>send</span>
            Outbound Integrations
          </button>
          <button className="button button-outline" onClick={() => navigate('/integrations/webhook-logs')} style={{ justifyContent: 'flex-start', gap: '8px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>webhook</span>
            Webhook Logs
          </button>
          <button className="button button-outline" onClick={() => navigate('/integrations/edi-partners')} style={{ justifyContent: 'flex-start', gap: '8px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>swap_horiz</span>
            EDI Partners
          </button>
        </div>
      </div>
    </div>
  );
}

function formatQueueName(name: string): string {
  const map: Record<string, string> = {
    'outbound.carrier': 'Outbound Carrier',
    'outbound.tracking': 'Outbound Tracking',
    'inbound.webhook': 'Inbound Webhook',
  };
  return map[name] || name;
}

function ActivityChart({ data }: { data: ActivityBucket[] }) {
  if (data.length === 0) return null;

  const maxVal = Math.max(
    1,
    ...data.map(d => d.outboundSuccess + d.outboundError + d.inboundSuccess + d.inboundError)
  );

  const width = 900;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const barWidth = Math.max(2, Math.min(12, (chartW / data.length) - 1));
  const barGap = Math.max(1, (chartW - barWidth * data.length) / data.length);

  // Y-axis grid lines
  const yTicks = 5;
  const yStep = maxVal / yTicks;

  // Totals for the summary line
  const totalOutbound = data.reduce((s, d) => s + d.outboundSuccess + d.outboundError, 0);
  const totalInbound = data.reduce((s, d) => s + d.inboundSuccess + d.inboundError, 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-1)' }}>
        <div style={{ fontSize: '13px' }}>
          <strong>{totalOutbound}</strong> <span style={{ color: 'var(--color-grey)' }}>outbound</span>
        </div>
        <div style={{ fontSize: '13px' }}>
          <strong>{totalInbound}</strong> <span style={{ color: 'var(--color-grey)' }}>inbound</span>
        </div>
        <div style={{ fontSize: '13px' }}>
          <strong>{totalOutbound + totalInbound}</strong> <span style={{ color: 'var(--color-grey)' }}>total events</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        {/* Y-axis grid */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = padding.top + chartH - (i * chartH / yTicks);
          const val = Math.round(i * yStep);
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                stroke="var(--color-border)" strokeDasharray="3,3" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end"
                fill="var(--color-grey)" fontSize="10">{val}</text>
            </g>
          );
        })}

        {/* Stacked bars */}
        {data.map((d, i) => {
          const x = padding.left + i * (barWidth + barGap);
          const total = d.outboundSuccess + d.outboundError + d.inboundSuccess + d.inboundError;
          const segments = [
            { value: d.outboundSuccess, color: '#4CAF50' },
            { value: d.outboundError, color: '#f44336' },
            { value: d.inboundSuccess, color: '#2196F3' },
            { value: d.inboundError, color: '#FF9800' },
          ];

          let yOffset = 0;
          return (
            <g key={i}>
              {segments.map((seg, si) => {
                if (seg.value === 0) return null;
                const segH = (seg.value / maxVal) * chartH;
                const y = padding.top + chartH - yOffset - segH;
                yOffset += segH;
                return (
                  <rect key={si} x={x} y={y} width={barWidth} height={segH}
                    fill={seg.color} rx={1}>
                    <title>{`${d.hour}: ${seg.value}`}</title>
                  </rect>
                );
              })}
              {/* X-axis labels (every few bars) */}
              {(i % Math.max(1, Math.floor(data.length / 12))) === 0 && (
                <text x={x + barWidth / 2} y={height - 8} textAnchor="middle"
                  fill="var(--color-grey)" fontSize="9"
                  transform={`rotate(-45, ${x + barWidth / 2}, ${height - 8})`}>
                  {formatHour(d.hour)}
                </text>
              )}
            </g>
          );
        })}

        {/* Axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartH}
          stroke="var(--color-border)" />
        <line x1={padding.left} y1={padding.top + chartH} x2={width - padding.right} y2={padding.top + chartH}
          stroke="var(--color-border)" />
      </svg>
    </div>
  );
}

function formatHour(isoHour: string): string {
  try {
    const d = new Date(isoHour + ':00:00Z');
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString([], { hour: '2-digit' });
  } catch {
    return isoHour;
  }
}
