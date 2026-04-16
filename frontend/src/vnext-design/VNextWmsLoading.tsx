import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface StagingAssignment {
  id: string;
  orderRef: string;
  shipmentRef: string | null;
  stagingBinLabel: string;
  loadSequence: number | null;
  status: string;
  packedAt: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function statusChip(status: string): string {
  switch (status) {
    case 'staged': return 'vn-chip-info';
    case 'loading': return 'vn-chip-warning';
    case 'loaded': return 'vn-chip-success';
    case 'dispatched': return 'vn-chip-primary';
    default: return 'vn-chip-secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsLoading() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<StagingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter(
          (l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(locs);
        if (locs.length > 0) setSelectedLocation(locs[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/staging?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setAssignments((res.data || []).map((a: any) => ({
        ...a,
        orderRef: a.orderId?.slice(0, 8) ?? '',
        shipmentRef: a.shipmentId?.slice(0, 8) ?? null,
        stagingBinLabel: a.stagingBin?.label ?? '',
        packedAt: a.createdAt,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLocation]);

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Loading</h1>
          <p className="vn-page-subtitle">Staging and loading for outbound shipments</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="vn-loading-spinner" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>local_shipping</span>
          <h3>No staged orders</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Packed orders are staged in the shipping dock area before being loaded onto outbound vehicles. Orders appear here after packing is complete.
          </p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Shipment</th>
                <th>Staging Bin</th>
                <th>Load Seq</th>
                <th>Status</th>
                <th>Packed At</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id} style={{ cursor: 'pointer' }}>
                  <td><strong>{a.orderRef}</strong></td>
                  <td>{a.shipmentRef || 'Not assigned'}</td>
                  <td>{a.stagingBinLabel}</td>
                  <td>{a.loadSequence ?? '--'}</td>
                  <td><span className={`vn-chip ${statusChip(a.status)}`}>{formatStatus(a.status)}</span></td>
                  <td>{new Date(a.packedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
