import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface WarehouseStats {
  zones: number;
  bins: number;
  activeBins: number;
  totalSkus: number;
  receivingTasks: number;
  pickTasks: number;
  packTasks: number;
  putawayTasks: number;
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    fetch(`${API_URL}/api/v1/wms/dashboard?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => { if (res.data) setStats(res.data); })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [selectedLocation]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="vn-loading-spinner" />
        <p>Loading warehouse dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Warehouse Operations</h1>
          <p className="vn-page-subtitle">Overview of warehouse activity and performance</p>
        </div>
        <select className="vn-filter-select" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} style={{ width: 'auto' }}>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {error && <div className="vn-alert vn-alert-error">{error}</div>}

      {/* Stats row */}
      <div className="vn-stats" style={{ marginBottom: '1.5rem' }}>
        <div className="vn-stat" onClick={() => navigate('/wms/zones')} style={{ cursor: 'pointer' }}>
          <div className="vn-stat-icon vn-stat-icon-primary">
            <span className="material-icons">grid_view</span>
          </div>
          <div className="vn-stat-value">{stats?.zones ?? 0}</div>
          <div className="vn-stat-label">Zones</div>
        </div>
        <div className="vn-stat" onClick={() => navigate('/wms/zones')} style={{ cursor: 'pointer' }}>
          <div className="vn-stat-icon vn-stat-icon-info">
            <span className="material-icons">inventory_2</span>
          </div>
          <div className="vn-stat-value">{stats?.activeBins ?? 0}</div>
          <div className="vn-stat-label">Active Bins</div>
        </div>
        <div className="vn-stat" onClick={() => navigate('/wms/inventory')} style={{ cursor: 'pointer' }}>
          <div className="vn-stat-icon vn-stat-icon-success">
            <span className="material-icons">category</span>
          </div>
          <div className="vn-stat-value">{stats?.totalSkus ?? 0}</div>
          <div className="vn-stat-label">SKUs in Stock</div>
        </div>
        <div className="vn-stat" onClick={() => navigate('/wms/receiving')} style={{ cursor: 'pointer' }}>
          <div className="vn-stat-icon vn-stat-icon-warning">
            <span className="material-icons">move_to_inbox</span>
          </div>
          <div className="vn-stat-value">{stats?.receivingTasks ?? 0}</div>
          <div className="vn-stat-label">Receiving Tasks</div>
        </div>
      </div>

      {/* Second stats row */}
      <div className="vn-stats" style={{ marginBottom: '1.5rem' }}>
        <div className="vn-stat" onClick={() => navigate('/wms/putaway')} style={{ cursor: 'pointer' }}>
          <div className="vn-stat-icon vn-stat-icon-info">
            <span className="material-icons">system_update_alt</span>
          </div>
          <div className="vn-stat-value">{stats?.putawayTasks ?? 0}</div>
          <div className="vn-stat-label">Putaway Tasks</div>
        </div>
        <div className="vn-stat" onClick={() => navigate('/wms/picking')} style={{ cursor: 'pointer' }}>
          <div className="vn-stat-icon vn-stat-icon-primary">
            <span className="material-icons">shopping_cart</span>
          </div>
          <div className="vn-stat-value">{stats?.pickTasks ?? 0}</div>
          <div className="vn-stat-label">Pick Tasks</div>
        </div>
        <div className="vn-stat" onClick={() => navigate('/wms/packing')} style={{ cursor: 'pointer' }}>
          <div className="vn-stat-icon vn-stat-icon-warning">
            <span className="material-icons">package_2</span>
          </div>
          <div className="vn-stat-value">{stats?.packTasks ?? 0}</div>
          <div className="vn-stat-label">Pack Tasks</div>
        </div>
        <div className="vn-stat" onClick={() => navigate('/wms/loading')} style={{ cursor: 'pointer' }}>
          <div className="vn-stat-icon vn-stat-icon-success">
            <span className="material-icons">local_shipping</span>
          </div>
          <div className="vn-stat-value">0</div>
          <div className="vn-stat-label">Loading</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="vn-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="vn-btn vn-btn-primary" onClick={() => navigate('/wms/zones')}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>
            Set Up Zones
          </button>
          <button className="vn-btn vn-btn-outline" onClick={() => navigate('/wms/receiving')}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>move_to_inbox</span>
            New Receiving Task
          </button>
          <button className="vn-btn vn-btn-outline" onClick={() => navigate('/wms/waves')}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>waves</span>
            Create Wave
          </button>
          <button className="vn-btn vn-btn-outline" onClick={() => navigate('/wms/inventory')}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>search</span>
            Search Inventory
          </button>
        </div>
      </div>

      {/* Placeholder for future widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="vn-card">
          <h3 style={{ margin: '0 0 1rem' }}>Dock Activity</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Dock utilization and appointment schedule will appear here once receiving is configured.
          </p>
        </div>
        <div className="vn-card">
          <h3 style={{ margin: '0 0 1rem' }}>Pick Performance</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Pick rate, accuracy, and wave progress will appear here once picking is active.
          </p>
        </div>
      </div>
    </div>
  );
}
