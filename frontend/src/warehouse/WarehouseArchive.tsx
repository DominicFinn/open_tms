import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import './warehouse.css';

export default function WarehouseArchive() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const locationId = (() => {
    try {
      return JSON.parse(localStorage.getItem('warehouse_location') || '{}').id;
    } catch { return ''; }
  })();

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (locationId) params.set('locationId', locationId);
        const res = await fetch(`${API_URL}/api/v1/warehouse/shipments/archive?${params}`);
        const json = await res.json();
        setShipments(json.data || []);
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, [locationId]);

  if (loading) {
    return <div className="wh-loading"><div className="wh-spinner" /></div>;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Archive</h2>
        <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
          Shipments idle {'>'}2 days
        </span>
      </div>

      {shipments.length === 0 ? (
        <div className="wh-empty">
          <span className="material-icons">inventory_2</span>
          <p className="wh-empty-title">No stale shipments</p>
          <p className="wh-empty-message">All shipments are being processed on time.</p>
        </div>
      ) : (
        <div className="wh-shipment-list">
          {shipments.map(s => (
            <div
              key={s.id}
              className={`wh-shipment-card ${s.flags?.length > 0 ? 'flagged' : ''}`}
              onClick={() => navigate(`/warehouse/shipments/${s.id}`)}
            >
              <div className="wh-shipment-header">
                <span className="wh-shipment-ref">{s.reference}</span>
                <span className="wh-shipment-status draft">{s.status}</span>
              </div>
              <div className="wh-shipment-route">
                <span className="material-icons">trip_origin</span>
                {s.origin?.name || '—'}
                <span className="material-icons">arrow_forward</span>
                <span className="material-icons">flag</span>
                {s.destination?.name || '—'}
              </div>
              <div className="wh-shipment-meta">
                <span className="wh-shipment-meta-item">
                  <span className="material-icons">schedule</span>
                  Created {new Date(s.createdAt).toLocaleDateString()}
                </span>
                {s.flags?.length > 0 && (
                  <span className="wh-shipment-meta-item" style={{ color: 'var(--error)' }}>
                    <span className="material-icons">flag</span>
                    {s.flags.length} flag{s.flags.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '16px', fontSize: '12px', color: 'var(--on-surface-variant)' }}>
        {shipments.length} stale shipment{shipments.length !== 1 ? 's' : ''}
      </div>
    </>
  );
}
