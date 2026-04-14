import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

interface Commission {
  id: string;
  user: { id: string; email: string; firstName?: string; lastName?: string };
  shipment: { id: string; reference: string; status: string };
  basisType: string;
  basisAmountCents: number;
  commissionPercent: string;
  commissionCents: number;
  currency: string;
  status: string;
  approvedAt?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

interface AgentSummary {
  userId: string;
  userName: string;
  email: string;
  totalCommissionCents: number;
  accruedCents: number;
  approvedCents: number;
  paidCents: number;
  count: number;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusChip(s: string): string {
  return s === 'paid' ? 'success' : s === 'approved' ? 'info' : 'warning';
}

export default function VNextCommissions() {
  const [tab, setTab] = useState<'list' | 'summary'>('summary');
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/v1/commissions`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/commissions/summary`).then(r => r.json()),
    ]).then(([commJson, sumJson]) => {
      setCommissions(commJson.data || []);
      setSummary(sumJson.data || []);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'pay') => {
    await fetch(`${API_URL}/api/v1/commissions/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    // Reload
    const res = await fetch(`${API_URL}/api/v1/commissions`);
    const json = await res.json();
    setCommissions(json.data || []);
    const sumRes = await fetch(`${API_URL}/api/v1/commissions/summary`);
    const sumJson = await sumRes.json();
    setSummary(sumJson.data || []);
  };

  const filtered = statusFilter === 'all' ? commissions : commissions.filter(c => c.status === statusFilter);

  const totals = summary.reduce((acc, s) => ({
    total: acc.total + s.totalCommissionCents,
    accrued: acc.accrued + s.accruedCents,
    approved: acc.approved + s.approvedCents,
    paid: acc.paid + s.paidCents,
  }), { total: 0, accrued: 0, approved: 0, paid: 0 });

  return (
    <div style={{ padding: '24px 32px' }}>
      <div className="vn-page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Commissions</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--on-surface-variant)', fontSize: 14 }}>
            Track broker agent commissions on shipments
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="vn-stats" style={{ marginBottom: 24 }}>
        <div className="vn-stat"><div className="vn-stat-label">Total</div><div className="vn-stat-value">{formatCents(totals.total)}</div></div>
        <div className="vn-stat"><div className="vn-stat-label">Accrued</div><div className="vn-stat-value" style={{ color: 'var(--color-warning)' }}>{formatCents(totals.accrued)}</div></div>
        <div className="vn-stat"><div className="vn-stat-label">Approved</div><div className="vn-stat-value" style={{ color: 'var(--color-info)' }}>{formatCents(totals.approved)}</div></div>
        <div className="vn-stat"><div className="vn-stat-label">Paid</div><div className="vn-stat-value" style={{ color: 'var(--color-success)' }}>{formatCents(totals.paid)}</div></div>
      </div>

      {/* Tabs */}
      <div className="vn-tabs" style={{ marginBottom: 16 }}>
        <button className={`vn-tab ${tab === 'summary' ? 'active' : ''}`} onClick={() => setTab('summary')}>By Agent</button>
        <button className={`vn-tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>All Commissions</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" /></div>
      ) : tab === 'summary' ? (
        <div className="vn-card">
          <div className="vn-table-wrap">
            {summary.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-variant)' }}>No commissions recorded yet</div>
            ) : (
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th style={{ textAlign: 'right' }}>Shipments</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Accrued</th>
                    <th style={{ textAlign: 'right' }}>Approved</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(s => (
                    <tr key={s.userId}>
                      <td><span style={{ fontWeight: 600 }}>{s.userName}</span><br /><span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{s.email}</span></td>
                      <td style={{ textAlign: 'right' }}>{s.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCents(s.totalCommissionCents)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-warning)' }}>{formatCents(s.accruedCents)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-info)' }}>{formatCents(s.approvedCents)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>{formatCents(s.paidCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="vn-card">
          <div className="vn-filters" style={{ padding: '8px 16px' }}>
            <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="accrued">Accrued</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Shipment</th>
                  <th>Basis</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const name = [c.user.firstName, c.user.lastName].filter(Boolean).join(' ') || c.user.email;
                  return (
                    <tr key={c.id}>
                      <td>{name}</td>
                      <td><span className="vn-table-id">{c.shipment.reference}</span></td>
                      <td>{c.basisType} ({formatCents(c.basisAmountCents)})</td>
                      <td style={{ textAlign: 'right' }}>{Number(c.commissionPercent).toFixed(1)}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCents(c.commissionCents)}</td>
                      <td><span className={`vn-chip vn-chip-${statusChip(c.status)}`}>{c.status}</span></td>
                      <td>
                        {c.status === 'accrued' && (
                          <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={() => handleAction(c.id, 'approve')}>Approve</button>
                        )}
                        {c.status === 'approved' && (
                          <button className="vn-btn vn-btn-success vn-btn-sm" onClick={() => handleAction(c.id, 'pay')}>Mark Paid</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
