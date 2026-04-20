import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface AtRiskShipment {
  id: string;
  reference: string;
  status: string;
  lastCutoffRiskSeverity: string | null;
  lastCutoffRiskAt: string | null;
  lastCutoffRiskIssueId: string | null;
  carrier: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
}

export default function VNextCutoffDashboard() {
  const [shipments, setShipments] = useState<AtRiskShipment[]>([]);
  const [severityFilter, setSeverityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (severityFilter) params.set('severity', severityFilter);
    fetch(`${API_URL}/api/v1/cutoff-monitor/at-risk?${params}`)
      .then(r => r.json())
      .then(json => setShipments(json.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [severityFilter]);

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/cutoff-monitor/run`, { method: 'POST' });
      const json = await res.json();
      if (json.data) {
        alert(`Scan complete: evaluated ${json.data.evaluated} shipments, ${json.data.atRisk} at risk (${json.data.critical} critical, ${json.data.warning} warning), ${json.data.notified} notified.`);
      }
      load();
    } finally { setRunning(false); }
  };

  const critical = shipments.filter(s => s.lastCutoffRiskSeverity === 'critical').length;
  const warning = shipments.filter(s => s.lastCutoffRiskSeverity === 'warning').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Cutoff At Risk</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Shipments projected to miss a carrier cutoff. Warning and critical severities auto-raise triage issues.
          </p>
        </div>
        <button className="vn-btn vn-btn-outline" onClick={handleRunNow} disabled={running}>
          {running ? 'Scanning...' : 'Run scan now'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="vn-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>At risk</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{shipments.length}</div>
        </div>
        <div className="vn-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Critical</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-error)' }}>{critical}</div>
        </div>
        <div className="vn-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Warning</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-warning)' }}>{warning}</div>
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-filters" style={{ padding: '8px 16px' }}>
          <select className="vn-filter-select" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
            <option value="">All at-risk</option>
            <option value="critical">Critical only</option>
            <option value="warning">Warning only</option>
          </select>
        </div>
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Shipment</th>
                <th>Status</th>
                <th>Carrier</th>
                <th>Customer</th>
                <th>Severity</th>
                <th>Flagged</th>
                <th>Issue</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}><div className="vn-loading-spinner" /></td></tr>}
              {!loading && shipments.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                  No shipments at risk. Scans run automatically every 5 minutes.
                </td></tr>
              )}
              {shipments.map(s => (
                <tr key={s.id}>
                  <td><Link className="vn-table-id" to={`/shipments/${s.id}`}>{s.reference}</Link></td>
                  <td>{s.status}</td>
                  <td>{s.carrier?.name ?? '-'}</td>
                  <td>{s.customer?.name ?? '-'}</td>
                  <td>
                    <span className={`vn-chip ${s.lastCutoffRiskSeverity === 'critical' ? 'vn-chip-error' : 'vn-chip-warning'}`}>
                      {s.lastCutoffRiskSeverity}
                    </span>
                  </td>
                  <td><span className="vn-table-secondary">{s.lastCutoffRiskAt ? new Date(s.lastCutoffRiskAt).toLocaleString() : '-'}</span></td>
                  <td>
                    {s.lastCutoffRiskIssueId
                      ? <Link to={`/issues/${s.lastCutoffRiskIssueId}`} className="vn-table-id">View issue</Link>
                      : <span className="vn-table-secondary">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
