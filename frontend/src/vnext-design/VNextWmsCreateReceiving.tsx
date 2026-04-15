import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface LocationOption { id: string; name: string; }
interface BinOption { id: string; label: string; binType: string; }

export default function VNextWmsCreateReceiving() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [dockBins, setDockBins] = useState<BinOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    locationId: '',
    receivingType: 'blind' as 'asn' | 'blind',
    dockBinId: '',
    crossDock: false,
    inboundShipmentId: '',
    carrierName: '',
    trailerNumber: '',
    sealNumber: '',
  });

  // Blind receiving lines (added before task creation)
  const [lines, setLines] = useState<Array<{ sku: string; expectedQuantity: string; lotNumber: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter(
          (l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(locs);
        if (locs.length === 1) setForm(f => ({ ...f, locationId: locs[0].id }));
      })
      .catch(() => {});
  }, []);

  // Load dock bins when location changes
  useEffect(() => {
    if (!form.locationId) { setDockBins([]); return; }
    fetch(`${API_URL}/api/v1/warehouse/bins?locationId=${form.locationId}`)
      .then(r => r.json())
      .then(res => {
        const docks = (res.data || []).filter((b: any) => b.binType === 'dock_door');
        setDockBins(docks);
      })
      .catch(() => {});
  }, [form.locationId]);

  const addLine = () => {
    setLines([...lines, { sku: '', expectedQuantity: '1', lotNumber: '' }]);
  };

  const removeLine = (i: number) => {
    setLines(lines.filter((_, idx) => idx !== i));
  };

  const updateLine = (i: number, field: string, value: string) => {
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const payload: Record<string, unknown> = {
      locationId: form.locationId,
      receivingType: form.receivingType,
      dockBinId: form.dockBinId || null,
      crossDock: form.crossDock,
      inboundShipmentId: form.inboundShipmentId || null,
    };

    // Include expected lines for ASN mode
    if (form.receivingType === 'asn' && lines.length > 0) {
      payload.expectedLines = lines
        .filter(l => l.sku.trim())
        .map(l => ({
          sku: l.sku.trim(),
          expectedQuantity: parseInt(l.expectedQuantity) || 1,
          lotNumber: l.lotNumber || null,
        }));
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/receiving/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        navigate(`/wms/receiving/${data.data.id}`);
      }
    } catch {
      setError('Failed to create receiving task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>New Receiving Task</h1>
          <p className="vn-page-subtitle">Receive inbound goods at a warehouse dock</p>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="vn-card" style={{ maxWidth: '800px' }}>
        <div className="vn-form-grid">
          <div className="vn-field">
            <label className="vn-field-label">Location *</label>
            <select className="vn-input" value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })} required>
              <option value="">Select warehouse...</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div className="vn-field">
            <label className="vn-field-label">Receiving Type *</label>
            <select className="vn-input" value={form.receivingType} onChange={e => setForm({ ...form, receivingType: e.target.value as 'asn' | 'blind' })}>
              <option value="blind">Blind Receiving</option>
              <option value="asn">ASN-Based (Expected Items)</option>
            </select>
          </div>

          <div className="vn-field">
            <label className="vn-field-label">Dock Door</label>
            <select className="vn-input" value={form.dockBinId} onChange={e => setForm({ ...form, dockBinId: e.target.value })}>
              <option value="">No dock assigned</option>
              {dockBins.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>

          <div className="vn-field">
            <label className="vn-field-label">Inbound Shipment ID</label>
            <input className="vn-input" value={form.inboundShipmentId} onChange={e => setForm({ ...form, inboundShipmentId: e.target.value })} placeholder="Optional" />
          </div>

          <div className="vn-field">
            <label className="vn-field-label">Carrier Name</label>
            <input className="vn-input" value={form.carrierName} onChange={e => setForm({ ...form, carrierName: e.target.value })} placeholder="Optional" />
          </div>

          <div className="vn-field">
            <label className="vn-field-label">Trailer #</label>
            <input className="vn-input" value={form.trailerNumber} onChange={e => setForm({ ...form, trailerNumber: e.target.value })} placeholder="Optional" />
          </div>

          <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.crossDock} onChange={e => setForm({ ...form, crossDock: e.target.checked })} />
              Cross-Dock (skip putaway to storage)
            </label>
          </div>
        </div>

        {/* Expected lines for ASN mode */}
        {form.receivingType === 'asn' && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Expected Items</h3>
              <button type="button" className="vn-btn vn-btn-outline" onClick={addLine} style={{ fontSize: '0.85rem' }}>
                <span className="material-icons" style={{ fontSize: '16px', marginRight: '0.3rem' }}>add</span>
                Add Line
              </button>
            </div>
            {lines.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No expected items. Add lines to pre-populate what you expect to receive.</p>
            ) : (
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr><th>SKU</th><th>Expected Qty</th><th>Lot #</th><th></th></tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i}>
                        <td><input className="vn-input" value={line.sku} onChange={e => updateLine(i, 'sku', e.target.value)} placeholder="SKU" style={{ minWidth: '120px' }} /></td>
                        <td><input className="vn-input" type="number" min="1" value={line.expectedQuantity} onChange={e => updateLine(i, 'expectedQuantity', e.target.value)} style={{ width: '80px' }} /></td>
                        <td><input className="vn-input" value={line.lotNumber} onChange={e => updateLine(i, 'lotNumber', e.target.value)} placeholder="Optional" /></td>
                        <td><button type="button" className="vn-btn vn-btn-outline" onClick={() => removeLine(i)} style={{ padding: '0.25rem 0.5rem' }}><span className="material-icons" style={{ fontSize: '16px' }}>close</span></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="vn-form-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="vn-btn vn-btn-outline" onClick={() => navigate('/wms/receiving')}>Cancel</button>
          <button type="submit" className="vn-btn vn-btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
}
