import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface LineItem {
  chargeType: string;
  description: string;
  amountCents: number;
  freightClass?: string;
  quantity: number;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function VNextFinanceCreateQuote() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [serviceLevel, setServiceLevel] = useState('FTL');
  const [markupPercent, setMarkupPercent] = useState('15');
  const [validDays, setValidDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { chargeType: 'linehaul', description: '', amountCents: 0, quantity: 1 },
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/customers`).then(r => r.json()).then(j => setCustomers(j.data || []));
  }, []);

  const addLineItem = () => {
    setLineItems([...lineItems, { chargeType: 'accessorial', description: '', amountCents: 0, quantity: 1 }]);
  };

  const removeLineItem = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateLineItem = (idx: number, field: string, value: any) => {
    setLineItems(lineItems.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };

  const totalCostCents = lineItems.reduce((s, li) => s + li.amountCents * li.quantity, 0);
  const markup = parseFloat(markupPercent) || 0;
  const totalRevenueCents = Math.round(totalCostCents * (1 + markup / 100));
  const marginCents = totalRevenueCents - totalCostCents;

  const createQuote = async () => {
    if (!customerId) { setError('Select a customer'); return; }
    if (lineItems.some(li => !li.description || li.amountCents <= 0)) { setError('All line items need a description and amount'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/quotes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          serviceLevel,
          markupPercent: markup,
          validDays: parseInt(validDays) || 30,
          notes: notes || undefined,
          lineItems: lineItems.map(li => ({
            chargeType: li.chargeType,
            description: li.description,
            amountCents: li.amountCents,
            freightClass: li.freightClass || undefined,
            quantity: li.quantity,
          })),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate(`/finance/quotes/${json.data.id}`);
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/finance/quotes')}>
          <span className="material-icons">arrow_back</span> Quotes
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ New Quote</span>
      </div>

      <div className="vn-page-header">
        <div><h1>Create Quote</h1><p>Build a quote with line items and markup</p></div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="vn-detail-grid">
        <div className="vn-detail-main">
          {/* Customer & Service */}
          <div className="vn-card" style={{ marginBottom: 24, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px' }}>Quote Details</h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Customer</label>
                <select className="vn-input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">Select customer...</option>
                  {customers.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Service Level</label>
                <select className="vn-input" value={serviceLevel} onChange={e => setServiceLevel(e.target.value)}>
                  <option value="FTL">FTL (Full Truck Load)</option>
                  <option value="LTL">LTL (Less Than Truck Load)</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Markup %</label>
                <input className="vn-input" type="number" min="0" step="0.5" value={markupPercent} onChange={e => setMarkupPercent(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Valid For (days)</label>
                <input className="vn-input" type="number" min="1" value={validDays} onChange={e => setValidDays(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="vn-card" style={{ marginBottom: 24, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Line Items (Cost Basis)</h3>
              <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={addLineItem}>
                <span className="material-icons">add</span> Add Line
              </button>
            </div>

            {lineItems.map((li, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'end', flexWrap: 'wrap' }}>
                <div className="vn-field" style={{ flex: '0 0 120px' }}>
                  {idx === 0 && <label className="vn-field-label">Type</label>}
                  <select className="vn-input" value={li.chargeType} onChange={e => updateLineItem(idx, 'chargeType', e.target.value)}>
                    <option value="linehaul">Linehaul</option>
                    <option value="fuel_surcharge">Fuel Surcharge</option>
                    <option value="accessorial">Accessorial</option>
                    <option value="discount">Discount</option>
                  </select>
                </div>
                <div className="vn-field" style={{ flex: 1, minWidth: 200 }}>
                  {idx === 0 && <label className="vn-field-label">Description</label>}
                  <input className="vn-input" value={li.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} placeholder="e.g. Linehaul Chicago to Dallas" />
                </div>
                <div className="vn-field" style={{ flex: '0 0 120px' }}>
                  {idx === 0 && <label className="vn-field-label">Amount ($)</label>}
                  <input className="vn-input" type="number" min="0" step="0.01" value={li.amountCents ? (li.amountCents / 100).toFixed(2) : ''}
                    onChange={e => updateLineItem(idx, 'amountCents', Math.round(parseFloat(e.target.value || '0') * 100))} />
                </div>
                <div className="vn-field" style={{ flex: '0 0 60px' }}>
                  {idx === 0 && <label className="vn-field-label">Qty</label>}
                  <input className="vn-input" type="number" min="1" value={li.quantity} onChange={e => updateLineItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                </div>
                {lineItems.length > 1 && (
                  <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => removeLineItem(idx)} style={{ marginBottom: 2 }}>
                    <span className="material-icons">close</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="vn-card" style={{ marginBottom: 24, padding: 20 }}>
            <div className="vn-field">
              <label className="vn-field-label">Notes</label>
              <textarea className="vn-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal or customer-facing notes..." />
            </div>
          </div>
        </div>

        {/* Sidebar summary */}
        <div className="vn-detail-sidebar">
          <div className="vn-card" style={{ padding: 20, position: 'sticky', top: 80 }}>
            <h3 style={{ margin: '0 0 16px' }}>Quote Summary</h3>
            <div className="vn-info-grid">
              <div className="vn-info-item"><label>Cost (Carrier)</label><span>{formatMoney(totalCostCents)}</span></div>
              <div className="vn-info-item"><label>Markup ({markup}%)</label><span>{formatMoney(totalRevenueCents - totalCostCents)}</span></div>
              <div className="vn-info-item"><label style={{ fontWeight: 700 }}>Revenue (Customer)</label><span style={{ fontWeight: 700, fontSize: 18 }}>{formatMoney(totalRevenueCents)}</span></div>
              <div className="vn-info-item"><label>Margin</label><span style={{ color: marginCents >= 0 ? 'var(--success)' : 'var(--error)' }}>{formatMoney(marginCents)}</span></div>
            </div>
            <button className="vn-btn vn-btn-primary" style={{ width: '100%', marginTop: 20, justifyContent: 'center' }} onClick={createQuote} disabled={creating}>
              <span className="material-icons">request_quote</span>
              {creating ? 'Creating...' : 'Create Quote'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
