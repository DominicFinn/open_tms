import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Check,
  ChevronRight,
  Gavel,
  Loader2,
  Plus,
  Star,
  Truck,
  X,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { keepMapSized } from '../lib/leafletMap';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';

interface Bid {
  carrier: string;
  rating: number;
  onTime: number;
  loads: number;
  price: number;
  transit: string;
  equipment: string;
  submitted: string;
  status: 'pending' | 'accepted' | 'declined';
}

function mapTenderToLane(t: any) {
  const origin = t.shipment?.origin;
  const dest = t.shipment?.destination;
  const originLabel = origin ? `${origin.city}, ${origin.state || ''}`.trim() : 'N/A';
  const destLabel = dest ? `${dest.city}, ${dest.state || ''}`.trim() : 'N/A';

  const statusMap: Record<string, string> = {
    draft: 'Draft',
    open: 'Open',
    evaluating: 'Open',
    awarded: 'Awarded',
    cancelled: 'Cancelled',
  };

  const relativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const bids: Bid[] = (t.offers || []).flatMap((offer: any) =>
    (offer.bids || []).map((bid: any) => ({
      carrier: offer.carrier?.name || 'Unknown Carrier',
      rating: 0,
      onTime: 0,
      loads: 0,
      price: bid.rate || 0,
      transit: bid.transitDays ? `${bid.transitDays} days` : 'N/A',
      equipment: bid.equipmentType || t.equipmentType || 'N/A',
      submitted: relativeTime(bid.createdAt),
      status: (bid.status === 'accepted' ? 'accepted' : bid.status === 'declined' ? 'declined' : 'pending') as Bid['status'],
    }))
  );

  return {
    id: t.reference || `TNR-${t.id?.slice(0, 6)}`,
    origin: originLabel,
    dest: destLabel,
    customer: t.shipment?.customer?.name || 'N/A',
    mode: t.equipmentType || 'FTL',
    weight: 'N/A',
    pickup: t.shipment?.pickupDate ? new Date(t.shipment.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
    delivery: t.shipment?.deliveryDate ? new Date(t.shipment.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
    targetRate: t.targetRate || 0,
    status: statusMap[t.status] || t.status || 'Unknown',
    bids,
    originCoords: [39.5, -98.5] as [number, number],
    destCoords: [39.5, -95.5] as [number, number],
  };
}

function BidStars({ rating }: { rating: number }) {
  const filled = Math.floor(rating);
  return (
    <div className="flex items-center gap-0.5" title={`${rating}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < filled ? 'fill-warning text-warning' : 'text-muted-foreground/40',
          )}
        />
      ))}
    </div>
  );
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default function VNextCarrierBidding() {
  const [lanes, setLanes] = useState<any[]>([]);
  const [selectedLane, setSelectedLane] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/tenders`)
      .then(r => r.json())
      .then(json => {
        const mapped = (json.data || []).map(mapTenderToLane);
        setLanes(mapped);
        if (mapped.length > 0) setSelectedLane(mapped[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mapRef.current || !selectedLane) return;
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([39.5, -98.5], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

    const cs = getComputedStyle(document.documentElement);
    const cOrigin = cs.getPropertyValue('--marker-origin').trim();
    const cDest = cs.getPropertyValue('--marker-destination').trim();
    const cDefault = cs.getPropertyValue('--marker-default').trim();

    L.polyline([selectedLane.originCoords, selectedLane.destCoords], {
      color: cDefault, weight: 3, opacity: 0.6, dashArray: '10 6',
    }).addTo(map);

    const oIcon = L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:${cOrigin};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10],
    });
    L.marker(selectedLane.originCoords, { icon: oIcon }).addTo(map).bindPopup(`<strong>Origin</strong><br/>${selectedLane.origin}`);

    const dIcon = L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:${cDest};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10],
    });
    L.marker(selectedLane.destCoords, { icon: dIcon }).addTo(map).bindPopup(`<strong>Destination</strong><br/>${selectedLane.dest}`);

    map.fitBounds(L.latLngBounds([selectedLane.originCoords, selectedLane.destCoords]).pad(0.3));
    mapInstance.current = map;
    const stopSizing = mapRef.current ? keepMapSized(map, mapRef.current) : () => {};

    return () => { stopSizing(); map.remove(); mapInstance.current = null; };
  }, [selectedLane?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  if (!selectedLane || lanes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Carrier bidding</h1>
            <p className="mt-1 text-sm text-muted-foreground">0 open bid requests</p>
          </div>
          <Button variant="gradient">
            <Plus className="h-4 w-4" />
            New bid request
          </Button>
        </div>
        <Card>
          <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
            <Gavel className="h-12 w-12 opacity-50" />
            <h3 className="text-lg font-medium">No tenders found</h3>
            <p className="text-sm">Create a new bid request to get started</p>
          </div>
        </Card>
      </div>
    );
  }

  const lowestBid = selectedLane.bids.length > 0 ? Math.min(...selectedLane.bids.map((b: Bid) => b.price)) : 0;
  const highestBid = selectedLane.bids.length > 0 ? Math.max(...selectedLane.bids.map((b: Bid) => b.price)) : 0;
  const targetDiff = lowestBid - selectedLane.targetRate;
  const overTarget = lowestBid > selectedLane.targetRate;

  const statusVariantFor = (status: string): BadgeVariant => {
    if (status === 'Open') return 'info';
    if (status === 'Awarded') return 'success';
    if (status === 'Cancelled') return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carrier bidding</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lanes.filter(l => l.status === 'Open').length} open bid requests &middot; {lanes.reduce((s, l) => s + l.bids.length, 0)} total bids
          </p>
        </div>
        <Button variant="gradient">
          <Plus className="h-4 w-4" />
          New bid request
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bid requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Separator />
              <ul className="divide-y divide-border">
                {lanes.map(lane => {
                  const isSelected = selectedLane.id === lane.id;
                  return (
                    <li key={lane.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedLane(lane)}
                        className={cn(
                          'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50',
                          isSelected && 'bg-muted/60',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-xs font-semibold text-primary">{lane.id}</span>
                            <Badge variant={statusVariantFor(lane.status)}>{lane.status}</Badge>
                          </div>
                          <div className="text-sm font-medium">
                            {lane.origin} <ChevronRight className="inline h-3 w-3 text-muted-foreground" /> {lane.dest}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {lane.customer} &middot; {lane.mode} &middot; {lane.weight}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs text-muted-foreground">Target: ${lane.targetRate.toLocaleString()}</div>
                          <div className="text-sm font-semibold">{lane.bids.length} bids</div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <CardTitle>
                  Bids for {selectedLane.origin} <ChevronRight className="inline h-3.5 w-3.5 text-muted-foreground" /> {selectedLane.dest}
                </CardTitle>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Target: <strong className="text-foreground">${selectedLane.targetRate.toLocaleString()}</strong></span>
                  <span>Range: <strong className="text-foreground">${lowestBid.toLocaleString()} - ${highestBid.toLocaleString()}</strong></span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedLane.bids
                .slice()
                .sort((a: Bid, b: Bid) => a.price - b.price)
                .map((bid: Bid, i: number) => {
                  const underTarget = bid.price <= selectedLane.targetRate;
                  return (
                    <div
                      key={bid.carrier}
                      className={cn(
                        'relative flex flex-wrap items-center gap-4 rounded-lg border border-border p-4 transition-colors',
                        bid.status === 'accepted' && 'border-success/50 bg-success/5',
                      )}
                    >
                      {i === 0 && bid.status === 'pending' && (
                        <div className="absolute left-4 top-0 -translate-y-1/2 rounded-md bg-success px-2 py-0.5 text-[10px] font-bold uppercase text-success-foreground">
                          Best value
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Truck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{bid.carrier}</div>
                          <div className="mt-1">
                            <BidStars rating={bid.rating} />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {bid.onTime}% on-time &middot; {bid.loads} loads YTD &middot; {bid.equipment}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn('text-xl font-bold tracking-tight', underTarget ? 'text-success' : 'text-foreground')}>
                          ${bid.price.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">{bid.transit} transit</div>
                        <div className="text-[11px] text-muted-foreground">Submitted {bid.submitted}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {bid.status === 'pending' ? (
                          <>
                            <Button size="sm" variant="default" className="bg-success text-success-foreground hover:bg-success/90">
                              <Check className="h-4 w-4" />
                              Accept
                            </Button>
                            <Button size="icon" variant="outline">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : bid.status === 'accepted' ? (
                          <Badge variant="success">
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Accepted
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Declined</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}

              {selectedLane.bids.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <Gavel className="h-10 w-10 opacity-50" />
                  <h3 className="text-base font-medium">No bids yet</h3>
                  <p className="text-sm">Waiting for carrier responses</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <div ref={mapRef} className="h-[280px] w-full overflow-hidden rounded-lg" />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lane details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoItem label="Customer">{selectedLane.customer}</InfoItem>
              <InfoItem label="Mode">{selectedLane.mode}</InfoItem>
              <InfoItem label="Weight">{selectedLane.weight}</InfoItem>
              <InfoItem label="Pickup date">{selectedLane.pickup}</InfoItem>
              <InfoItem label="Required delivery">{selectedLane.delivery}</InfoItem>
              <InfoItem label="Target rate">
                <span className="text-lg font-bold">${selectedLane.targetRate.toLocaleString()}</span>
              </InfoItem>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bid summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoItem label="Total bids">
                <span className="font-semibold">{selectedLane.bids.length}</span>
              </InfoItem>
              <InfoItem label="Lowest bid">
                <span className="font-semibold text-success">${lowestBid.toLocaleString()}</span>
              </InfoItem>
              <InfoItem label="Highest bid">
                <span className="font-semibold">${highestBid.toLocaleString()}</span>
              </InfoItem>
              <InfoItem label="vs target">
                <span className={cn('font-semibold', overTarget ? 'text-destructive' : 'text-success')}>
                  {overTarget ? '+' : '-'}${Math.abs(targetDiff).toLocaleString()}
                  {' '}({overTarget ? 'over' : 'under'})
                </span>
              </InfoItem>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
