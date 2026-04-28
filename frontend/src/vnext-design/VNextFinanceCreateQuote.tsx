import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CircleAlert,
  FileText,
  Plus,
  X,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface LineItem {
  chargeType: string;
  description: string;
  amountCents: number;
  freightClass?: string;
  quantity: number;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function VNextFinanceCreateQuote() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [serviceLevel, setServiceLevel] = useState('FTL');
  const [markupPercent, setMarkupPercent] = useState('15');
  const [validDays, setValidDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { chargeType: 'linehaul', description: '', amountCents: 0, quantity: 1 },
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/customers`).then(r => r.json()).then(j => setCustomers(j.data || []));
  }, []);

  const addLineItem = () => {
    setLineItems([...lineItems, { chargeType: 'accessorial', description: '', amountCents: 0, quantity: 1 }]);
  };

  const removeLineItem = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateLineItem = (idx: number, field: string, value: any) => {
    setLineItems(lineItems.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };

  const totalCostCents = lineItems.reduce((s, li) => s + li.amountCents * li.quantity, 0);
  const markup = parseFloat(markupPercent) || 0;
  const totalRevenueCents = Math.round(totalCostCents * (1 + markup / 100));
  const marginCents = totalRevenueCents - totalCostCents;

  const createQuote = async () => {
    if (!customerId) { setError('Select a customer'); return; }
    if (lineItems.some(li => !li.description || li.amountCents <= 0)) { setError('All line items need a description and amount'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/quotes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          serviceLevel,
          markupPercent: markup,
          validDays: parseInt(validDays) || 30,
          notes: notes || undefined,
          lineItems: lineItems.map(li => ({
            chargeType: li.chargeType,
            description: li.description,
            amountCents: li.amountCents,
            freightClass: li.freightClass || undefined,
            quantity: li.quantity,
          })),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate(`/finance/quotes/${json.data.id}`);
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate('/finance/quotes')}>
          <ArrowLeft className="h-4 w-4" /> Quotes
        </Button>
        <span className="text-muted-foreground">/ New Quote</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Quote</h1>
          <p className="mt-1 text-sm text-muted-foreground">Build a quote with line items and markup</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 text-base font-semibold">Quote Details</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Customer</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                    <SelectContent>
                      {customers.filter(c => !c.archived).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Service Level</Label>
                  <Select value={serviceLevel} onValueChange={setServiceLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FTL">FTL (Full Truck Load)</SelectItem>
                      <SelectItem value="LTL">LTL (Less Than Truck Load)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="markup">Markup %</Label>
                  <Input
                    id="markup"
                    type="number"
                    min="0"
                    step="0.5"
                    value={markupPercent}
                    onChange={e => setMarkupPercent(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="valid-days">Valid For (days)</Label>
                  <Input
                    id="valid-days"
                    type="number"
                    min="1"
                    value={validDays}
                    onChange={e => setValidDays(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Line Items (Cost Basis)</h3>
                <Button variant="ghost" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4" /> Add Line
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {lineItems.map((li, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5" style={{ flex: '0 0 130px' }}>
                      {idx === 0 && <Label>Type</Label>}
                      <Select value={li.chargeType} onValueChange={v => updateLineItem(idx, 'chargeType', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linehaul">Linehaul</SelectItem>
                          <SelectItem value="fuel_surcharge">Fuel Surcharge</SelectItem>
                          <SelectItem value="accessorial">Accessorial</SelectItem>
                          <SelectItem value="discount">Discount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                      {idx === 0 && <Label>Description</Label>}
                      <Input
                        value={li.description}
                        onChange={e => updateLineItem(idx, 'description', e.target.value)}
                        placeholder="e.g. Linehaul Chicago to Dallas"
                      />
                    </div>
                    <div className="space-y-1.5" style={{ flex: '0 0 130px' }}>
                      {idx === 0 && <Label>Amount ($)</Label>}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={li.amountCents ? (li.amountCents / 100).toFixed(2) : ''}
                        onChange={e => updateLineItem(idx, 'amountCents', Math.round(parseFloat(e.target.value || '0') * 100))}
                      />
                    </div>
                    <div className="space-y-1.5" style={{ flex: '0 0 80px' }}>
                      {idx === 0 && <Label>Qty</Label>}
                      <Input
                        type="number"
                        min="1"
                        value={li.quantity}
                        onChange={e => updateLineItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    {lineItems.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeLineItem(idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Internal or customer-facing notes..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 text-base font-semibold">Quote Summary</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Cost (Carrier)</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(totalCostCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Markup ({markup}%)</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(totalRevenueCents - totalCostCents)}</dd>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <dt className="font-bold">Revenue (Customer)</dt>
                  <dd className="text-lg font-bold font-mono tabular-nums">{formatMoney(totalRevenueCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Margin</dt>
                  <dd className={cn('font-mono tabular-nums', marginCents >= 0 ? 'text-success' : 'text-destructive')}>
                    {formatMoney(marginCents)}
                  </dd>
                </div>
              </dl>
              <Button variant="gradient" className="mt-5 w-full" onClick={createQuote} disabled={creating}>
                <FileText className="h-4 w-4" />
                {creating ? 'Creating...' : 'Create Quote'}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
