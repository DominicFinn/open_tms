import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface InventoryRecord {
  id: string;
  locationName: string;
  binLabel: string;
  sku: string;
  uomCode: string;
  quantityOnHand: number;
  quantityAllocated: number;
  quantityAvailable: number;
  quantityOnHold: number;
  lotNumber: string | null;
  expiryDate: string | null;
  lastCountedAt: string | null;
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsInventory() {
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skuFilter, setSkuFilter] = useState('');

  useEffect(() => {
    // TODO: Fetch from API
    setLoading(false);
  }, []);

  const filtered = records.filter(r =>
    r.sku.toLowerCase().includes(search.toLowerCase()) ||
    r.binLabel.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Inventory</h1>
          <p className="vn-page-subtitle">Real-time stock levels across all warehouse bins</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="vn-btn vn-btn-outline">
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>tune</span>
            Adjust Stock
          </button>
          <button className="vn-btn vn-btn-outline">
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>swap_horiz</span>
            Transfer
          </button>
          <button className="vn-btn vn-btn-outline">
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>fact_check</span>
            Cycle Count
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="vn-filters" style={{ marginBottom: '1rem' }}>
        <input
          className="vn-filter-input"
          placeholder="Search by SKU, bin label..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="vn-loading-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>inventory_2</span>
          <h3>No inventory records</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Inventory records are created automatically when goods are received and put away. Set up zones and start receiving to build inventory.
          </p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Bin</th>
                <th>UOM</th>
                <th>On Hand</th>
                <th>Allocated</th>
                <th>Available</th>
                <th>On Hold</th>
                <th>Lot</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.sku}</strong></td>
                  <td><span className="vn-table-secondary">{r.binLabel}</span></td>
                  <td>{r.uomCode}</td>
                  <td>{r.quantityOnHand}</td>
                  <td>{r.quantityAllocated}</td>
                  <td style={{ fontWeight: 600, color: r.quantityAvailable > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {r.quantityAvailable}
                  </td>
                  <td>{r.quantityOnHold > 0 ? <span style={{ color: 'var(--color-warning)' }}>{r.quantityOnHold}</span> : 0}</td>
                  <td>{r.lotNumber || '--'}</td>
                  <td>{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
