import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../../api';
import { customerFetch } from '../CustomerDashboard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PartnerTransaction {
  id: string;
  transactionType: string;
  direction: string;
  enabled: boolean;
  autoProcess: boolean;
  ack997Required: boolean;
}

interface TradingPartner {
  id: string;
  name: string;
  active: boolean;
  entityType: string;
  senderId: string | null;
  receiverId: string | null;
  ediVersion: string;
  sftpHost: string | null;
  sftpPort: number;
  sftpUsername: string | null;
  sftpPassword: string | null;
  sftpPrivateKey: string | null;
  httpUrl: string | null;
  httpAuthType: string | null;
  httpAuthHeader: string | null;
  httpAuthValue: string | null;
  inboundEnabled: boolean;
  inboundDir: string;
  outboundEnabled: boolean;
  outboundDir: string | null;
  outboundTransport: string;
  transactions: PartnerTransaction[];
}

export default function CustomerEdiSetup() {
  const [partners, setPartners] = useState<TradingPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerFetch(`${API_URL}/api/v1/customer-portal/developer/trading-partners`)
      .then(r => r.json())
      .then(json => setPartners(json.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">EDI setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your trading partner configuration for EDI file exchange. This view is read-only - contact support to change connection settings.
        </p>
      </div>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : partners.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No trading partner is configured for your account. If you exchange EDI documents with us, reach out to have a partner provisioned.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {partners.map(p => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{p.name}</CardTitle>
                <Badge variant={p.active ? 'success' : 'secondary'}>{p.active ? 'Active' : 'Inactive'}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div><strong>Entity type:</strong> {p.entityType}</div>
                  <div><strong>EDI version:</strong> {p.ediVersion}</div>
                  <div>
                    <strong>Sender ID (ISA06):</strong>{' '}
                    <code className="rounded bg-muted px-1">{p.senderId ?? '-'}</code>
                  </div>
                  <div>
                    <strong>Receiver ID (ISA08):</strong>{' '}
                    <code className="rounded bg-muted px-1">{p.receiverId ?? '-'}</code>
                  </div>
                </div>

                {(p.sftpHost || p.sftpUsername) && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <div className="mb-2 font-semibold">SFTP</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div><strong>Host:</strong> {p.sftpHost ?? '-'}</div>
                      <div><strong>Port:</strong> {p.sftpPort}</div>
                      <div><strong>Username:</strong> {p.sftpUsername ?? '-'}</div>
                      <div><strong>Credential:</strong> {p.sftpPassword || p.sftpPrivateKey ? 'Configured' : 'None'}</div>
                    </div>
                  </div>
                )}

                {p.httpUrl && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <div className="mb-2 font-semibold">HTTP</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <strong>URL:</strong>{' '}
                        <code className="rounded bg-muted px-1">{p.httpUrl}</code>
                      </div>
                      <div><strong>Auth type:</strong> {p.httpAuthType ?? 'none'}</div>
                      <div><strong>Auth header:</strong> {p.httpAuthHeader ?? '-'}</div>
                    </div>
                  </div>
                )}

                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <div className="mb-2 font-semibold">File exchange</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><strong>Inbound:</strong> {p.inboundEnabled ? 'Enabled' : 'Disabled'}</div>
                    <div>
                      <strong>Inbound dir:</strong>{' '}
                      <code className="rounded bg-muted px-1">{p.inboundDir}</code>
                    </div>
                    <div><strong>Outbound:</strong> {p.outboundEnabled ? 'Enabled' : 'Disabled'}</div>
                    <div><strong>Outbound transport:</strong> {p.outboundTransport}</div>
                    <div className="sm:col-span-2">
                      <strong>Outbound dir:</strong>{' '}
                      <code className="rounded bg-muted px-1">{p.outboundDir ?? '-'}</code>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-semibold">Supported transactions</div>
                  {p.transactions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">None configured</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Direction</TableHead>
                          <TableHead>Enabled</TableHead>
                          <TableHead>Auto-process</TableHead>
                          <TableHead>Requires 997</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.transactions.map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="font-semibold">{t.transactionType}</TableCell>
                            <TableCell>{t.direction}</TableCell>
                            <TableCell>{t.enabled ? 'Yes' : 'No'}</TableCell>
                            <TableCell>{t.autoProcess ? 'Yes' : 'No'}</TableCell>
                            <TableCell>{t.ack997Required ? 'Yes' : 'No'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
