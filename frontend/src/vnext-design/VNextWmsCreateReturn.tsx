import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';

import { API_URL } from '../api';
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

interface Customer { id: string; name: string; }
interface OrderLine { id: string; sku: string; description: string | null; quantity: number; unitPriceCents: number | null; }
interface Order { id: string; orderNumber: string | null; customerId: string; customer: { name: string }; lineItems: OrderLine[]; }

const RETURN_REASONS = ['damaged', 'wrong_item', 'not_as_described', 'no_longer_needed', 'defective', 'ordered_extra', 'other'];
const DISPOSITIONS = ['restock', 'refurb', 'scrap', 'recycle', 'donate', 'rtv', 'customer_keeps'];

function formatStr(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsCreateReturn() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [lineSelections, setLineSelections] = useState<Record<string, { quantity: number; disposition?: string }>>({});
  const [returnReason, setReturnReason] = useState('damaged');
  const [customerNotes, setCustomerNotes] = useState('');
  const [autoAuthorize, setAutoAuthorize] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/customers`)
      .then(r => r.json())
      .then(res => setCustomers(res.data || []));
  }, []);

  useEffect(() => {
    if (!selectedCustomer) { setOrders([]); return; }
    fetch(`${API_URL}/api/v1/orders?customerId=${selectedCustomer}`)
      .then(r => r.json())
      .then(res => setOrders(res.data || []));
  }, [selectedCustomer]);

  useEffect(() => {
    if (!selectedOrderId) { setSelectedOrder(null); return; }
    fetch(`${API_URL}/api/v1/orders/${selectedOrderId}`)
      .then(r => r.json())
      .then(res => setSelectedOrder(res.data || null));
  }, [selectedOrderId]);

  const toggleLine = (lineId: string, maxQty: number) => {
    setLineSelections(prev => {
      const next = { ...prev };
      if (next[lineId]) {
        delete next[lineId];
      } else {
        next[lineId] = { quantity: maxQty };
      }
      return next;
    });
  };

  const setLineQty = (lineId: string, qty: number) => {
    setLineSelections(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], quantity: qty },
    }));
  };

  const setLineDisposition = (lineId: string, disp: string) => {
    setLineSelections(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], disposition: disp === 'undecided' ? undefined : disp },
    }));
  };

  const calculatedRefund = selectedOrder?.lineItems.reduce((sum, line) => {
    const sel = lineSelections[line.id];
    if (!sel) return sum;
    return sum + (line.unitPriceCents ?? 0) * sel.quantity;
  }, 0) ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const lines = Object.entries(lineSelections).map(([orderLineItemId, sel]) => {
      const oli = selectedOrder.lineItems.find(l => l.id === orderLineItemId)!;
      return {
        orderLineItemId,
        sku: oli.sku,
        requestedQuantity: sel.quantity,
        requestedDisposition: sel.disposition,
      };
    });
    if (lines.length === 0) { setError('Select at least one item to return'); return; }

    setError(''); setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/rmas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer,
          orderId: selectedOrderId,
          returnReason,
          customerNotes: customerNotes || undefined,
          autoAuthorize,
          lines,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else navigate(`/wms/returns/${data.data.id}`);
    } catch {
      setError('Failed to create RMA');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Return (RMA)</h1>
        <p className="mt-1 text-sm text-muted-foreground">Authorize a customer return and select items</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Customer &amp; Order</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select value={selectedCustomer} onValueChange={(v) => { setSelectedCustomer(v); setSelectedOrderId(''); setLineSelections({}); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Order *</Label>
              <Select value={selectedOrderId} onValueChange={(v) => { setSelectedOrderId(v); setLineSelections({}); }} disabled={!selectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select order..." />
                </SelectTrigger>
                <SelectContent>
                  {orders.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.orderNumber || o.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedOrder && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>2. Items to Return</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {selectedOrder.lineItems.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">Order has no line items</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Ordered</TableHead>
                        <TableHead>Return Qty</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Suggested Disposition</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.lineItems.map(line => {
                        const sel = lineSelections[line.id];
                        return (
                          <TableRow key={line.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={!!sel}
                                onChange={() => toggleLine(line.id, line.quantity)}
                                className="h-4 w-4 rounded border border-input bg-background accent-primary"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm font-semibold">{line.sku}</TableCell>
                            <TableCell>{line.description || '-'}</TableCell>
                            <TableCell>{line.quantity}</TableCell>
                            <TableCell>
                              {sel && (
                                <Input
                                  type="number"
                                  min="1"
                                  max={line.quantity}
                                  value={sel.quantity}
                                  onChange={e => setLineQty(line.id, parseInt(e.target.value) || 1)}
                                  className="w-24"
                                />
                              )}
                            </TableCell>
                            <TableCell>{line.unitPriceCents != null ? `$${(line.unitPriceCents / 100).toFixed(2)}` : '-'}</TableCell>
                            <TableCell>
                              {sel && (
                                <Select value={sel.disposition || 'undecided'} onValueChange={(v) => setLineDisposition(line.id, v)}>
                                  <SelectTrigger className="w-44">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="undecided">(decide at inspection)</SelectItem>
                                    {DISPOSITIONS.map(d => (
                                      <SelectItem key={d} value={d}>{formatStr(d)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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

            <Card>
              <CardHeader>
                <CardTitle>3. Reason &amp; Notes</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Return Reason *</Label>
                  <Select value={returnReason} onValueChange={setReturnReason}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_REASONS.map(r => (
                        <SelectItem key={r} value={r}>{formatStr(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Customer Notes</Label>
                  <textarea
                    rows={3}
                    value={customerNotes}
                    onChange={e => setCustomerNotes(e.target.value)}
                    placeholder="Describe the issue..."
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={autoAuthorize}
                      onChange={e => setAutoAuthorize(e.target.checked)}
                      className="h-4 w-4 rounded border border-input bg-background accent-primary"
                    />
                    Auto-authorize (skip the "requested" state, go straight to "authorized")
                  </label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>4. Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-8">
                  <div>
                    <div className="text-xs text-muted-foreground">Lines selected</div>
                    <div className="text-2xl font-bold">{Object.keys(lineSelections).length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Suggested refund</div>
                    <div className="text-2xl font-bold text-primary">${(calculatedRefund / 100).toFixed(2)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => navigate('/wms/returns')}>Cancel</Button>
          <Button variant="gradient" type="submit" disabled={saving || Object.keys(lineSelections).length === 0}>
            {saving ? 'Creating...' : 'Create RMA'}
          </Button>
        </div>
      </form>
    </div>
  );
}
