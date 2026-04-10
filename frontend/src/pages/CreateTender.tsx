import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

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

export default function CreateTender() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
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
      prev.includes(carrierId) ? prev.filter(c => c !== carrierId) : [...prev, carrierId]
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
    <div>
      <div className="vn-page-header">
        <div><h1>Create Tender</h1></div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>{error}</div>}

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
        {['Shipment', 'Strategy', 'Carriers', 'Details', 'Review'].map((label, i) => (
          <div
            key={i}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              background: step === i + 1 ? 'var(--primary)' : step > i + 1 ? 'var(--success)' : 'var(--surface-container)',
              color: step >= i + 1 ? '#fff' : 'var(--on-surface-variant)',
              fontWeight: step === i + 1 ? 600 : 400,
              fontSize: '13px',
              cursor: step > i + 1 ? 'pointer' : 'default',
            }}
            onClick={() => step > i + 1 && setStep(i + 1)}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {/* Step 1: Select Shipment */}
      {step === 1 && (
        <div className="vn-card">
          <h3 style={{ margin: '0 0 var(--spacing-2)' }}>Select Shipment</h3>
          <div style={{ display: 'grid', gap: 'var(--spacing-1)', maxHeight: '400px', overflowY: 'auto' }}>
            {shipments.map(s => (
              <label
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)',
                  padding: 'var(--spacing-2)', borderRadius: 'var(--radius-md)',
                  border: shipmentId === s.id ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                  cursor: 'pointer', background: shipmentId === s.id ? 'var(--primary-container)' : 'transparent',
                }}
              >
                <input type="radio" name="shipment" checked={shipmentId === s.id} onChange={() => setShipmentId(s.id)} />
                <div>
                  <div style={{ fontWeight: 600 }}>{s.reference}</div>
                  <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                    {s.origin?.city}{s.origin?.state ? `, ${s.origin.state}` : ''} → {s.destination?.city}{s.destination?.state ? `, ${s.destination.state}` : ''}
                    {s.customer ? ` | ${s.customer.name}` : ''}
                  </div>
                </div>
              </label>
            ))}
            {shipments.length === 0 && (
              <p style={{ color: 'var(--on-surface-variant)', textAlign: 'center' }}>No draft/planned shipments available</p>
            )}
          </div>
          <div className="vn-form-actions" style={{ marginTop: 'var(--spacing-2)' }}>
            <button className="vn-btn vn-btn-primary" onClick={() => setStep(2)} disabled={!shipmentId}>Next</button>
          </div>
        </div>
      )}

      {/* Step 2: Strategy */}
      {step === 2 && (
        <div className="vn-card">
          <h3 style={{ margin: '0 0 var(--spacing-2)' }}>Tendering Strategy</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)' }}>
            <label
              style={{
                padding: 'var(--spacing-3)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                border: strategy === 'broadcast' ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                background: strategy === 'broadcast' ? 'var(--primary-container)' : 'transparent',
              }}
            >
              <input type="radio" name="strategy" checked={strategy === 'broadcast'} onChange={() => setStrategy('broadcast')} style={{ display: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="material-icons">campaign</span>
                <strong>Broadcast</strong>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                Send to all carriers simultaneously. Carriers submit competitive bids. Review and award the best bid.
              </p>
            </label>
            <label
              style={{
                padding: 'var(--spacing-3)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                border: strategy === 'waterfall' ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                background: strategy === 'waterfall' ? 'var(--primary-container)' : 'transparent',
              }}
            >
              <input type="radio" name="strategy" checked={strategy === 'waterfall'} onChange={() => setStrategy('waterfall')} style={{ display: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="material-icons">waterfall_chart</span>
                <strong>Waterfall</strong>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                Offer to carriers in ranked order. If one declines or times out, automatically move to the next.
              </p>
            </label>
          </div>
          <div className="vn-form-actions" style={{ marginTop: 'var(--spacing-2)' }}>
            <button className="vn-btn vn-btn-outline" onClick={() => setStep(1)}>Back</button>
            <button className="vn-btn vn-btn-primary" onClick={() => setStep(3)}>Next</button>
          </div>
        </div>
      )}

      {/* Step 3: Select Carriers */}
      {step === 3 && (
        <div className="vn-card">
          <h3 style={{ margin: '0 0 var(--spacing-2)' }}>
            Select Carriers {strategy === 'waterfall' && '(drag to reorder priority)'}
          </h3>

          {/* Selected carriers (ordered list for waterfall) */}
          {selectedCarriers.length > 0 && (
            <div style={{ marginBottom: 'var(--spacing-2)' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                Selected ({selectedCarriers.length}):
              </label>
              {selectedCarriers.map((cId, idx) => {
                const carrier = carriers.find(c => c.id === cId);
                return (
                  <div key={cId} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', padding: '6px 8px',
                    border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-sm)', marginBottom: '4px',
                    background: 'var(--surface-container)',
                  }}>
                    {strategy === 'waterfall' && (
                      <span style={{ fontWeight: 700, minWidth: '24px', color: 'var(--primary)' }}>#{idx + 1}</span>
                    )}
                    <span style={{ flex: 1, fontWeight: 500 }}>{carrier?.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{carrier?.scacCode || carrier?.mcNumber || ''}</span>
                    {strategy === 'waterfall' && (
                      <>
                        <button className="vn-btn-icon" onClick={() => moveCarrier(idx, 'up')} disabled={idx === 0} title="Move up">
                          <span className="material-icons" style={{ fontSize: '18px' }}>arrow_upward</span>
                        </button>
                        <button className="vn-btn-icon" onClick={() => moveCarrier(idx, 'down')} disabled={idx === selectedCarriers.length - 1} title="Move down">
                          <span className="material-icons" style={{ fontSize: '18px' }}>arrow_downward</span>
                        </button>
                      </>
                    )}
                    <button className="vn-btn-icon" onClick={() => toggleCarrier(cId)} title="Remove">
                      <span className="material-icons" style={{ fontSize: '18px', color: 'var(--error)' }}>close</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Available carriers */}
          <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Available Carriers:</label>
          <div style={{ display: 'grid', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
            {carriers.filter(c => !selectedCarriers.includes(c.id)).map(c => (
              <label key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', padding: '6px 8px',
                border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              }}>
                <input type="checkbox" checked={false} onChange={() => toggleCarrier(c.id)} />
                <span style={{ fontWeight: 500, flex: 1 }}>{c.name}</span>
                <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>
                  {c.scacCode || c.mcNumber || ''} {c.contactEmail ? `| ${c.contactEmail}` : ''}
                </span>
              </label>
            ))}
          </div>
          <div className="vn-form-actions" style={{ marginTop: 'var(--spacing-2)' }}>
            <button className="vn-btn vn-btn-outline" onClick={() => setStep(2)}>Back</button>
            <button className="vn-btn vn-btn-primary" onClick={() => setStep(4)} disabled={selectedCarriers.length === 0}>Next</button>
          </div>
        </div>
      )}

      {/* Step 4: Parameters */}
      {step === 4 && (
        <div className="vn-card">
          <h3 style={{ margin: '0 0 var(--spacing-2)' }}>Tender Parameters</h3>
          <div className="vn-form-grid">
            <div>
              <label className="vn-field-label">Tender Duration (minutes)</label>
              <input className="vn-input" type="number" min="1" value={durationMinutes} onChange={e => setDurationMinutes(parseInt(e.target.value) || 120)} />
              <div className="vn-field-hint">How long carriers have to respond</div>
            </div>
            <div>
              <label className="vn-field-label">Target Rate ($)</label>
              <input className="vn-input" type="number" min="0" step="0.01" value={targetRate} onChange={e => setTargetRate(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="vn-field-label">Equipment Type</label>
              <select className="vn-select" value={equipmentType} onChange={e => setEquipmentType(e.target.value)}>
                <option value="">Not specified</option>
                <option value="53' Dry Van">53' Dry Van</option>
                <option value="53' Reefer">53' Reefer</option>
                <option value="Flatbed">Flatbed</option>
                <option value="Step Deck">Step Deck</option>
                <option value="LTL Shared">LTL Shared</option>
                <option value="Tanker">Tanker</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 'var(--spacing-2)' }}>
            <label className="vn-field-label">Notes</label>
            <textarea className="vn-textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes for carriers" />
          </div>
          <div style={{ marginTop: 'var(--spacing-1)' }}>
            <label className="vn-field-label">Special Instructions</label>
            <textarea className="vn-textarea" rows={2} value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} placeholder="Loading/unloading instructions, hazmat, etc." />
          </div>
          <div className="vn-form-actions" style={{ marginTop: 'var(--spacing-2)' }}>
            <button className="vn-btn vn-btn-outline" onClick={() => setStep(3)}>Back</button>
            <button className="vn-btn vn-btn-primary" onClick={() => setStep(5)}>Review</button>
          </div>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div className="vn-card">
          <h3 style={{ margin: '0 0 var(--spacing-2)' }}>Review & Create</h3>
          <div style={{ display: 'grid', gap: 'var(--spacing-1)', fontSize: '14px', marginBottom: 'var(--spacing-2)' }}>
            <div><strong>Shipment:</strong> {selectedShipment?.reference} — {selectedShipment?.origin?.city} → {selectedShipment?.destination?.city}</div>
            <div><strong>Strategy:</strong> <span className={`vn-chip vn-chip-${strategy === 'broadcast' ? 'info' : 'secondary'}`}>{strategy}</span></div>
            <div><strong>Carriers:</strong> {selectedCarriers.map(id => carriers.find(c => c.id === id)?.name).join(', ')}</div>
            <div><strong>Duration:</strong> {durationMinutes} minutes</div>
            {targetRate && <div><strong>Target Rate:</strong> ${parseFloat(targetRate).toLocaleString()}</div>}
            {equipmentType && <div><strong>Equipment:</strong> {equipmentType}</div>}
            {notes && <div><strong>Notes:</strong> {notes}</div>}
            {specialInstructions && <div><strong>Instructions:</strong> {specialInstructions}</div>}
          </div>
          <div className="vn-alert vn-alert-info" style={{ marginBottom: 'var(--spacing-2)' }}>
            The tender will be created in <strong>draft</strong> status. You can review it before opening it to carriers.
          </div>
          <div className="vn-form-actions">
            <button className="vn-btn vn-btn-outline" onClick={() => setStep(4)}>Back</button>
            <button className="vn-btn vn-btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creating...' : 'Create Tender'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
