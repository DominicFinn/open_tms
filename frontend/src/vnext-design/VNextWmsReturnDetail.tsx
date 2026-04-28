import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, CircleAlert, Info, Loader2 } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RmaLine {
  id: string;
  sku: string;
  requestedQuantity: number;
  receivedQuantity: number;
  requestedDisposition: string | null;
  disposition: string;
  inspectionStatus: string;
  inspectionNotes: string | null;
  refundAmountCents: number;
}

interface RmaDetail {
  id: string;
  rmaNumber: string;
  customerId: string;
  orderId: string;
  status: string;
  returnReason: string;
  customerNotes: string | null;
  rejectionNotes: string | null;
  requestedAt: string;
  authorizedAt: string | null;
  receivedAt: string | null;
  completedAt: string | null;
  suggestedRefundCents: number;
  actualRefundCents: number | null;
  refundAdjustmentNotes: string | null;
  creditNoteId: string | null;
  initiatedVia: string;
  lines: RmaLine[];
  returnCarrierId: string | null;
  returnServiceLevel: string | null;
  returnTrackingNumber: string | null;
  returnLabelStorageKey: string | null;
  returnLabelFormat: string | null;
  returnLabelGeneratedAt: string | null;
  returnLabelProvider: string | null;
  returnPickupScheduledAt: string | null;
  returnPickupWindow: string | null;
  returnPickupConfirmationNumber: string | null;
  returnPickupCancelledAt: string | null;
}

interface CarrierOption {
  id: string;
  name: string;
  returnLabelProvider: string | null;
  returnLabelDefaultService: string | null;
}

const DISPOSITIONS = ['restock', 'refurb', 'scrap', 'recycle', 'donate', 'rtv', 'customer_keeps'];
const INSPECTION_STATUSES = ['pass', 'fail', 'partial_damage'];

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): BadgeVariant {
  switch (s) {
    case 'requested': return 'info';
    case 'authorized': case 'in_transit': case 'received': case 'inspecting': case 'dispositioning': return 'warning';
    case 'completed': case 'pass': case 'restock': return 'success';
    case 'rejected': case 'fail': case 'scrap': return 'destructive';
    default: return 'secondary';
  }
}

