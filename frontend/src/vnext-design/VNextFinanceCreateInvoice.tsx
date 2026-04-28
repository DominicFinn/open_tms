import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CircleAlert,
  Loader2,
  Receipt,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

interface ReadyShipment {
  shipmentId: string;
  shipmentReference: string;
  customerId: string;
  customerName: string;
  totalRevenueCents: number;
  chargeCount: number;
  deliveredAt: string | null;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d?: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VNextFinanceCreateInvoice() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<ReadyShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customerFilter, setCustomerFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/invoices/ready-to-invoice`)
      .then(r => r.json())
      .then(j => setShipments(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const customers = [...new Map(shipments.map(s => [s.customerId, s.customerName])).entries()];

  const filtered = shipments.filter(s => customerFilter === 'all' || s.customerId === customerFilter);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(s => s.shipmentId)));
    }
  };

  const selectedShipments = shipments.filter(s => selected.has(s.shipmentId));
  const totalRevenue = selectedShipments.reduce((s, sh) => s + sh.totalRevenueCents, 0);

  const selectedCustomers = [...new Set(selectedShipments.map(s => s.customerId))];
  const canCreate = selected.size > 0 && selectedCustomers.length === 1;

  const createInvoice = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/invoices`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomers[0],
          shipmentIds: [...selected],
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate(`/finance/invoices/${json.data.id}`);
    } catch (e: any) { alert(e.message); }
    finally { setCreating(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate('/finance/invoices')}>
          <ArrowLeft className="h-4 w-4" /> Invoices
        </Button>
        <span className="text-muted-foreground">/ Create Invoice</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
          <p className="mt-1 text-sm text-muted-foreground">Select delivered shipments with approved charges to invoice</p>
        </div>
      </div>

      {shipments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <Receipt className="h-10 w-10" />
          <h3 className="text-base font-medium">No shipments ready to invoice</h3>
          <p className="max-w-md text-sm">Shipments are marked as ready to invoice when they are delivered and have approved revenue charges.</p>
        </div>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <Select
                value={customerFilter}
                onValueChange={v => { setCustomerFilter(v); setSelected(new Set()); }}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{filtered.length} shipments ready</span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border border-input bg-background accent-primary"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={selectAll}
                    />
                  </TableHead>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Charges</TableHead>
                  <TableHead>Delivered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => (
                  <TableRow
                    key={s.shipmentId}
                    onClick={() => toggleSelect(s.shipmentId)}
                    className={cn('cursor-pointer', selected.has(s.shipmentId) && 'bg-muted/50')}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border border-input bg-background accent-primary"
                        checked={selected.has(s.shipmentId)}
                        readOnly
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold">{s.shipmentReference}</span>
                    </TableCell>
                    <TableCell>{s.customerName}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-medium">{formatMoney(s.totalRevenueCents)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{s.chargeCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(s.deliveredAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {selected.size > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <strong>{selected.size} shipment{selected.size > 1 ? 's' : ''} selected</strong>
                    <span className="text-muted-foreground">|</span>
                    <strong className="text-lg font-mono tabular-nums">{formatMoney(totalRevenue)}</strong>
                    {selectedCustomers.length > 1 && (
                      <Badge variant="destructive">Multiple customers - select only one</Badge>
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <Input
                      placeholder="Invoice notes (optional)"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-[250px]"
                    />
                    <Button onClick={createInvoice} disabled={!canCreate || creating}>
                      <Receipt className="h-4 w-4" />
                      {creating ? 'Creating...' : 'Create Invoice'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
