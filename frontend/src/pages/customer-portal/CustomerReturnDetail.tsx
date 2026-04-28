import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';

import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';
import { Button } from '@/components/ui/button';
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

interface RmaLine {
  id: string;
  sku: string;
  requestedQuantity: number;
  receivedQuantity: number;
  requestedDisposition: string | null;
  disposition: string;
  inspectionStatus: string;
  inspectionNotes: string | null;
  refundAmountCents: number;
}

interface RmaDetail {
  id: string;
  rmaNumber: string;
  orderId: string;
  status: string;
  returnReason: string;
  customerNotes: string | null;
  rejectionNotes: string | null;
  requestedAt: string;
  authorizedAt: string | null;
  receivedAt: string | null;
  completedAt: string | null;
  suggestedRefundCents: number;
  actualRefundCents: number | null;
  returnTrackingNumber: string | null;
  returnLabelStorageKey: string | null;
  returnLabelFormat: string | null;
  returnLabelProvider: string | null;
  returnServiceLevel: string | null;
  returnPickupScheduledAt: string | null;
  returnPickupWindow: string | null;
  returnPickupConfirmationNumber: string | null;
  returnPickupCancelledAt: string | null;
  lines: RmaLine[];
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    requested: 'info',
    authorized: 'default',
    in_transit: 'info',
    received: 'warning',
    inspecting: 'warning',
    dispositioning: 'warning',
    completed: 'success',
    rejected: 'destructive',
    pass: 'success',
    fail: 'destructive',
    restock: 'success',
    scrap: 'destructive',
  };
  return m[s] || 'secondary';
}

function fmt(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function statusExplain(s: string): string {
  const m: Record<string, string> = {
    requested: 'Your return request is with our team for review.',
    authorized: 'Your return has been approved. Ship the items back using the label we will provide.',
    in_transit: 'We are waiting for your return to arrive at our warehouse.',
    received: 'We have received your return. It is in quarantine pending inspection.',
    inspecting: 'Our team is inspecting the returned items.',
    dispositioning: 'Inspection complete. Your refund is being processed by finance.',
    completed: 'This return is complete and your refund has been issued.',
    rejected: 'We were unable to approve this return. See notes below.',
  };
  return m[s] || '';
}

export default function CustomerReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const [rma, setRma] = useState<RmaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    customerFetch(`${API_URL}/api/v1/customer-portal/rmas/${id}`)
      .then(r => r.json())
      .then(json => { if (json.error) setError(json.error); else setRma(json.data); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (error || !rma) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error || 'Return not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/customer-portal/returns">Back</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{rma.rmaNumber}</h1>
        <Badge variant={statusVariant(rma.status)}>{fmt(rma.status)}</Badge>
      </div>

      <div className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
        {statusExplain(rma.status)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-8 p-6">
          <div>
            <div className="text-xs text-muted-foreground">Reason</div>
            <div className="font-semibold">{fmt(rma.returnReason)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Estimated refund</div>
            <div className="text-xl font-bold">${(rma.suggestedRefundCents / 100).toFixed(2)}</div>
          </div>
          {rma.actualRefundCents != null && (
            <div>
              <div className="text-xs text-muted-foreground">Final refund</div>
              <div className="text-xl font-bold text-success">${(rma.actualRefundCents / 100).toFixed(2)}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground">Requested</div>
            <div>{new Date(rma.requestedAt).toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>

      {(rma.returnLabelStorageKey || rma.returnPickupScheduledAt) && (
        <Card>
          <CardHeader>
            <CardTitle>Return shipping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rma.returnLabelStorageKey && (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="gradient" size="sm" asChild>
                  <a
                    href={`${API_URL}/api/v1/customer-portal/rmas/${rma.id}/return-label`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="h-4 w-4" />
                    Download return label
                  </a>
                </Button>
                {rma.returnTrackingNumber && (
                  <span className="text-sm">
                    Tracking: <strong>{rma.returnTrackingNumber}</strong>
                    {rma.returnLabelProvider && <> &middot; via {rma.returnLabelProvider.toUpperCase()}</>}
                    {rma.returnServiceLevel && <> &middot; {fmt(rma.returnServiceLevel)}</>}
                  </span>
                )}
              </div>
            )}
            {rma.returnPickupScheduledAt && (
              <div className="border-t border-border pt-3 text-sm">
                <strong>Pickup scheduled:</strong> {new Date(rma.returnPickupScheduledAt).toLocaleString()}
                {rma.returnPickupWindow && <> (window {rma.returnPickupWindow})</>}
                {rma.returnPickupConfirmationNumber && <> &middot; confirmation {rma.returnPickupConfirmationNumber}</>}
                {rma.returnPickupCancelledAt && (
                  <span className="ml-3 text-destructive">
                    Cancelled {new Date(rma.returnPickupCancelledAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {rma.rejectionNotes && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <strong>Why this was rejected:</strong> {rma.rejectionNotes}
        </div>
      )}

      {rma.customerNotes && (
        <Card>
          <CardHeader>
            <CardTitle>Your notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">{rma.customerNotes}</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Requested qty</TableHead>
                <TableHead>Received qty</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Refund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rma.lines.map(line => (
                <TableRow key={line.id}>
                  <TableCell className="font-semibold">{line.sku}</TableCell>
                  <TableCell>{line.requestedQuantity}</TableCell>
                  <TableCell>{line.receivedQuantity}</TableCell>
                  <TableCell>
                    {line.disposition === 'pending'
                      ? <Badge variant="secondary">Pending</Badge>
                      : <Badge variant={statusVariant(line.disposition)}>{fmt(line.disposition)}</Badge>}
                  </TableCell>
                  <TableCell>${(line.refundAmountCents / 100).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
