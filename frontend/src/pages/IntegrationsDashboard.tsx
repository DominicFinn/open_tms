import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface DashboardStats {
  apiKeys: { total: number; active: number };
  webhookLogs: { total: number; recentErrors: number; last24h: number };
  outboundIntegrations: { total: number; active: number; carrier: number; tracking: number };
  outboundLogs: { total: number; recentErrors: number; last24h: number };
  ediPartners: { total: number; active: number };
  ediFiles: { total: number; last24h: number };
}

export default function IntegrationsDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [apiKeysRes, webhookLogsRes, integrationsRes, outboundLogsRes, ediPartnersRes, ediFilesRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/api-keys`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/v1/webhook-logs?limit=500`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/v1/outbound-integrations`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/v1/outbound-integration-logs?limit=500`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/v1/edi-partners`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/v1/edi-files`).then(r => r.json()).catch(() => ({ data: [] })),
      ]);

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const apiKeys = apiKeysRes.data || [];
      const webhookLogs = webhookLogsRes.data || [];
      const integrations = integrationsRes.data || [];
      const outboundLogs = outboundLogsRes.data || [];
      const ediPartners = ediPartnersRes.data || [];
      const ediFiles = ediFilesRes.data || [];

      setStats({
        apiKeys: {
          total: apiKeys.length,
          active: apiKeys.filter((k: any) => k.active).length,
        },
        webhookLogs: {
          total: webhookLogs.length,
          recentErrors: webhookLogs.filter((l: any) => l.status === 'error' && new Date(l.receivedAt) > last24h).length,
          last24h: webhookLogs.filter((l: any) => new Date(l.receivedAt) > last24h).length,
        },
        outboundIntegrations: {
          total: integrations.length,
          active: integrations.filter((i: any) => i.active).length,
          carrier: integrations.filter((i: any) => i.integrationType === 'carrier').length,
          tracking: integrations.filter((i: any) => i.integrationType === 'tracking').length,
        },
        outboundLogs: {
          total: outboundLogs.length,
          recentErrors: outboundLogs.filter((l: any) => l.status === 'error' && new Date(l.sentAt) > last24h).length,
          last24h: outboundLogs.filter((l: any) => new Date(l.sentAt) > last24h).length,
        },
        ediPartners: {
          total: ediPartners.length,
          active: ediPartners.filter((p: any) => p.active).length,
        },
        ediFiles: {
          total: ediFiles.length,
          last24h: ediFiles.filter((f: any) => new Date(f.createdAt) > last24h).length,
        },
      });
    } catch (err) {
      console.error('Failed to load integration stats:', err);
    } finally {
      setLoading(false);
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

  const s = stats!;

  return (
    <div>
      <h1>Integrations</h1>
      <p style={{ color: 'var(--color-grey)', marginBottom: 'var(--spacing-3)' }}>
        Monitor and manage all inbound, outbound, and EDI integrations
      </p>

      {/* Health Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/integrations/api-keys')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-1)' }}>
            <span className="material-icons" style={{ color: 'var(--primary)' }}>vpn_key</span>
            <h3 style={{ margin: 0 }}>API Keys</h3>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '600' }}>{s.apiKeys.active}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-grey)' }}>{s.apiKeys.total} total, {s.apiKeys.active} active</div>
        </div>

        <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/integrations/webhook-logs')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-1)' }}>
            <span className="material-icons" style={{ color: 'var(--primary)' }}>webhook</span>
            <h3 style={{ margin: 0 }}>Webhooks</h3>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '600' }}>{s.webhookLogs.last24h}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-grey)' }}>last 24h</div>
          {s.webhookLogs.recentErrors > 0 && (
            <div style={{ marginTop: '4px' }}>
              <span className="badge badge-error">{s.webhookLogs.recentErrors} errors</span>
            </div>
          )}
        </div>

        <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/integrations/outbound')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-1)' }}>
            <span className="material-icons" style={{ color: 'var(--primary)' }}>send</span>
            <h3 style={{ margin: 0 }}>Outbound</h3>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '600' }}>{s.outboundIntegrations.active}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-grey)' }}>
            {s.outboundIntegrations.carrier} carrier, {s.outboundIntegrations.tracking} tracking
          </div>
          {s.outboundLogs.recentErrors > 0 && (
            <div style={{ marginTop: '4px' }}>
              <span className="badge badge-error">{s.outboundLogs.recentErrors} errors (24h)</span>
            </div>
          )}
        </div>

        <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/integrations/edi-partners')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-1)' }}>
            <span className="material-icons" style={{ color: 'var(--primary)' }}>swap_horiz</span>
            <h3 style={{ margin: 0 }}>EDI</h3>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '600' }}>{s.ediPartners.active}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-grey)' }}>
            {s.ediPartners.total} partners, {s.ediFiles.last24h} files (24h)
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-2)' }}>
          <button className="button button-outline" onClick={() => navigate('/integrations/api-keys')} style={{ justifyContent: 'flex-start', gap: 'var(--spacing-1)' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Create API Key
          </button>
          <button className="button button-outline" onClick={() => navigate('/integrations/outbound')} style={{ justifyContent: 'flex-start', gap: 'var(--spacing-1)' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Add Outbound Integration
          </button>
          <button className="button button-outline" onClick={() => navigate('/integrations/edi-partners')} style={{ justifyContent: 'flex-start', gap: 'var(--spacing-1)' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Add EDI Partner
          </button>
          <button className="button button-outline" onClick={() => navigate('/integrations/webhook-logs')} style={{ justifyContent: 'flex-start', gap: 'var(--spacing-1)' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>visibility</span>
            View Webhook Logs
          </button>
        </div>
      </div>
    </div>
  );
}
