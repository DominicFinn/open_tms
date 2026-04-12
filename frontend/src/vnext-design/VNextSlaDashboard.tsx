/**
 * VNextSlaDashboard — SLA health dashboard for control centres.
 *
 * Designed for large displays: big numbers, high contrast, auto-refresh.
 * Shows SLA evaluation summary, at-risk evaluations, and breach history.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { API_URL } from '../api';

interface SlaSummary {
  active: number;
  warning: number;
  breached: number;
  met: number;
  total: number;
}

interface SlaEvaluation {
  id: string;
  ruleType: string;
  ruleName: string;
  entityType: string;
  entityId: string;
  entityReference: string | null;
  status: string;
  slaDueAt: string | null;
  slaStartedAt: string;
  breachedAt: string | null;
  breachDurationMinutes: number | null;
  remainingMinutes: number | null;
  customerId: string | null;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '--';
  if (minutes < 0) return `${Math.abs(minutes)}m overdue`;
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

function getStatusChipClass(status: string): string {
  switch (status) {
    case 'breached': return 'vn-chip-error';
    case 'warning': return 'vn-chip-warning';
    case 'active': return 'vn-chip-info';
    case 'met': return 'vn-chip-success';
    default: return 'vn-chip-secondary';
  }
}

function getRuleTypeLabel(ruleType: string): string {
  const labels: Record<string, string> = {
    eta_delivery: 'ETA Delivery',
    issue_response: 'Issue Response',
    issue_resolution: 'Issue Resolution',
    dwell_time: 'Dwell Time',
    light_event: 'Light Event',
    seal_event: 'Seal Event',
    temperature_excursion: 'Temp Excursion',
    temperature_out_of_range: 'Out of Range',
  };
  return labels[ruleType] || ruleType;
}

export default function VNextSlaDashboard() {
  const [summary, setSummary] = useState<SlaSummary>({ active: 0, warning: 0, breached: 0, met: 0, total: 0 });
  const [atRisk, setAtRisk] = useState<SlaEvaluation[]>([]);
  const [breached, setBreached] = useState<SlaEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, riskRes, breachRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/sla/evaluations/summary`),
        fetch(`${API_URL}/api/v1/sla/evaluations?status=active,warning&limit=20`),
        fetch(`${API_URL}/api/v1/sla/evaluations?status=breached&limit=20`),
      ]);

      if (sumRes.ok) {
        const d = await sumRes.json();
        setSummary(d.data || { active: 0, warning: 0, breached: 0, met: 0, total: 0 });
      }
      if (riskRes.ok) {
        const d = await riskRes.json();
        setAtRisk(d.data?.items || []);
      }
      if (breachRes.ok) {
        const d = await breachRes.json();
        setBreached(d.data?.items || []);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[SlaDashboard] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAll]);

  const complianceRate = summary.total > 0
    ? Math.round(((summary.met) / (summary.met + summary.breached || 1)) * 100)
    : 100;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--on-surface)' }}>SLA Dashboard</h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
            Service Level Agreement monitoring
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastRefresh && (
            <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 14px', fontSize: '13px', fontWeight: 600,
              borderRadius: '16px',
              border: `1px solid ${autoRefresh ? 'var(--color-success)' : 'var(--outline-variant)'}`,
              background: autoRefresh ? 'var(--color-success)' : 'transparent',
              color: autoRefresh ? '#fff' : 'var(--on-surface-variant)',
              cursor: 'pointer',
            }}
          >
            <span className="material-icons" style={{ fontSize: '16px' }}>
              {autoRefresh ? 'pause' : 'play_arrow'}
            </span>
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button onClick={fetchAll} className="vn-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-icons" style={{ fontSize: '16px' }}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="vn-stats" style={{ marginBottom: '24px' }}>
        <div className="vn-stat" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--color-success)' }}>{complianceRate}%</div>
          <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Compliance Rate</div>
        </div>
        <div className="vn-stat" style={{ borderLeft: '4px solid var(--color-info)' }}>
          <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--color-info)' }}>{summary.active}</div>
          <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Active SLAs</div>
        </div>
        <div className="vn-stat" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--color-warning)' }}>{summary.warning}</div>
          <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>At Risk</div>
        </div>
        <div className="vn-stat" style={{ borderLeft: '4px solid var(--color-error)' }}>
          <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--color-error)' }}>{summary.breached}</div>
          <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Breached</div>
        </div>
        <div className="vn-stat" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--color-success)' }}>{summary.met}</div>
          <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Met</div>
        </div>
      </div>

      {/* Two-column layout: At Risk + Breached */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* At Risk */}
        <div className="vn-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons" style={{ color: 'var(--color-warning)', fontSize: '20px' }}>schedule</span>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>At Risk ({atRisk.length})</h2>
          </div>
          {atRisk.length === 0 && !loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: '40px', display: 'block', marginBottom: '8px', opacity: 0.5 }}>check_circle</span>
              No SLAs at risk
            </div>
          ) : (
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Rule</th>
                    <th>Status</th>
                    <th>Time Left</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div className="vn-table-id">
                          <a href={`/${e.entityType === 'shipment' ? 'shipments' : 'issues'}/${e.entityId}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                            {e.entityReference || e.entityId.slice(0, 8)}
                          </a>
                        </div>
                        <div className="vn-table-secondary">{e.entityType}</div>
                      </td>
                      <td>
                        <div>{e.ruleName}</div>
                        <div className="vn-table-secondary">{getRuleTypeLabel(e.ruleType)}</div>
                      </td>
                      <td><span className={`vn-chip ${getStatusChipClass(e.status)}`}>{e.status}</span></td>
                      <td style={{ fontWeight: 600, color: e.status === 'warning' ? 'var(--color-warning)' : 'var(--on-surface)' }}>
                        {e.slaDueAt ? formatMinutes(Math.round((new Date(e.slaDueAt).getTime() - Date.now()) / 60_000)) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Breached */}
        <div className="vn-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons" style={{ color: 'var(--color-error)', fontSize: '20px' }}>timer_off</span>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Breached ({breached.length})</h2>
          </div>
          {breached.length === 0 && !loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: '40px', display: 'block', marginBottom: '8px', opacity: 0.5 }}>verified</span>
              No SLA breaches
            </div>
          ) : (
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Rule</th>
                    <th>Breached</th>
                    <th>Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {breached.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div className="vn-table-id">
                          <a href={`/${e.entityType === 'shipment' ? 'shipments' : 'issues'}/${e.entityId}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                            {e.entityReference || e.entityId.slice(0, 8)}
                          </a>
                        </div>
                        <div className="vn-table-secondary">{e.entityType}</div>
                      </td>
                      <td>
                        <div>{e.ruleName}</div>
                        <div className="vn-table-secondary">{getRuleTypeLabel(e.ruleType)}</div>
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {e.breachedAt ? new Date(e.breachedAt).toLocaleString() : '--'}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--color-error)' }}>
                        {formatMinutes(e.breachDurationMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Export section */}
      <div className="vn-card" style={{ marginTop: '24px' }}>
        <div className="vn-card-header">
          <h2>Export Compliance Report</h2>
        </div>
        <div className="vn-card-body">
          <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)', margin: '0 0 16px' }}>
            Download a CSV report of SLA evaluations for sharing with customers or internal review.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
            <div className="vn-field" style={{ marginBottom: 0 }}>
              <label className="vn-field-label">From</label>
              <input className="vn-input" type="date" id="report-from"
                defaultValue={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} />
            </div>
            <div className="vn-field" style={{ marginBottom: 0 }}>
              <label className="vn-field-label">To</label>
              <input className="vn-input" type="date" id="report-to"
                defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <button
              className="vn-btn"
              onClick={() => {
                const from = (document.getElementById('report-from') as HTMLInputElement)?.value;
                const to = (document.getElementById('report-to') as HTMLInputElement)?.value;
                const params = new URLSearchParams();
                if (from) params.set('from', from);
                if (to) params.set('to', to);
                window.open(`${API_URL}/api/v1/reports/sla-compliance?${params}`, '_blank');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span className="material-icons" style={{ fontSize: '16px' }}>download</span>
              Download CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
