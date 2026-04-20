import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface PackAudit {
  id: string;
  verdict: string;
  expectedWeightGrams: number;
  actualWeightGrams: number;
  weightVariancePercent: string | number | null;
  dimWeightVariancePercent: string | number | null;
  weightTolerancePercent: string | number;
  issueId: string | null;
  createdAt: string;
  packTask: { id: string; orderId: string; locationId: string };
}

interface Stats {
  windowDays: number;
  total: number;
  pass: number;
  warning: number;
  fail: number;
  passRatePercent: number | null;
}

function chipForVerdict(v: string): string {
  if (v === 'pass') return 'vn-chip-success';
  if (v === 'warning') return 'vn-chip-warning';
  return 'vn-chip-error';
}

export default function VNextWmsPackAudits() {
  const [audits, setAudits] = useState<PackAudit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [verdictFilter, setVerdictFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (verdictFilter) params.set('verdict', verdictFilter);
    params.set('limit', '200');
    Promise.all([
      fetch(`${API_URL}/api/v1/pack-audits?${params}`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/pack-audits/stats`).then(r => r.json()),
    ])
      .then(([list, s]) => {
        setAudits(list.data || []);
        setStats(s.data);
      })
      .finally(() => setLoading(false));
  }, [verdictFilter]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Pack Audits</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        Scale and dim-weight variance checks at pack stations. Verdict beyond tolerance auto-raises a quality issue.
      </p>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div className="vn-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Last {stats.windowDays} days</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>audits recorded</div>
          </div>
          <div className="vn-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Pass rate</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-success)' }}>{stats.passRatePercent != null ? `${stats.passRatePercent}%` : '-'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{stats.pass} / {stats.total} passed</div>
          </div>
          <div className="vn-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Warnings</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-warning)' }}>{stats.warning}</div>
          </div>
          <div className="vn-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Failures</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-error)' }}>{stats.fail}</div>
          </div>
        </div>
      )}

      <div className="vn-card">
        <div className="vn-filters" style={{ padding: '8px 16px' }}>
          <select className="vn-filter-select" value={verdictFilter} onChange={e => setVerdictFilter(e.target.value)}>
            <option value="">All verdicts</option>
            <option value="pass">Pass</option>
            <option value="warning">Warning</option>
            <option value="fail">Fail</option>
          </select>
        </div>

        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Pack Task</th>
                <th>Verdict</th>
                <th>Expected</th>
                <th>Actual</th>
                <th>Weight variance</th>
                <th>Dim variance</th>
                <th>Tolerance</th>
                <th>Issue</th>
                <th>Recorded</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24 }}><div className="vn-loading-spinner" /></td></tr>}
              {!loading && audits.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No pack audits recorded yet.</td></tr>
              )}
              {audits.map(a => {
                const wv = Number(a.weightVariancePercent ?? 0);
                const dv = a.dimWeightVariancePercent != null ? Number(a.dimWeightVariancePercent) : null;
                return (
                  <tr key={a.id}>
                    <td><code>{a.packTask.id.slice(0, 8)}</code></td>
                    <td><span className={`vn-chip ${chipForVerdict(a.verdict)}`}>{a.verdict}</span></td>
                    <td>{(a.expectedWeightGrams / 1000).toFixed(2)} kg</td>
                    <td>{(a.actualWeightGrams / 1000).toFixed(2)} kg</td>
                    <td style={{ fontWeight: 600, color: a.verdict === 'pass' ? 'var(--color-success)' : a.verdict === 'warning' ? 'var(--color-warning)' : 'var(--color-error)' }}>
                      {wv > 0 ? '+' : ''}{wv.toFixed(1)}%
                    </td>
                    <td>{dv != null ? `${dv > 0 ? '+' : ''}${dv.toFixed(1)}%` : <span className="vn-table-secondary">-</span>}</td>
                    <td><span className="vn-table-secondary">±{Number(a.weightTolerancePercent).toFixed(0)}%</span></td>
                    <td>
                      {a.issueId
                        ? <Link to={`/issues/${a.issueId}`} className="vn-table-id">View issue</Link>
                        : <span className="vn-table-secondary">-</span>}
                    </td>
                    <td><span className="vn-table-secondary">{new Date(a.createdAt).toLocaleString()}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
