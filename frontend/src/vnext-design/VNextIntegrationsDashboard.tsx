import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface QueueStats {
  name: string;
  queued: number;
  active: number;
  deadLetter: number;
}

export default function VNextIntegrationsDashboard() {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [ediPartners, setEdiPartners] = useState<any[]>([]);
  const [queues, setQueues] = useState<QueueStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [keysRes, tpRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/api-keys`),
        fetch(`${API_URL}/api/v1/trading-partners`),
      ]);

      if (!keysRes.ok || !tpRes.ok) {
        setError('Failed to load some integration data');
      }

      const keysData = keysRes.ok ? await keysRes.json() : { data: [] };
      const tpData = tpRes.ok ? await tpRes.json() : { data: [] };

      setApiKeys(keysData.data || []);
      setIntegrations(tpData.data?.filter((p: any) => p.outboundEnabled) || []);
      setEdiPartners(tpData.data?.filter((p: any) => p.inboundEnabled) || []);

      // Optionally try queue stats
      try {
        const qRes = await fetch(`${API_URL}/api/v1/queues/stats`);
        if (qRes.ok) {
          const qData = await qRes.json();
          setQueues(qData.data || []);
        }
      } catch {
        // Queue stats endpoint may not exist — that's fine
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const activeKeys = apiKeys.filter((k: any) => k.active !== false).length;
  const activeIntegrations = integrations.filter((i: any) => i.active !== false).length;
  const totalQueueDepth = queues.reduce((sum, q) => sum + (q.queued || 0), 0);
  const totalDeadLetter = queues.reduce((sum, q) => sum + (q.deadLetter || 0), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Integrations</h1>
          <p>Monitor and manage all integration channels</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">extension</span>
          </div>
          <div>
            <div className="vn-stat-value">{activeIntegrations}</div>
            <div className="vn-stat-label">Active Integrations</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">vpn_key</span>
          </div>
          <div>
            <div className="vn-stat-value">{apiKeys.length}</div>
            <div className="vn-stat-label">API Keys</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning">
            <span className="material-icons">queue</span>
          </div>
          <div>
            <div className="vn-stat-value">{totalQueueDepth}</div>
            <div className="vn-stat-label">Queue Depth</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error">
            <span className="material-icons">error</span>
          </div>
          <div>
            <div className="vn-stat-value">{totalDeadLetter}</div>
            <div className="vn-stat-label">Failed</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">swap_horiz</span>
          </div>
          <div>
            <div className="vn-stat-value">{ediPartners.length}</div>
            <div className="vn-stat-label">EDI Partners</div>
          </div>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="vn-grid-2">
        {/* Queue Status */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Queue Status</h2>
          </div>
          <div className="vn-card-body" style={{ padding: 0 }}>
            {queues.length === 0 ? (
              <div className="vn-empty">
                <span className="material-icons">queue</span>
                <h3>No queue data available</h3>
                <p>Queue statistics are not currently available.</p>
              </div>
            ) : (
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr>
                      <th>Queue Name</th>
                      <th style={{ textAlign: 'right' }}>Queued</th>
                      <th style={{ textAlign: 'right' }}>Active</th>
                      <th style={{ textAlign: 'right' }}>Dead Letter</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queues.map(q => (
                      <tr key={q.name}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{q.name}</td>
                        <td style={{ textAlign: 'right' }}>{q.queued}</td>
                        <td style={{ textAlign: 'right' }}>{q.active}</td>
                        <td style={{ textAlign: 'right', color: q.deadLetter > 0 ? 'var(--error)' : undefined, fontWeight: q.deadLetter > 0 ? 600 : undefined }}>
                          {q.deadLetter}
                        </td>
                        <td>
                          <button className="vn-btn vn-btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}>
                            <span className="material-icons" style={{ fontSize: 14 }}>replay</span>
                            Retry
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="vn-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {integrations.length === 0 && apiKeys.length === 0 && ediPartners.length === 0 ? (
                <div style={{ fontSize: 14, color: 'var(--on-surface-variant)', textAlign: 'center', padding: '24px 0' }}>
                  No recent activity to display.
                </div>
              ) : (
                <>
                  {apiKeys.slice(0, 3).map((k: any) => (
                    <div key={`key-${k.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span className="material-icons" style={{ fontSize: 20, color: 'var(--info)', marginTop: 2 }}>vpn_key</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: 'var(--on-surface)' }}>API key &apos;{k.name}&apos; {k.active !== false ? 'active' : 'inactive'}</div>
                        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Created {new Date(k.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                  {integrations.slice(0, 3).map((i: any) => (
                    <div key={`int-${i.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span className="material-icons" style={{ fontSize: 20, color: i.active !== false ? 'var(--success)' : 'var(--error)', marginTop: 2 }}>
                        {i.active !== false ? 'check_circle' : 'error'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: 'var(--on-surface)' }}>{i.name} — {i.active !== false ? 'active' : 'inactive'}</div>
                        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{i.type || 'Integration'}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="vn-card" style={{ marginTop: '16px' }}>
        <div className="vn-card-header">
          <h2>Quick Actions</h2>
        </div>
        <div className="vn-card-body">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link to="/integrations/api-keys" className="vn-btn vn-btn-outline">
              <span className="material-icons">vpn_key</span>
              Manage API Keys
            </Link>
            <Link to="/integrations/outbound" className="vn-btn vn-btn-outline">
              <span className="material-icons">send</span>
              Outbound Integrations
            </Link>
            <Link to="/integrations/webhook-logs" className="vn-btn vn-btn-outline">
              <span className="material-icons">list_alt</span>
              Webhook Logs
            </Link>
            <Link to="/integrations/edi/partners" className="vn-btn vn-btn-outline">
              <span className="material-icons">swap_horiz</span>
              EDI Partners
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
