import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../api';

interface Location {
  id: string;
  name: string;
  city: string;
  state?: string;
  country: string;
}

interface Carrier {
  id: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
}

interface LaneCarrier {
  id: string;
  carrierId: string;
  price?: number;
  currency: string;
  serviceLevel?: string;
  notes?: string;
  assigned: boolean;
  carrier: Carrier;
}

interface Lane {
  id: string;
  name: string;
  origin: Location;
  destination: Location;
  distance?: number;
  notes?: string;
  status: string;
  laneCarriers: LaneCarrier[];
}

export default function LaneDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lane, setLane] = useState<Lane | null>(null);
  const [allCarriers, setAllCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add carrier form
  const [showAddCarrier, setShowAddCarrier] = useState(false);
  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [serviceLevel, setServiceLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const [laneRes, carriersRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/lanes/${id}`),
        fetch(`${API_URL}/api/v1/carriers`)
      ]);

      const [laneData, carriersData] = await Promise.all([
        laneRes.json(),
        carriersRes.json()
      ]);

      if (laneData.error) {
        setError(laneData.error);
      } else {
        setLane(laneData.data);
      }

      if (!carriersData.error) {
        setAllCarriers(carriersData.data || []);
      }
    } catch (err) {
      setError('Failed to load lane details');
    } finally {
      setLoading(false);
    }
  };

  const addCarrierToLane = async () => {
    if (!selectedCarrierId || !id) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/lanes/${id}/carriers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierId: selectedCarrierId,
          price: price ? parseFloat(price) : undefined,
          currency,
          serviceLevel: serviceLevel || undefined,
          notes: notes || undefined
        })
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
      } else {
        setShowAddCarrier(false);
        setSelectedCarrierId('');
        setPrice('');
        setServiceLevel('');
        setNotes('');
        loadData();
      }
    } catch (err) {
      alert('Failed to add carrier to lane');
    } finally {
      setSubmitting(false);
    }
  };

  const assignCarrier = async (carrierId: string) => {
    if (!id) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/lanes/${id}/carriers/${carrierId}/assign`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
      } else {
        loadData();
      }
    } catch (err) {
      alert('Failed to assign carrier');
    }
  };

  const removeCarrier = async (carrierId: string) => {
    if (!id || !confirm('Remove this carrier from the lane?')) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/lanes/${id}/carriers/${carrierId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
      } else {
        loadData();
      }
    } catch (err) {
      alert('Failed to remove carrier');
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
          Loading lane details...
        </div>
      </div>
    );
  }

  if (error || !lane) {
    return (
      <div className="card">
        <h2>Error</h2>
        <p>{error || 'Lane not found'}</p>
        <Link to="/lanes" className="button outlined">
          <span className="material-icons" style={{ fontSize: '18px' }}>arrow_back</span>
          Back to Lanes
        </Link>
      </div>
    );
  }

  const assignedCarrier = lane.laneCarriers.find(lc => lc.assigned);
  const availableCarriers = allCarriers.filter(c =>
    !lane.laneCarriers.some(lc => lc.carrierId === c.id)
  );

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h2>{lane.name}</h2>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
            <Link to={`/lanes/${id}/edit`} className="button outlined">
              <span className="material-icons" style={{ fontSize: '18px' }}>edit</span>
              Edit Lane
            </Link>
            <Link to="/lanes" className="button outlined">
              <span className="material-icons" style={{ fontSize: '18px' }}>arrow_back</span>
              Back
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)' }}>
          <div>
            <strong>Origin:</strong> {lane.origin.name} ({lane.origin.city}, {lane.origin.state || lane.origin.country})
          </div>
          <div>
            <strong>Destination:</strong> {lane.destination.name} ({lane.destination.city}, {lane.destination.state || lane.destination.country})
          </div>
          {lane.distance && (
            <div>
              <strong>Distance:</strong> {lane.distance.toFixed(1)} km
            </div>
          )}
          <div>
            <strong>Status:</strong> <span className={`chip ${lane.status === 'active' ? 'chip-success' : 'chip-warning'}`}>{lane.status}</span>
          </div>
        </div>

        {lane.notes && (
          <div style={{ marginTop: 'var(--spacing-2)' }}>
            <strong>Notes:</strong> {lane.notes}
          </div>
        )}
      </div>

      {/* Assigned Carrier */}
      {assignedCarrier && (
        <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
            <span className="material-icons" style={{ color: 'var(--primary)' }}>check_circle</span>
            Assigned Carrier
          </h3>
          <div style={{
            backgroundColor: 'var(--primary-container)',
            padding: 'var(--spacing-2)',
            borderRadius: '8px',
            border: '2px solid var(--primary)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 'var(--spacing-2)', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  {assignedCarrier.carrier.name}
                </div>
                {assignedCarrier.carrier.mcNumber && (
                  <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
                    MC: {assignedCarrier.carrier.mcNumber}
                  </div>
                )}
              </div>
              <div>
                {assignedCarrier.price ? (
                  <>
                    <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Price</div>
                    <div style={{ fontWeight: 'bold' }}>{assignedCarrier.currency} {assignedCarrier.price.toFixed(2)}</div>
                  </>
                ) : (
                  <div style={{ color: 'var(--on-surface-variant)' }}>No price set</div>
                )}
              </div>
              <div>
                {assignedCarrier.serviceLevel ? (
                  <>
                    <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Service Level</div>
                    <div>{assignedCarrier.serviceLevel}</div>
                  </>
                ) : (
                  <div style={{ color: 'var(--on-surface-variant)' }}>—</div>
                )}
              </div>
              <div>
                <button
                  className="button outlined"
                  onClick={() => removeCarrier(assignedCarrier.carrierId)}
                  style={{ width: '100%' }}
                >
                  <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
                  Remove
                </button>
              </div>
            </div>
            {assignedCarrier.notes && (
              <div style={{ marginTop: 'var(--spacing-1)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                Notes: {assignedCarrier.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Carrier Quotes */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h3>Carrier Quotes ({lane.laneCarriers.length})</h3>
          <button
            className="button"
            onClick={() => setShowAddCarrier(true)}
            disabled={availableCarriers.length === 0}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Add Carrier Quote
          </button>
        </div>

        {lane.laneCarriers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)', color: 'var(--on-surface-variant)' }}>
            No carriers added to this lane yet. Click "Add Carrier Quote" to add one.
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>Price</th>
                  <th>Service Level</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lane.laneCarriers.map(lc => (
                  <tr key={lc.id} style={lc.assigned ? { backgroundColor: 'var(--primary-container)' } : {}}>
                    <td>
                      <strong>{lc.carrier.name}</strong>
                      {lc.carrier.mcNumber && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
                          MC: {lc.carrier.mcNumber}
                        </div>
                      )}
                    </td>
                    <td>{lc.price ? `${lc.currency} ${lc.price.toFixed(2)}` : '—'}</td>
                    <td>{lc.serviceLevel || '—'}</td>
                    <td>
                      {lc.assigned ? (
                        <span className="chip chip-success">
                          <span className="material-icons" style={{ fontSize: '14px' }}>check</span>
                          Assigned
                        </span>
                      ) : (
                        <span className="chip chip-default">Quote</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                        {!lc.assigned && (
                          <button
                            className="button"
                            onClick={() => assignCarrier(lc.carrierId)}
                            style={{ padding: '4px 12px', fontSize: '0.875rem' }}
                          >
                            <span className="material-icons" style={{ fontSize: '16px' }}>check</span>
                            Assign
                          </button>
                        )}
                        <button
                          className="icon-btn"
                          onClick={() => removeCarrier(lc.carrierId)}
                          title="Remove carrier"
                          style={{ color: 'var(--error)' }}
                        >
                          <span className="material-icons">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Carrier Modal */}
      {showAddCarrier && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '500px', margin: 'var(--spacing-2)', width: '100%' }}>
            <h3>Add Carrier Quote</h3>

            <div style={{ display: 'grid', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
              <div className="text-field">
                <select
                  value={selectedCarrierId}
                  onChange={e => setSelectedCarrierId(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Select a carrier...</option>
                  {availableCarriers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.mcNumber && `(MC: ${c.mcNumber})`}
                    </option>
                  ))}
                </select>
                <label>Carrier</label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--spacing-2)' }}>
                <div className="text-field">
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder=" "
                  />
                  <label>Price (optional)</label>
                </div>
                <div className="text-field">
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                  <label>Currency</label>
                </div>
              </div>

              <div className="text-field">
                <input
                  type="text"
                  value={serviceLevel}
                  onChange={e => setServiceLevel(e.target.value)}
                  placeholder=" "
                />
                <label>Service Level (optional)</label>
              </div>

              <div className="text-field">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder=" "
                  rows={3}
                  style={{ width: '100%' }}
                />
                <label>Notes (optional)</label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end', marginTop: 'var(--spacing-2)' }}>
              <button
                className="button outlined"
                onClick={() => {
                  setShowAddCarrier(false);
                  setSelectedCarrierId('');
                  setPrice('');
                  setServiceLevel('');
                  setNotes('');
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="button"
                onClick={addCarrierToLane}
                disabled={!selectedCarrierId || submitting}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
                {submitting ? 'Adding...' : 'Add Carrier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
