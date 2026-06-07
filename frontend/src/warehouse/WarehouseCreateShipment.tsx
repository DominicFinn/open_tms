import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function WarehouseCreateShipment() {
  const navigate = useNavigate();
  const [reference, setReference] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill origin from selected warehouse location
  useEffect(() => {
    try {
      const loc = JSON.parse(localStorage.getItem('warehouse_location') || '{}');
      if (loc.id) setOriginId(loc.id);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v1/customers`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/warehouse/locations`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/carriers`).then(r => r.json()),
    ]).then(([cust, loc, carr]) => {
      setCustomers(cust.data || []);
      setLocations(loc.data || []);
      setCarriers(carr.data || []);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference || !customerId || !originId || !destinationId) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          customerId,
          originId,
          destinationId,
          pickupDate: pickupDate || undefined,
          carrierId: carrierId || undefined,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        setLoading(false);
        return;
      }
      navigate(`/warehouse/shipments/${json.data.id}`);
    } catch {
      setError('Network error');
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-1 py-2 pb-24">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0"
          onClick={() => navigate('/warehouse')}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create Shipment</h1>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wh-reference" className="text-base">Reference *</Label>
              <Input
                id="wh-reference"
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="SH-001"
                required
                data-manual-input="true"
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wh-customer" className="text-base">Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="wh-customer" className="h-12 text-base">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wh-origin" className="text-base">Origin *</Label>
              <Select value={originId} onValueChange={setOriginId}>
                <SelectTrigger id="wh-origin" className="h-12 text-base">
                  <SelectValue placeholder="Select origin" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} - {l.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wh-destination" className="text-base">Destination *</Label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger id="wh-destination" className="h-12 text-base">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} - {l.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wh-pickup" className="text-base">Pickup Date</Label>
              <DatePicker
                id="wh-pickup"
                type="date"
                value={pickupDate}
                onChange={e => setPickupDate(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wh-carrier" className="text-base">Carrier</Label>
              <Select value={carrierId} onValueChange={setCarrierId}>
                <SelectTrigger id="wh-carrier" className="h-12 text-base">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {carriers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full text-base"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Creating...' : 'Create Shipment'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
