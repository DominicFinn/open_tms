import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface AgingBucket {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
}

interface CustomerAging {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  buckets: AgingBucket;
}

interface AgingData {
  totals: AgingBucket;
  customers: CustomerAging[];
  generatedAt: string;
  asOfDate: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function bucketColor(cents: number): string | undefined {
  if (cents === 0) return 'var(--on-surface-variant)';
  return undefined;
}

export default function VNextFinanceAgingReport() {
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/reports/ar-aging?asOfDate=${asOfDate}`)
      .then(r => r.json())
      .then(j => { setData(j.data); setError(''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [asOfDate]);

  const downloadCsv = () => {
    window.open(`${API_URL}/api/v1/reports/ar-aging/csv?asOfDate=${asOfDate}`, '_blank');
  };

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error) return <div className="vn-alert vn-alert-error">{error}</div>;
  if (!data) return null;

  const t = data.totals;
  const pastDueTotal = t.days1to30 + t.days31to60 + t.days61to90 + t.days90plus;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>AR Aging Report</h1>
          <p>Outstanding invoices by days past due as of {data.asOfDate}</p>
        </div>
        <div className="vn-page-actions">
          <input type="date" className="vn-input" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} style={{ width: 160 }} />
          <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={downloadCsv}>
            <span className="material-icons">download</span> Export CSV
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">account_balance_wallet</span></div>
          <div><div className="vn-stat-value">{formatMoney(t.total)}</div><div className="vn-stat-label">Total Outstanding</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">schedule</span></div>
          <div><div className="vn-stat-value">{formatMoney(t.current)}</div><div className="vn-stat-label">Current (Not Due)</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">warning</span></div>
          <div><div className="vn-stat-value">{formatMoney(pastDueTotal)}</div><div className="vn-stat-label">Past Due Total</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">error</span></div>
          <div><div className="vn-stat-value">{formatMoney(t.days90plus)}</div><div className="vn-stat-label">90+ Days</div></div>
        </div>
      </div>

      {/* Totals bar chart (visual) */}
      {t.total > 0 && (
        <div className="vn-card" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>Aging Distribution</h3>
          <div style={{ display: 'flex', height: 32, borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', background: 'var(--surface-container)' }}>
            {t.current > 0 && (
              <div style={{ width: `${(t.current / t.total) * 100}%`, background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 600 }}
                title={`Current: ${formatMoney(t.current)}`}>
                {(t.current / t.total * 100) > 10 ? 'Current' : ''}
              </div>
            )}
            {t.days1to30 > 0 && (
              <div style={{ width: `${(t.days1to30 / t.total) * 100}%`, background: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 600 }}
                title={`1-30 Days: ${formatMoney(t.days1to30)}`}>
                {(t.days1to30 / t.total * 100) > 10 ? '1-30' : ''}
              </div>
            )}
            {t.days31to60 > 0 && (
              <div style={{ width: `${(t.days31to60 / t.total) * 100}%`, background: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 600 }}
                title={`31-60 Days: ${formatMoney(t.days31to60)}`}>
                {(t.days31to60 / t.total * 100) > 10 ? '31-60' : ''}
              </div>
            )}
            {t.days61to90 > 0 && (
              <div style={{ width: `${(t.days61to90 / t.total) * 100}%`, background: '#e65100', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 600 }}
                title={`61-90 Days: ${formatMoney(t.days61to90)}`}>
                {(t.days61to90 / t.total * 100) > 10 ? '61-90' : ''}
              </div>
            )}
            {t.days90plus > 0 && (
              <div style={{ width: `${(t.days90plus / t.total) * 100}%`, background: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 600 }}
                title={`90+ Days: ${formatMoney(t.days90plus)}`}>
                {(t.days90plus / t.total * 100) > 10 ? '90+' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer breakdown table */}
      <div className="vn-card">
        <div className="vn-card-header"><h2>By Customer ({data.customers.length})</h2></div>
        {data.customers.length === 0 ? (
          <div className="vn-empty"><span className="material-icons">check_circle</span><h3>No outstanding invoices</h3></div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th style={{ textAlign: 'right' }}>Invoices</th>
                  <th style={{ textAlign: 'right' }}>Current</th>
                  <th style={{ textAlign: 'right' }}>1-30 Days</th>
                  <th style={{ textAlign: 'right' }}>31-60 Days</th>
                  <th style={{ textAlign: 'right' }}>61-90 Days</th>
                  <th style={{ textAlign: 'right' }}>90+ Days</th>
                  <th style={{ textAlign: 'right', fontWeight: 700 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map(c => (
                  <tr key={c.customerId}>
                    <td style={{ fontWeight: 500 }}>{c.customerName}</td>
                    <td style={{ textAlign: 'right' }}>{c.invoiceCount}</td>
                    <td style={{ textAlign: 'right', color: bucketColor(c.buckets.current) }}>{formatMoney(c.buckets.current)}</td>
                    <td style={{ textAlign: 'right', color: bucketColor(c.buckets.days1to30) }}>{formatMoney(c.buckets.days1to30)}</td>
                    <td style={{ textAlign: 'right', color: c.buckets.days31to60 > 0 ? 'var(--warning)' : bucketColor(c.buckets.days31to60) }}>{formatMoney(c.buckets.days31to60)}</td>
                    <td style={{ textAlign: 'right', color: c.buckets.days61to90 > 0 ? 'var(--warning)' : bucketColor(c.buckets.days61to90) }}>{formatMoney(c.buckets.days61to90)}</td>
                    <td style={{ textAlign: 'right', color: c.buckets.days90plus > 0 ? 'var(--error)' : bucketColor(c.buckets.days90plus), fontWeight: c.buckets.days90plus > 0 ? 600 : 400 }}>{formatMoney(c.buckets.days90plus)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(c.buckets.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td>TOTAL</td>
                  <td style={{ textAlign: 'right' }}>{data.customers.reduce((s, c) => s + c.invoiceCount, 0)}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(t.current)}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(t.days1to30)}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(t.days31to60)}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(t.days61to90)}</td>
                  <td style={{ textAlign: 'right', color: t.days90plus > 0 ? 'var(--error)' : undefined }}>{formatMoney(t.days90plus)}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(t.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
