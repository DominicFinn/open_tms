import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface EdiStats {
  total: number;
  pending: number;
  processing: number;
  success: number;
  error: number;
  duplicate: number;
  totalEntitiesCreated: number;
}

interface EdiLog {
  id: string;
  transactionType: string;
  direction: string;
  status: string;
  fileName?: string;
  source?: string;
  partnerName?: string;
  partner?: { name: string };
  referenceNumber?: string;
  createdAt: string;
}

const DEFAULT_STATS: EdiStats = {
  total: 0, pending: 0, processing: 0, success: 0, error: 0, duplicate: 0, totalEntitiesCreated: 0,
};

function getStatusChip(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'success') return 'vn-chip-success';
  if (s === 'error') return 'vn-chip-error';
  if (s === 'pending' || s === 'processing') return 'vn-chip-warning';
  if (s === 'duplicate') return 'vn-chip-secondary';
  return 'vn-chip-info';
}

function getDirectionChip(dir: string): string {
  return dir === 'inbound' ? 'vn-chip-info' : 'vn-chip-primary';
}

function formatDate(d: string): string {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function VNextEdiDashboard() {
  const [stats, setStats] = useState<EdiStats>(DEFAULT_STATS);
  const [recentLogs, setRecentLogs] = useState<EdiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/edi-logs/stats`),
        fetch(`${API_URL}/api/v1/edi-logs?limit=10&offset=0`),
      ]);

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.data) setStats(statsJson.data);
      }

      if (logsRes.ok) {
        const logsJson = await logsRes.json();
        setRecentLogs(logsJson.data || []);
      } else {
        throw new Error('Failed to load recent EDI transactions');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load EDI dashboard data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>EDI Dashboard</h1>
          <p>Overview of EDI transaction activity and processing status</p>
        </div>
        <div className="vn-page-actions">
          <Link to="/integrations/edi/partners" className="vn-btn vn-btn-outline">
            <span className="material-icons">handshake</span>
            Trading Partners
          </Link>
          <Link to="/integrations/edi/logs" className="vn-btn vn-btn-primary">
            <span className="material-icons">list_alt</span>
            Transaction Log
          </Link>
        </div>
      </div>

      {error && (
        <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Stats Row */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">swap_horiz</span>
          </div>
          <div>
            <div className="vn-stat-value">{stats.total.toLocaleString()}</div>
            <div className="vn-stat-label">Total Transactions</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{stats.success.toLocaleString()}</div>
            <div className="vn-stat-label">Successful</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error">
            <span className="material-icons">error</span>
          </div>
          <div>
            <div className="vn-stat-value">{stats.error.toLocaleString()}</div>
            <div className="vn-stat-label">Errors</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning">
            <span className="material-icons">hourglass_empty</span>
          </div>
          <div>
            <div className="vn-stat-value">{(stats.pending + stats.processing).toLocaleString()}</div>
            <div className="vn-stat-label">Pending</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">inventory_2</span>
          </div>
          <div>
            <div className="vn-stat-value">{stats.totalEntitiesCreated.toLocaleString()}</div>
            <div className="vn-stat-label">Entities Created</div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="vn-card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Recent Activity</h2>
          <Link to="/integrations/edi/logs" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            View all
            <span className="material-icons" style={{ fontSize: 16 }}>arrow_forward</span>
          </Link>
        </div>

        {recentLogs.length === 0 ? (
          <div className="vn-empty">
            <span className="material-icons">swap_horiz</span>
            <h3>No EDI transactions yet</h3>
            <p>Transactions will appear here once trading partners begin sending or receiving EDI files.</p>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Partner</th>
                  <th>Type</th>
                  <th>Direction</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                      {formatDate(log.createdAt)}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {log.partnerName || log.partner?.name || '-'}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>
                        {log.transactionType || '-'}
                      </span>
                    </td>
                    <td>
                      <span className={`vn-chip ${getDirectionChip(log.direction)}`}>
                        {log.direction || '-'}
                      </span>
                    </td>
                    <td>
                      <span className={`vn-chip ${getStatusChip(log.status)}`}>
                        {log.status || '-'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                      {log.referenceNumber || log.fileName || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
