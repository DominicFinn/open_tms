import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

interface Stop {
  id: number;
  location: string;
  order: number;
}

let stopIdCounter = 0;

export default function VNextCreateLane() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState('mi');
  const [targetRate, setTargetRate] = useState('');
  const [rateCurrency, setRateCurrency] = useState('USD');
  const [serviceLevel, setServiceLevel] = useState('FTL');
  const [notes, setNotes] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);

  const [apiLocations, setApiLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json())
      .then(json => setApiLocations(json.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/lanes/${id}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then(json => {
        const l = json.data;
        if (!l) return;
        setOrigin(l.originId || '');
        setDestination(l.destinationId || '');
        setDistance(l.distance != null ? String(l.distance) : '');
        setNotes(l.notes || '');
        setServiceLevel(l.serviceLevel || 'FTL');
        if (l.stops && l.stops.length > 0) {
          setStops(l.stops.map((s: any, i: number) => {
            stopIdCounter += 1;
            return { id: stopIdCounter, location: s.locationId || '', order: s.order || i + 1 };
          }));
        }
      })
      .catch(err => setSubmitError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const body: any = {
        originId: origin, destinationId: destination,
        distance: distance ? parseFloat(distance) : undefined,
        notes, serviceLevel,
        stops: stops.filter(s => s.location).map(s => ({ locationId: s.location, order: s.order })),
      };
      const url = isEdit ? `${API_URL}/api/v1/lanes/${id}` : `${API_URL}/api/v1/lanes`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save lane');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate('/lanes');
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-spinner" style={{ margin: '2rem auto' }} />;

  const originLabel = apiLocations.find(l => l.id === origin)?.name || '';
  const destLabel = apiLocations.find(l => l.id === destination)?.name || '';

  const addStop = () => {
    stopIdCounter += 1;
    setStops(prev => [...prev, { id: stopIdCounter, location: '', order: prev.length + 1 }]);
  };

  const updateStop = (id: number, field: keyof Stop, value: string | number) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeStop = (id: number) => {
    setStops(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })));
  };

  return (
    <>
      <div className="vn-page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link to="/lanes" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Lanes</Link>
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_right</span>
            <span>{isEdit ? 'Edit Lane' : 'New Lane'}</span>
          </div>
          <h1>{isEdit ? 'Edit Lane' : 'New Lane'}</h1>
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-card-body" style={{ padding: 0 }}>

          {/* Route */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">route</span>
              Route
            </div>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Origin Location</label>
                <select className="vn-select" value={origin} onChange={e => setOrigin(e.target.value)}>
                  <option value="">Select origin...</option>
                  {apiLocations.map((loc: any) => (
                    <option key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</option>
                  ))}
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Destination Location</label>
                <select className="vn-select" value={destination} onChange={e => setDestination(e.target.value)}>
                  <option value="">Select destination...</option>
                  {apiLocations.map((loc: any) => (
                    <option key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Route Visualization */}
            {(origin || destination) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 8px', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="vn-route-dot" style={{ backgroundColor: 'var(--success)' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--on-surface)' }}>{originLabel || 'Origin'}</span>
                </div>
                <div className="vn-route-line" style={{ flex: 1, height: 2, backgroundColor: 'var(--outline-variant)' }} />
                {stops.length > 0 && stops.map((stop, i) => {
                  const stopLabel = apiLocations.find(l => l.id === stop.location)?.name || `Stop ${i + 1}`;
                  return (
                    <React.Fragment key={stop.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="vn-route-dot" style={{ backgroundColor: 'var(--warning)' }} />
                        <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{stopLabel}</span>
                      </div>
                      <div className="vn-route-line" style={{ flex: 1, height: 2, backgroundColor: 'var(--outline-variant)' }} />
                    </React.Fragment>
                  );
                })}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="vn-route-dot" style={{ backgroundColor: 'var(--error)' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--on-surface)' }}>{destLabel || 'Destination'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">info</span>
              Details
            </div>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Distance</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="vn-input" type="number" placeholder="0" value={distance} onChange={e => setDistance(e.target.value)} style={{ flex: 1 }} />
                  <select className="vn-select" value={distanceUnit} onChange={e => setDistanceUnit(e.target.value)} style={{ width: 80 }}>
                    <option value="mi">mi</option>
                    <option value="km">km</option>
                  </select>
                </div>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Target Rate</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="vn-input" type="number" placeholder="0.00" value={targetRate} onChange={e => setTargetRate(e.target.value)} style={{ flex: 1 }} />
                  <select className="vn-select" value={rateCurrency} onChange={e => setRateCurrency(e.target.value)} style={{ width: 80 }}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Service Level</label>
                <select className="vn-select" value={serviceLevel} onChange={e => setServiceLevel(e.target.value)}>
                  <option value="FTL">FTL</option>
                  <option value="LTL">LTL</option>
                  <option value="Both">Both</option>
                </select>
              </div>
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Notes</label>
                <textarea className="vn-textarea" rows={3} placeholder="Additional lane notes..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Stops */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">pin_drop</span>
              Stops
            </div>

            {stops.length === 0 && (
              <p style={{ color: 'var(--on-surface-variant)', fontSize: 13, margin: '0 0 12px' }}>
                No intermediate stops added. Click below to add one.
              </p>
            )}

            {stops.map((stop) => (
              <div key={stop.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
                <div className="vn-field" style={{ flex: 1 }}>
                  <label className="vn-field-label">Location</label>
                  <select className="vn-select" value={stop.location} onChange={e => updateStop(stop.id, 'location', e.target.value)}>
                    <option value="">Select location...</option>
                    {apiLocations.map((loc: any) => (
                      <option key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</option>
                    ))}
                  </select>
                </div>
                <div className="vn-field" style={{ width: 100 }}>
                  <label className="vn-field-label">Order</label>
                  <input className="vn-input" type="number" min={1} value={stop.order} onChange={e => updateStop(stop.id, 'order', parseInt(e.target.value) || 1)} />
                </div>
                <button
                  className="vn-btn vn-btn-outline"
                  style={{ color: 'var(--error)', borderColor: 'var(--error)', marginBottom: 0 }}
                  onClick={() => removeStop(stop.id)}
                >
                  <span className="material-icons">delete</span>
                </button>
              </div>
            ))}

            <button className="vn-btn vn-btn-outline" onClick={addStop}>
              <span className="material-icons">add</span>
              Add Stop
            </button>
          </div>

        </div>
      </div>

      {submitError && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{submitError}</div>}

      {/* Form Actions */}
      <div className="vn-form-actions">
        <Link to="/lanes" className="vn-btn vn-btn-outline">Cancel</Link>
        <button className="vn-btn vn-btn-primary" onClick={handleSubmit} disabled={submitting}>
          <span className="material-icons">save</span>
          {submitting ? 'Saving...' : isEdit ? 'Update Lane' : 'Create Lane'}
        </button>
      </div>
    </>
  );
}
