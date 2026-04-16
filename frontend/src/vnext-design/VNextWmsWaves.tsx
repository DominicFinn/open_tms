import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface Wave {
  id: string;
  waveNumber: string;
  status: string;
  pickStrategy: string;
  orderCount: number;
  lineCount: number;
  cutoffAt: string | null;
  projectedCompletionAt: string | null;
  createdAt: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function statusChip(status: string): string {
  switch (status) {
    case 'planning': return 'vn-chip-secondary';
    case 'released': return 'vn-chip-info';
    case 'in_progress': return 'vn-chip-warning';
    case 'completed': return 'vn-chip-success';
    case 'cancelled': return 'vn-chip-error';
    default: return 'vn-chip-secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function strategyLabel(s: string): string {
  switch (s) {
    case 'discrete': return 'Discrete';
    case 'batch': return 'Batch';
    case 'zone': return 'Zone';
    case 'wave': return 'Wave';
    default: return s;
  }
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsWaves() {
  const navigate = useNavigate();
  const [waves, setWaves] = useState<Wave[]>([]);
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
    fetch(`${API_URL}/api/v1/waves?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setWaves((res.data || []).map((w: any) => ({
        ...w,
        createdAt: w.createdAt,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLocation]);

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Waves</h1>
          <p className="vn-page-subtitle">Group orders into pick waves for efficient fulfillment</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="vn-btn vn-btn-outline" onClick={() => navigate('/wms/waves/templates')}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>description</span>
            Templates
          </button>
          <button className="vn-btn vn-btn-primary" onClick={() => navigate('/wms/waves/create')}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>
            Create Wave
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="vn-loading-spinner" />
        </div>
      ) : waves.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>waves</span>
          <h3>No waves created</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Waves group orders for efficient picking. Create wave templates to automate grouping by carrier, cutoff time, or service level.
          </p>
          <button className="vn-btn vn-btn-primary" onClick={() => navigate('/wms/waves/create')}>
            Create First Wave
          </button>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Wave #</th>
                <th>Strategy</th>
                <th>Orders</th>
                <th>Lines</th>
                <th>Cutoff</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {waves.map(w => (
                <tr key={w.id} onClick={() => navigate(`/wms/waves/${w.id}`)} style={{ cursor: 'pointer' }}>
                  <td><strong>{w.waveNumber}</strong></td>
                  <td><span className="vn-chip vn-chip-primary">{strategyLabel(w.pickStrategy)}</span></td>
                  <td>{w.orderCount}</td>
                  <td>{w.lineCount}</td>
                  <td>{w.cutoffAt ? new Date(w.cutoffAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                  <td><span className={`vn-chip ${statusChip(w.status)}`}>{formatStatus(w.status)}</span></td>
                  <td>{new Date(w.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
