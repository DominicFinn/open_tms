import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface OrderLineItem {
  id: string;
  sku: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number | null;
}
interface EligibleOrder {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  lineItems: OrderLineItem[];
}

interface LineSelection {
  orderLineItemId: string;
  sku: string;
  requestedQuantity: number;
  requestedDisposition: string;
}

const RETURN_REASONS = [
  { v: 'damaged', l: 'Damaged in transit' },
  { v: 'wrong_item', l: 'Wrong item shipped' },
  { v: 'not_as_described', l: 'Not as described' },
  { v: 'no_longer_needed', l: 'No longer needed' },
  { v: 'defective', l: 'Defective / faulty' },
  { v: 'ordered_extra', l: 'Ordered too many' },
  { v: 'other', l: 'Other' },
];

const DISPOSITIONS = [
  { v: '__none__', l: '(let us decide)' },
  { v: 'restock', l: 'Restock' },
  { v: 'refurb', l: 'Refurbish' },
  { v: 'scrap', l: 'Scrap' },
  { v: 'customer_keeps', l: 'Keep the item (refund only)' },
];

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export default function CustomerRequestReturn() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<EligibleOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineSelection[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoadingOrders(true);
    customerFetch(`${API_URL}/api/v1/customer-portal/rmas/eligible-orders`)
      .then(r => r.json())
      .then(json => setOrders(json.data || []))
      .catch(() => setError('Could not load your recent orders.'))
      .finally(() => setLoadingOrders(false));
  }, []);

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);

  const toggleLine = (item: OrderLineItem) => {
    setLines(current => {
      const existing = current.find(l => l.orderLineItemId === item.id);
      if (existing) return current.filter(l => l.orderLineItemId !== item.id);
      return [...current, { orderLineItemId: item.id, sku: item.sku, requestedQuantity: 1, requestedDisposition: '__none__' }];
    });
  };

  const updateLine = (orderLineItemId: string, patch: Partial<LineSelection>) => {
    setLines(current => current.map(l => l.orderLineItemId === orderLineItemId ? { ...l, ...patch } : l));
  };

  const canSubmit = !!selectedOrderId && !!returnReason && lines.length > 0 && lines.every(l => l.requestedQuantity > 0);

  const handleSubmit = async () => {
    setError(''); setSubmitting(true);
    try {
      const payload = {
        orderId: selectedOrderId,
        returnReason,
        customerNotes: notes || undefined,
        lines: lines.map(l => ({
          orderLineItemId: l.orderLineItemId,
          sku: l.sku,
          requestedQuantity: l.requestedQuantity,
          requestedDisposition: l.requestedDisposition && l.requestedDisposition !== '__none__'
            ? l.requestedDisposition
            : undefined,
        })),
      };
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/rmas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      navigate(`/customer-portal/returns/${data.data.id}`);
    } catch (e: any) {
      setError(e.message || 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Request a return</h1>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Choose order</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingOrders && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {!loadingOrders && orders.length === 0 && (
            <div className="text-sm text-muted-foreground">You have no delivered orders eligible for return.</div>
          )}
          {!loadingOrders && orders.length > 0 && (
            <Select value={selectedOrderId} onValueChange={v => { setSelectedOrderId(v); setLines([]); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select an order..." />
              </SelectTrigger>
              <SelectContent>
                {orders.map(o => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.orderNumber} - {o.lineItems.length} line{o.lineItems.length === 1 ? '' : 's'} - delivered {new Date(o.createdAt).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedOrder && (
        <Card>
          <CardHeader>
            <CardTitle>2. Select items to return</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Ordered qty</TableHead>
                  <TableHead>Return qty</TableHead>
                  <TableHead>Preferred outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedOrder.lineItems.map(item => {
                  const selection = lines.find(l => l.orderLineItemId === item.id);
                  const checked = !!selection;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLine(item)}
                          className="h-4 w-4 rounded border border-input bg-background accent-primary"
                        />
                      </TableCell>
                      <TableCell className="font-semibold">{item.sku}</TableCell>
                      <TableCell className="text-sm">{item.description ?? '-'}</TableCell>
                      <TableCell className="text-sm">{item.quantity}</TableCell>
                      <TableCell>
                        {checked ? (
                          <Input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={selection!.requestedQuantity}
                            onChange={e => updateLine(item.id, { requestedQuantity: Math.min(parseInt(e.target.value) || 1, item.quantity) })}
                            className="w-24"
                          />
                        ) : <span className="text-sm text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {checked ? (
                          <Select
                            value={selection!.requestedDisposition || '__none__'}
                            onValueChange={v => updateLine(item.id, { requestedDisposition: v })}
                          >
                            <SelectTrigger className="w-[220px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DISPOSITIONS.map(d => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : <span className="text-sm text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selectedOrder && lines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Reason</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="return-reason">Why are you returning?</Label>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger id="return-reason">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map(r => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Additional notes (optional)</Label>
              <textarea
                id="notes"
                className={TEXTAREA_CLASS}
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Describe the issue so our team can help..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/customer-portal/returns')} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="gradient" onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? 'Submitting...' : 'Submit return request'}
        </Button>
      </div>
    </div>
  );
}
