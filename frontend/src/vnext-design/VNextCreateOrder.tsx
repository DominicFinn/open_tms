import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  ListChecks,
  Plus,
  Receipt,
  Route,
  Save,
  Trash2,
} from 'lucide-react';

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

interface LineItem {
  id: number;
  sku: string;
  description: string;
  quantity: string;
  weight: string;
}

let nextLineId = 2;

export default function VNextCreateOrder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [customer, setCustomer] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [requestedDelivery, setRequestedDelivery] = useState('');
  const [serviceLevel, setServiceLevel] = useState('');
  const [originLocation, setOriginLocation] = useState('');
  const [destLocation, setDestLocation] = useState('');
  const [tempControl, setTempControl] = useState('ambient');
  const [hazmat, setHazmat] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, sku: '', description: '', quantity: '', weight: '' },
  ]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v1/customers`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/locations`).then(r => r.json()),
    ]).then(([cRes, lRes]) => {
      setCustomers(cRes.data || []);
      setLocations(lRes.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/orders/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load order');
        return r.json();
      })
      .then(json => {
        const o = json.data;
        if (!o) return;
        setCustomer(o.customerId || '');
        setPoNumber(o.poNumber || '');
        setOrderDate(o.requestedPickupDate ? o.requestedPickupDate.slice(0, 10) : '');
        setRequestedDelivery(o.requestedDeliveryDate ? o.requestedDeliveryDate.slice(0, 10) : '');
        setServiceLevel(o.serviceLevel || '');
        setOriginLocation(o.originId || '');
        setDestLocation(o.destinationId || '');
        setTempControl(o.temperatureControl || 'ambient');
        setHazmat(Boolean(o.requiresHazmat));
        setSpecialInstructions(o.specialInstructions || '');
        setNotes(o.notes || '');
        if (Array.isArray(o.lineItems) && o.lineItems.length > 0) {
          setLineItems(o.lineItems.map((li: any, idx: number) => ({
            id: idx + 1,
            sku: li.sku || '',
            description: li.description || '',
            quantity: li.quantity != null ? String(li.quantity) : '',
            weight: li.weight != null ? String(li.weight) : '',
          })));
          nextLineId = o.lineItems.length + 1;
        }
      })
      .catch(err => setSubmitError(err.message));
  }, [id]);

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const toIsoDate = (d: string) => d ? new Date(d + 'T00:00:00Z').toISOString() : undefined;
      if (isEdit && id) {
        const body: any = {
          poNumber: poNumber || undefined,
          originId: originLocation || undefined,
          destinationId: destLocation || undefined,
          requestedPickupDate: toIsoDate(orderDate),
          requestedDeliveryDate: toIsoDate(requestedDelivery),
          serviceLevel: serviceLevel || undefined,
          temperatureControl: tempControl || undefined,
          requiresHazmat: hazmat,
          specialInstructions: specialInstructions || undefined,
          notes: notes || undefined,
        };
        const res = await fetch(`${API_URL}/api/v1/orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to update order');
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        navigate(`/orders/${id}`);
        return;
      }
      const body: any = {
        poNumber, customerId: customer, originId: originLocation, destinationId: destLocation,
        requestedPickupDate: orderDate || undefined,
        requestedDeliveryDate: requestedDelivery || undefined,
        serviceLevel: serviceLevel || undefined,
        temperatureControl: tempControl, requiresHazmat: hazmat,
        lineItems: lineItems.filter(li => li.sku || li.description).map(li => ({
          sku: li.sku, description: li.description,
          quantity: li.quantity ? parseInt(li.quantity) : undefined,
          weight: li.weight ? parseFloat(li.weight) : undefined,
        })),
        specialInstructions, notes, importSource: 'manual',
      };
      const res = await fetch(`${API_URL}/api/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create order');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate('/orders');
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: nextLineId++, sku: '', description: '', quantity: '', weight: '' }]);
  };

  const removeLineItem = (lid: number) => {
    setLineItems(prev => prev.length > 1 ? prev.filter(item => item.id !== lid) : prev);
  };

  const updateLineItem = (lid: number, field: keyof LineItem, value: string) => {
    setLineItems(prev => prev.map(item => item.id === lid ? { ...item, [field]: value } : item));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/orders" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Orders
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{isEdit ? 'Edit order' : 'New order'}</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{isEdit ? 'Edit order' : 'New order'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEdit ? 'Update the order details below.' : 'Create a customer order from scratch.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Order details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Select value={customer} onValueChange={setCustomer} disabled={isEdit}>
              <SelectTrigger id="customer">
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-xs text-muted-foreground">Customer cannot be changed after creation</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="po">PO number</Label>
            <Input
              id="po"
              type="text"
              placeholder="Enter PO number"
              value={poNumber}
              onChange={e => setPoNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orderDate">Order date</Label>
            <Input id="orderDate" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reqDel">Requested delivery date</Label>
            <Input id="reqDel" type="date" value={requestedDelivery} onChange={e => setRequestedDelivery(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="svc">Service level</Label>
            <Select value={serviceLevel} onValueChange={setServiceLevel}>
              <SelectTrigger id="svc">
                <SelectValue placeholder="Select service level..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ftl">FTL</SelectItem>
                <SelectItem value="ltl">LTL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            Origin &amp; destination
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="origin">Origin location</Label>
            <Select value={originLocation} onValueChange={setOriginLocation}>
              <SelectTrigger id="origin">
                <SelectValue placeholder="Select origin..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.name} - {l.city}, {l.state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dest">Destination location</Label>
            <Select value={destLocation} onValueChange={setDestLocation}>
              <SelectTrigger id="dest">
                <SelectValue placeholder="Select destination..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.name} - {l.city}, {l.state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="temp">Temperature control</Label>
            <Select value={tempControl} onValueChange={setTempControl}>
              <SelectTrigger id="temp">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambient">Ambient</SelectItem>
                <SelectItem value="refrigerated">Refrigerated</SelectItem>
                <SelectItem value="frozen">Frozen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={hazmat}
                onChange={e => setHazmat(e.target.checked)}
                className="h-4 w-4 rounded border border-input bg-background accent-primary"
              />
              Hazmat
            </label>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="instructions">Special instructions</Label>
            <textarea
              id="instructions"
              rows={3}
              placeholder="Enter any special instructions..."
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </CardContent>
      </Card>

      {!isEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              Line items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-2 text-left">SKU</th>
                    <th className="px-2 py-2 text-left">Description</th>
                    <th className="px-2 py-2 text-left">Qty</th>
                    <th className="px-2 py-2 text-left">Weight (lb)</th>
                    <th className="px-2 py-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map(item => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-2 py-2">
                        <Input
                          type="text"
                          placeholder="SKU"
                          value={item.sku}
                          onChange={e => updateLineItem(item.id, 'sku', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2 w-24">
                        <Input
                          type="number"
                          placeholder="0"
                          value={item.quantity}
                          onChange={e => updateLineItem(item.id, 'quantity', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2 w-28">
                        <Input
                          type="number"
                          placeholder="0"
                          value={item.weight}
                          onChange={e => updateLineItem(item.id, 'weight', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(item.id)}
                          className="text-destructive"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {submitError && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {submitError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" asChild>
          <Link to={isEdit && id ? `/orders/${id}` : '/orders'}>Cancel</Link>
        </Button>
        <Button variant="gradient" onClick={handleSubmit} disabled={submitting}>
          {isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {submitting ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save changes' : 'Create order')}
        </Button>
      </div>
    </div>
  );
}
