import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Clock,
  Gavel,
  Loader2,
  Send,
  TrendingDown,
  Truck,
  Users,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface Bid {
  id: string;
  rate: number;
  currency: string;
  transitDays: number | null;
  equipmentType: string | null;
  notes: string | null;
  status: string;
  sourceType: string;
  submittedAt: string;
  carrier: { id: string; name: string };
}

interface Offer {
  id: string;
  sequence: number;
  status: string;
  sentAt: string | null;
  expiresAt: string | null;
  viewedAt: string | null;
  ediSent: boolean;
  carrier: { id: string; name: string; scacCode: string | null; contactEmail: string | null };
  bids: Bid[];
}

interface Tender {
  id: string;
  reference: string;
  status: string;
  strategy: string;
  tenderDurationMinutes: number;
  targetRate: number | null;
  currency: string;
  equipmentType: string | null;
  notes: string | null;
  specialInstructions: string | null;
  openedAt: string | null;
  closedAt: string | null;
  awardedAt: string | null;
  createdAt: string;
  shipment: {
    id: string;
    reference: string;
    status: string;
    pickupDate: string | null;
    deliveryDate: string | null;
    customer: { id: string; name: string };
    origin: { id: string; name: string; city: string; state: string | null };
    destination: { id: string; name: string; city: string; state: string | null };
  };
  offers: Offer[];
  bids: Bid[];
}

type StatusVariant = 'success' | 'warning' | 'destructive' | 'info' | 'muted' | 'default';

const statusVariants: Record<string, StatusVariant> = {
  draft: 'muted',
  open: 'default',
  evaluating: 'warning',
  awarded: 'success',
  cancelled: 'destructive',
  expired: 'destructive',
  pending: 'muted',
  sent: 'info',
  viewed: 'default',
  submitted: 'info',
  accepted: 'success',
  rejected: 'destructive',
  withdrawn: 'warning',
};

const STAT_TONES = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
  muted: 'bg-muted text-muted-foreground',
} as const;

