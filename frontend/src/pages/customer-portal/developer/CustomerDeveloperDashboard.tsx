import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../api';
import { customerFetch } from '../CustomerDashboard';

interface Summary {
  apiKeys: { total: number; active: number };
  webhooks: { total: number; enabled: number };
  tradingPartners: number;
  ediTransactionsLast7Days: number;
}

export default function CustomerDeveloperDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerFetch(`${API_URL}/api/v1/customer-portal/developer/summary`)
      .then(r => r.json())
      .then(json => setSummary(json.data))
      .finally(() => setLoading(false));
  }, []);

  const Tile = ({ to, icon, label, primary, secondary, tone }: { to: string; icon: string; label: string; primary: string | number; secondary?: string; tone?: string }) => (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="vn-card" style={{ padding: 16, height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
          <span className="material-icons" style={{ fontSize: 18 }}>{icon}</span>
          {label}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: tone || 'var(--text-primary)' }}>{primary}</div>
        {secondary && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{secondary}</div>}
      </div>
    </Link>
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Developer</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: 24 }}>
        Manage the credentials, webhooks, and EDI configuration that connect your systems to Open TMS.
      </p>

      {loading ? <div className="vn-loading-spinner" /> : summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <Tile
            to="/customer-portal/developer/api-keys"
            icon="vpn_key"
            label="API Keys"
            primary={summary.apiKeys.active}
            secondary={`${summary.apiKeys.total} total`}
          />
          <Tile
            to="/customer-portal/developer/webhooks"
            icon="webhook"
            label="Webhooks"
            primary={summary.webhooks.enabled}
            secondary={`${summary.webhooks.total} configured`}
          />
          <Tile
            to="/customer-portal/developer/edi"
            icon="settings_ethernet"
            label="Trading Partners"
            primary={summary.tradingPartners}
            secondary="EDI endpoints linked to your account"
          />
          <Tile
            to="/customer-portal/developer/logs"
            icon="history"
            label="EDI Activity (7d)"
            primary={summary.ediTransactionsLast7Days}
            secondary="transactions across all partners"
          />
        </div>
      )}

      <div className="vn-card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px' }}>Quick start</h3>
        <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li>Create an <Link to="/customer-portal/developer/api-keys">API key</Link> so your systems can authenticate.</li>
          <li>Subscribe to <Link to="/customer-portal/developer/webhooks">webhooks</Link> to receive real-time updates when your orders, shipments, and returns change state.</li>
          <li>Review your <Link to="/customer-portal/developer/edi">EDI trading partner</Link> setup if you exchange X12 documents with us.</li>
          <li>Monitor integration health from the <Link to="/customer-portal/developer/logs">activity log</Link>.</li>
        </ol>
      </div>

      <div className="vn-card" style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 8px' }}>Signing &amp; security</h3>
        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li>API keys are displayed once at creation. Store them in a secure vault - they cannot be retrieved later.</li>
          <li>Webhook payloads are signed with HMAC-SHA256. Every delivery includes <code>X-OpenTms-Signature: t=&lt;unix_seconds&gt;,v1=&lt;hex_hmac&gt;</code>. Verify by computing HMAC-SHA256 of <code>`${'{'}t{'}'}.${'{'}raw_body{'}'}`</code> with the webhook secret.</li>
          <li>Rotate a webhook secret any time from the webhook detail view - old signatures stop validating immediately.</li>
        </ul>
      </div>
    </div>
  );
}
