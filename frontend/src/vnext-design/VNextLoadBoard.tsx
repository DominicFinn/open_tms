import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Inbox,
  Search,
  UserX,
  X,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FinancialSummary {
  expectedRevenueCents?: number;
  expectedCostCents?: number;
  expectedMarginCents?: number;
}

interface LoadBoardShipment {
  id: string;
  reference?: string;
  status: string;
  pickupDate?: string;
  deliveryDate?: string;
  customer?: { id: string; name: string };
  origin?: { id: string; name: string; city: string; state: string };
  destination?: { id: string; name: string; city: string; state: string };
  lane?: { id: string; name: string };
  shipmentFinancialSummary?: FinancialSummary | null;
  tenders?: { id: string; status: string; strategy: string }[];
}

interface MatchingCarrier {
  id: string;
  name: string;
  mcNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  scacCode?: string;
  laneRate?: {
    priceCents?: number;
    rateType?: string;
    fuelSurchargePercent?: number;
    serviceLevel?: string;
    isContractRate?: boolean;
  } | null;
  tenderStats?: {
    totalBids: number;
    acceptedBids: number;
    acceptanceRate?: number | null;
  };
  matchSource: 'lane_rate' | 'historical';
}

function formatDate(d?: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCents(cents?: number | null): string {
  if (cents == null) return '-';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysUntilPickup(d?: string): string {
  if (!d) return '';
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

function pickupUrgencyVariant(d?: string): 'destructive' | 'warning' | 'info' {
  if (!d) return 'info';
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'destructive';
  if (days <= 1) return 'warning';
  return 'info';
}

export default function VNextLoadBoard() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<LoadBoardShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [carriers, setCarriers] = useState<MatchingCarrier[]>([]);
  const [carriersLoading, setCarriersLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [assignModal, setAssignModal] = useState<{ shipmentId: string; carrier: MatchingCarrier } | null>(null);
  const [assignRate, setAssignRate] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/loadboard`);
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const json = await res.json();
        if (!cancelled) setShipments(json.data || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedId) { setCarriers([]); return; }
    let cancelled = false;
    (async () => {
      try {
        setCarriersLoading(true);
        const res = await fetch(`${API_URL}/api/v1/loadboard/${selectedId}/matching-carriers`);
        if (!res.ok) throw new Error('Failed to load carriers');
        const json = await res.json();
        if (!cancelled) setCarriers(json.data?.carriers || []);
      } catch {
        if (!cancelled) setCarriers([]);
      } finally {
        if (!cancelled) setCarriersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const filtered = shipments.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.reference?.toLowerCase().includes(q) ||
      s.customer?.name.toLowerCase().includes(q) ||
      s.origin?.city?.toLowerCase().includes(q) ||
      s.destination?.city?.toLowerCase().includes(q)
    );
  });

  const selectedShipment = shipments.find(s => s.id === selectedId);

  async function handleAssign() {
    if (!assignModal) return;
    const rateCents = Math.round(parseFloat(assignRate) * 100);
    if (isNaN(rateCents) || rateCents <= 0) {
      setAssignError('Enter a valid rate');
      return;
    }
    setAssigning(true);
    setAssignError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/loadboard/${assignModal.shipmentId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierId: assignModal.carrier.id,
          costRateCents: rateCents,
          notes: assignNotes || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Assignment failed');
      }
      setShipments(prev => prev.filter(s => s.id !== assignModal.shipmentId));
      setSelectedId(null);
      setAssignModal(null);
      setAssignRate('');
      setAssignNotes('');
    } catch (err: any) {
      setAssignError(err.message);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Load Board</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {shipments.length} shipment{shipments.length !== 1 ? 's' : ''} awaiting carrier assignment
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className={cn('grid gap-6', selectedId ? 'lg:grid-cols-[1fr_400px]' : 'grid-cols-1')}>
        {/* Left: Shipment cards */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by reference, customer, city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <Inbox className="h-10 w-10" />
                <h3 className="text-base font-medium">No loads available</h3>
                <p className="text-sm">All shipments have carriers assigned</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(s => (
                <Card
                  key={s.id}
                  onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                  className={cn(
                    'cursor-pointer transition-colors',
                    s.id === selectedId ? 'border-primary' : 'hover:border-primary/40',
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{s.reference || s.id.slice(0, 8)}</span>
                          <Badge variant="muted">{s.status}</Badge>
                          {s.tenders && s.tenders.length > 0 && (
                            <Badge variant="info">Tender {s.tenders[0].status}</Badge>
                          )}
                        </div>
                        <div className="mb-1 text-sm text-muted-foreground">
                          {s.customer?.name || 'Unknown customer'}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span>{s.origin ? `${s.origin.city}, ${s.origin.state}` : '-'}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span>{s.destination ? `${s.destination.city}, ${s.destination.state}` : '-'}</span>
                        </div>
                      </div>
                      <div className="min-w-[100px] text-right">
                        {s.pickupDate && (
                          <div className="mb-1">
                            <Badge variant={pickupUrgencyVariant(s.pickupDate)}>
                              {daysUntilPickup(s.pickupDate)}
                            </Badge>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">PU: {formatDate(s.pickupDate)}</div>
                        {s.shipmentFinancialSummary?.expectedRevenueCents != null && (
                          <div className="mt-1 text-sm font-semibold text-primary">
                            {formatCents(s.shipmentFinancialSummary.expectedRevenueCents)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right: Carrier search panel */}
        {selectedId && (
          <div>
            <Card className="lg:sticky lg:top-20">
              <div className="border-b border-border p-5">
                <h3 className="text-base font-semibold">Matching Carriers</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedShipment?.reference} - {selectedShipment?.origin?.city} to {selectedShipment?.destination?.city}
                </p>
              </div>

              {carriersLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading...</div>
              ) : carriers.length === 0 ? (
                <div className="p-6 text-center">
                  <UserX className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No matching carriers found for this lane
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate(`/carrier-bidding`)}
                  >
                    Create Tender
                  </Button>
                </div>
              ) : (
                <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
                  {carriers.map(c => (
                    <div key={c.id} className="border-b border-border p-4 last:border-b-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-semibold">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.mcNumber ? `MC-${c.mcNumber}` : ''}{c.scacCode ? ` / ${c.scacCode}` : ''}
                          </div>
                          {c.contactName && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {c.contactName}{c.contactPhone ? ` - ${c.contactPhone}` : ''}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {c.laneRate?.priceCents != null && (
                            <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                              {formatCents(c.laneRate.priceCents)}
                              {c.laneRate.isContractRate && (
                                <Badge variant="success" className="text-[10px]">Contract</Badge>
                              )}
                            </div>
                          )}
                          <Badge variant={c.matchSource === 'lane_rate' ? 'info' : 'muted'} className="text-[10px]">
                            {c.matchSource === 'lane_rate' ? 'Lane Rate' : 'Historical'}
                          </Badge>
                        </div>
                      </div>
                      {c.tenderStats && c.tenderStats.totalBids > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Acceptance: {c.tenderStats.acceptanceRate ?? 0}% ({c.tenderStats.acceptedBids}/{c.tenderStats.totalBids} bids)
                        </div>
                      )}
                      <div className="mt-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setAssignModal({ shipmentId: selectedId!, carrier: c });
                            setAssignRate(c.laneRate?.priceCents ? (c.laneRate.priceCents / 100).toFixed(2) : '');
                            setAssignNotes('');
                            setAssignError('');
                          }}
                        >
                          Assign
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 border-t border-border p-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/shipments/${selectedId}`)}
                >
                  View Shipment
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/carrier-bidding`)}
                >
                  Create Tender
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      <Dialog open={!!assignModal} onOpenChange={open => !open && setAssignModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Carrier</DialogTitle>
          </DialogHeader>
          {assignModal && (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">Shipment</div>
                <div className="font-semibold">
                  {shipments.find(s => s.id === assignModal.shipmentId)?.reference || assignModal.shipmentId.slice(0, 8)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Carrier</div>
                <div className="font-semibold">{assignModal.carrier.name}</div>
              </div>
              <div className="space-y-2">
                <Label>Cost Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={assignRate}
                  onChange={e => setAssignRate(e.target.value)}
                />
              </div>
              {assignModal.carrier.laneRate?.priceCents != null && (
                <div className="text-xs text-muted-foreground">
                  Lane rate: {formatCents(assignModal.carrier.laneRate.priceCents)}
                  {assignModal.carrier.laneRate.isContractRate ? ' (contract)' : ''}
                </div>
              )}
              {selectedShipment?.shipmentFinancialSummary?.expectedRevenueCents != null && assignRate && (
                <div className="rounded-md bg-muted/30 p-3 text-sm">
                  <div className="flex justify-between">
                    <span>Sell rate:</span>
                    <span className="font-semibold">{formatCents(selectedShipment.shipmentFinancialSummary.expectedRevenueCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buy rate:</span>
                    <span className="font-semibold">{formatCents(Math.round(parseFloat(assignRate) * 100))}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1">
                    <span>Margin:</span>
                    <span
                      className={cn(
                        'font-bold',
                        (selectedShipment.shipmentFinancialSummary.expectedRevenueCents - Math.round(parseFloat(assignRate) * 100)) > 0
                          ? 'text-success'
                          : 'text-destructive',
                      )}
                    >
                      {formatCents(selectedShipment.shipmentFinancialSummary.expectedRevenueCents - Math.round(parseFloat(assignRate) * 100))}
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={2}
                  value={assignNotes}
                  onChange={e => setAssignNotes(e.target.value)}
                  placeholder="Internal notes..."
                />
              </div>
              {assignError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {assignError}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModal(null)}>Cancel</Button>
            <Button variant="gradient" onClick={handleAssign} disabled={assigning}>
              {assigning ? 'Assigning...' : 'Assign Carrier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
