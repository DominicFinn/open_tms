import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';
import {
  validateShipmentAgainstType,
  applyShipmentTypeDefaults,
  SHIPMENT_FIELD_LABELS,
  ShipmentTypeConfig,
} from '../shared/shipmentTypeValidator';

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
  const [lanes, setLanes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedType = useMemo(
    () => shipmentTypes.find(t => t.id === shipmentTypeId) || null,
    [shipmentTypeId, shipmentTypes]
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

  // When the user picks a shipment type on a fresh form, fill in any empty
  // fields from the type's defaults. User input always wins (shallow merge).
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
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
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

  // Compute missing required fields for the selected type (soft-warn only).
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
      // Create always saves as a draft. On edit we don't send status so the
      // existing status is preserved unless the user explicitly changes it elsewhere.
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

  if (loading) return <div className="loading-spinner" style={{ margin: '2rem auto' }} />;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            <Link to="/shipments" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Shipments</Link>
            {' '}&gt; {isEdit ? 'Edit Shipment' : 'New Shipment'}
          </p>
          <h1>{isEdit ? 'Edit Shipment' : 'New Shipment'}</h1>
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-card-body" style={{ padding: '2rem' }}>

          {/* Shipment Type picker */}
          {shipmentTypes.length > 0 && (
            <div className="vn-form-section">
              <h3 className="vn-form-section-title">
                <span className="material-icons">category</span>
                Shipment Type
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShipmentTypeId('')}
                  className="vn-type-chip"
                  style={{
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${shipmentTypeId === '' ? 'var(--primary)' : 'var(--outline-variant)'}`,
                    background: shipmentTypeId === '' ? 'var(--surface-container)' : 'var(--surface-container-lowest)',
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 18 }}>block</span>
                  No template
                </button>
                {shipmentTypes.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTypeDefaults(t.id)}
                    style={{
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${shipmentTypeId === t.id ? t.color : 'var(--outline-variant)'}`,
                      background: shipmentTypeId === t.id ? `${t.color}15` : 'var(--surface-container-lowest)',
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
                    }}
                    title={t.description || undefined}
                  >
                    <span className="material-icons" style={{ fontSize: 20, color: t.color }}>{t.icon}</span>
                    {t.name}
                  </button>
                ))}
              </div>
              {selectedType?.description && (
                <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 8, marginBottom: 0 }}>
                  {selectedType.description}
                </p>
              )}
            </div>
          )}

          {/* Basic Information */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">info</span>
              Basic Information
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Customer{isFieldRequired('customerId') && <span style={{ color: 'var(--color-error)' }}> *</span>}</label>
                <select className="vn-select" value={customer} onChange={e => setCustomer(e.target.value)}>
                  <option value="">Select customer...</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Reference{isFieldRequired('reference') && <span style={{ color: 'var(--color-error)' }}> *</span>}</label>
                <input className="vn-input" type="text" placeholder="Auto-generated if left blank" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Mode</label>
                <select className="vn-select" value={mode} onChange={e => setMode(e.target.value)}>
                  <option value="">Select mode...</option>
                  <option value="ftl">FTL</option>
                  <option value="ltl">LTL</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">PRO Number{isFieldRequired('proNumber') && <span style={{ color: 'var(--color-error)' }}> *</span>}</label>
                <input className="vn-input" type="text" placeholder="Enter PRO number" value={proNumber} onChange={e => setProNumber(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Origin */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">flight_takeoff</span>
              Origin
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Location{isFieldRequired('originId') && <span style={{ color: 'var(--color-error)' }}> *</span>}</label>
                <select className="vn-select" value={originLocation} onChange={e => setOriginLocation(e.target.value)}>
                  <option value="">Select origin...</option>
                  {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name} — {l.city}, {l.state}</option>)}
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Pickup Date{isFieldRequired('pickupDate') && <span style={{ color: 'var(--color-error)' }}> *</span>}</label>
                <input className="vn-input" type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
              </div>
              <div className="vn-field vn-col-span-2">
                <label className="vn-checkbox">
                  <input
                    type="checkbox"
                    checked={hasPickupWindow}
                    onChange={e => {
                      setHasPickupWindow(e.target.checked);
                      if (!e.target.checked) { setPickupWindowStart(''); setPickupWindowEnd(''); }
                    }}
                  />
                  Specify pickup window
                  {(isFieldRequired('pickupWindowStart') || isFieldRequired('pickupWindowEnd')) && (
                    <span style={{ color: 'var(--color-error)', marginLeft: 4 }}>*</span>
                  )}
                </label>
              </div>
              {hasPickupWindow && (
                <>
                  <div className="vn-field">
                    <label className="vn-field-label">Window start</label>
                    <input className="vn-input" type="datetime-local" value={pickupWindowStart} onChange={e => setPickupWindowStart(e.target.value)} />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Window end</label>
                    <input className="vn-input" type="datetime-local" value={pickupWindowEnd} onChange={e => setPickupWindowEnd(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Destination */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">flight_land</span>
              Destination
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Location{isFieldRequired('destinationId') && <span style={{ color: 'var(--color-error)' }}> *</span>}</label>
                <select className="vn-select" value={destLocation} onChange={e => setDestLocation(e.target.value)}>
                  <option value="">Select destination...</option>
                  {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name} — {l.city}, {l.state}</option>)}
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Delivery Date{isFieldRequired('deliveryDate') && <span style={{ color: 'var(--color-error)' }}> *</span>}</label>
                <input className="vn-input" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
              <div className="vn-field vn-col-span-2">
                <label className="vn-checkbox">
                  <input
                    type="checkbox"
                    checked={hasDeliveryWindow}
                    onChange={e => {
                      setHasDeliveryWindow(e.target.checked);
                      if (!e.target.checked) { setDeliveryWindowStart(''); setDeliveryWindowEnd(''); }
                    }}
                  />
                  Specify delivery window
                  {(isFieldRequired('deliveryWindowStart') || isFieldRequired('deliveryWindowEnd')) && (
                    <span style={{ color: 'var(--color-error)', marginLeft: 4 }}>*</span>
                  )}
                </label>
              </div>
              {hasDeliveryWindow && (
                <>
                  <div className="vn-field">
                    <label className="vn-field-label">Window start</label>
                    <input className="vn-input" type="datetime-local" value={deliveryWindowStart} onChange={e => setDeliveryWindowStart(e.target.value)} />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Window end</label>
                    <input className="vn-input" type="datetime-local" value={deliveryWindowEnd} onChange={e => setDeliveryWindowEnd(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Cargo */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">inventory</span>
              Cargo
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Weight</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input className="vn-input" type="number" placeholder="0" value={weight} onChange={e => setWeight(e.target.value)} style={{ flex: 1 }} />
                  <select className="vn-select" value={weightUnit} onChange={e => setWeightUnit(e.target.value)} style={{ width: '5rem' }}>
                    <option value="lb">lb</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Pieces</label>
                <input className="vn-input" type="number" placeholder="0" value={pieces} onChange={e => setPieces(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Commodity</label>
                <input className="vn-input" type="text" placeholder="Enter commodity description" value={commodity} onChange={e => setCommodity(e.target.value)} />
              </div>
              <div className="vn-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label className="vn-checkbox">
                  <input type="checkbox" checked={tempControlled} onChange={e => setTempControlled(e.target.checked)} />
                  Temperature Controlled
                </label>
                {tempControlled && (
                  <select className="vn-select" value={tempMode} onChange={e => setTempMode(e.target.value)}>
                    <option value="ambient">Ambient</option>
                    <option value="refrigerated">Refrigerated</option>
                    <option value="frozen">Frozen</option>
                  </select>
                )}
                <label className="vn-checkbox">
                  <input type="checkbox" checked={hazmat} onChange={e => setHazmat(e.target.checked)} />
                  Hazmat
                </label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">notes</span>
              Notes
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Additional Notes</label>
                <textarea className="vn-textarea" rows={4} placeholder="Enter any additional notes or special instructions..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {missingRequired.length > 0 && (
            <div className="vn-alert vn-alert-warning" style={{ marginBottom: 16 }}>
              <span className="material-icons">info</span>
              <div className="vn-alert-content">
                <strong>Missing fields required by "{selectedType?.name}":</strong>{' '}
                {missingRequired.map(f => SHIPMENT_FIELD_LABELS[f] || f).join(', ')}.
                <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                  You can still save as a draft. The shipment cannot leave draft status until these are filled in.
                </div>
              </div>
            </div>
          )}

          {submitError && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{submitError}</div>}

          {/* Form Actions */}
          <div className="vn-form-actions">
            <Link to={isEdit && id ? `/shipments/${id}` : '/shipments'} className="vn-btn vn-btn-outline">Cancel</Link>
            <button className="vn-btn vn-btn-primary" onClick={handleSubmit} disabled={submitting}>
              <span className="material-icons">{isEdit ? 'save' : 'add'}</span>
              {submitting
                ? 'Saving...'
                : isEdit
                  ? 'Update Shipment'
                  : missingRequired.length > 0 ? 'Save as Draft' : 'Create Shipment'}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
