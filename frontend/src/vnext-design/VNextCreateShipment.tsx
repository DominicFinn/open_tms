import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  Box,
  ChevronRight,
  CircleAlert,
  FlagTriangleRight,
  Info,
  Loader2,
  MapPin,
  PencilLine,
  Plus,
  Save,
  StickyNote,
  Tag,
} from 'lucide-react';

import { API_URL } from '../api';
import {
  validateShipmentAgainstType,
  applyShipmentTypeDefaults,
  SHIPMENT_FIELD_LABELS,
  ShipmentTypeConfig,
} from '../shared/shipmentTypeValidator';
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
import { cn } from '@/lib/utils';

interface ShipmentTypeRow extends ShipmentTypeConfig {
  id: string;
  description?: string | null;
}

export default function VNextCreateShipment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [shipmentTypeId, setShipmentTypeId] = useState('');
  const [shipmentTypes, setShipmentTypes] = useState<ShipmentTypeRow[]>([]);

  const [customer, setCustomer] = useState('');
  const [reference, setReference] = useState('');
  const [mode, setMode] = useState('');
  const [proNumber, setProNumber] = useState('');

  const [originLocation, setOriginLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [hasPickupWindow, setHasPickupWindow] = useState(false);
  const [pickupWindowStart, setPickupWindowStart] = useState('');
  const [pickupWindowEnd, setPickupWindowEnd] = useState('');

  const [destLocation, setDestLocation] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [hasDeliveryWindow, setHasDeliveryWindow] = useState(false);
  const [deliveryWindowStart, setDeliveryWindowStart] = useState('');
  const [deliveryWindowEnd, setDeliveryWindowEnd] = useState('');

  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('lb');
  const [pieces, setPieces] = useState('');
  const [commodity, setCommodity] = useState('');
  const [tempControlled, setTempControlled] = useState(false);
  const [tempMode, setTempMode] = useState('ambient');
  const [hazmat, setHazmat] = useState(false);

  const [notes, setNotes] = useState('');
  const [laneId, setLaneId] = useState('');

  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [, setLanes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedType = useMemo(
    () => shipmentTypes.find(t => t.id === shipmentTypeId) || null,
    [shipmentTypeId, shipmentTypes],
  );

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v1/customers`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/locations`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/lanes`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/shipment-types`).then(r => r.json()),
    ]).then(([cRes, lRes, laRes, stRes]) => {
      setCustomers(cRes.data || []);
      setLocations(lRes.data || []);
      setLanes(laRes.data || []);
      setShipmentTypes(stRes.data || []);
    }).catch(() => {});
  }, []);

  const applyTypeDefaults = (typeId: string) => {
    setShipmentTypeId(typeId);
    const type = shipmentTypes.find(t => t.id === typeId);
    if (!type) return;
    const current = {
      customerId: customer,
      originId: originLocation,
      destinationId: destLocation,
      reference,
      proNumber,
      pickupDate,
      deliveryDate,
      pickupWindowStart,
      pickupWindowEnd,
      deliveryWindowStart,
      deliveryWindowEnd,
    } as Record<string, string>;
    const merged = applyShipmentTypeDefaults(current as any, type);
    if (merged.customerId && !customer) setCustomer(String(merged.customerId));
    if (merged.originId && !originLocation) setOriginLocation(String(merged.originId));
    if (merged.destinationId && !destLocation) setDestLocation(String(merged.destinationId));
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/shipments/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(json => {
        const s = json.data;
        if (!s) return;
        setCustomer(s.customerId || '');
        setReference(s.reference || '');
        setProNumber(s.proNumber || '');
        setOriginLocation(s.originId || '');
        setDestLocation(s.destinationId || '');
        setPickupDate(s.pickupDate ? s.pickupDate.slice(0, 10) : '');
        setDeliveryDate(s.deliveryDate ? s.deliveryDate.slice(0, 10) : '');
        if (s.pickupWindowStart || s.pickupWindowEnd) {
          setHasPickupWindow(true);
          setPickupWindowStart(s.pickupWindowStart ? s.pickupWindowStart.slice(0, 16) : '');
          setPickupWindowEnd(s.pickupWindowEnd ? s.pickupWindowEnd.slice(0, 16) : '');
        }
        if (s.deliveryWindowStart || s.deliveryWindowEnd) {
          setHasDeliveryWindow(true);
          setDeliveryWindowStart(s.deliveryWindowStart ? s.deliveryWindowStart.slice(0, 16) : '');
          setDeliveryWindowEnd(s.deliveryWindowEnd ? s.deliveryWindowEnd.slice(0, 16) : '');
        }
        setShipmentTypeId(s.shipmentTypeId || '');
        setLaneId(s.laneId || '');
      })
      .catch(err => setSubmitError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const missingRequired = useMemo(() => {
    if (!selectedType) return [] as string[];
    const shipment = {
      customerId: customer,
      originId: originLocation,
      destinationId: destLocation,
      reference,
      proNumber,
      pickupDate,
      deliveryDate,
      pickupWindowStart: hasPickupWindow ? pickupWindowStart : '',
      pickupWindowEnd: hasPickupWindow ? pickupWindowEnd : '',
      deliveryWindowStart: hasDeliveryWindow ? deliveryWindowStart : '',
      deliveryWindowEnd: hasDeliveryWindow ? deliveryWindowEnd : '',
    };
    return validateShipmentAgainstType(shipment, selectedType).missing;
  }, [
    selectedType, customer, originLocation, destLocation, reference, proNumber,
    pickupDate, deliveryDate,
    hasPickupWindow, pickupWindowStart, pickupWindowEnd,
    hasDeliveryWindow, deliveryWindowStart, deliveryWindowEnd,
  ]);

  const isFieldRequired = (field: string) => selectedType?.requiredFields?.includes(field) ?? false;

  const reqMark = (field: string) =>
    isFieldRequired(field) ? <span className="text-destructive"> *</span> : null;

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const body: any = {
        reference: reference || undefined,
        proNumber: proNumber || undefined,
        customerId: customer || undefined,
        originId: originLocation || undefined,
        destinationId: destLocation || undefined,
        laneId: laneId || undefined,
        shipmentTypeId: shipmentTypeId || undefined,
        pickupDate: pickupDate || undefined,
        deliveryDate: deliveryDate || undefined,
        pickupWindowStart: hasPickupWindow && pickupWindowStart ? pickupWindowStart : undefined,
        pickupWindowEnd: hasPickupWindow && pickupWindowEnd ? pickupWindowEnd : undefined,
        deliveryWindowStart: hasDeliveryWindow && deliveryWindowStart ? deliveryWindowStart : undefined,
        deliveryWindowEnd: hasDeliveryWindow && deliveryWindowEnd ? deliveryWindowEnd : undefined,
      };
      if (!isEdit) body.status = 'draft';
      const url = isEdit ? `${API_URL}/api/v1/shipments/${id}` : `${API_URL}/api/v1/shipments`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to save shipment');
      navigate(isEdit ? `/shipments/${id}` : '/shipments');
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/shipments" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Shipments
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{isEdit ? 'Edit shipment' : 'New shipment'}</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isEdit ? 'Edit shipment' : 'New shipment'}
        </h1>
      </div>

      {shipmentTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Shipment type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShipmentTypeId('')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors',
                  shipmentTypeId === ''
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <Ban className="h-4 w-4" />
                No template
              </button>
              {shipmentTypes.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTypeDefaults(t.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors',
                    shipmentTypeId === t.id ? 'bg-card' : 'border-border hover:border-primary/40 bg-transparent',
                  )}
                  style={shipmentTypeId === t.id ? { borderColor: t.color, background: `${t.color}15` } : undefined}
                  title={t.description || undefined}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </button>
              ))}
            </div>
            {selectedType?.description && (
              <p className="mt-3 text-sm text-muted-foreground">{selectedType.description}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Basic information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Customer{reqMark('customerId')}</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference{reqMark('reference')}</Label>
            <Input
              type="text"
              placeholder="Auto-generated if left blank"
              value={reference}
              onChange={e => setReference(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ftl">FTL</SelectItem>
                <SelectItem value="ltl">LTL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>PRO number{reqMark('proNumber')}</Label>
            <Input
              type="text"
              placeholder="Enter PRO number"
              value={proNumber}
              onChange={e => setProNumber(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Origin
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Location{reqMark('originId')}</Label>
            <Select value={originLocation} onValueChange={setOriginLocation}>
              <SelectTrigger>
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
            <Label>Pickup date{reqMark('pickupDate')}</Label>
            <Input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={hasPickupWindow}
                onChange={e => {
                  setHasPickupWindow(e.target.checked);
                  if (!e.target.checked) {
                    setPickupWindowStart('');
                    setPickupWindowEnd('');
                  }
                }}
                className="h-4 w-4 rounded border border-input bg-background accent-primary"
              />
              Specify pickup window
              {(isFieldRequired('pickupWindowStart') || isFieldRequired('pickupWindowEnd')) && (
                <span className="text-destructive">*</span>
              )}
            </label>
          </div>
          {hasPickupWindow && (
            <>
              <div className="space-y-2">
                <Label>Window start</Label>
                <Input
                  type="datetime-local"
                  value={pickupWindowStart}
                  onChange={e => setPickupWindowStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Window end</Label>
                <Input
                  type="datetime-local"
                  value={pickupWindowEnd}
                  onChange={e => setPickupWindowEnd(e.target.value)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlagTriangleRight className="h-4 w-4 text-primary" />
            Destination
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Location{reqMark('destinationId')}</Label>
            <Select value={destLocation} onValueChange={setDestLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.name} - {l.city}, {l.state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Delivery date{reqMark('deliveryDate')}</Label>
            <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={hasDeliveryWindow}
                onChange={e => {
                  setHasDeliveryWindow(e.target.checked);
                  if (!e.target.checked) {
                    setDeliveryWindowStart('');
                    setDeliveryWindowEnd('');
                  }
                }}
                className="h-4 w-4 rounded border border-input bg-background accent-primary"
              />
              Specify delivery window
              {(isFieldRequired('deliveryWindowStart') || isFieldRequired('deliveryWindowEnd')) && (
                <span className="text-destructive">*</span>
              )}
            </label>
          </div>
          {hasDeliveryWindow && (
            <>
              <div className="space-y-2">
                <Label>Window start</Label>
                <Input
                  type="datetime-local"
                  value={deliveryWindowStart}
                  onChange={e => setDeliveryWindowStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Window end</Label>
                <Input
                  type="datetime-local"
                  value={deliveryWindowEnd}
                  onChange={e => setDeliveryWindowEnd(e.target.value)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            Cargo
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Weight</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="flex-1"
              />
              <Select value={weightUnit} onValueChange={setWeightUnit}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lb">lb</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Pieces</Label>
            <Input
              type="number"
              placeholder="0"
              value={pieces}
              onChange={e => setPieces(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Commodity</Label>
            <Input
              type="text"
              placeholder="Enter commodity description"
              value={commodity}
              onChange={e => setCommodity(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={tempControlled}
                onChange={e => setTempControlled(e.target.checked)}
                className="h-4 w-4 rounded border border-input bg-background accent-primary"
              />
              Temperature controlled
            </label>
            {tempControlled && (
              <Select value={tempMode} onValueChange={setTempMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambient">Ambient</SelectItem>
                  <SelectItem value="refrigerated">Refrigerated</SelectItem>
                  <SelectItem value="frozen">Frozen</SelectItem>
                </SelectContent>
              </Select>
            )}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-primary" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            rows={4}
            placeholder="Enter any additional notes or special instructions..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </CardContent>
      </Card>

      {missingRequired.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          <Info className="h-5 w-5 shrink-0" />
          <div>
            <strong>Missing fields required by "{selectedType?.name}":</strong>{' '}
            {missingRequired.map(f => SHIPMENT_FIELD_LABELS[f] || f).join(', ')}.
            <div className="mt-1 text-xs text-muted-foreground">
              You can still save as a draft. The shipment cannot leave draft status until these are filled in.
            </div>
          </div>
        </div>
      )}

      {submitError && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {submitError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" asChild>
          <Link to={isEdit && id ? `/shipments/${id}` : '/shipments'}>Cancel</Link>
        </Button>
        <Button variant="gradient" onClick={handleSubmit} disabled={submitting}>
          {isEdit ? <Save className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />}
          {submitting
            ? 'Saving...'
            : isEdit
              ? 'Update shipment'
              : missingRequired.length > 0 ? 'Save as draft' : 'Create shipment'}
        </Button>
      </div>
    </div>
  );
}
