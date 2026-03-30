import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface ReportSummary {
  date: string;
  generatedAt: string;
  shipmentsByStatus: Record<string, number>;
  ordersByDeliveryStatus: Record<string, number>;
  totalShipments: number;
  totalOrders: number;
  exceptionCount: number;
}

export default function DailyReport() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSummary();
  }, [date]);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/reports/daily/summary?date=${date}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setSummary(result.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load report summary');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    window.open(`${API_URL}/api/v1/reports/daily?date=${date}&format=xlsx`, '_blank');
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>Daily Operations Report</h1>
      </div>

      {/* Controls */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Report Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--md-outline)' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
          <button onClick={handleDownloadExcel}
            style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', background: 'var(--md-primary)', color: 'var(--md-on-primary)', cursor: 'pointer', fontWeight: 500 }}>
            Download Excel
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--md-error)', marginBottom: '16px' }}>{error}</div>}

      {loading ? (
        <p>Loading summary...</p>
      ) : summary ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Shipments card */}
          <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--md-surface-container-low)', border: '1px solid var(--md-outline-variant)' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Shipments</h3>
            <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '12px' }}>{summary.totalShipments}</div>
            {Object.entries(summary.shipmentsByStatus).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--md-outline-variant)' }}>
                <span style={{ textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 600 }}>{count}</span>
              </div>
            ))}
          </div>

          {/* Orders card */}
          <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--md-surface-container-low)', border: '1px solid var(--md-outline-variant)' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Orders</h3>
            <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '12px' }}>{summary.totalOrders}</div>
            {Object.entries(summary.ordersByDeliveryStatus).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--md-outline-variant)' }}>
                <span style={{ textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 600 }}>{count}</span>
              </div>
            ))}
          </div>

          {/* Exceptions card */}
          <div style={{ padding: '20px', borderRadius: '12px', background: summary.exceptionCount > 0 ? 'var(--md-error-container, #fce4ec)' : 'var(--md-surface-container-low)', border: '1px solid var(--md-outline-variant)' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Exceptions</h3>
            <div style={{ fontSize: '32px', fontWeight: 700, color: summary.exceptionCount > 0 ? 'var(--md-error)' : 'inherit' }}>
              {summary.exceptionCount}
            </div>
            <p style={{ margin: '8px 0 0 0', color: 'var(--md-on-surface-variant)', fontSize: '14px' }}>
              {summary.exceptionCount === 0 ? 'No exceptions for this date' : 'See Exceptions sheet in Excel report for details'}
            </p>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'var(--md-surface-container-low)', border: '1px solid var(--md-outline-variant)' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Excel Report Contents</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--md-on-surface-variant)' }}>
          <li><strong>Summary</strong> - Shipment and order counts by status</li>
          <li><strong>Shipments</strong> - All shipments for the date with carrier, vehicle, driver assignments</li>
          <li><strong>Orders</strong> - All orders linked to the day's shipments with service details</li>
          <li><strong>Stop Schedule</strong> - Every stop with estimated arrival times and instructions</li>
          <li><strong>Exceptions</strong> - Orders with delivery exceptions requiring attention</li>
        </ul>
      </div>
    </div>
  );
}
