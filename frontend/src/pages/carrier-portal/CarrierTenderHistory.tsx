import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../api';
import { carrierFetch, getCarrierToken } from './CarrierDashboard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface OfferHistory {
  id: string;
  status: string;
  outcome: string;
  bidRate: number | null;
  bidStatus: string | null;
  tenderStatus: string;
  tenderReference: string;
  route: string | null;
  customerName: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  tender: {
    id: string;
    reference: string;
    status: string;
    targetRate: number | null;
    equipmentType: string | null;
    shipment: {
      pickupDate: string | null;
      deliveryDate: string | null;
    };
  };
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

const outcomeVariants: Record<string, StatusVariant> = {
  won: 'success',
  lost: 'destructive',
  pending: 'info',
  active: 'default',
  expired: 'warning',
  cancelled: 'secondary',
};

const outcomeLabels: Record<string, string> = {
  won: 'Won',
  lost: 'Lost',
  pending: 'Bid Pending',
  active: 'Active',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

function tenderStatusVariant(s: string): StatusVariant {
  if (s === 'awarded') return 'success';
  if (s === 'open') return 'default';
  return 'secondary';
}

const STAT_BORDER: Record<string, string> = {
  total: 'border-l-primary',
  won: 'border-l-success',
  lost: 'border-l-destructive',
  pending: 'border-l-info',
  active: 'border-l-primary',
  expired: 'border-l-warning',
};

export default function CarrierTenderHistory() {
  const [offers, setOffers] = useState<OfferHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!getCarrierToken()) {
      navigate('/carrier-portal/login');
      return;
    }
    carrierFetch(`${API_URL}/api/v1/carrier-portal/history`)
      .then(r => r.json())
      .then(json => {
        setOffers(json.data || []);
        setLoading(false);
      });
  }, []);

  const filtered = outcomeFilter
    ? offers.filter(o => o.outcome === outcomeFilter)
    : offers;

  const counts = {
    total: offers.length,
    won: offers.filter(o => o.outcome === 'won').length,
    lost: offers.filter(o => o.outcome === 'lost').length,
    pending: offers.filter(o => o.outcome === 'pending').length,
    active: offers.filter(o => o.outcome === 'active').length,
    expired: offers.filter(o => o.outcome === 'expired').length,
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  const tiles: Array<{ key: string; label: string; value: number; valueClass?: string }> = [
    { key: 'total', label: 'Total', value: counts.total },
    { key: 'won', label: 'Won', value: counts.won, valueClass: 'text-success' },
    { key: 'lost', label: 'Lost', value: counts.lost, valueClass: 'text-destructive' },
    { key: 'pending', label: 'Pending', value: counts.pending },
    { key: 'active', label: 'Active', value: counts.active, valueClass: 'text-primary' },
    { key: 'expired', label: 'Expired', value: counts.expired },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tender history</h1>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(t => {
          const isActive = (t.key === 'total' && outcomeFilter === '') || outcomeFilter === t.key;
          return (
            <Card
              key={t.key}
              className={cn(
                'cursor-pointer border-l-4 text-center transition-colors',
                isActive ? STAT_BORDER[t.key] : 'border-l-transparent',
                'hover:border-primary/40',
              )}
            >
              <button
                type="button"
                onClick={() => setOutcomeFilter(t.key === 'total' ? '' : (outcomeFilter === t.key ? '' : t.key))}
                className="block w-full p-4 text-left"
              >
                <div className="text-xs text-muted-foreground">{t.label}</div>
                <div className={cn('mt-1 text-2xl font-bold tracking-tight', t.valueClass)}>{t.value}</div>
              </button>
            </Card>
          );
        })}
      </div>

      {counts.won + counts.lost > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-6 p-4">
            <div>
              <div className="text-xs text-muted-foreground">Win rate</div>
              <div className="text-3xl font-bold tracking-tight text-success">
                {Math.round((counts.won / (counts.won + counts.lost)) * 100)}%
              </div>
            </div>
            <div className="h-2 flex-1 min-w-[120px] overflow-hidden rounded-full bg-destructive/30">
              <div
                className="h-full rounded-full bg-success"
                style={{ width: `${Math.round((counts.won / (counts.won + counts.lost)) * 100)}%` }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {counts.won}W / {counts.lost}L
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tender</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Target rate</TableHead>
              <TableHead>Your bid</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Tender status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  {outcomeFilter ? `No ${outcomeLabels[outcomeFilter]?.toLowerCase()} tenders` : 'No tender history yet'}
                </TableCell>
              </TableRow>
            ) : filtered.map(o => {
              const clickable = ['active', 'pending'].includes(o.outcome);
              return (
                <TableRow
                  key={o.id}
                  onClick={() => clickable && navigate(`/carrier-portal/tenders/${o.tender.id}`)}
                  className={clickable ? 'cursor-pointer' : ''}
                >
                  <TableCell className="font-semibold">{o.tenderReference}</TableCell>
                  <TableCell className="text-sm">{o.route || '-'}</TableCell>
                  <TableCell className="text-sm">{o.customerName || '-'}</TableCell>
                  <TableCell className="text-sm">{o.tender.equipmentType || '-'}</TableCell>
                  <TableCell className="text-sm">{o.tender.targetRate ? `$${o.tender.targetRate.toLocaleString()}` : '-'}</TableCell>
                  <TableCell className={cn('text-sm', o.bidRate && 'font-bold')}>
                    {o.bidRate ? `$${o.bidRate.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={outcomeVariants[o.outcome] || 'secondary'}>
                      {outcomeLabels[o.outcome] || o.outcome}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tenderStatusVariant(o.tenderStatus)}>{o.tenderStatus}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
