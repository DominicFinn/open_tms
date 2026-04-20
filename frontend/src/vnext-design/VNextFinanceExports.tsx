import React, { useState } from 'react';
import { API_URL } from '../api';

interface ExportOption {
  key: string;
  label: string;
  description: string;
  icon: string;
  endpoint: string;
  supportsDateRange: boolean;
  extraParams?: { key: string; label: string; options: { value: string; label: string }[] }[];
}

const EXPORTS: ExportOption[] = [
  {
    key: 'invoices',
    label: 'Invoice Register',
    description: 'All customer invoices with line item detail — totals, payment status, balances',
    icon: 'receipt',
    endpoint: '/api/v1/reports/export/invoices',
    supportsDateRange: true,
    extraParams: [{ key: 'status', label: 'Status', options: [
      { value: '', label: 'All' }, { value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' },
      { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' }, { value: 'void', label: 'Void' },
    ]}],
  },
  {
    key: 'carrier-invoices',
    label: 'Carrier Invoice Register',
    description: 'All carrier invoices with freight audit results — match status, variance, line items',
    icon: 'local_shipping',
    endpoint: '/api/v1/reports/export/carrier-invoices',
    supportsDateRange: true,
    extraParams: [{ key: 'status', label: 'Status', options: [
      { value: '', label: 'All' }, { value: 'received', label: 'Received' }, { value: 'approved', label: 'Approved' },
      { value: 'paid', label: 'Paid' }, { value: 'discrepancy', label: 'Discrepancy' },
    ]}],
  },
  {
    key: 'payments',
    label: 'Payment Ledger',
    description: 'All customer payments received — date, invoice, amount, method, reference',
    icon: 'payment',
    endpoint: '/api/v1/reports/export/payments',
    supportsDateRange: true,
  },
  {
    key: 'charges',
    label: 'Charge Detail',
    description: 'All revenue and cost charges across shipments — for margin analysis and reconciliation',
    icon: 'attach_money',
    endpoint: '/api/v1/reports/export/charges',
    supportsDateRange: true,
    extraParams: [{ key: 'chargeCategory', label: 'Category', options: [
      { value: '', label: 'All' }, { value: 'revenue', label: 'Revenue' }, { value: 'cost', label: 'Cost' },
    ]}],
  },
  {
    key: 'ar-aging',
    label: 'AR Aging',
    description: 'Outstanding invoices bucketed by days past due per customer',
    icon: 'assessment',
    endpoint: '/api/v1/reports/ar-aging/csv',
    supportsDateRange: false,
  },
];

export default function VNextFinanceExports() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({});

  const download = (exp: ExportOption) => {
    const params = new URLSearchParams();
    if (exp.supportsDateRange) {
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
    }
    if (exp.extraParams) {
      for (const p of exp.extraParams) {
        const val = extraFilters[`${exp.key}-${p.key}`];
        if (val) params.set(p.key, val);
      }
    }
    const qs = params.toString();
    window.open(`${API_URL}${exp.endpoint}${qs ? '?' + qs : ''}`, '_blank');
  };

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Financial Exports</h1>
          <p>Download CSV files for your accounting system</p>
        </div>
      </div>

      {/* Global date range */}
      <div className="vn-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px' }}>Date Range</h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="vn-field" style={{ marginBottom: 0 }}>
            <label className="vn-field-label">From</label>
            <input className="vn-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="vn-field" style={{ marginBottom: 0 }}>
            <label className="vn-field-label">To</label>
            <input className="vn-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
            <button className="vn-btn vn-btn-ghost" style={{ padding: '10px 14px' }} onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 30);
              setDateFrom(d.toISOString().slice(0, 10)); setDateTo(today);
            }}>Last 30 days</button>
            <button className="vn-btn vn-btn-ghost" style={{ padding: '10px 14px' }} onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 90);
              setDateFrom(d.toISOString().slice(0, 10)); setDateTo(today);
            }}>Last 90 days</button>
            <button className="vn-btn vn-btn-ghost" style={{ padding: '10px 14px' }} onClick={() => {
              setDateFrom(`${new Date().getFullYear()}-01-01`); setDateTo(today);
            }}>Year to date</button>
          </div>
        </div>
      </div>

      {/* Export cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
        {EXPORTS.map(exp => (
          <div key={exp.key} className="vn-card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div className="vn-stat-icon primary" style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-icons">{exp.icon}</span>
              </div>
              <div>
                <h3 style={{ margin: 0 }}>{exp.label}</h3>
              </div>
            </div>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: 13, margin: '0 0 16px', flex: 1 }}>{exp.description}</p>

            {exp.extraParams && (
              <div style={{ marginBottom: 12 }}>
                {exp.extraParams.map(p => (
                  <select key={p.key} className="vn-filter-select" style={{ width: '100%', marginBottom: 8 }}
                    value={extraFilters[`${exp.key}-${p.key}`] || ''}
                    onChange={e => setExtraFilters(prev => ({ ...prev, [`${exp.key}-${p.key}`]: e.target.value }))}>
                    {p.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ))}
              </div>
            )}

            <button className="vn-btn vn-btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={() => download(exp)}>
              <span className="material-icons">download</span>
              Download CSV
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