export default function TenderDetail() {
  const { id } = useParams<{ id: string }>();
  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState<string | null>(null);

  useEffect(() => {
    fetchTender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchTender() {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/v1/tenders/${id}`);
    const json = await res.json();
    setTender(json.data);
    setLoading(false);
  }

  async function handleOpen() {
    setActionLoading(true);
    await fetch(`${API_URL}/api/v1/tenders/${id}/open`, { method: 'POST' });
    await fetchTender();
    setActionLoading(false);
  }

  async function handleCancel() {
    if (!confirm('Cancel this tender? All pending offers will be cancelled.')) return;
    setActionLoading(true);
    await fetch(`${API_URL}/api/v1/tenders/${id}/cancel`, { method: 'POST' });
    await fetchTender();
    setActionLoading(false);
  }

  async function handleAward(bidId: string) {
    setActionLoading(true);
    await fetch(`${API_URL}/api/v1/tenders/${id}/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidId }),
    });
    setShowAwardModal(null);
    await fetchTender();
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!tender) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Tender not found
      </div>
    );
  }

  const lowestBid = tender.bids.length > 0
    ? Math.min(...tender.bids.filter(b => b.status === 'submitted').map(b => b.rate))
    : null;

  const stats = [
    { tone: 'primary' as const, value: tender.targetRate ? `$${tender.targetRate.toLocaleString()}` : '--', label: 'Target Rate', Icon: TrendingDown },
    { tone: 'info' as const, value: tender.offers.length, label: 'Carriers', Icon: Users },
    { tone: 'warning' as const, value: tender.bids.filter(b => b.status === 'submitted').length, label: 'Bids Received', Icon: Gavel },
    {
      tone: 'success' as const,
      value: lowestBid ? `$${lowestBid.toLocaleString()}` : '--',
      label: 'Lowest Bid',
      Icon: TrendingDown,
      valueClass: lowestBid && tender.targetRate && lowestBid <= tender.targetRate ? 'text-success' : undefined,
    },
    { tone: 'muted' as const, value: `${tender.tenderDurationMinutes}m`, label: 'Duration', Icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/tenders" className="text-muted-foreground hover:text-foreground">Tenders</Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-3xl font-bold tracking-tight">{tender.reference}</h1>
            <Badge variant={statusVariants[tender.status]}>{tender.status}</Badge>
            <Badge variant={tender.strategy === 'broadcast' ? 'info' : 'muted'}>{tender.strategy}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link to={`/shipments/${tender.shipment.id}`} className="text-primary hover:underline">
              {tender.shipment.reference}
            </Link>
            {' - '}
            {tender.shipment.origin.city}{tender.shipment.origin.state ? `, ${tender.shipment.origin.state}` : ''}
            {' -> '}
            {tender.shipment.destination.city}{tender.shipment.destination.state ? `, ${tender.shipment.destination.state}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {tender.status === 'draft' && (
            <Button variant="gradient" onClick={handleOpen} disabled={actionLoading}>
              <Send className="h-4 w-4" />
              Open Tender
            </Button>
          )}
          {['draft', 'open', 'evaluating'].includes(tender.status) && (
            <Button variant="destructive" onClick={handleCancel} disabled={actionLoading}>Cancel</Button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat, i) => {
          const Icon = stat.Icon;
          return (
            <Card key={i} className="p-5">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', STAT_TONES[stat.tone])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className={cn('mt-3 text-2xl font-bold tracking-tight', stat.valueClass)}>{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          );
        })}
      </div>

      {/* Tender details */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Tender Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><strong>Customer:</strong> {tender.shipment.customer.name}</div>
            <div><strong>Equipment:</strong> {tender.equipmentType || 'Not specified'}</div>
            <div><strong>Pickup:</strong> {tender.shipment.pickupDate ? new Date(tender.shipment.pickupDate).toLocaleDateString() : 'TBD'}</div>
            <div><strong>Delivery:</strong> {tender.shipment.deliveryDate ? new Date(tender.shipment.deliveryDate).toLocaleDateString() : 'TBD'}</div>
            {tender.notes && <div><strong>Notes:</strong> {tender.notes}</div>}
            {tender.specialInstructions && <div><strong>Instructions:</strong> {tender.specialInstructions}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><strong>Created:</strong> {new Date(tender.createdAt).toLocaleString()}</div>
            {tender.openedAt && <div><strong>Opened:</strong> {new Date(tender.openedAt).toLocaleString()}</div>}
            {tender.awardedAt && <div><strong>Awarded:</strong> {new Date(tender.awardedAt).toLocaleString()}</div>}
            {tender.closedAt && <div><strong>Closed:</strong> {new Date(tender.closedAt).toLocaleString()}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Carrier Offers */}
      <Card>
        <CardHeader><CardTitle className="text-base">Carrier Offers</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {tender.strategy === 'waterfall' && <TableHead>#</TableHead>}
                <TableHead>Carrier</TableHead>
                <TableHead>SCAC</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Viewed</TableHead>
                <TableHead>EDI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tender.offers.map(o => (
                <TableRow key={o.id}>
                  {tender.strategy === 'waterfall' && <TableCell>{o.sequence}</TableCell>}
                  <TableCell className="font-medium">{o.carrier.name}</TableCell>
                  <TableCell>{o.carrier.scacCode || '--'}</TableCell>
                  <TableCell><Badge variant={statusVariants[o.status]}>{o.status}</Badge></TableCell>
                  <TableCell>{o.sentAt ? new Date(o.sentAt).toLocaleString() : '--'}</TableCell>
                  <TableCell>{o.expiresAt ? new Date(o.expiresAt).toLocaleString() : '--'}</TableCell>
                  <TableCell>{o.viewedAt ? new Date(o.viewedAt).toLocaleString() : '--'}</TableCell>
                  <TableCell>{o.ediSent ? <Badge variant="success">Sent</Badge> : '--'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bids */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bids</CardTitle></CardHeader>
        <CardContent className="p-0">
          {tender.bids.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Gavel className="h-8 w-8" />
              <h3 className="text-base font-medium">No bids received yet</h3>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>vs Target</TableHead>
                  <TableHead>Transit</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tender.bids.map(b => {
                  const diff = tender.targetRate ? b.rate - tender.targetRate : null;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.carrier.name}</TableCell>
                      <TableCell className="text-base font-bold">${b.rate.toLocaleString()}</TableCell>
                      <TableCell>
                        {diff !== null && (
                          <span className={cn('font-semibold', diff <= 0 ? 'text-success' : 'text-destructive')}>
                            {diff <= 0 ? '' : '+'}${diff.toLocaleString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{b.transitDays ? `${b.transitDays} days` : '--'}</TableCell>
                      <TableCell>{b.equipmentType || '--'}</TableCell>
                      <TableCell>
                        <Badge variant={b.sourceType === 'edi_990' ? 'info' : 'muted'}>
                          {b.sourceType === 'edi_990' ? 'EDI' : b.sourceType}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant={statusVariants[b.status]}>{b.status}</Badge></TableCell>
                      <TableCell>{new Date(b.submittedAt).toLocaleString()}</TableCell>
                      <TableCell>
                        {b.status === 'submitted' && ['open', 'evaluating'].includes(tender.status) && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setShowAwardModal(b.id)}
                            disabled={actionLoading}
                          >
                            Award
                          </Button>
                        )}
                        {b.status === 'accepted' && (
                          <span className="font-semibold text-success">Winner</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Award confirmation modal */}
      <Dialog open={!!showAwardModal} onOpenChange={open => !open && setShowAwardModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Award Tender</DialogTitle>
          </DialogHeader>
          {showAwardModal && (
            <div className="space-y-3">
              <p>
                Award this tender to <strong>{tender.bids.find(b => b.id === showAwardModal)?.carrier.name}</strong> at{' '}
                <strong>${tender.bids.find(b => b.id === showAwardModal)?.rate.toLocaleString()}</strong>?
              </p>
              <p className="text-sm text-muted-foreground">
                This will assign the carrier to the shipment and reject all other bids.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAwardModal(null)}>Cancel</Button>
            <Button variant="default" onClick={() => showAwardModal && handleAward(showAwardModal)} disabled={actionLoading}>
              Confirm Award
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
