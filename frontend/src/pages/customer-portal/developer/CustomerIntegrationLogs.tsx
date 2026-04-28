import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../../api';
import { customerFetch } from '../CustomerDashboard';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface EdiLog {
  id: string;
  transactionType: string;
  direction: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
  controlNumber: string | null;
  partner: { name: string } | null;
}

type StatusVariant = 'success' | 'destructive' | 'warning';

function statusVariant(s: string): StatusVariant {
  if (s === 'processed' || s === 'delivered') return 'success';
  if (s === 'failed') return 'destructive';
  return 'warning';
}

export default function CustomerIntegrationLogs() {
  const [logs, setLogs] = useState<EdiLog[]>([]);
  const [total, setTotal] = useState(0);
  const [direction, setDirection] = useState('all');
  const [txType, setTxType] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (direction !== 'all') params.set('direction', direction);
    if (txType !== 'all') params.set('transactionType', txType);
    params.set('limit', '100');
    customerFetch(`${API_URL}/api/v1/customer-portal/developer/edi-logs?${params}`)
      .then(r => r.json())
      .then(json => {
        setLogs(json.data?.logs || []);
        setTotal(json.data?.total || 0);
      })
      .finally(() => setLoading(false));
  }, [direction, txType]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integration logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every EDI transaction exchanged with your trading partners. {total} in total.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All directions</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
          <Select value={txType} onValueChange={setTxType}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All transaction types</SelectItem>
              <SelectItem value="850">850 - Purchase Order</SelectItem>
              <SelectItem value="855">855 - PO Ack</SelectItem>
              <SelectItem value="856">856 - ASN</SelectItem>
              <SelectItem value="810">810 - Invoice</SelectItem>
              <SelectItem value="820">820 - Payment</SelectItem>
              <SelectItem value="210">210 - Freight Invoice</SelectItem>
              <SelectItem value="204">204 - Load Tender</SelectItem>
              <SelectItem value="990">990 - Tender Response</SelectItem>
              <SelectItem value="214">214 - Shipment Status</SelectItem>
              <SelectItem value="180">180 - RMA</SelectItem>
              <SelectItem value="997">997 - Functional Ack</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Control #</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Processed</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No EDI transactions yet for your account.
                </TableCell>
              </TableRow>
            )}
            {logs.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-sm">{l.partner?.name ?? '-'}</TableCell>
                <TableCell className="font-semibold">{l.transactionType}</TableCell>
                <TableCell className="text-sm">{l.direction}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1 text-xs">{l.controlNumber ?? '-'}</code>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(l.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {l.processedAt ? new Date(l.processedAt).toLocaleString() : '-'}
                </TableCell>
                <TableCell className="max-w-xs truncate text-xs">{l.errorMessage}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
