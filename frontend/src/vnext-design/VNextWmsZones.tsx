import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface WarehouseZone {
  id: string;
  locationId: string;
  locationName: string;
  name: string;
  zoneType: string;
  temperatureZone: string | null;
  hazmatCertified: boolean;
  maxWeightKg: number | null;
  maxVolumeCbm: number | null;
  sortOrder: number;
  active: boolean;
  binCount: number;
}

interface WarehouseBin {
  id: string;
  zoneId: string;
  zoneName: string;
  aisleId: string | null;
  label: string;
  binType: string;
  maxWeightKg: number | null;
  maxVolumeCbm: number | null;
  maxPalletPositions: number | null;
  level: number | null;
  walkSequence: number;
  active: boolean;
  currentWeightKg: number;
  currentVolumeCbm: number;
  currentPalletCount: number;
}

interface LocationOption {
  id: string;
  name: string;
}

const ZONE_TYPES = [
  'receiving', 'bulk_storage', 'pick_face', 'staging', 'packing',
  'shipping_dock', 'quarantine', 'returns', 'cross_dock',
];

const BIN_TYPES = [
  'pallet', 'shelf', 'floor', 'dock_door', 'staging', 'pack_station',
];

const TEMP_ZONES = ['ambient', 'refrigerated', 'frozen'];

/* ── Helpers ──────────────────────────────────────────────── */

function formatZoneType(t: string): string {
  return t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function zoneTypeChip(t: string): string {
  switch (t) {
    case 'receiving': return 'vn-chip-info';
    case 'bulk_storage': return 'vn-chip-secondary';
    case 'pick_face': return 'vn-chip-primary';
    case 'staging': return 'vn-chip-warning';
    case 'packing': return 'vn-chip-info';
    case 'shipping_dock': return 'vn-chip-success';
    case 'quarantine': return 'vn-chip-error';
    case 'returns': return 'vn-chip-warning';
    case 'cross_dock': return 'vn-chip-primary';
    default: return 'vn-chip-secondary';
  }
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsZones() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'zones' | 'bins'>(
    (searchParams.get('tab') as 'zones' | 'bins') || 'zones'
  );
  const [zones, setZones] = useState<WarehouseZone[]>([]);
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Load locations first, then fetch zones/bins for selected location
  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter(
          (l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(locs);
        if (locs.length > 0) {
          setSelectedLocation(locs[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    setLoading(true);
    const zoneP = fetch(`${API_URL}/api/v1/warehouse/zones?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setZones((res.data || []).map((z: any) => ({ ...z, binCount: z._count?.bins ?? 0 }))));
    const binP = fetch(`${API_URL}/api/v1/warehouse/bins?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setBins((res.data || []).map((b: any) => ({ ...b, zoneName: b.zone?.name ?? '' }))));
    Promise.all([zoneP, binP]).finally(() => setLoading(false));
  }, [selectedLocation]);

  const switchTab = (t: 'zones' | 'bins') => {
    setTab(t);
    setSearchParams({ tab: t });
  };

  const filteredZones = zones.filter(z =>
    z.name.toLowerCase().includes(search.toLowerCase()) ||
    z.zoneType.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBins = bins.filter(b =>
    b.label.toLowerCase().includes(search.toLowerCase()) ||
    b.binType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Zones & Bins</h1>
          <p className="vn-page-subtitle">Manage warehouse location hierarchy</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {tab === 'zones' && (
            <button className="vn-btn vn-btn-primary" onClick={() => navigate('/wms/zones/create')}>
              <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>
              Add Zone
            </button>
          )}
          {tab === 'bins' && (
            <button className="vn-btn vn-btn-primary" onClick={() => navigate('/wms/bins/create')}>
              <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>
              Add Bin
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="vn-tabs" style={{ marginBottom: '1rem' }}>
        <button className={`vn-tab ${tab === 'zones' ? 'active' : ''}`} onClick={() => switchTab('zones')}>
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>grid_view</span>
          Zones
        </button>
        <button className={`vn-tab ${tab === 'bins' ? 'active' : ''}`} onClick={() => switchTab('bins')}>
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>inventory_2</span>
          Bins
        </button>
      </div>

      {/* Filters */}
      <div className="vn-filters" style={{ marginBottom: '1rem' }}>
        <select
          className="vn-filter-select"
          value={selectedLocation}
          onChange={e => setSelectedLocation(e.target.value)}
        >
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <input
          className="vn-filter-input"
          placeholder={tab === 'zones' ? 'Search zones...' : 'Search bins...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="vn-loading-spinner" />
        </div>
      ) : tab === 'zones' ? (
        /* Zone list */
        filteredZones.length === 0 ? (
          <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>grid_view</span>
            <h3>No zones configured</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Set up warehouse zones to define receiving docks, storage areas, pick faces, and staging areas.
            </p>
            <button className="vn-btn vn-btn-primary" onClick={() => navigate('/wms/zones/create')}>
              Create First Zone
            </button>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Temperature</th>
                  <th>Hazmat</th>
                  <th>Bins</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredZones.map(zone => (
                  <tr key={zone.id} onClick={() => navigate(`/wms/zones/${zone.id}`)} style={{ cursor: 'pointer' }}>
                    <td><strong>{zone.name}</strong></td>
                    <td><span className={`vn-chip ${zoneTypeChip(zone.zoneType)}`}>{formatZoneType(zone.zoneType)}</span></td>
                    <td>{zone.temperatureZone ? formatZoneType(zone.temperatureZone) : '--'}</td>
                    <td>{zone.hazmatCertified ? 'Yes' : 'No'}</td>
                    <td>{zone.binCount}</td>
                    <td><span className={`vn-chip ${zone.active ? 'vn-chip-success' : 'vn-chip-secondary'}`}>{zone.active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Bin list */
        filteredBins.length === 0 ? (
          <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>inventory_2</span>
            <h3>No bins configured</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Bins are individual storage locations within zones. Create zones first, then add bins.
            </p>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Zone</th>
                  <th>Type</th>
                  <th>Level</th>
                  <th>Walk Seq</th>
                  <th>Utilization</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBins.map(bin => (
                  <tr key={bin.id} style={{ cursor: 'pointer' }}>
                    <td><strong>{bin.label}</strong></td>
                    <td>{bin.zoneName}</td>
                    <td><span className="vn-chip vn-chip-secondary">{formatZoneType(bin.binType)}</span></td>
                    <td>{bin.level ?? '--'}</td>
                    <td>{bin.walkSequence}</td>
                    <td>
                      {bin.maxPalletPositions
                        ? `${bin.currentPalletCount}/${bin.maxPalletPositions} pallets`
                        : '--'}
                    </td>
                    <td><span className={`vn-chip ${bin.active ? 'vn-chip-success' : 'vn-chip-secondary'}`}>{bin.active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