function formatStr(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rma, setRma] = useState<RmaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const [inspectingLineId, setInspectingLineId] = useState<string | null>(null);
  const [inspectionForm, setInspectionForm] = useState({ inspectionStatus: 'pass', disposition: '', inspectionNotes: '' });

  const [receivingLineId, setReceivingLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');

  const [showComplete, setShowComplete] = useState(false);
  const [actualRefund, setActualRefund] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [showPickupForm, setShowPickupForm] = useState(false);
  const [labelForm, setLabelForm] = useState({
    carrierId: '', providerOverride: 'default', serviceLevel: '',
    fromName: '', fromAddress1: '', fromCity: '', fromPostalCode: '', fromCountry: 'US',
    toName: '', toAddress1: '', toCity: '', toPostalCode: '', toCountry: 'US',
    weightKg: '1.0',
  });
  const [pickupForm, setPickupForm] = useState({
    pickupDate: '', pickupWindow: '',
    pickupName: '', pickupAddress1: '', pickupCity: '', pickupPostalCode: '', pickupCountry: 'US',
    notes: '',
  });

  const loadRma = () => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/rmas/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setRma(res.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRma(); }, [id]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/carriers`)
      .then(r => r.json())
      .then(res => { if (!res.error && Array.isArray(res.data)) setCarriers(res.data); })
      .catch(() => { });
  }, []);

  const handleAuthorize = async () => {
    setBusy('authorize'); setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/rmas/${id}/authorize`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.error) setError(data.error); else loadRma();
    } finally { setBusy(''); }
  };

  const handleReject = async () => {
    const notes = prompt('Rejection reason?');
    if (!notes) return;
    setBusy('reject'); setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/rmas/${id}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionNotes: notes }),
      });
      const data = await res.json();
      if (data.error) setError(data.error); else loadRma();
    } finally { setBusy(''); }
  };

  const handleReceive = async () => {
    if (!receivingLineId || !receiveQty) return;
    setBusy('receive'); setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/rma-lines/${receivingLineId}/receive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedQuantity: parseInt(receiveQty) }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setReceivingLineId(null); setReceiveQty(''); loadRma(); }
    } finally { setBusy(''); }
  };

  const handleInspect = async () => {
    if (!inspectingLineId || !inspectionForm.disposition) return;
    setBusy('inspect'); setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/rma-lines/${inspectingLineId}/inspect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionStatus: inspectionForm.inspectionStatus,
          disposition: inspectionForm.disposition,
          inspectionNotes: inspectionForm.inspectionNotes || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setInspectingLineId(null);
        setInspectionForm({ inspectionStatus: 'pass', disposition: '', inspectionNotes: '' });
        loadRma();
      }
    } finally { setBusy(''); }
  };

  const handleComplete = async () => {
    setBusy('complete'); setError('');
    try {
      const body: any = {};
      if (actualRefund && parseInt(actualRefund) * 100 !== rma!.suggestedRefundCents) {
        body.actualRefundCents = parseInt(actualRefund) * 100;
        if (refundNotes) body.refundAdjustmentNotes = refundNotes;
      }
      const res = await fetch(`${API_URL}/api/v1/rmas/${id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowComplete(false); loadRma(); }
    } finally { setBusy(''); }
  };

  const handleGenerateLabel = async () => {
    if (!labelForm.fromAddress1 || !labelForm.toAddress1 || !labelForm.weightKg) {
      setError('Origin address, destination address, and weight are required');
      return;
    }
    setBusy('label'); setError('');
    try {
      const body = {
        carrierId: labelForm.carrierId || undefined,
        providerOverride: labelForm.providerOverride === 'default' ? undefined : labelForm.providerOverride,
        serviceLevel: labelForm.serviceLevel || undefined,
        from: {
          name: labelForm.fromName, address1: labelForm.fromAddress1,
          city: labelForm.fromCity, postalCode: labelForm.fromPostalCode, country: labelForm.fromCountry,
        },
        to: {
          name: labelForm.toName, address1: labelForm.toAddress1,
          city: labelForm.toCity, postalCode: labelForm.toPostalCode, country: labelForm.toCountry,
        },
        parcels: [{ weightKg: parseFloat(labelForm.weightKg) }],
      };
      const res = await fetch(`${API_URL}/api/v1/rmas/${id}/return-label`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowLabelForm(false); loadRma(); }
    } finally { setBusy(''); }
  };

  const handleSchedulePickup = async () => {
    if (!pickupForm.pickupDate || !pickupForm.pickupAddress1) {
      setError('Pickup date and address are required');
      return;
    }
    setBusy('pickup'); setError('');
    try {
      const body = {
        pickupDate: new Date(pickupForm.pickupDate).toISOString(),
        pickupWindow: pickupForm.pickupWindow || undefined,
        notes: pickupForm.notes || undefined,
        address: {
          name: pickupForm.pickupName, address1: pickupForm.pickupAddress1,
          city: pickupForm.pickupCity, postalCode: pickupForm.pickupPostalCode, country: pickupForm.pickupCountry,
        },
      };
      const res = await fetch(`${API_URL}/api/v1/rmas/${id}/pickup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowPickupForm(false); loadRma(); }
    } finally { setBusy(''); }
  };

  const handleCancelPickup = async () => {
    const reason = prompt('Cancellation reason (optional):') ?? '';
    setBusy('cancel-pickup'); setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/rmas/${id}/pickup/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else loadRma();
    } finally { setBusy(''); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!rma) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error || 'Not found'}
      </div>
    );
  }

  const canAuthorize = rma.status === 'requested';
  const canReject = rma.status === 'requested' || rma.status === 'authorized';
  const canReceive = rma.status === 'authorized' || rma.status === 'in_transit' || rma.status === 'received';
  const canInspect = rma.status === 'received' || rma.status === 'inspecting';
  const canComplete = rma.status === 'dispositioning';
  const allLinesInspected = rma.lines.every(l => l.disposition !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/wms/returns" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Returns
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{rma.rmaNumber}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{rma.rmaNumber}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(rma.status)}>{formatStr(rma.status)}</Badge>
            <Badge variant="secondary">{formatStr(rma.returnReason)}</Badge>
            <span className="text-sm text-muted-foreground">Via: {formatStr(rma.initiatedVia)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {canAuthorize && <Button variant="gradient" onClick={handleAuthorize} disabled={!!busy}>Authorize</Button>}
          {canReject && <Button variant="outline" className="text-destructive" onClick={handleReject} disabled={!!busy}>Reject</Button>}
          {canComplete && <Button variant="gradient" onClick={() => { setActualRefund(String(rma.suggestedRefundCents / 100)); setShowComplete(true); }}>Complete &amp; Refund</Button>}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <div><strong>Requested:</strong> {new Date(rma.requestedAt).toLocaleString()}</div>
            {rma.authorizedAt && <div><strong>Authorized:</strong> {new Date(rma.authorizedAt).toLocaleString()}</div>}
            {rma.receivedAt && <div><strong>Received:</strong> {new Date(rma.receivedAt).toLocaleString()}</div>}
            {rma.completedAt && <div><strong>Completed:</strong> {new Date(rma.completedAt).toLocaleString()}</div>}
          </div>
          {rma.customerNotes && <div className="rounded-md bg-muted p-3 text-sm"><strong>Customer notes:</strong> {rma.customerNotes}</div>}
          {rma.rejectionNotes && <div className="rounded-md bg-muted p-3 text-sm text-destructive"><strong>Rejected:</strong> {rma.rejectionNotes}</div>}
          {rma.refundAdjustmentNotes && <div className="rounded-md bg-muted p-3 text-sm"><strong>Refund adjustment:</strong> {rma.refundAdjustmentNotes}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refund</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-8">
            <div>
              <div className="text-xs text-muted-foreground">Suggested</div>
              <div className="text-2xl font-bold">${(rma.suggestedRefundCents / 100).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Actual</div>
              <div className={`text-2xl font-bold ${rma.actualRefundCents != null ? 'text-primary' : 'text-muted-foreground'}`}>
                {rma.actualRefundCents != null ? `$${(rma.actualRefundCents / 100).toFixed(2)}` : '-'}
              </div>
            </div>
            {rma.creditNoteId && (
              <div>
                <div className="text-xs text-muted-foreground">Credit Note</div>
                <Button variant="outline" size="sm" onClick={() => navigate(`/finance/credit-notes/${rma.creditNoteId}`)}>View</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {rma.status !== 'rejected' && rma.status !== 'completed' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Return Shipping</CardTitle>
            <div className="flex gap-2">
              {!rma.returnLabelStorageKey && rma.status !== 'requested' && (
                <Button variant="gradient" onClick={() => setShowLabelForm(v => !v)} disabled={!!busy}>Generate Label</Button>
              )}
              {rma.returnLabelStorageKey && (
                <Button variant="outline" asChild>
                  <a href={`${API_URL}/api/v1/rmas/${rma.id}/return-label/download`} target="_blank" rel="noreferrer">Download Label</a>
                </Button>
              )}
              {rma.returnTrackingNumber && !rma.returnPickupScheduledAt && !rma.returnPickupCancelledAt && (
                <Button variant="gradient" onClick={() => setShowPickupForm(v => !v)} disabled={!!busy}>Schedule Pickup</Button>
              )}
              {rma.returnPickupScheduledAt && !rma.returnPickupCancelledAt && (
                <Button variant="outline" className="text-destructive" onClick={handleCancelPickup} disabled={!!busy}>Cancel Pickup</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {rma.returnTrackingNumber && (
              <div className="flex flex-wrap gap-6 text-sm">
                <div><strong>Provider:</strong> {rma.returnLabelProvider ?? '-'}</div>
                <div><strong>Service:</strong> {rma.returnServiceLevel ?? '-'}</div>
                <div><strong>Tracking:</strong> {rma.returnTrackingNumber}</div>
                {rma.returnLabelGeneratedAt && <div><strong>Label issued:</strong> {new Date(rma.returnLabelGeneratedAt).toLocaleString()}</div>}
              </div>
            )}

            {rma.returnPickupScheduledAt && (
              <div className="flex flex-wrap gap-6 border-t border-border pt-3 text-sm">
                <div><strong>Pickup:</strong> {new Date(rma.returnPickupScheduledAt).toLocaleString()}</div>
                {rma.returnPickupWindow && <div><strong>Window:</strong> {rma.returnPickupWindow}</div>}
                {rma.returnPickupConfirmationNumber && <div><strong>Confirmation:</strong> {rma.returnPickupConfirmationNumber}</div>}
                {rma.returnPickupCancelledAt && <div className="text-destructive"><strong>Cancelled:</strong> {new Date(rma.returnPickupCancelledAt).toLocaleString()}</div>}
              </div>
            )}

            {showLabelForm && (
              <div className="rounded-md bg-muted p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Carrier</Label>
                    <Select
                      value={labelForm.carrierId || 'none'}
                      onValueChange={(v) => {
                        const carrierId = v === 'none' ? '' : v;
                        const c = carriers.find(c => c.id === carrierId);
                        setLabelForm(f => ({ ...f, carrierId, serviceLevel: c?.returnLabelDefaultService ?? f.serviceLevel }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select carrier (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {carriers.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}{c.returnLabelProvider ? ` (${c.returnLabelProvider})` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider Override</Label>
                    <Select value={labelForm.providerOverride} onValueChange={v => setLabelForm(f => ({ ...f, providerOverride: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Use carrier default</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="fedex">FedEx</SelectItem>
                        <SelectItem value="ups">UPS</SelectItem>
                        <SelectItem value="dhl">DHL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Service Level</Label>
                    <Input value={labelForm.serviceLevel} placeholder="ground" onChange={e => setLabelForm(f => ({ ...f, serviceLevel: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Parcel Weight (kg)</Label>
                    <Input type="number" step="0.1" value={labelForm.weightKg} onChange={e => setLabelForm(f => ({ ...f, weightKg: e.target.value }))} />
                  </div>
                </div>
                <h4 className="mt-4 text-sm font-semibold">From (customer)</h4>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <Input placeholder="Name" value={labelForm.fromName} onChange={e => setLabelForm(f => ({ ...f, fromName: e.target.value }))} />
                  <Input placeholder="Address line 1" value={labelForm.fromAddress1} onChange={e => setLabelForm(f => ({ ...f, fromAddress1: e.target.value }))} />
                  <Input placeholder="City" value={labelForm.fromCity} onChange={e => setLabelForm(f => ({ ...f, fromCity: e.target.value }))} />
                  <Input placeholder="Postal code" value={labelForm.fromPostalCode} onChange={e => setLabelForm(f => ({ ...f, fromPostalCode: e.target.value }))} />
                  <Input placeholder="Country" value={labelForm.fromCountry} onChange={e => setLabelForm(f => ({ ...f, fromCountry: e.target.value }))} />
                </div>
                <h4 className="mt-4 text-sm font-semibold">To (receiving warehouse)</h4>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <Input placeholder="Name" value={labelForm.toName} onChange={e => setLabelForm(f => ({ ...f, toName: e.target.value }))} />
                  <Input placeholder="Address line 1" value={labelForm.toAddress1} onChange={e => setLabelForm(f => ({ ...f, toAddress1: e.target.value }))} />
                  <Input placeholder="City" value={labelForm.toCity} onChange={e => setLabelForm(f => ({ ...f, toCity: e.target.value }))} />
                  <Input placeholder="Postal code" value={labelForm.toPostalCode} onChange={e => setLabelForm(f => ({ ...f, toPostalCode: e.target.value }))} />
                  <Input placeholder="Country" value={labelForm.toCountry} onChange={e => setLabelForm(f => ({ ...f, toCountry: e.target.value }))} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="gradient" onClick={handleGenerateLabel} disabled={!!busy}>Generate</Button>
                  <Button variant="outline" onClick={() => setShowLabelForm(false)} disabled={!!busy}>Cancel</Button>
                </div>
              </div>
            )}

            {showPickupForm && (
              <div className="rounded-md bg-muted p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Pickup Date/Time</Label>
                    <Input type="datetime-local" value={pickupForm.pickupDate} onChange={e => setPickupForm(f => ({ ...f, pickupDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Window (optional)</Label>
                    <Input placeholder="09:00-12:00" value={pickupForm.pickupWindow} onChange={e => setPickupForm(f => ({ ...f, pickupWindow: e.target.value }))} />
                  </div>
                </div>
                <h4 className="mt-4 text-sm font-semibold">Pickup address</h4>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <Input placeholder="Name" value={pickupForm.pickupName} onChange={e => setPickupForm(f => ({ ...f, pickupName: e.target.value }))} />
                  <Input placeholder="Address line 1" value={pickupForm.pickupAddress1} onChange={e => setPickupForm(f => ({ ...f, pickupAddress1: e.target.value }))} />
                  <Input placeholder="City" value={pickupForm.pickupCity} onChange={e => setPickupForm(f => ({ ...f, pickupCity: e.target.value }))} />
                  <Input placeholder="Postal code" value={pickupForm.pickupPostalCode} onChange={e => setPickupForm(f => ({ ...f, pickupPostalCode: e.target.value }))} />
                  <Input placeholder="Country" value={pickupForm.pickupCountry} onChange={e => setPickupForm(f => ({ ...f, pickupCountry: e.target.value }))} />
                </div>
                <div className="mt-3 space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input value={pickupForm.notes} onChange={e => setPickupForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="gradient" onClick={handleSchedulePickup} disabled={!!busy}>Schedule</Button>
                  <Button variant="outline" onClick={() => setShowPickupForm(false)} disabled={!!busy}>Cancel</Button>
                </div>
              </div>
            )}

            {!rma.returnLabelStorageKey && rma.status === 'requested' && (
              <div className="text-sm text-muted-foreground">Authorize the RMA to enable label generation.</div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Return Lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Customer Wanted</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead>Inspection</TableHead>
                <TableHead>Refund</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rma.lines.map(line => (
                <React.Fragment key={line.id}>
                  <TableRow>
                    <TableCell className="font-mono text-sm font-semibold">{line.sku}</TableCell>
                    <TableCell>{line.requestedQuantity}</TableCell>
                    <TableCell>{line.receivedQuantity}</TableCell>
                    <TableCell>{line.requestedDisposition ? formatStr(line.requestedDisposition) : '-'}</TableCell>
                    <TableCell>
                      {line.disposition === 'pending'
                        ? <Badge variant="secondary">Pending</Badge>
                        : <Badge variant={statusVariant(line.disposition)}>{formatStr(line.disposition)}</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(line.inspectionStatus)}>{formatStr(line.inspectionStatus)}</Badge>
                    </TableCell>
                    <TableCell>${(line.refundAmountCents / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canReceive && line.receivedQuantity < line.requestedQuantity && (
                          <Button variant="outline" size="sm" onClick={() => { setReceivingLineId(line.id); setReceiveQty(String(line.requestedQuantity - line.receivedQuantity)); }}>
                            Receive
                          </Button>
                        )}
                        {canInspect && line.disposition === 'pending' && line.receivedQuantity > 0 && (
                          <Button variant="outline" size="sm" onClick={() => { setInspectingLineId(line.id); setInspectionForm({ inspectionStatus: 'pass', disposition: line.requestedDisposition || '', inspectionNotes: '' }); }}>
                            Inspect
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {receivingLineId === line.id && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted">
                        <div className="flex items-end gap-2">
                          <div className="space-y-2">
                            <Label>Received Quantity</Label>
                            <Input type="number" min="0" max={line.requestedQuantity} value={receiveQty} onChange={e => setReceiveQty(e.target.value)} className="w-32" />
                          </div>
                          <Button variant="gradient" onClick={handleReceive} disabled={!!busy}>Save</Button>
                          <Button variant="outline" onClick={() => setReceivingLineId(null)}>Cancel</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {inspectingLineId === line.id && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted">
                        <div className="grid max-w-2xl gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Inspection Status *</Label>
                            <Select value={inspectionForm.inspectionStatus} onValueChange={v => setInspectionForm({ ...inspectionForm, inspectionStatus: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {INSPECTION_STATUSES.map(s => (
                                  <SelectItem key={s} value={s}>{formatStr(s)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Disposition *</Label>
                            <Select value={inspectionForm.disposition} onValueChange={v => setInspectionForm({ ...inspectionForm, disposition: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {DISPOSITIONS.map(d => (
                                  <SelectItem key={d} value={d}>{formatStr(d)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Notes</Label>
                            <textarea
                              rows={2}
                              value={inspectionForm.inspectionNotes}
                              onChange={e => setInspectionForm({ ...inspectionForm, inspectionNotes: e.target.value })}
                              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button variant="gradient" onClick={handleInspect} disabled={!!busy || !inspectionForm.disposition}>Save Disposition</Button>
                          <Button variant="outline" onClick={() => setInspectingLineId(null)}>Cancel</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canComplete && allLinesInspected && !showComplete && (
        <div className="flex items-center gap-3 rounded-md border border-info/30 bg-info/10 p-4 text-sm text-info">
          <Info className="h-5 w-5" />
          All lines inspected. Click <strong>Complete &amp; Refund</strong> to finalize and generate the credit note.
        </div>
      )}

      <Dialog open={showComplete} onOpenChange={setShowComplete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete RMA &amp; Issue Refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border border-info/30 bg-info/10 p-3 text-sm text-info">
              <Info className="h-4 w-4" />
              Suggested refund: <strong>${(rma.suggestedRefundCents / 100).toFixed(2)}</strong>
            </div>
            <div className="space-y-2">
              <Label>Actual Refund Amount ($)</Label>
              <Input type="number" step="0.01" value={actualRefund} onChange={e => setActualRefund(e.target.value)} />
              <p className="text-xs text-muted-foreground">Override the suggested amount if needed (restocking fee, partial shipping refund, etc.)</p>
            </div>
            {parseFloat(actualRefund) * 100 !== rma.suggestedRefundCents && (
              <div className="space-y-2">
                <Label>Reason for Adjustment</Label>
                <textarea
                  rows={2}
                  value={refundNotes}
                  onChange={e => setRefundNotes(e.target.value)}
                  placeholder="e.g. Restocking fee applied, shipping not refunded..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplete(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleComplete} disabled={!!busy}>{busy === 'complete' ? 'Processing...' : 'Complete & Refund'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
