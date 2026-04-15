import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface ZoneDetail {
  id: string;
  locationId: string;
  name: string;
  zoneType: string;
  temperatureZone: string | null;
  hazmatCertified: boolean;
  maxWeightKg: number | null;
  maxVolumeCbm: number | null;
  sortOrder: number;
  active: boolean;
  bins: Bin[];
  aisles: Aisle[];
}

interface Bin {
  id: string;
  label: string;
  binType: string;
  level: number | null;
  walkSequence: number;
  active: boolean;
  maxWeightKg: number | null;
  maxPalletPositions: number | null;
  currentWeightKg: number;
  currentPalletCount: number;
}

interface Aisle {
  id: string;
  name: string;
  sortOrder: number;
}

/* ── Helpers ──────────────────────────────────────────────── */

function formatZoneType(t: string): string {
  return t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function binTypeChip(t: string): string {
  switch (t) {
    case 'pallet': return 'vn-chip-primary';
    case 'shelf': return 'vn-chip-info';
    case 'floor': return 'vn-chip-secondary';
    case 'dock_door': return 'vn-chip-warning';
    case 'staging': return 'vn-chip-info';
    case 'pack_station': return 'vn-chip-success';
    default: return 'vn-chip-secondary';
  }
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsZoneDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [zone, setZone] = useState<ZoneDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/warehouse/zones/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setZone(res.data);
      })
      .catch(() => setError('Failed to load zone'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="vn-loading-spinner" />
      </div>
    );
  }

  if (error || !zone) {
    return (
      <div className="vn-alert vn-alert-error">
        {error || 'Zone not found'}
      </div>
    );
  }

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>{zone.name}</h1>
          <p className="vn-page-subtitle">{formatZoneType(zone.zoneType)} zone</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="vn-btn vn-btn-outline" onClick={() => navigate(`/wms/zones/${id}/edit`)}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>edit</span>
            Edit
          </button>
          <button className="vn-btn vn-btn-primary" onClick={() => navigate(`/wms/zones/${id}/bins/create`)}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>
            Add Bins
          </button>
        </div>
      </div>

      {/* Zone info cards */}
      <div className="vn-detail-grid">
        <div className="vn-detail-main">
          {/* Bin list */}
          <div className="vn-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Bins ({zone.bins.length})</h3>
              <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.85rem' }} onClick={() => navigate(`/wms/zones/${id}/bins/bulk`)}>
                <span className="material-icons" style={{ fontSize: '16px', marginRight: '0.4rem' }}>playlist_add</span>
                Bulk Create
              </button>
            </div>

            {zone.bins.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <span className="material-icons" style={{ fontSize: '36px', display: 'block', marginBottom: '0.5rem' }}>inventory_2</span>
                No bins in this zone yet. Add bins individually or use bulk create.
              </div>
            ) : (
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Type</th>
                      <th>Level</th>
                      <th>Walk Seq</th>
                      <th>Utilization</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zone.bins.map(bin => (
                      <tr key={bin.id}>
                        <td><strong>{bin.label}</strong></td>
                        <td><span className={`vn-chip ${binTypeChip(bin.binType)}`}>{formatZoneType(bin.binType)}</span></td>
                        <td>{bin.level ?? '--'}</td>
                        <td>{bin.walkSequence}</td>
                        <td>
                          {bin.maxPalletPositions
                            ? `${bin.currentPalletCount}/${bin.maxPalletPositions}`
                            : bin.maxWeightKg
                              ? `${bin.currentWeightKg.toFixed(0)}/${bin.maxWeightKg}kg`
                              : '--'}
                        </td>
                        <td>
                          <span className={`vn-chip ${bin.active ? 'vn-chip-success' : 'vn-chip-secondary'}`}>
                            {bin.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="vn-detail-sidebar">
          {/* Zone properties */}
          <div className="vn-card">
            <h3 style={{ margin: '0 0 1rem' }}>Properties</h3>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1rem', margin: 0 }}>
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Type</dt>
                <dd style={{ margin: 0, fontWeight: 500 }}>{formatZoneType(zone.zoneType)}</dd>
              </div>
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Temperature</dt>
                <dd style={{ margin: 0 }}>{zone.temperatureZone ? formatZoneType(zone.temperatureZone) : 'None'}</dd>
              </div>
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Hazmat</dt>
                <dd style={{ margin: 0 }}>{zone.hazmatCertified ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sort Order</dt>
                <dd style={{ margin: 0 }}>{zone.sortOrder}</dd>
              </div>
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Max Weight</dt>
                <dd style={{ margin: 0 }}>{zone.maxWeightKg != null ? `${zone.maxWeightKg} kg` : '--'}</dd>
              </div>
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Max Volume</dt>
                <dd style={{ margin: 0 }}>{zone.maxVolumeCbm != null ? `${zone.maxVolumeCbm} cbm` : '--'}</dd>
              </div>
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status</dt>
                <dd style={{ margin: 0 }}>
                  <span className={`vn-chip ${zone.active ? 'vn-chip-success' : 'vn-chip-error'}`}>
                    {zone.active ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bins</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>{zone.bins.length}</dd>
              </div>
            </dl>
          </div>

          {/* Aisles */}
          {zone.aisles.length > 0 && (
            <div className="vn-card">
              <h3 style={{ margin: '0 0 0.75rem' }}>Aisles</h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {zone.aisles.map(a => (
                  <span key={a.id} className="vn-chip vn-chip-secondary">{a.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
