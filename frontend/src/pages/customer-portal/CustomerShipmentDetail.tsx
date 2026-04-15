import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';

function statusChip(s: string): string {
  const m: Record<string, string> = { in_transit: 'info', delivered: 'success', booked: 'warning', exception: 'error', at_pickup: 'warning', at_delivery: 'warning' };
  return m[s] || 'secondary';
}

export default function CustomerShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerFetch(`${API_URL}/api/v1/customer-portal/shipments/${id}`)
      .then(r => r.json())
      .then(json => setShipment(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><div className="loading-spinner" /></div>;
  if (!shipment) return <div className="vn-alert vn-alert-error">Shipment not found</div>;

  return (
    <div>
      <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/customer-portal/shipments')} style={{ marginBottom: 16 }}>
        <span className="material-icons">arrow_back</span> Shipments
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{shipment.reference}</h1>
        <span className={`vn-chip vn-chip-${statusChip(shipment.status)}`}>{shipment.status}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div className="vn-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Origin</h3>
          {shipment.origin ? (
            <>
              <div style={{ fontWeight: 600 }}>{shipment.origin.name}</div>
              <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{shipment.origin.address1}</div>
              <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{shipment.origin.city}, {shipment.origin.state} {shipment.origin.postalCode}</div>
            </>
          ) : <div style={{ color: 'var(--on-surface-variant)' }}>-</div>}
        </div>
        <div className="vn-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Destination</h3>
          {shipment.destination ? (
            <>
              <div style={{ fontWeight: 600 }}>{shipment.destination.name}</div>
              <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{shipment.destination.address1}</div>
              <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{shipment.destination.city}, {shipment.destination.state} {shipment.destination.postalCode}</div>
            </>
          ) : <div style={{ color: 'var(--on-surface-variant)' }}>-</div>}
        </div>
      </div>

      <div className="vn-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div><div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Carrier</div><div style={{ fontWeight: 600 }}>{shipment.carrier?.name || '-'}</div></div>
          <div><div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Pickup Date</div><div style={{ fontWeight: 600 }}>{shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : '-'}</div></div>
          <div><div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Delivery Date</div><div style={{ fontWeight: 600 }}>{shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : '-'}</div></div>
          <div><div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>PRO Number</div><div style={{ fontWeight: 600 }}>{shipment.proNumber || '-'}</div></div>
        </div>
      </div>

      {shipment.stops && shipment.stops.length > 0 && (
        <div className="vn-card" style={{ padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Stops</h3>
          {shipment.stops.map((stop: any, i: number) => (
            <div key={stop.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < shipment.stops.length - 1 ? '1px solid var(--outline-variant)' : 'none' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary-container)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{stop.location?.name || 'Unknown'}</div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{stop.location?.city}, {stop.location?.state} - {stop.stopType}</div>
              </div>
              <span className={`vn-chip vn-chip-${stop.status === 'completed' ? 'success' : stop.status === 'arrived' ? 'info' : 'secondary'}`} style={{ marginLeft: 'auto' }}>
                {stop.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {shipment.events && shipment.events.length > 0 && (
        <div className="vn-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Tracking Events</h3>
          {shipment.events.map((evt: any) => (
            <div key={evt.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--outline-variant)' }}>
              <span className="material-icons" style={{ fontSize: 16, color: 'var(--on-surface-variant)', marginTop: 2 }}>schedule</span>
              <div>
                <div style={{ fontSize: 13 }}>{evt.eventType}: {evt.description || evt.status || '-'}</div>
                <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{new Date(evt.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
