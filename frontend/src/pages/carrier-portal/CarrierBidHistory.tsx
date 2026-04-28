import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../api';
import { carrierFetch, getCarrierToken } from './CarrierDashboard';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Bid {
  id: string;
  rate: number;
  currency: string;
  transitDays: number | null;
  equipmentType: string | null;
  status: string;
  sourceType: string;
  submittedAt: string;
  tender: { id: string; reference: string; status: string };
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary';

function statusVariant(s: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    submitted: 'info',
    accepted: 'success',
    rejected: 'destructive',
    withdrawn: 'warning',
    expired: 'destructive',
  };
  return m[s] || 'secondary';
}

export default function CarrierBidHistory() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getCarrierToken()) {
      navigate('/carrier-portal/login');
      return;
    }
    carrierFetch(`${API_URL}/api/v1/carrier-portal/bids`)
      .then(r => r.json())
      .then(json => {
        setBids(json.data || []);
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Bid history</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tender</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Transit</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tender status</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bids.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No bids submitted yet
                </TableCell>
              </TableRow>
            ) : bids.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-semibold">{b.tender.reference}</TableCell>
                <TableCell className="font-bold">${b.rate.toLocaleString()}</TableCell>
                <TableCell className="text-sm">{b.transitDays ? `${b.transitDays} days` : '-'}</TableCell>
                <TableCell className="text-sm">{b.equipmentType || '-'}</TableCell>
                <TableCell className="text-sm">{b.sourceType}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(b.tender.status)}>{b.tender.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(b.submittedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
