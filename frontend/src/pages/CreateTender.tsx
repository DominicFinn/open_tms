import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Megaphone, Waves, X } from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Shipment {
  id: string;
  reference: string;
  status: string;
  customer?: { name: string };
  origin?: { city: string; state: string | null };
  destination?: { city: string; state: string | null };
}

interface Carrier {
  id: string;
  name: string;
  mcNumber: string | null;
  scacCode: string | null;
  contactEmail: string | null;
}

const STEPS = ['Shipment', 'Strategy', 'Carriers', 'Details', 'Review'];

export default function CreateTender() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [shipmentId, setShipmentId] = useState('');
  const [strategy, setStrategy] = useState<'broadcast' | 'waterfall'>('broadcast');
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [targetRate, setTargetRate] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [notes, setNotes] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/shipments`).then(r => r.json()).then(j => {
      setShipments((j.data || []).filter((s: Shipment) => ['draft', 'planned'].includes(s.status)));
    });
    fetch(`${API_URL}/api/v1/carriers`).then(r => r.json()).then(j => {
      setCarriers(j.data || []);
    });
  }, []);

  function toggleCarrier(carrierId: string) {
    setSelectedCarriers(prev =>
      prev.includes(carrierId) ? prev.filter(c => c !== carrierId) : [...prev, carrierId],
    );
  }

  function moveCarrier(index: number, direction: 'up' | 'down') {
    const newList = [...selectedCarriers];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newList.length) return;
    [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
    setSelectedCarriers(newList);
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    const res = await fetch(`${API_URL}/api/v1/tenders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipmentId,
        strategy,
        carrierIds: selectedCarriers,
        tenderDurationMinutes: durationMinutes,
        targetRate: targetRate ? parseFloat(targetRate) : undefined,
        equipmentType: equipmentType || undefined,
        notes: notes || undefined,
        specialInstructions: specialInstructions || undefined,
      }),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      setLoading(false);
    } else {
      navigate(`/tenders/${json.data.id}`);
    }
  }

  const selectedShipment = shipments.find(s => s.id === shipmentId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Tender</h1>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step indicator */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={i}
            onClick={() => step > i + 1 && setStep(i + 1)}
            disabled={step <= i + 1}
            className={cn(
              'rounded-md px-4 py-2 text-sm transition-colors',
              step === i + 1
                ? 'bg-primary font-semibold text-primary-foreground'
                : step > i + 1
                  ? 'cursor-pointer bg-success text-background'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {/* Step 1: Select Shipment */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Select Shipment</CardTitle></CardHeader>
          <CardContent>
            <div className="grid max-h-[400px] gap-2 overflow-y-auto">
              {shipments.map(s => (
                <label
                  key={s.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors',
                    shipmentId === s.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                  )}
                >
                  <input
                    type="radio"
                    name="shipment"
                    checked={shipmentId === s.id}
                    onChange={() => setShipmentId(s.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <div>
                    <div className="font-semibold">{s.reference}</div>
                    <div className="text-sm text-muted-foreground">
                      {s.origin?.city}{s.origin?.state ? `, ${s.origin.state}` : ''} -&gt; {s.destination?.city}{s.destination?.state ? `, ${s.destination.state}` : ''}
                      {s.customer ? ` | ${s.customer.name}` : ''}
                    </div>
                  </div>
                </label>
              ))}
              {shipments.length === 0 && (
                <p className="text-center text-muted-foreground">No draft/planned shipments available</p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="gradient" onClick={() => setStep(2)} disabled={!shipmentId}>Next</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Strategy */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Tendering Strategy</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <label
                className={cn(
                  'cursor-pointer rounded-md border p-5',
                  strategy === 'broadcast' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                )}
              >
                <input
                  type="radio"
                  name="strategy"
                  checked={strategy === 'broadcast'}
                  onChange={() => setStrategy('broadcast')}
                  className="hidden"
                />
                <div className="mb-2 flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  <strong>Broadcast</strong>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send to all carriers simultaneously. Carriers submit competitive bids. Review and award the best bid.
                </p>
              </label>
              <label
                className={cn(
                  'cursor-pointer rounded-md border p-5',
                  strategy === 'waterfall' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                )}
              >
                <input
                  type="radio"
                  name="strategy"
                  checked={strategy === 'waterfall'}
                  onChange={() => setStrategy('waterfall')}
                  className="hidden"
                />
                <div className="mb-2 flex items-center gap-2">
                  <Waves className="h-5 w-5" />
                  <strong>Waterfall</strong>
                </div>
                <p className="text-sm text-muted-foreground">
                  Offer to carriers in ranked order. If one declines or times out, automatically move to the next.
                </p>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button variant="gradient" onClick={() => setStep(3)}>Next</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Select Carriers */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Select Carriers {strategy === 'waterfall' && '(reorder priority)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedCarriers.length > 0 && (
              <div className="mb-4">
                <Label className="mb-2 block">Selected ({selectedCarriers.length}):</Label>
                {selectedCarriers.map((cId, idx) => {
                  const carrier = carriers.find(c => c.id === cId);
                  return (
                    <div key={cId} className="mb-1.5 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5">
                      {strategy === 'waterfall' && (
                        <span className="min-w-[24px] font-bold text-primary">#{idx + 1}</span>
                      )}
                      <span className="flex-1 font-medium">{carrier?.name}</span>
                      <span className="text-xs text-muted-foreground">{carrier?.scacCode || carrier?.mcNumber || ''}</span>
                      {strategy === 'waterfall' && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveCarrier(idx, 'up')} disabled={idx === 0} title="Move up">
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveCarrier(idx, 'down')} disabled={idx === selectedCarriers.length - 1} title="Move down">
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => toggleCarrier(cId)} title="Remove">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <Label className="mb-2 block">Available Carriers:</Label>
            <div className="grid max-h-[300px] gap-1 overflow-y-auto">
              {carriers.filter(c => !selectedCarriers.includes(c.id)).map(c => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 hover:border-primary/40">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => toggleCarrier(c.id)}
                    className="h-4 w-4 rounded border border-input bg-background accent-primary"
                  />
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.scacCode || c.mcNumber || ''} {c.contactEmail ? `| ${c.contactEmail}` : ''}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button variant="gradient" onClick={() => setStep(4)} disabled={selectedCarriers.length === 0}>Next</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Parameters */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Tender Parameters</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Tender Duration (minutes)</Label>
                <Input
                  type="number"
                  min="1"
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(parseInt(e.target.value) || 120)}
                />
                <div className="text-xs text-muted-foreground">How long carriers have to respond</div>
              </div>
              <div className="space-y-2">
                <Label>Target Rate ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={targetRate}
                  onChange={e => setTargetRate(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Equipment Type</Label>
                <Select value={equipmentType || 'none'} onValueChange={v => setEquipmentType(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="53' Dry Van">53' Dry Van</SelectItem>
                    <SelectItem value="53' Reefer">53' Reefer</SelectItem>
                    <SelectItem value="Flatbed">Flatbed</SelectItem>
                    <SelectItem value="Step Deck">Step Deck</SelectItem>
                    <SelectItem value="LTL Shared">LTL Shared</SelectItem>
                    <SelectItem value="Tanker">Tanker</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes for carriers"
              />
            </div>
            <div className="space-y-2">
              <Label>Special Instructions</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={2}
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="Loading/unloading instructions, hazmat, etc."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button variant="gradient" onClick={() => setStep(5)}>Review</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <Card>
          <CardHeader><CardTitle>Review &amp; Create</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div><strong>Shipment:</strong> {selectedShipment?.reference} - {selectedShipment?.origin?.city} -&gt; {selectedShipment?.destination?.city}</div>
              <div className="flex items-center gap-2">
                <strong>Strategy:</strong>
                <Badge variant={strategy === 'broadcast' ? 'info' : 'muted'}>{strategy}</Badge>
              </div>
              <div><strong>Carriers:</strong> {selectedCarriers.map(id => carriers.find(c => c.id === id)?.name).join(', ')}</div>
              <div><strong>Duration:</strong> {durationMinutes} minutes</div>
              {targetRate && <div><strong>Target Rate:</strong> ${parseFloat(targetRate).toLocaleString()}</div>}
              {equipmentType && <div><strong>Equipment:</strong> {equipmentType}</div>}
              {notes && <div><strong>Notes:</strong> {notes}</div>}
              {specialInstructions && <div><strong>Instructions:</strong> {specialInstructions}</div>}
            </div>
            <div className="rounded-md border border-info/30 bg-info/10 p-3 text-sm text-info">
              The tender will be created in <strong>draft</strong> status. You can review it before opening it to carriers.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(4)}>Back</Button>
              <Button variant="gradient" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Creating...' : 'Create Tender'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
