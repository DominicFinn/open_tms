import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface InventoryRecord {
  id: string;
  sku: string;
  uomCode: string;
  quantityOnHand: number;
  quantityAllocated: number;
  quantityAvailable: number;
  quantityOnHold: number;
  lotNumber: string | null;
  expiryDate: string | null;
  lastCountedAt: string | null;
  bin: { id: string; label: string; binType: string; zone: { id: string; name: string; zoneType: string } };
  ownerCustomer: { id: string; name: string } | null;
}

interface SkuSummary {
  sku: string;
  uomCode: string;
  totalOnHand: number;
  totalAllocated: number;
  totalAvailable: number;
  totalOnHold: number;
  binCount: number;
}

const REASON_CODES = ['damage', 'expired', 'recount', 'scrap', 'found', 'return', 'other'];

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsInventory() {
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [summary, setSummary] = useState<SkuSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'detail' | 'summary'>('detail');

  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);

  // Adjust modal
  const [adjustRecord, setAdjustRecord] = useState<InventoryRecord | null>(null);
  const [adjustForm, setAdjustForm] = useState({ quantityChange: '', reasonCode: 'recount' });
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // Transfer modal
  const [transferRecord, setTransferRecord] = useState<InventoryRecord | null>(null);
  const [transferForm, setTransferForm] = useState({ targetBinId: '', quantity: '' });
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [bins, setBins] = useState<Array<{ id: string; label: string }>>([]);

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

  const loadData = () => {
    if (!selectedLocation) return;
    setLoading(true);
    const detailP = fetch(`${API_URL}/api/v1/inventory?locationId=${selectedLocation}&hasStock=true`)
      .then(r => r.json())
      .then(res => setRecords(res.data || []));
    const summaryP = fetch(`${API_URL}/api/v1/inventory/summary?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setSummary(res.data || []));
    Promise.all([detailP, summaryP]).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedLocation]);

  // Load bins for transfer modal
  useEffect(() => {
    if (!selectedLocation) return;
    fetch(`${API_URL}/api/v1/warehouse/bins?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setBins((res.data || []).filter((b: any) => b.active)));
  }, [selectedLocation]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustRecord) return;
    setAdjustError('');
    setAdjusting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/inventory/${adjustRecord.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityChange: parseInt(adjustForm.quantityChange),
          reasonCode: adjustForm.reasonCode,
        }),
      });
      const data = await res.json();
      if (data.error) { setAdjustError(data.error); }
      else { setAdjustRecord(null); loadData(); }
    } catch { setAdjustError('Failed to adjust'); }
    finally { setAdjusting(false); }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferRecord) return;
    setTransferError('');
    setTransferring(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/inventory/${transferRecord.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetBinId: transferForm.targetBinId,
          quantity: parseInt(transferForm.quantity),
        }),
      });
      const data = await res.json();
      if (data.error) { setTransferError(data.error); }
      else { setTransferRecord(null); loadData(); }
    } catch { setTransferError('Failed to transfer'); }
    finally { setTransferring(false); }
  };

  const filtered = records.filter(r =>
    r.sku.toLowerCase().includes(search.toLowerCase()) ||
    r.bin.label.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSummary = summary.filter(s =>
    s.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Inventory</h1>
          <p className="vn-page-subtitle">Real-time stock levels across all warehouse bins</p>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="vn-tabs">
          <button className={`vn-tab ${view === 'detail' ? 'active' : ''}`} onClick={() => setView('detail')}>By Bin</button>
          <button className={`vn-tab ${view === 'summary' ? 'active' : ''}`} onClick={() => setView('summary')}>By SKU</button>
        </div>
        <div className="vn-filters" style={{ margin: 0 }}>
          <select className="vn-filter-select" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <input className="vn-filter-input" placeholder="Search SKU or bin..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>
      ) : view === 'summary' ? (
        /* Summary view */
        filteredSummary.length === 0 ? (
          <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>inventory_2</span>
            <h3>No inventory</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Stock appears here after goods are received and put away.</p>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr><th>SKU</th><th>UOM</th><th>On Hand</th><th>Allocated</th><th>Available</th><th>On Hold</th><th>Bins</th></tr>
              </thead>
              <tbody>
                {filteredSummary.map(s => (
                  <tr key={`${s.sku}-${s.uomCode}`}>
                    <td><strong>{s.sku}</strong></td>
                    <td>{s.uomCode}</td>
                    <td>{s.totalOnHand}</td>
                    <td>{s.totalAllocated}</td>
                    <td style={{ fontWeight: 600, color: s.totalAvailable > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{s.totalAvailable}</td>
                    <td>{s.totalOnHold > 0 ? <span style={{ color: 'var(--color-warning)' }}>{s.totalOnHold}</span> : 0}</td>
                    <td>{s.binCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Detail view */
        filtered.length === 0 ? (
          <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>inventory_2</span>
            <h3>No inventory records</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Stock appears here after goods are received and put away.</p>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr><th>SKU</th><th>Bin</th><th>Zone</th><th>UOM</th><th>On Hand</th><th>Allocated</th><th>Available</th><th>On Hold</th><th>Lot</th><th>Expiry</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.sku}</strong></td>
                    <td><span className="vn-table-secondary">{r.bin.label}</span></td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.bin.zone.name}</td>
                    <td>{r.uomCode}</td>
                    <td>{r.quantityOnHand}</td>
                    <td>{r.quantityAllocated}</td>
                    <td style={{ fontWeight: 600, color: r.quantityAvailable > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{r.quantityAvailable}</td>
                    <td>{r.quantityOnHold > 0 ? <span style={{ color: 'var(--color-warning)' }}>{r.quantityOnHold}</span> : 0}</td>
                    <td>{r.lotNumber || '--'}</td>
                    <td>{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '--'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
                          onClick={() => { setAdjustRecord(r); setAdjustForm({ quantityChange: '', reasonCode: 'recount' }); setAdjustError(''); }}>
                          Adjust
                        </button>
                        <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
                          onClick={() => { setTransferRecord(r); setTransferForm({ targetBinId: '', quantity: String(r.quantityAvailable) }); setTransferError(''); }}>
                          Transfer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Adjust modal */}
      {adjustRecord && (
        <div className="vn-modal-backdrop" onClick={() => setAdjustRecord(null)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="vn-modal-header">
              <h3>Adjust Stock</h3>
              <button onClick={() => setAdjustRecord(null)}><span className="material-icons">close</span></button>
            </div>
            <form onSubmit={handleAdjust}>
              <div className="vn-modal-body">
                {adjustError && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{adjustError}</div>}
                <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
                  <strong>{adjustRecord.sku}</strong> at <strong>{adjustRecord.bin.label}</strong> - current: {adjustRecord.quantityOnHand}
                </p>
                <div className="vn-field" style={{ marginBottom: '1rem' }}>
                  <label className="vn-field-label">Quantity Change *</label>
                  <input className="vn-input" type="number" value={adjustForm.quantityChange}
                    onChange={e => setAdjustForm({ ...adjustForm, quantityChange: e.target.value })}
                    placeholder="e.g. -5 to remove, +3 to add" required />
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Reason *</label>
                  <select className="vn-input" value={adjustForm.reasonCode} onChange={e => setAdjustForm({ ...adjustForm, reasonCode: e.target.value })}>
                    {REASON_CODES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="vn-modal-footer">
                <button type="button" className="vn-btn vn-btn-outline" onClick={() => setAdjustRecord(null)}>Cancel</button>
                <button type="submit" className="vn-btn vn-btn-primary" disabled={adjusting}>{adjusting ? 'Saving...' : 'Apply Adjustment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferRecord && (
        <div className="vn-modal-backdrop" onClick={() => setTransferRecord(null)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="vn-modal-header">
              <h3>Transfer Stock</h3>
              <button onClick={() => setTransferRecord(null)}><span className="material-icons">close</span></button>
            </div>
            <form onSubmit={handleTransfer}>
              <div className="vn-modal-body">
                {transferError && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{transferError}</div>}
                <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
                  <strong>{transferRecord.sku}</strong> from <strong>{transferRecord.bin.label}</strong> - available: {transferRecord.quantityAvailable}
                </p>
                <div className="vn-field" style={{ marginBottom: '1rem' }}>
                  <label className="vn-field-label">Target Bin *</label>
                  <select className="vn-input" value={transferForm.targetBinId} onChange={e => setTransferForm({ ...transferForm, targetBinId: e.target.value })} required>
                    <option value="">Select bin...</option>
                    {bins.filter(b => b.id !== transferRecord.bin.id).map(b => (
                      <option key={b.id} value={b.id}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Quantity *</label>
                  <input className="vn-input" type="number" min="1" max={transferRecord.quantityAvailable}
                    value={transferForm.quantity} onChange={e => setTransferForm({ ...transferForm, quantity: e.target.value })} required />
                </div>
              </div>
              <div className="vn-modal-footer">
                <button type="button" className="vn-btn vn-btn-outline" onClick={() => setTransferRecord(null)}>Cancel</button>
                <button type="submit" className="vn-btn vn-btn-primary" disabled={transferring}>{transferring ? 'Transferring...' : 'Transfer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
