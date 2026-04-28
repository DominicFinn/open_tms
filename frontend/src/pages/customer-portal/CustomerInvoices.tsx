import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string; invoiceNumber: string; customerName: string;
  totalCents: number; paidCents: number; balanceCents: number;
  status: string; daysPastDue: number; dueDate: string;
  issueDate: string; createdAt: string;
}

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary';

function statusVariant(s: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    draft: 'secondary',
    sent: 'info',
    partial_paid: 'warning',
    overdue: 'destructive',
    paid: 'success',
    voided: 'secondary',
  };
  return m[s] || 'secondary';
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CustomerInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputing, setDisputing] = useState(false);

  const load = () => {
    setLoading(true);
    customerFetch(`${API_URL}/api/v1/customer-portal/invoices`)
      .then(r => r.json())
      .then(json => setInvoices(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDispute = async () => {
    if (!disputeId || !disputeReason.trim()) return;
    setDisputing(true);
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/invoices/${disputeId}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ reason: disputeReason }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      alert(`Dispute submitted: ${json.data.queryNumber}`);
      setDisputeId(null);
      setDisputeReason('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDisputing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
      <Card>
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Issue date</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm font-semibold">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(inv.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell className={cn('text-sm', inv.daysPastDue > 0 && 'text-destructive')}>
                    {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {inv.daysPastDue > 0 ? ` (${inv.daysPastDue}d overdue)` : ''}
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatCents(inv.totalCents)}</TableCell>
                  <TableCell className="text-right text-sm">{formatCents(inv.paidCents)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{formatCents(inv.balanceCents)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {['sent', 'overdue'].includes(inv.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setDisputeId(inv.id); setDisputeReason(''); }}
                      >
                        Dispute
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No invoices
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!disputeId} onOpenChange={open => !open && setDisputeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dispute-reason">Reason for dispute</Label>
            <textarea
              id="dispute-reason"
              className={TEXTAREA_CLASS}
              rows={4}
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              placeholder="Describe the issue with this invoice..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeId(null)}>Cancel</Button>
            <Button variant="gradient" onClick={handleDispute} disabled={disputing || !disputeReason.trim()}>
              {disputing ? 'Submitting...' : 'Submit dispute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
