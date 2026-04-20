import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

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

function statusChip(s: string): string {
  switch (s) {
    case 'requested': return 'vn-chip-info';
    case 'authorized': case 'in_transit': case 'received': case 'inspecting': case 'dispositioning': return 'vn-chip-warning';
    case 'completed': case 'pass': case 'restock': return 'vn-chip-success';
    case 'rejected': case 'fail': case 'scrap': return 'vn-chip-error';
    default: return 'vn-chip-secondary';
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

  // Line inspection state
  const [inspectingLineId, setInspectingLineId] = useState<string | null>(null);
  const [inspectionForm, setInspectionForm] = useState({ inspectionStatus: 'pass', disposition: '', inspectionNotes: '' });

  // Line receiving state
  const [receivingLineId, setReceivingLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');

  // Refund state for completion
  const [showComplete, setShowComplete] = useState(false);
  const [actualRefund, setActualRefund] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  // Return label + pickup state
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [showPickupForm, setShowPickupForm] = useState(false);
  const [labelForm, setLabelForm] = useState({
    carrierId: '', providerOverride: '', serviceLevel: '',
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
      .catch(() => { /* non-blocking */ });
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
        providerOverride: labelForm.providerOverride || undefined,
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

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>;
  if (!rma) return <div className="vn-alert vn-alert-error">{error || 'Not found'}</div>;

  const canAuthorize = rma.status === 'requested';
  const canReject = rma.status === 'requested' || rma.status === 'authorized';
  const canReceive = rma.status === 'authorized' || rma.status === 'in_transit' || rma.status === 'received';
  const canInspect = rma.status === 'received' || rma.status === 'inspecting';
  const canComplete = rma.status === 'dispositioning';
  const allLinesInspected = rma.lines.every(l => l.disposition !== 'pending');

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>{rma.rmaNumber}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className={`vn-chip ${statusChip(rma.status)}`}>{formatStr(rma.status)}</span>
            <span className="vn-chip vn-chip-secondary">{formatStr(rma.returnReason)}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Via: {formatStr(rma.initiatedVia)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {canAuthorize && <button className="vn-btn vn-btn-primary" onClick={handleAuthorize} disabled={!!busy}>Authorize</button>}
          {canReject && <button className="vn-btn vn-btn-outline" onClick={handleReject} disabled={!!busy} style={{ color: 'var(--color-error)' }}>Reject</button>}
          {canComplete && <button className="vn-btn vn-btn-primary" onClick={() => { setActualRefund(String(rma.suggestedRefundCents / 100)); setShowComplete(true); }}>Complete & Refund</button>}
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Status timeline */}
      <div className="vn-card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem' }}>Timeline</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <div><strong>Requested:</strong> {new Date(rma.requestedAt).toLocaleString()}</div>
          {rma.authorizedAt && <div><strong>Authorized:</strong> {new Date(rma.authorizedAt).toLocaleString()}</div>}
          {rma.receivedAt && <div><strong>Received:</strong> {new Date(rma.receivedAt).toLocaleString()}</div>}
          {rma.completedAt && <div><strong>Completed:</strong> {new Date(rma.completedAt).toLocaleString()}</div>}
        </div>
        {rma.customerNotes && <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--surface-secondary)', borderRadius: '6px', fontSize: '0.9rem' }}><strong>Customer notes:</strong> {rma.customerNotes}</div>}
        {rma.rejectionNotes && <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--surface-secondary)', borderRadius: '6px', fontSize: '0.9rem', color: 'var(--color-error)' }}><strong>Rejected:</strong> {rma.rejectionNotes}</div>}
        {rma.refundAdjustmentNotes && <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--surface-secondary)', borderRadius: '6px', fontSize: '0.9rem' }}><strong>Refund adjustment:</strong> {rma.refundAdjustmentNotes}</div>}
      </div>

      {/* Refund summary */}
      <div className="vn-card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem' }}>Refund</h3>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Suggested</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>${(rma.suggestedRefundCents / 100).toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Actual</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: rma.actualRefundCents != null ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
              {rma.actualRefundCents != null ? `$${(rma.actualRefundCents / 100).toFixed(2)}` : '--'}
            </div>
          </div>
          {rma.creditNoteId && (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Credit Note</div>
              <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => navigate(`/finance/credit-notes/${rma.creditNoteId}`)}>View</button>
            </div>
          )}
        </div>
      </div>

      {/* Return Label + Pickup */}
      {rma.status !== 'rejected' && rma.status !== 'completed' && (
        <div className="vn-card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Return Shipping</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!rma.returnLabelStorageKey && rma.status !== 'requested' && (
                <button className="vn-btn vn-btn-primary" onClick={() => setShowLabelForm(v => !v)} disabled={!!busy}>Generate Label</button>
              )}
              {rma.returnLabelStorageKey && (
                <a className="vn-btn vn-btn-outline" href={`${API_URL}/api/v1/rmas/${rma.id}/return-label/download`} target="_blank" rel="noreferrer">Download Label</a>
              )}
              {rma.returnTrackingNumber && !rma.returnPickupScheduledAt && !rma.returnPickupCancelledAt && (
                <button className="vn-btn vn-btn-primary" onClick={() => setShowPickupForm(v => !v)} disabled={!!busy}>Schedule Pickup</button>
              )}
              {rma.returnPickupScheduledAt && !rma.returnPickupCancelledAt && (
                <button className="vn-btn vn-btn-outline" style={{ color: 'var(--color-error)' }} onClick={handleCancelPickup} disabled={!!busy}>Cancel Pickup</button>
              )}
            </div>
          </div>

          {rma.returnTrackingNumber && (
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <div><strong>Provider:</strong> {rma.returnLabelProvider ?? '--'}</div>
              <div><strong>Service:</strong> {rma.returnServiceLevel ?? '--'}</div>
              <div><strong>Tracking:</strong> {rma.returnTrackingNumber}</div>
              {rma.returnLabelGeneratedAt && <div><strong>Label issued:</strong> {new Date(rma.returnLabelGeneratedAt).toLocaleString()}</div>}
            </div>
          )}

          {rma.returnPickupScheduledAt && (
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem', padding: '0.5rem 0', borderTop: '1px solid var(--border-color)' }}>
              <div><strong>Pickup:</strong> {new Date(rma.returnPickupScheduledAt).toLocaleString()}</div>
              {rma.returnPickupWindow && <div><strong>Window:</strong> {rma.returnPickupWindow}</div>}
              {rma.returnPickupConfirmationNumber && <div><strong>Confirmation:</strong> {rma.returnPickupConfirmationNumber}</div>}
              {rma.returnPickupCancelledAt && <div style={{ color: 'var(--color-error)' }}><strong>Cancelled:</strong> {new Date(rma.returnPickupCancelledAt).toLocaleString()}</div>}
            </div>
          )}

          {showLabelForm && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--surface-secondary)', borderRadius: '6px' }}>
              <div className="vn-form-grid" style={{ gap: '0.5rem' }}>
                <div className="vn-field">
                  <label className="vn-field-label">Carrier</label>
                  <select className="vn-input" value={labelForm.carrierId} onChange={e => {
                    const c = carriers.find(c => c.id === e.target.value);
                    setLabelForm(f => ({ ...f, carrierId: e.target.value, serviceLevel: c?.returnLabelDefaultService ?? f.serviceLevel }));
                  }}>
                    <option value="">Select carrier (optional)</option>
                    {carriers.map(c => <option key={c.id} value={c.id}>{c.name}{c.returnLabelProvider ? ` (${c.returnLabelProvider})` : ''}</option>)}
                  </select>
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Provider Override</label>
                  <select className="vn-input" value={labelForm.providerOverride} onChange={e => setLabelForm(f => ({ ...f, providerOverride: e.target.value }))}>
                    <option value="">Use carrier default</option>
                    <option value="manual">Manual</option>
                    <option value="fedex">FedEx</option>
                    <option value="ups">UPS</option>
                    <option value="dhl">DHL</option>
                  </select>
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Service Level</label>
                  <input className="vn-input" value={labelForm.serviceLevel} placeholder="ground" onChange={e => setLabelForm(f => ({ ...f, serviceLevel: e.target.value }))} />
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Parcel Weight (kg)</label>
                  <input className="vn-input" type="number" step="0.1" value={labelForm.weightKg} onChange={e => setLabelForm(f => ({ ...f, weightKg: e.target.value }))} />
                </div>
              </div>
              <h4 style={{ margin: '0.75rem 0 0.25rem' }}>From (customer)</h4>
              <div className="vn-form-grid" style={{ gap: '0.5rem' }}>
                <input className="vn-input" placeholder="Name" value={labelForm.fromName} onChange={e => setLabelForm(f => ({ ...f, fromName: e.target.value }))} />
                <input className="vn-input" placeholder="Address line 1" value={labelForm.fromAddress1} onChange={e => setLabelForm(f => ({ ...f, fromAddress1: e.target.value }))} />
                <input className="vn-input" placeholder="City" value={labelForm.fromCity} onChange={e => setLabelForm(f => ({ ...f, fromCity: e.target.value }))} />
                <input className="vn-input" placeholder="Postal code" value={labelForm.fromPostalCode} onChange={e => setLabelForm(f => ({ ...f, fromPostalCode: e.target.value }))} />
                <input className="vn-input" placeholder="Country" value={labelForm.fromCountry} onChange={e => setLabelForm(f => ({ ...f, fromCountry: e.target.value }))} />
              </div>
              <h4 style={{ margin: '0.75rem 0 0.25rem' }}>To (receiving warehouse)</h4>
              <div className="vn-form-grid" style={{ gap: '0.5rem' }}>
                <input className="vn-input" placeholder="Name" value={labelForm.toName} onChange={e => setLabelForm(f => ({ ...f, toName: e.target.value }))} />
                <input className="vn-input" placeholder="Address line 1" value={labelForm.toAddress1} onChange={e => setLabelForm(f => ({ ...f, toAddress1: e.target.value }))} />
                <input className="vn-input" placeholder="City" value={labelForm.toCity} onChange={e => setLabelForm(f => ({ ...f, toCity: e.target.value }))} />
                <input className="vn-input" placeholder="Postal code" value={labelForm.toPostalCode} onChange={e => setLabelForm(f => ({ ...f, toPostalCode: e.target.value }))} />
                <input className="vn-input" placeholder="Country" value={labelForm.toCountry} onChange={e => setLabelForm(f => ({ ...f, toCountry: e.target.value }))} />
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button className="vn-btn vn-btn-primary" onClick={handleGenerateLabel} disabled={!!busy}>Generate</button>
                <button className="vn-btn vn-btn-outline" onClick={() => setShowLabelForm(false)} disabled={!!busy}>Cancel</button>
              </div>
            </div>
          )}

          {showPickupForm && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--surface-secondary)', borderRadius: '6px' }}>
              <div className="vn-form-grid" style={{ gap: '0.5rem' }}>
                <div className="vn-field">
                  <label className="vn-field-label">Pickup Date/Time</label>
                  <input className="vn-input" type="datetime-local" value={pickupForm.pickupDate} onChange={e => setPickupForm(f => ({ ...f, pickupDate: e.target.value }))} />
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Window (optional)</label>
                  <input className="vn-input" placeholder="09:00-12:00" value={pickupForm.pickupWindow} onChange={e => setPickupForm(f => ({ ...f, pickupWindow: e.target.value }))} />
                </div>
              </div>
              <h4 style={{ margin: '0.75rem 0 0.25rem' }}>Pickup address</h4>
              <div className="vn-form-grid" style={{ gap: '0.5rem' }}>
                <input className="vn-input" placeholder="Name" value={pickupForm.pickupName} onChange={e => setPickupForm(f => ({ ...f, pickupName: e.target.value }))} />
                <input className="vn-input" placeholder="Address line 1" value={pickupForm.pickupAddress1} onChange={e => setPickupForm(f => ({ ...f, pickupAddress1: e.target.value }))} />
                <input className="vn-input" placeholder="City" value={pickupForm.pickupCity} onChange={e => setPickupForm(f => ({ ...f, pickupCity: e.target.value }))} />
                <input className="vn-input" placeholder="Postal code" value={pickupForm.pickupPostalCode} onChange={e => setPickupForm(f => ({ ...f, pickupPostalCode: e.target.value }))} />
                <input className="vn-input" placeholder="Country" value={pickupForm.pickupCountry} onChange={e => setPickupForm(f => ({ ...f, pickupCountry: e.target.value }))} />
              </div>
              <div className="vn-field" style={{ marginTop: '0.5rem' }}>
                <label className="vn-field-label">Notes (optional)</label>
                <input className="vn-input" value={pickupForm.notes} onChange={e => setPickupForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button className="vn-btn vn-btn-primary" onClick={handleSchedulePickup} disabled={!!busy}>Schedule</button>
                <button className="vn-btn vn-btn-outline" onClick={() => setShowPickupForm(false)} disabled={!!busy}>Cancel</button>
              </div>
            </div>
          )}

          {!rma.returnLabelStorageKey && rma.status === 'requested' && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Authorize the RMA to enable label generation.</div>
          )}
        </div>
      )}

      {/* Lines */}
      <div className="vn-card">
        <h3 style={{ margin: '0 0 1rem' }}>Return Lines</h3>
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Requested</th>
                <th>Received</th>
                <th>Customer Wanted</th>
                <th>Disposition</th>
                <th>Inspection</th>
                <th>Refund</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rma.lines.map(line => (
                <React.Fragment key={line.id}>
                  <tr>
                    <td><strong>{line.sku}</strong></td>
                    <td>{line.requestedQuantity}</td>
                    <td>{line.receivedQuantity}</td>
                    <td>{line.requestedDisposition ? formatStr(line.requestedDisposition) : '--'}</td>
                    <td>
                      {line.disposition === 'pending'
                        ? <span className="vn-chip vn-chip-secondary">Pending</span>
                        : <span className={`vn-chip ${statusChip(line.disposition)}`}>{formatStr(line.disposition)}</span>}
                    </td>
                    <td><span className={`vn-chip ${statusChip(line.inspectionStatus)}`}>{formatStr(line.inspectionStatus)}</span></td>
                    <td>${(line.refundAmountCents / 100).toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {canReceive && line.receivedQuantity < line.requestedQuantity && (
                          <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }} onClick={() => { setReceivingLineId(line.id); setReceiveQty(String(line.requestedQuantity - line.receivedQuantity)); }}>
                            Receive
                          </button>
                        )}
                        {canInspect && line.disposition === 'pending' && line.receivedQuantity > 0 && (
                          <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }} onClick={() => { setInspectingLineId(line.id); setInspectionForm({ inspectionStatus: 'pass', disposition: line.requestedDisposition || '', inspectionNotes: '' }); }}>
                            Inspect
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {receivingLineId === line.id && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--surface-secondary)', padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                          <div className="vn-field" style={{ marginBottom: 0 }}>
                            <label className="vn-field-label">Received Quantity</label>
                            <input className="vn-input" type="number" min="0" max={line.requestedQuantity} value={receiveQty} onChange={e => setReceiveQty(e.target.value)} style={{ width: '120px' }} />
                          </div>
                          <button className="vn-btn vn-btn-primary" onClick={handleReceive} disabled={!!busy}>Save</button>
                          <button className="vn-btn vn-btn-outline" onClick={() => setReceivingLineId(null)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {inspectingLineId === line.id && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--surface-secondary)', padding: '1rem' }}>
                        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr', maxWidth: '600px' }}>
                          <div className="vn-field">
                            <label className="vn-field-label">Inspection Status *</label>
                            <select className="vn-input" value={inspectionForm.inspectionStatus} onChange={e => setInspectionForm({ ...inspectionForm, inspectionStatus: e.target.value })}>
                              {INSPECTION_STATUSES.map(s => <option key={s} value={s}>{formatStr(s)}</option>)}
                            </select>
                          </div>
                          <div className="vn-field">
                            <label className="vn-field-label">Disposition *</label>
                            <select className="vn-input" value={inspectionForm.disposition} onChange={e => setInspectionForm({ ...inspectionForm, disposition: e.target.value })}>
                              <option value="">Select...</option>
                              {DISPOSITIONS.map(d => <option key={d} value={d}>{formatStr(d)}</option>)}
                            </select>
                          </div>
                          <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                            <label className="vn-field-label">Notes</label>
                            <textarea className="vn-input" rows={2} value={inspectionForm.inspectionNotes} onChange={e => setInspectionForm({ ...inspectionForm, inspectionNotes: e.target.value })} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                          <button className="vn-btn vn-btn-primary" onClick={handleInspect} disabled={!!busy || !inspectionForm.disposition}>Save Disposition</button>
                          <button className="vn-btn vn-btn-outline" onClick={() => setInspectingLineId(null)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {canComplete && allLinesInspected && !showComplete && (
        <div style={{ marginTop: '1rem' }}>
          <div className="vn-alert vn-alert-info">All lines inspected. Click <strong>Complete & Refund</strong> to finalize and generate the credit note.</div>
        </div>
      )}

      {showComplete && (
        <div className="vn-modal-backdrop" onClick={() => setShowComplete(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="vn-modal-header"><h3>Complete RMA & Issue Refund</h3><button onClick={() => setShowComplete(false)}><span className="material-icons">close</span></button></div>
            <div className="vn-modal-body">
              <div className="vn-alert vn-alert-info" style={{ marginBottom: '1rem' }}>
                Suggested refund: <strong>${(rma.suggestedRefundCents / 100).toFixed(2)}</strong>
              </div>
              <div className="vn-field" style={{ marginBottom: '1rem' }}>
                <label className="vn-field-label">Actual Refund Amount ($)</label>
                <input className="vn-input" type="number" step="0.01" value={actualRefund} onChange={e => setActualRefund(e.target.value)} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Override the suggested amount if needed (restocking fee, partial shipping refund, etc.)</span>
              </div>
              {parseFloat(actualRefund) * 100 !== rma.suggestedRefundCents && (
                <div className="vn-field">
                  <label className="vn-field-label">Reason for Adjustment</label>
                  <textarea className="vn-input" rows={2} value={refundNotes} onChange={e => setRefundNotes(e.target.value)} placeholder="e.g. Restocking fee applied, shipping not refunded..." />
                </div>
              )}
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setShowComplete(false)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={handleComplete} disabled={!!busy}>{busy === 'complete' ? 'Processing...' : 'Complete & Refund'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
