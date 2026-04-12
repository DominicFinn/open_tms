import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface ReadyShipment {
  shipmentId: string;
  shipmentReference: string;
  customerId: string;
  customerName: string;
  totalRevenueCents: number;
  chargeCount: number;
  deliveredAt: string | null;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VNextFinanceCreateInvoice() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<ReadyShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customerFilter, setCustomerFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/invoices/ready-to-invoice`)
      .then(r => r.json())
      .then(j => setShipments(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const customers = [...new Map(shipments.map(s => [s.customerId, s.customerName])).entries()];

  const filtered = shipments.filter(s => customerFilter === 'all' || s.customerId === customerFilter);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(s => s.shipmentId)));
    }
  };

  const selectedShipments = shipments.filter(s => selected.has(s.shipmentId));
  const totalRevenue = selectedShipments.reduce((s, sh) => s + sh.totalRevenueCents, 0);

  // All selected must be same customer
  const selectedCustomers = [...new Set(selectedShipments.map(s => s.customerId))];
  const canCreate = selected.size > 0 && selectedCustomers.length === 1;

  const createInvoice = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/invoices`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomers[0],
          shipmentIds: [...selected],
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate(`/finance/invoices/${json.data.id}`);
    } catch (e: any) { alert(e.message); }
    finally { setCreating(false); }
  };

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error) return <div className="vn-alert vn-alert-error">{error}</div>;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/finance/invoices')}>
          <span className="material-icons">arrow_back</span> Invoices
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ Create Invoice</span>
      </div>

      <div className="vn-page-header">
        <div>
          <h1>Create Invoice</h1>
          <p>Select delivered shipments with approved charges to invoice</p>
        </div>
      </div>

      {shipments.length === 0 ? (
        <div className="vn-empty">
          <span className="material-icons">receipt</span>
          <h3>No shipments ready to invoice</h3>
          <p>Shipments are marked as ready to invoice when they are delivered and have approved revenue charges.</p>
        </div>
      ) : (
        <>
          <div className="vn-card" style={{ marginBottom: 16 }}>
            <div className="vn-filters">
              <select className="vn-filter-select" value={customerFilter} onChange={e => { setCustomerFilter(e.target.value); setSelected(new Set()); }}>
                <option value="all">All Customers</option>
                {customers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>{filtered.length} shipments ready</span>
            </div>

            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} /></th>
                    <th>Shipment</th>
                    <th>Customer</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Charges</th>
                    <th>Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.shipmentId} onClick={() => toggleSelect(s.shipmentId)} style={{ cursor: 'pointer', background: selected.has(s.shipmentId) ? 'var(--surface-container)' : undefined }}>
                      <td><input type="checkbox" checked={selected.has(s.shipmentId)} readOnly /></td>
                      <td><span className="vn-table-id">{s.shipmentReference}</span></td>
                      <td>{s.customerName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatMoney(s.totalRevenueCents)}</td>
                      <td style={{ textAlign: 'right' }}>{s.chargeCount}</td>
                      <td className="vn-table-secondary">{formatDate(s.deliveredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary and create */}
          {selected.size > 0 && (
            <div className="vn-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <strong>{selected.size} shipment{selected.size > 1 ? 's' : ''} selected</strong>
                  <span style={{ margin: '0 12px', color: 'var(--on-surface-variant)' }}>|</span>
                  <strong style={{ fontSize: 18 }}>{formatMoney(totalRevenue)}</strong>
                  {selectedCustomers.length > 1 && (
                    <span className="vn-chip vn-chip-error" style={{ marginLeft: 12 }}>Multiple customers — select only one</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                  <input className="vn-input" placeholder="Invoice notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: 250 }} />
                  <button className="vn-btn vn-btn-primary" onClick={createInvoice} disabled={!canCreate || creating}>
                    <span className="material-icons">receipt</span>
                    {creating ? 'Creating...' : 'Create Invoice'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
