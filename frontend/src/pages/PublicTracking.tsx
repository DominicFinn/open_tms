import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../api';

interface TrackingData {
  reference: string;
  status: string;
  pickupDate?: string;
  deliveryDate?: string;
  proNumber?: string;
  origin?: { city: string; state: string };
  destination?: { city: string; state: string };
  stops: Array<{
    sequenceNumber: number;
    stopType: string;
    status: string;
    arrivedAt?: string;
    completedAt?: string;
    location?: { name: string; city: string; state: string };
  }>;
  events: Array<{
    eventType: string;
    status?: string;
    description?: string;
    createdAt: string;
  }>;
  currentLocation?: { lat: number; lng: number; asOf: string } | null;
}

function statusColor(s: string): string {
  const m: Record<string, string> = { in_transit: 'var(--color-info)', delivered: 'var(--color-success)', booked: 'var(--color-warning)', exception: 'var(--color-error)', at_pickup: 'var(--color-warning)', at_delivery: 'var(--color-warning)' };
  return m[s] || 'var(--on-surface-variant)';
}

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function PublicTracking() {
  const { token } = useParams();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/v1/track/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) setError(json.error);
        else setData(json.data);
      })
      .catch(() => setError('Failed to load tracking information'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
      <div className="loading-spinner" />
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <span className="material-icons" style={{ fontSize: 64, color: 'var(--on-surface-variant)' }}>search_off</span>
        <h2 style={{ margin: '16px 0 8px' }}>Tracking Not Found</h2>
        <p style={{ color: 'var(--on-surface-variant)' }}>{error || 'This tracking link is invalid or has expired.'}</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface-container)', borderBottom: '1px solid var(--outline-variant)', padding: '16px 0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="material-icons" style={{ color: 'var(--primary)', fontSize: 28 }}>local_shipping</span>
            <span style={{ fontWeight: 700, fontSize: 18 }}>Shipment Tracking</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        {/* Status banner */}
        <div style={{
          background: 'var(--surface-container)', borderRadius: 12, padding: 24, marginBottom: 24,
          borderLeft: `4px solid ${statusColor(data.status)}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Shipment Reference</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{data.reference}</div>
              {data.proNumber && <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>PRO: {data.proNumber}</div>}
            </div>
            <div style={{
              padding: '8px 20px', borderRadius: 24,
              background: 'var(--surface-container)',
              color: statusColor(data.status),
              fontWeight: 700, fontSize: 16,
            }}>
              {statusLabel(data.status)}
            </div>
          </div>

          {/* Route */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Origin</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                {data.origin ? `${data.origin.city}, ${data.origin.state}` : '-'}
              </div>
              {data.pickupDate && <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{new Date(data.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
            </div>
            <span className="material-icons" style={{ fontSize: 28, color: 'var(--on-surface-variant)' }}>east</span>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Destination</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                {data.destination ? `${data.destination.city}, ${data.destination.state}` : '-'}
              </div>
              {data.deliveryDate && <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{new Date(data.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
            </div>
          </div>
        </div>

        {/* Stops timeline */}
        {data.stops.length > 0 && (
          <div style={{ background: 'var(--surface-container)', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Stops</h3>
            {data.stops.map((stop, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: i < data.stops.length - 1 ? '1px solid var(--outline-variant)' : 'none' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: stop.status === 'completed' ? 'var(--color-success)' : stop.status === 'arrived' ? 'var(--primary)' : 'var(--outline-variant)',
                  color: stop.status !== 'pending' ? 'var(--surface-container)' : 'var(--on-surface-variant)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                }}>
                  {stop.status === 'completed' ? <span className="material-icons" style={{ fontSize: 18 }}>check</span> : stop.sequenceNumber}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{stop.location?.name || 'Stop ' + stop.sequenceNumber}</div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{stop.location?.city}, {stop.location?.state} - {stop.stopType}</div>
                  {stop.arrivedAt && <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>Arrived: {new Date(stop.arrivedAt).toLocaleString()}</div>}
                  {stop.completedAt && <div style={{ fontSize: 11, color: 'var(--color-success)', marginTop: 1 }}>Completed: {new Date(stop.completedAt).toLocaleString()}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tracking events */}
        {data.events.length > 0 && (
          <div style={{ background: 'var(--surface-container)', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Tracking Events</h3>
            {data.events.map((evt, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < data.events.length - 1 ? '1px solid var(--surface)' : 'none' }}>
                <span className="material-icons" style={{ fontSize: 18, color: 'var(--on-surface-variant)', marginTop: 1 }}>schedule</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{evt.description || evt.eventType}</div>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{new Date(evt.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
