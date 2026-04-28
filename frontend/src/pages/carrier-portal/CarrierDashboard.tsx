import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gavel, Inbox, Loader2, Receipt, ReceiptText, Trophy } from 'lucide-react';

import { API_URL } from '../../api';
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
import { cn } from '@/lib/utils';

function getCarrierToken() {
  return localStorage.getItem('carrier_token') || '';
}

function getCarrierUser() {
  try {
    return JSON.parse(localStorage.getItem('carrier_user') || '{}');
  } catch { return {}; }
}

function carrierFetch(url: string, opts?: RequestInit) {
  return fetch(url, {
    ...opts,
    headers: {
      ...opts?.headers,
      Authorization: `Bearer ${getCarrierToken()}`,
      'Content-Type': 'application/json',
    },
  });
}

interface TenderOffer {
  id: string;
  status: string;
  expiresAt: string | null;
  tender: {
    id: string;
    reference: string;
    status: string;
    targetRate: number | null;
    equipmentType: string | null;
    tenderDurationMinutes: number;
    shipment: {
      reference: string;
      pickupDate: string | null;
      deliveryDate: string | null;
      origin: { city: string; state: string | null };
      destination: { city: string; state: string | null };
    };
  };
}

interface Bid {
  id: string;
  rate: number;
  status: string;
  submittedAt: string;
  tender: { id: string; reference: string; status: string };
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary';

function bidStatusVariant(s: string): StatusVariant {
  if (s === 'accepted') return 'success';
  if (s === 'rejected') return 'destructive';
  return 'info';
}

const STAT_TONES = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
} as const;

export default function CarrierDashboard() {
  const [offers, setOffers] = useState<TenderOffer[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = getCarrierUser();

  useEffect(() => {
    if (!getCarrierToken()) {
      navigate('/carrier-portal/login');
      return;
    }
    Promise.all([
      carrierFetch(`${API_URL}/api/v1/carrier-portal/tenders`).then(r => r.json()),
      carrierFetch(`${API_URL}/api/v1/carrier-portal/bids`).then(r => r.json()),
    ]).then(([offersRes, bidsRes]) => {
      setOffers(offersRes.data || []);
      setBids(bidsRes.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  const activeOffers = offers.filter(o => ['sent', 'viewed'].includes(o.status));
  const submittedBids = bids.filter(b => b.status === 'submitted');
  const wonBids = bids.filter(b => b.status === 'accepted');

  const stats = [
    { tone: 'primary' as const, icon: Gavel, label: 'Active tenders', value: activeOffers.length },
    { tone: 'warning' as const, icon: Receipt, label: 'Pending bids', value: submittedBids.length },
    { tone: 'success' as const, icon: Trophy, label: 'Loads won', value: wonBids.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {user.name || 'Carrier'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.carrierName}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-6">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', STAT_TONES[s.tone])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-3xl font-bold tracking-tight">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            Active tenders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeOffers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <h3 className="text-base font-medium">No active tenders at this time</h3>
            </div>
          ) : (
            <div className="grid gap-3">
              {activeOffers.map(offer => {
                const t = offer.tender;
                const timeLeft = offer.expiresAt
                  ? Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 60000))
                  : null;
                return (
                  <div
                    key={offer.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4"
                  >
                    <div>
                      <div className="font-semibold">{t.reference}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {t.shipment.origin.city}{t.shipment.origin.state ? `, ${t.shipment.origin.state}` : ''}
                        {' -> '}
                        {t.shipment.destination.city}{t.shipment.destination.state ? `, ${t.shipment.destination.state}` : ''}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t.equipmentType || 'No equipment specified'}
                        {t.targetRate ? ` | Target: $${t.targetRate.toLocaleString()}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {timeLeft !== null && (
                        <div
                          className={cn(
                            'text-sm font-semibold',
                            timeLeft < 30 ? 'text-destructive' : 'text-muted-foreground',
                          )}
                        >
                          {timeLeft > 60 ? `${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m` : `${timeLeft}m`} left
                        </div>
                      )}
                      <Button variant="gradient" size="sm" asChild>
                        <Link to={`/carrier-portal/tenders/${t.id}`}>View &amp; bid</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-warning" />
            Recent bids
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {bids.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <ReceiptText className="h-8 w-8" />
              <h3 className="text-base font-medium">No bids submitted yet</h3>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tender</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids.slice(0, 10).map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-semibold">{b.tender.reference}</TableCell>
                    <TableCell className="font-bold">${b.rate.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={bidStatusVariant(b.status)}>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(b.submittedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { carrierFetch, getCarrierToken, getCarrierUser };
