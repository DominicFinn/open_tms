import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../api';
import { carrierFetch, getCarrierToken } from './CarrierDashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary';

function bidStatusVariant(s: string): StatusVariant {
  if (s === 'accepted') return 'success';
  if (s === 'rejected') return 'destructive';
  return 'info';
}

export default function CarrierTenderView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bid form
  const [rate, setRate] = useState('');
  const [transitDays, setTransitDays] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!getCarrierToken()) {
      navigate('/carrier-portal/login');
      return;
    }
    fetchTender();
  }, [id]);

  async function fetchTender() {
    setLoading(true);
    const res = await carrierFetch(`${API_URL}/api/v1/carrier-portal/tenders/${id}`);
    const json = await res.json();
    if (json.error) {
      setError(json.error);
    } else {
      setData(json.data);
      if (json.data?.tender?.equipmentType) {
        setEquipmentType(json.data.tender.equipmentType);
      }
    }
    setLoading(false);
  }

  async function handleBid(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const res = await carrierFetch(`${API_URL}/api/v1/carrier-portal/tenders/${id}/bid`, {
      method: 'POST',
      body: JSON.stringify({
        rate: parseFloat(rate),
        transitDays: transitDays ? parseInt(transitDays) : undefined,
        equipmentType: equipmentType || undefined,
        notes: notes || undefined,
      }),
    });
    const json = await res.json();

    if (json.error) {
      setError(json.error);
    } else {
      setSuccess('Bid submitted successfully!');
      await fetchTender();
    }
    setSubmitting(false);
  }

  async function handleDecline() {
    if (!confirm('Decline this tender? You will not be able to bid on it afterwards.')) return;
    setSubmitting(true);
    const res = await carrierFetch(`${API_URL}/api/v1/carrier-portal/tenders/${id}/decline`, {
      method: 'POST',
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
    } else {
      navigate('/carrier-portal');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }
  if (!data?.tender) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error || 'Tender not found'}
      </div>
    );
  }

  const { tender, offer } = data;
  const existingBid = offer?.bids?.find((b: any) => b.status === 'submitted' || b.status === 'accepted');
  const canBid = ['sent', 'viewed'].includes(offer?.status) && !existingBid && tender.status === 'open';
  const timeLeft = offer?.expiresAt
    ? Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 60000))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tender.reference}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tender.shipment.origin.city}{tender.shipment.origin.state ? `, ${tender.shipment.origin.state}` : ''}
            {' -> '}
            {tender.shipment.destination.city}{tender.shipment.destination.state ? `, ${tender.shipment.destination.state}` : ''}
          </p>
        </div>
        {timeLeft !== null && tender.status === 'open' && (
          <div
            className={cn(
              'rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground',
              timeLeft < 30 ? 'bg-destructive' : 'bg-primary',
            )}
          >
            {timeLeft > 60 ? `${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m` : `${timeLeft}m`} remaining
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Shipment details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div><strong>Reference:</strong> {tender.shipment.reference}</div>
              <div><strong>Customer:</strong> {tender.shipment.customer?.name}</div>
              <div>
                <strong>Origin:</strong> {tender.shipment.origin.name}, {tender.shipment.origin.city}
                {tender.shipment.origin.state ? `, ${tender.shipment.origin.state}` : ''}
              </div>
              <div>
                <strong>Destination:</strong> {tender.shipment.destination.name}, {tender.shipment.destination.city}
                {tender.shipment.destination.state ? `, ${tender.shipment.destination.state}` : ''}
              </div>
              {tender.shipment.pickupDate && (
                <div><strong>Pickup:</strong> {new Date(tender.shipment.pickupDate).toLocaleDateString()}</div>
              )}
              {tender.shipment.deliveryDate && (
                <div><strong>Delivery:</strong> {new Date(tender.shipment.deliveryDate).toLocaleDateString()}</div>
              )}
              {tender.equipmentType && <div><strong>Equipment:</strong> {tender.equipmentType}</div>}
              {tender.specialInstructions && (
                <div className="mt-2 rounded-md bg-muted/50 p-3">
                  <strong>Special instructions:</strong>
                  <br />
                  {tender.specialInstructions}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          {existingBid ? (
            <>
              <CardHeader>
                <CardTitle>Your bid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="text-4xl font-bold tracking-tight">${existingBid.rate.toLocaleString()}</div>
                  <Badge variant={bidStatusVariant(existingBid.status)}>{existingBid.status}</Badge>
                  {existingBid.status === 'accepted' && (
                    <div className="mt-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                      Congratulations! Your bid was accepted.
                    </div>
                  )}
                </div>
              </CardContent>
            </>
          ) : canBid ? (
            <>
              <CardHeader>
                <CardTitle>Submit your bid</CardTitle>
              </CardHeader>
              <CardContent>
                {tender.targetRate && (
                  <div className="mb-4 rounded-md bg-muted/50 px-3 py-2 text-center text-sm">
                    Target rate: <strong>${tender.targetRate.toLocaleString()}</strong>
                  </div>
                )}
                <form onSubmit={handleBid} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bid-rate">Your rate ($) *</Label>
                    <Input
                      id="bid-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={rate}
                      onChange={e => setRate(e.target.value)}
                      required
                      placeholder="Enter your rate"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transit-days">Transit days</Label>
                    <Input
                      id="transit-days"
                      type="number"
                      min="1"
                      value={transitDays}
                      onChange={e => setTransitDays(e.target.value)}
                      placeholder="Estimated transit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="equipment">Equipment type</Label>
                    <Input
                      id="equipment"
                      value={equipmentType}
                      onChange={e => setEquipmentType(e.target.value)}
                      placeholder="e.g. 53' Dry Van"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <textarea
                      id="notes"
                      className={TEXTAREA_CLASS}
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Additional comments"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDecline}
                      disabled={submitting}
                    >
                      Decline
                    </Button>
                    <Button type="submit" variant="gradient" disabled={submitting || !rate}>
                      {submitting ? 'Submitting...' : 'Submit bid'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Tender status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {tender.status === 'awarded' ? 'This tender has been awarded.' :
                   tender.status === 'cancelled' ? 'This tender was cancelled.' :
                   tender.status === 'expired' ? 'This tender has expired.' :
                   offer?.status === 'expired' ? 'Your offer has expired.' :
                   'Bidding is not available.'}
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <div className="text-center">
        <Button variant="outline" onClick={() => navigate('/carrier-portal')}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
