import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Send, X } from 'lucide-react';

import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';
import { AddressFields, AddressValue, EMPTY_ADDRESS } from '@/components/AddressFields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

type Mode = 'ftl' | 'ltl' | 'parcel';
type WeightUnit = 'kg' | 'lb' | 'g';
type DimUnit = 'cm' | 'in' | 'mm';

interface LineItem {
  description: string;
  sku: string;
  quantity: number;
  unitOfMeasure: string;
  weight: string;          // kept as string for free input
  weightUnit: WeightUnit;
  length: string;
  width: string;
  height: string;
  dimUnit: DimUnit;
  unitPriceCents: string;
  hazmat: boolean;
  unNumber: string;
  hazmatClass: string;
  packingGroup: string;
  properShippingName: string;
  freightClass: string;
  nmfcCode: string;
  stackable: boolean;
  hsCode: string;
  countryOfOrigin: string;
  tempMinC: string;
  tempMaxC: string;
}

interface ModeRules {
  required: string[];
  recommended: string[];
  hidden: string[];
}

interface PackagingType {
  id: string;
  code: string;
  name: string;
  kind: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  stackable: boolean;
}

interface LineCartonResult {
  totalWeightLbs: number;
  totalCubeFt: number;
  densityLbsPerCubeFt: number | null;
  suggestedFreightClass: string | null;
  warnings: string[];
}

interface OrderCartonResult {
  lines: LineCartonResult[];
  rolledUpFreightClass: string | null;
  totalWeightLbs: number;
  totalCubeFt: number;
  palletPositions: number | null;
  linearFeet: number | null;
}

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const UOMS = ['each', 'pieces', 'cases', 'pallets', 'cartons', 'kg', 'lb'];
const PACKING_GROUPS = ['I', 'II', 'III'];

function emptyLine(): LineItem {
  return {
    description: '', sku: '', quantity: 1, unitOfMeasure: 'each',
    weight: '', weightUnit: 'kg',
    length: '', width: '', height: '', dimUnit: 'cm',
    unitPriceCents: '',
    hazmat: false, unNumber: '', hazmatClass: '', packingGroup: '', properShippingName: '',
    freightClass: '', nmfcCode: '', stackable: true,
    hsCode: '', countryOfOrigin: '',
    tempMinC: '', tempMaxC: '',
  };
}

function modeFor(serviceLevel: string): Mode {
  if (serviceLevel === 'FTL') return 'ftl';
  if (serviceLevel === 'LTL') return 'ltl';
  return 'parcel';
}

