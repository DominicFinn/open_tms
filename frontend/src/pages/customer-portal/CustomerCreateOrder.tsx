import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Send, X } from 'lucide-react';

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

interface LineItem {
  description: string;
  quantity: number;
  weightKg: string;
  sku: string;
}

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export default function CustomerCreateOrder() {
  const navigate = useNavigate();
  const [poNumber, setPoNumber] = useState('');
  const [serviceLevel, setServiceLevel] = useState('FTL');
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  const [destCity, setDestCity] = useState('');
  const [destState, setDestState] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', quantity: 1, weightKg: '', sku: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addItem = () => setLineItems([...lineItems, { description: '', quantity: 1, weightKg: '', sku: '' }]);
  const removeItem = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    (updated[i] as any)[field] = value;
    setLineItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poNumber.trim()) { setError('PO Number is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/orders`, {
        method: 'POST',
        body: JSON.stringify({
          poNumber,
          serviceLevel,
          originCity: originCity || undefined,
          originState: originState || undefined,
          destinationCity: destCity || undefined,
          destinationState: destState || undefined,
          requestedDeliveryDate: requestedDeliveryDate || undefined,
          specialInstructions: specialInstructions || undefined,
          lineItems: lineItems.filter(li => li.description.trim()).map(li => ({
            description: li.description,
            quantity: li.quantity,
            weightKg: li.weightKg ? parseFloat(li.weightKg) : undefined,
            sku: li.sku || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate('/customer-portal/orders');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/customer-portal/orders')}>
          <ArrowLeft className="h-4 w-4" />
          Orders
        </Button>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Create order</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Order details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="po-number">PO number *</Label>
                <Input id="po-number" value={poNumber} onChange={e => setPoNumber(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-level">Service level</Label>
                <Select value={serviceLevel} onValueChange={setServiceLevel}>
                  <SelectTrigger id="service-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FTL">Full Truckload (FTL)</SelectItem>
                    <SelectItem value="LTL">Less Than Truckload (LTL)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery-date">Requested delivery date</Label>
                <Input id="delivery-date" type="date" value={requestedDeliveryDate} onChange={e => setRequestedDeliveryDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Origin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="origin-city">City</Label>
                <Input id="origin-city" value={originCity} onChange={e => setOriginCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="origin-state">State</Label>
                <Input id="origin-state" value={originState} onChange={e => setOriginState(e.target.value)} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Destination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dest-city">City</Label>
                <Input id="dest-city" value={destCity} onChange={e => setDestCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dest-state">State</Label>
                <Input id="dest-state" value={destState} onChange={e => setDestState(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-end gap-2">
                <div className="space-y-1">
                  {i === 0 && <Label className="text-xs">Description</Label>}
                  <Input
                    value={item.description}
                    onChange={e => updateItem(i, 'description', e.target.value)}
                    placeholder="Item description"
                  />
                </div>
                <div className="space-y-1">
                  {i === 0 && <Label className="text-xs">Qty</Label>}
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-1">
                  {i === 0 && <Label className="text-xs">Weight (kg)</Label>}
                  <Input
                    type="number"
                    step="0.1"
                    value={item.weightKg}
                    onChange={e => updateItem(i, 'weightKg', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  {i === 0 && <Label className="text-xs">SKU</Label>}
                  <Input value={item.sku} onChange={e => updateItem(i, 'sku', e.target.value)} />
                </div>
                {lineItems.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(i)}
                    className="text-destructive"
                    aria-label="Remove item"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <div />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Special instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className={TEXTAREA_CLASS}
              rows={3}
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              placeholder="Any special requirements..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/customer-portal/orders')}>
            Cancel
          </Button>
          <Button type="submit" variant="gradient" disabled={submitting}>
            <Send className="h-4 w-4" />
            {submitting ? 'Submitting...' : 'Submit order'}
          </Button>
        </div>
      </form>
    </div>
  );
}
