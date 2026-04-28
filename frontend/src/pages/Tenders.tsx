import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Tender {
  id: string;
  reference: string;
  status: string;
  strategy: string;
  targetRate: number | null;
  currency: string;
  equipmentType: string | null;
  tenderDurationMinutes: number;
  openedAt: string | null;
  awardedAt: string | null;
  createdAt: string;
  shipment: {
    id: string;
    reference: string;
    origin: { name: string; city: string; state: string | null };
    destination: { name: string; city: string; state: string | null };
  };
  offers: Array<{ id: string; carrierId: string; status: string; carrier: { name: string } }>;
  bids: Array<{ id: string; rate: number; status: string; carrier: { name: string } }>;
}

type StatusVariant = 'success' | 'warning' | 'destructive' | 'info' | 'muted' | 'default';

const statusVariants: Record<string, StatusVariant> = {
  draft: 'muted',
  open: 'default',
  evaluating: 'warning',
  awarded: 'success',
  cancelled: 'destructive',
  expired: 'destructive',
};

interface Carrier {
  id: string;
  name: string;
}

const STATUS_OPTIONS = ['', 'draft', 'open', 'evaluating', 'awarded', 'cancelled', 'expired'];

export default function Tenders() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/api/v1/carriers`).then(r => r.json()).then(j => setCarriers(j.data || []));
  }, []);

  useEffect(() => {
    fetchTenders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, carrierFilter]);

  async function fetchTenders() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (carrierFilter) params.set('carrierId', carrierFilter);
    const res = await fetch(`${API_URL}/api/v1/tenders?${params}`);
    const json = await res.json();
    setTenders(json.data || []);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage carrier tender requests and bids</p>
        </div>
        <Button asChild variant="gradient">
          <Link to="/tenders/create">
            <Plus className="h-4 w-4" />
            Create Tender
          </Link>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          {STATUS_OPTIONS.map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
            >
              {s || 'All'}
            </Button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Carrier:</span>
          <Select value={carrierFilter || 'all'} onValueChange={v => setCarrierFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Carriers</SelectItem>
              {carriers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {carrierFilter && (
            <Button variant="outline" size="sm" onClick={() => setCarrierFilter('')}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Shipment</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Carriers</TableHead>
              <TableHead>Bids</TableHead>
              <TableHead>Target Rate</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : tenders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                  No tenders found
                </TableCell>
              </TableRow>
            ) : tenders.map(t => (
              <TableRow
                key={t.id}
                onClick={() => navigate(`/tenders/${t.id}`)}
                className="cursor-pointer"
              >
                <TableCell className="font-semibold">{t.reference}</TableCell>
                <TableCell>
                  <Link
                    to={`/shipments/${t.shipment.id}`}
                    onClick={e => e.stopPropagation()}
                    className="text-primary hover:underline"
                  >
                    {t.shipment.reference}
                  </Link>
                </TableCell>
                <TableCell>
                  {t.shipment.origin.city}{t.shipment.origin.state ? `, ${t.shipment.origin.state}` : ''}
                  {' -> '}
                  {t.shipment.destination.city}{t.shipment.destination.state ? `, ${t.shipment.destination.state}` : ''}
                </TableCell>
                <TableCell>
                  <Badge variant={t.strategy === 'broadcast' ? 'info' : 'muted'}>
                    {t.strategy}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariants[t.status] || 'muted'}>
                    {t.status}
                  </Badge>
                </TableCell>
                <TableCell>{t.offers.length}</TableCell>
                <TableCell>{t.bids.length}</TableCell>
                <TableCell>{t.targetRate ? `$${t.targetRate.toLocaleString()}` : '--'}</TableCell>
                <TableCell>{new Date(t.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
