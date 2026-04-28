import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, KeyRound, Loader2, Network, Webhook } from 'lucide-react';

import { API_URL } from '../../../api';
import { customerFetch } from '../CustomerDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Summary {
  apiKeys: { total: number; active: number };
  webhooks: { total: number; enabled: number };
  tradingPartners: number;
  ediTransactionsLast7Days: number;
}

interface TileProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary: string | number;
  secondary?: string;
}

function Tile({ to, icon: Icon, label, primary, secondary }: TileProps) {
  return (
    <Link to={to} className="block">
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Icon className="h-4 w-4" />
            {label}
          </div>
          <div className="text-3xl font-bold tracking-tight">{primary}</div>
          {secondary && <div className="mt-1 text-xs text-muted-foreground">{secondary}</div>}
        </CardContent>
      </Card>
    </Link>
  );
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Developer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the credentials, webhooks, and EDI configuration that connect your systems to Open TMS.
        </p>
      </div>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            to="/customer-portal/developer/api-keys"
            icon={KeyRound}
            label="API Keys"
            primary={summary.apiKeys.active}
            secondary={`${summary.apiKeys.total} total`}
          />
          <Tile
            to="/customer-portal/developer/webhooks"
            icon={Webhook}
            label="Webhooks"
            primary={summary.webhooks.enabled}
            secondary={`${summary.webhooks.total} configured`}
          />
          <Tile
            to="/customer-portal/developer/edi"
            icon={Network}
            label="Trading partners"
            primary={summary.tradingPartners}
            secondary="EDI endpoints linked to your account"
          />
          <Tile
            to="/customer-portal/developer/logs"
            icon={History}
            label="EDI activity (7d)"
            primary={summary.ediTransactionsLast7Days}
            secondary="transactions across all partners"
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Create an{' '}
              <Link to="/customer-portal/developer/api-keys" className="text-primary hover:underline">API key</Link>{' '}
              so your systems can authenticate.
            </li>
            <li>
              Subscribe to{' '}
              <Link to="/customer-portal/developer/webhooks" className="text-primary hover:underline">webhooks</Link>{' '}
              to receive real-time updates when your orders, shipments, and returns change state.
            </li>
            <li>
              Review your{' '}
              <Link to="/customer-portal/developer/edi" className="text-primary hover:underline">EDI trading partner</Link>{' '}
              setup if you exchange X12 documents with us.
            </li>
            <li>
              Monitor integration health from the{' '}
              <Link to="/customer-portal/developer/logs" className="text-primary hover:underline">activity log</Link>.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signing &amp; security</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>API keys are displayed once at creation. Store them in a secure vault - they cannot be retrieved later.</li>
            <li>
              Webhook payloads are signed with HMAC-SHA256. Every delivery includes{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">X-OpenTms-Signature: t=&lt;unix_seconds&gt;,v1=&lt;hex_hmac&gt;</code>.
              Verify by computing HMAC-SHA256 of{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{'`${t}.${raw_body}`'}</code>{' '}
              with the webhook secret.
            </li>
            <li>Rotate a webhook secret any time from the webhook detail view - old signatures stop validating immediately.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
