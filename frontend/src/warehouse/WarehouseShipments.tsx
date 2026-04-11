import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { useBarcodeScanner } from './useBarcodeScanner';
import './warehouse.css';

export default function WarehouseShipments() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const searchRef = useRef<HTMLInputElement>(null);

  const locationId = (() => {
    try {
      return JSON.parse(localStorage.getItem('warehouse_location') || '{}').id;
    } catch { return ''; }
  })();

  const loadShipments = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ locationId });
      if (search) params.set('search', search);
      const res = await fetch(`${API_URL}/api/v1/warehouse/shipments?${params}`);
      const json = await res.json();
      setShipments(json.data || []);
    } catch {
      // Ignore — will show empty
    }
    setLoading(false);
  }, [locationId, search]);

  useEffect(() => {
    loadShipments();
    // Refresh every 30s
    const interval = setInterval(loadShipments, 30000);
    return () => clearInterval(interval);
  }, [loadShipments]);

  // Barcode scanner hook: when a barcode is scanned, search for it
  const handleScan = useCallback((barcode: string) => {
    setSearch(barcode);
  }, []);

  useBarcodeScanner(handleScan);

  // Filter shipments client-side by status
  const filtered = shipments.filter(s => {
    if (statusFilter === 'flagged') return s.flags?.length > 0;
    if (statusFilter === 'launched') return !!s.launchedAt;
    if (statusFilter === 'pending') return !s.launchedAt;
    return true;
  });

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function getStatusLabel(s: any) {
    if (s.launchedAt) return 'launched';
    return s.status;
  }

  return (
    <>
      {/* Search bar */}
      <div className="wh-search-bar">
        <div className="wh-search-input">
          <span className="material-icons">search</span>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search or scan shipment..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            inputMode="none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--on-surface-variant)' }}
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
            </button>
          )}
        </div>
        <button className="wh-filter-btn" onClick={() => {
          if (searchRef.current) {
            searchRef.current.focus();
            searchRef.current.inputMode = 'text';
          }
        }} title="Type to search">
          <span className="material-icons">keyboard</span>
        </button>
      </div>

      {/* Filter chips */}
      <div className="wh-filter-chips">
        {(['all', 'pending', 'launched', 'flagged'] as const).map(f => (
          <button
            key={f}
            className={`wh-filter-chip ${statusFilter === f ? 'active' : ''}`}
            onClick={() => setStatusFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'pending' ? 'To Do' : f === 'launched' ? 'Launched' : 'Flagged'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && shipments.length === 0 && (
        <div className="wh-loading"><div className="wh-spinner" /></div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="wh-empty">
          <span className="material-icons">
            {search ? 'search_off' : 'check_circle'}
          </span>
          <p className="wh-empty-title">
            {search ? 'No matches' : "You're all caught up"}
          </p>
          <p className="wh-empty-message">
            {search ? 'Try a different search or scan.' : 'No shipments need attention right now.'}
          </p>
        </div>
      )}

      {/* Shipment list */}
      <div className="wh-shipment-list">
        {filtered.map(s => {
          const status = getStatusLabel(s);
          const hasFlags = s.flags?.length > 0;
          const orderCount = s.orderShipments?.length || 0;
          const unitCount = s.orderShipments?.reduce(
            (sum: number, os: any) => sum + (os.order?.trackableUnits?.length || 0), 0
          ) || 0;
          const deviceCount = s.deviceAssignments?.length || 0;

          return (
            <div
              key={s.id}
              className={`wh-shipment-card ${hasFlags ? 'flagged' : ''} ${s.launchedAt ? 'launched' : ''}`}
              onClick={() => navigate(`/warehouse/shipments/${s.id}`)}
            >
              <div className="wh-shipment-header">
                <span className="wh-shipment-ref">{s.reference}</span>
                <span className={`wh-shipment-status ${status}`}>{status}</span>
              </div>
              <div className="wh-shipment-route">
                <span className="material-icons">trip_origin</span>
                {s.origin?.name || '—'}
                <span className="material-icons">arrow_forward</span>
                <span className="material-icons">flag</span>
                {s.destination?.name || '—'}
              </div>
              <div className="wh-shipment-meta">
                {s.customer && (
                  <span className="wh-shipment-meta-item">
                    <span className="material-icons">business</span>
                    {s.customer.name}
                  </span>
                )}
                {s.pickupDate && (
                  <span className="wh-shipment-meta-item">
                    <span className="material-icons">calendar_today</span>
                    {formatDate(s.pickupDate)}
                  </span>
                )}
                {orderCount > 0 && (
                  <span className="wh-shipment-meta-item">
                    <span className="material-icons">receipt</span>
                    {orderCount} order{orderCount !== 1 ? 's' : ''}
                  </span>
                )}
                {unitCount > 0 && (
                  <span className="wh-shipment-meta-item">
                    <span className="material-icons">inventory</span>
                    {unitCount} unit{unitCount !== 1 ? 's' : ''}
                  </span>
                )}
                {deviceCount > 0 && (
                  <span className="wh-shipment-meta-item">
                    <span className="material-icons">sensors</span>
                    {deviceCount} tracker{deviceCount !== 1 ? 's' : ''}
                  </span>
                )}
                {hasFlags && (
                  <span className="wh-shipment-meta-item" style={{ color: 'var(--error)' }}>
                    <span className="material-icons">flag</span>
                    {s.flags.length} flag{s.flags.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pull to refresh hint */}
      <div style={{ textAlign: 'center', padding: '16px', fontSize: '12px', color: 'var(--on-surface-variant)' }}>
        {filtered.length > 0 && `${filtered.length} shipment${filtered.length !== 1 ? 's' : ''}`}
        {' · '}
        <button onClick={loadShipments} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>
          Refresh
        </button>
      </div>
    </>
  );
}