export default function CustomerCreateOrder() {
  const navigate = useNavigate();
  const [poNumber, setPoNumber] = useState('');
  const [serviceLevel, setServiceLevel] = useState('FTL');
  const [temperatureControl, setTemperatureControl] = useState<'ambient' | 'refrigerated' | 'frozen'>('ambient');
  const [requiresHazmat, setRequiresHazmat] = useState(false);
  const [international, setInternational] = useState(false);

  const [origin, setOrigin] = useState<AddressValue>(EMPTY_ADDRESS);
  const [destination, setDestination] = useState<AddressValue>(EMPTY_ADDRESS);
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [rules, setRules] = useState<ModeRules>({ required: [], recommended: [], hidden: [] });
  const [packagingTypes, setPackagingTypes] = useState<PackagingType[]>([]);
  const [packingSummary, setPackingSummary] = useState({
    packagingTypeId: '',
    unitCount: '',
    stackable: true,
    notes: '',
  });
  const [carton, setCarton] = useState<OrderCartonResult | null>(null);

  const mode = modeFor(serviceLevel);

  // Detect international from origin/destination country mismatch
  useEffect(() => {
    if (origin.country && destination.country && origin.country !== destination.country) {
      setInternational(true);
    }
  }, [origin.country, destination.country]);

  // Fetch mode rules whenever mode/flags change
  useEffect(() => {
    const flags = {
      hazmat: requiresHazmat || lineItems.some(l => l.hazmat),
      international,
      temperatureControlled: temperatureControl !== 'ambient',
    };
    const params = new URLSearchParams({
      mode,
      hazmat: String(flags.hazmat),
      international: String(flags.international),
      temperatureControlled: String(flags.temperatureControlled),
    });
    customerFetch(`${API_URL}/api/v1/order-line-items/mode-rules?${params.toString()}`)
      .then(r => r.json())
      .then(json => json.data && setRules(json.data))
      .catch(() => { /* ignore — UI degrades to all-optional */ });
  }, [mode, requiresHazmat, international, temperatureControl, lineItems]);

  // Load packaging types catalogue once
  useEffect(() => {
    customerFetch(`${API_URL}/api/v1/customer-portal/packaging-types`)
      .then(r => r.json())
      .then(json => setPackagingTypes(json.data || []))
      .catch(() => setPackagingTypes([]));
  }, []);

  // Live cartonization preview
  useEffect(() => {
    const handle = setTimeout(() => {
      const selectedType = packagingTypes.find(p => p.id === packingSummary.packagingTypeId);
      const body = {
        lines: lineItems.map(li => ({
          quantity: li.quantity,
          weight: li.weight ? parseFloat(li.weight) : null,
          weightUnit: li.weightUnit,
          length: li.length ? parseFloat(li.length) : null,
          width: li.width ? parseFloat(li.width) : null,
          height: li.height ? parseFloat(li.height) : null,
          dimUnit: li.dimUnit,
          freightClass: li.freightClass || null,
        })),
        packingSummary: packingSummary.unitCount ? {
          packagingTypeId: packingSummary.packagingTypeId || null,
          unitCount: parseInt(packingSummary.unitCount, 10) || 0,
          stackable: packingSummary.stackable,
          unitLengthMm: selectedType?.lengthMm ?? null,
          unitWidthMm: selectedType?.widthMm ?? null,
          unitHeightMm: selectedType?.heightMm ?? null,
        } : undefined,
      };
      customerFetch(`${API_URL}/api/v1/order-line-items/cartonization/preview`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
        .then(r => r.json())
        .then(json => setCarton(json.data))
        .catch(() => setCarton(null));
    }, 200);
    return () => clearTimeout(handle);
  }, [lineItems, packingSummary, packagingTypes]);

  const isRequired = (f: string) => rules.required.includes(f);
  const isHidden = (f: string) => rules.hidden.includes(f);
  const showField = (f: string) => !isHidden(f) && (isRequired(f) || rules.recommended.includes(f));

  const addItem = () => setLineItems([...lineItems, emptyLine()]);
  const removeItem = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<LineItem>) => {
    const updated = [...lineItems];
    updated[i] = { ...updated[i], ...patch };
    setLineItems(updated);
  };

  const summary = useMemo(() => {
    if (!carton) return null;
    return {
      totalWeightLbs: carton.totalWeightLbs,
      totalCubeFt: carton.totalCubeFt,
      rolledUpClass: carton.rolledUpFreightClass,
      palletPositions: carton.palletPositions,
      linearFeet: carton.linearFeet,
    };
  }, [carton]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poNumber.trim()) { setError('PO Number is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payload: any = {
        poNumber,
        serviceLevel,
        requiresHazmat: requiresHazmat || lineItems.some(l => l.hazmat),
        temperatureControl,
        originAddress1: origin.address1 || undefined,
        originAddress2: origin.address2 || undefined,
        originCity: origin.city || undefined,
        originState: origin.state || undefined,
        originPostalCode: origin.postalCode || undefined,
        originCountry: origin.country || undefined,
        originLat: origin.lat,
        originLng: origin.lng,
        destinationAddress1: destination.address1 || undefined,
        destinationAddress2: destination.address2 || undefined,
        destinationCity: destination.city || undefined,
        destinationState: destination.state || undefined,
        destinationPostalCode: destination.postalCode || undefined,
        destinationCountry: destination.country || undefined,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        requestedDeliveryDate: requestedDeliveryDate || undefined,
        specialInstructions: specialInstructions || undefined,
        lineItems: lineItems
          .filter(li => li.description.trim())
          .map(li => ({
            description: li.description,
            sku: li.sku || undefined,
            quantity: li.quantity,
            unitOfMeasure: li.unitOfMeasure,
            weight: li.weight ? parseFloat(li.weight) : undefined,
            weightUnit: li.weightUnit,
            length: li.length ? parseFloat(li.length) : undefined,
            width: li.width ? parseFloat(li.width) : undefined,
            height: li.height ? parseFloat(li.height) : undefined,
            dimUnit: li.dimUnit,
            unitPriceCents: li.unitPriceCents ? Math.round(parseFloat(li.unitPriceCents) * 100) : undefined,
            hazmat: li.hazmat,
            unNumber: li.unNumber || undefined,
            hazmatClass: li.hazmatClass || undefined,
            packingGroup: li.packingGroup || undefined,
            properShippingName: li.properShippingName || undefined,
            freightClass: li.freightClass || undefined,
            nmfcCode: li.nmfcCode || undefined,
            hsCode: li.hsCode || undefined,
            countryOfOrigin: li.countryOfOrigin || undefined,
            tempMinC: li.tempMinC ? parseFloat(li.tempMinC) : undefined,
            tempMaxC: li.tempMaxC ? parseFloat(li.tempMaxC) : undefined,
          })),
      };

      if (packingSummary.unitCount) {
        payload.packingSummary = {
          packagingTypeId: packingSummary.packagingTypeId || null,
          unitCount: parseInt(packingSummary.unitCount, 10),
          stackable: packingSummary.stackable,
          notes: packingSummary.notes || undefined,
        };
      }

      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/orders`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const orderNumber = json.data?.orderNumber || 'order';
      toast.success(`Order ${orderNumber} created`, {
        description: 'It will appear in your orders list shortly.',
        action: { label: 'View orders', onClick: () => navigate('/customer-portal/orders') },
      });
      navigate('/customer-portal/orders');
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to create order', { description: err.message });
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
                <DatePicker id="delivery-date" type="date" value={requestedDeliveryDate} onChange={e => setRequestedDeliveryDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temp-control">Temperature control</Label>
                <Select value={temperatureControl} onValueChange={v => setTemperatureControl(v as any)}>
                  <SelectTrigger id="temp-control">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambient">Ambient</SelectItem>
                    <SelectItem value="refrigerated">Refrigerated</SelectItem>
                    <SelectItem value="frozen">Frozen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={requiresHazmat} onChange={e => setRequiresHazmat(e.target.checked)} className="h-4 w-4 rounded border border-input bg-background accent-primary" />
                  Order contains hazardous materials
                </label>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={international} onChange={e => setInternational(e.target.checked)} className="h-4 w-4 rounded border border-input bg-background accent-primary" />
                  International shipment (customs)
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Origin</CardTitle>
            </CardHeader>
            <CardContent>
              <AddressFields idPrefix="origin" value={origin} onChange={setOrigin} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Destination</CardTitle>
            </CardHeader>
            <CardContent>
              <AddressFields idPrefix="destination" value={destination} onChange={setDestination} />
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
          <CardContent className="space-y-5">
            {lineItems.map((item, i) => (
              <div key={i} className="rounded-md border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">Line {i + 1}</span>
                  {lineItems.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-destructive" aria-label="Remove item">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                    <Label className="text-xs">Description {isRequired('description') && '*'}</Label>
                    <Input value={item.description} onChange={e => updateItem(i, { description: e.target.value })} placeholder="Item description" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">SKU {isRequired('sku') ? '*' : ''}</Label>
                    <Input value={item.sku} onChange={e => updateItem(i, { sku: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity {isRequired('quantity') && '*'}</Label>
                    <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(i, { quantity: parseInt(e.target.value, 10) || 1 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit of measure {isRequired('unitOfMeasure') && '*'}</Label>
                    <Select value={item.unitOfMeasure} onValueChange={v => updateItem(i, { unitOfMeasure: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UOMS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Weight {isRequired('weight') && '*'}</Label>
                    <div className="flex gap-2">
                      <Input type="number" step="0.01" value={item.weight} onChange={e => updateItem(i, { weight: e.target.value })} />
                      <Select value={item.weightUnit} onValueChange={v => updateItem(i, { weightUnit: v as WeightUnit })}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="lb">lb</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {showField('declaredValue') && (
                    <div className="space-y-1">
                      <Label className="text-xs">Declared value (per unit)</Label>
                      <Input type="number" step="0.01" value={item.unitPriceCents} onChange={e => updateItem(i, { unitPriceCents: e.target.value })} placeholder="0.00" />
                    </div>
                  )}

                  {(showField('length') || showField('width') || showField('height')) && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Length {isRequired('length') && '*'}</Label>
                        <Input type="number" step="0.1" value={item.length} onChange={e => updateItem(i, { length: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Width {isRequired('width') && '*'}</Label>
                        <Input type="number" step="0.1" value={item.width} onChange={e => updateItem(i, { width: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Height {isRequired('height') && '*'}</Label>
                        <div className="flex gap-2">
                          <Input type="number" step="0.1" value={item.height} onChange={e => updateItem(i, { height: e.target.value })} />
                          <Select value={item.dimUnit} onValueChange={v => updateItem(i, { dimUnit: v as DimUnit })}>
                            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cm">cm</SelectItem>
                              <SelectItem value="in">in</SelectItem>
                              <SelectItem value="mm">mm</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}

                  {showField('freightClass') && (
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Freight class {isRequired('freightClass') && '*'}
                        {carton?.lines?.[i]?.suggestedFreightClass && (
                          <span className="ml-2 text-muted-foreground"> (suggested: {carton.lines[i].suggestedFreightClass})</span>
                        )}
                      </Label>
                      <Input value={item.freightClass} onChange={e => updateItem(i, { freightClass: e.target.value })} placeholder="50, 70, 100..." />
                    </div>
                  )}

                  {showField('nmfcCode') && (
                    <div className="space-y-1">
                      <Label className="text-xs">NMFC code {isRequired('nmfcCode') && '*'}</Label>
                      <Input value={item.nmfcCode} onChange={e => updateItem(i, { nmfcCode: e.target.value })} placeholder="12345" />
                    </div>
                  )}

                  {showField('stackable') && (
                    <div className="space-y-1">
                      <Label className="text-xs">Stackable {isRequired('stackable') && '*'}</Label>
                      <Select value={String(item.stackable)} onValueChange={v => updateItem(i, { stackable: v === 'true' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="sm:col-span-2 lg:col-span-3 pt-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={item.hazmat} onChange={e => updateItem(i, { hazmat: e.target.checked })} className="h-4 w-4 rounded border border-input bg-background accent-primary" />
                      This line is hazmat
                    </label>
                  </div>

                  {item.hazmat && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">UN number {isRequired('unNumber') && '*'}</Label>
                        <Input value={item.unNumber} onChange={e => updateItem(i, { unNumber: e.target.value })} placeholder="UN1203" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hazmat class {isRequired('hazmatClass') && '*'}</Label>
                        <Input value={item.hazmatClass} onChange={e => updateItem(i, { hazmatClass: e.target.value })} placeholder="3" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Packing group {isRequired('packingGroup') && '*'}</Label>
                        <Select value={item.packingGroup} onValueChange={v => updateItem(i, { packingGroup: v })}>
                          <SelectTrigger><SelectValue placeholder="select" /></SelectTrigger>
                          <SelectContent>
                            {PACKING_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                        <Label className="text-xs">Proper shipping name {isRequired('properShippingName') && '*'}</Label>
                        <Input value={item.properShippingName} onChange={e => updateItem(i, { properShippingName: e.target.value })} placeholder="Gasoline" />
                      </div>
                    </>
                  )}

                  {showField('hsCode') && (
                    <div className="space-y-1">
                      <Label className="text-xs">HS code {isRequired('hsCode') && '*'}</Label>
                      <Input value={item.hsCode} onChange={e => updateItem(i, { hsCode: e.target.value })} placeholder="8471.30" />
                    </div>
                  )}

                  {showField('countryOfOrigin') && (
                    <div className="space-y-1">
                      <Label className="text-xs">Country of origin {isRequired('countryOfOrigin') && '*'}</Label>
                      <Input value={item.countryOfOrigin} onChange={e => updateItem(i, { countryOfOrigin: e.target.value.toUpperCase().slice(0, 2) })} placeholder="US" maxLength={2} />
                    </div>
                  )}

                  {showField('tempMinC') && (
                    <div className="space-y-1">
                      <Label className="text-xs">Temp min (°C) {isRequired('tempMinC') && '*'}</Label>
                      <Input type="number" step="0.1" value={item.tempMinC} onChange={e => updateItem(i, { tempMinC: e.target.value })} />
                    </div>
                  )}

                  {showField('tempMaxC') && (
                    <div className="space-y-1">
                      <Label className="text-xs">Temp max (°C) {isRequired('tempMaxC') && '*'}</Label>
                      <Input type="number" step="0.1" value={item.tempMaxC} onChange={e => updateItem(i, { tempMaxC: e.target.value })} />
                    </div>
                  )}
                </div>

                {carton?.lines?.[i] && (
                  <div className="mt-3 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Calculated:{' '}
                    {carton.lines[i].totalWeightLbs > 0 && <span>{carton.lines[i].totalWeightLbs.toFixed(1)} lb total · </span>}
                    {carton.lines[i].totalCubeFt > 0 && <span>{carton.lines[i].totalCubeFt.toFixed(2)} ft³ · </span>}
                    {carton.lines[i].densityLbsPerCubeFt != null && <span>density {carton.lines[i].densityLbsPerCubeFt!.toFixed(1)} lb/ft³ · </span>}
                    {carton.lines[i].suggestedFreightClass && <span>suggested class {carton.lines[i].suggestedFreightClass}</span>}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Packing summary</CardTitle>
            <p className="text-xs text-muted-foreground">How is this order packed? We auto-generate handling units from this summary.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Packaging type</Label>
                <Select value={packingSummary.packagingTypeId || 'none'} onValueChange={v => setPackingSummary(p => ({ ...p, packagingTypeId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">- not specified -</SelectItem>
                    {packagingTypes.map(pt => (
                      <SelectItem key={pt.id} value={pt.id}>{pt.kind}: {pt.code} - {pt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit count</Label>
                <Input type="number" min={0} value={packingSummary.unitCount} onChange={e => setPackingSummary(p => ({ ...p, unitCount: e.target.value }))} placeholder="e.g. 6" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stackable</Label>
                <Select value={String(packingSummary.stackable)} onValueChange={v => setPackingSummary(p => ({ ...p, stackable: v === 'true' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input value={packingSummary.notes} onChange={e => setPackingSummary(p => ({ ...p, notes: e.target.value }))} placeholder="optional" />
              </div>
            </div>

            {summary && (
              <div className="mt-4 grid gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <div className="text-xs text-muted-foreground">Total weight</div>
                  <div className="font-semibold">{summary.totalWeightLbs.toFixed(1)} lb</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total cube</div>
                  <div className="font-semibold">{summary.totalCubeFt.toFixed(2)} ft³</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Rolled-up class</div>
                  <div className="font-semibold">{summary.rolledUpClass ?? '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Pallet positions</div>
                  <div className="font-semibold">{summary.palletPositions ?? '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Linear feet</div>
                  <div className="font-semibold">{summary.linearFeet != null ? summary.linearFeet.toFixed(1) : '-'}</div>
                </div>
              </div>
            )}
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
