import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { VnPageHeader, VnStatCard, VnFilterBar, VnDataTable, VnChip } from './components';

interface Decision {
  [key: string]: unknown;
  id: string;
  agentType: string;
  modelProvider: string | null;
  modelId: string | null;
  triggerType: string;
  triggerEventType: string | null;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  confidence: number | null;
  actionType: string;
  actionEntityType: string | null;
  actionEntityId: string | null;
  outcomeStatus: string | null;
  promotedToAutomation: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  totalDecisions: number;
  byAgentType: { agentType: string; count: number }[];
  byActionType: { actionType: string; count: number }[];
  byOutcomeStatus: { outcomeStatus: string; count: number }[];
  averageConfidence: number | null;
  promotedCount: number;
  pendingReviewCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  averageDurationMs: number | null;
}

interface DailyUsage {
  date: string;
  invocations: number;
  inputTokens: number;
  outputTokens: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function outcomeChip(status: string | null) {
  if (!status || status === 'pending') return <VnChip variant="secondary">Pending review</VnChip>;
  if (status === 'correct') return <VnChip variant="success">Correct</VnChip>;
  if (status === 'incorrect') return <VnChip variant="error">Incorrect</VnChip>;
  if (status === 'partially_correct') return <VnChip variant="warning">Partial</VnChip>;
  return <VnChip variant="secondary">{status}</VnChip>;
}

function actionChip(actionType: string) {
  if (actionType === 'create_issue') return <VnChip variant="info">Created issue</VnChip>;
  if (actionType === 'escalate_issue') return <VnChip variant="warning">Escalated</VnChip>;
  if (actionType === 'no_action') return <VnChip variant="secondary">No action</VnChip>;
  return <VnChip variant="secondary">{actionType}</VnChip>;
}

function confidenceBar(confidence: number | null) {
  if (confidence === null || confidence === undefined) return <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>-</span>;
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--error)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 48, height: 6, borderRadius: 3, background: 'var(--surface-container-high)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{pct}%</span>
    </div>
  );
}

export default function VNextAgentDecisions() {
  const navigate = useNavigate();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [agentTypeFilter, setAgentTypeFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (outcomeFilter !== 'all') params.set('outcomeStatus', outcomeFilter);
        if (actionFilter !== 'all') params.set('actionType', actionFilter);
        if (agentTypeFilter !== 'all') params.set('agentType', agentTypeFilter);
        params.set('limit', '100');

        const [listRes, statsRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/agent-decisions?${params}`),
          fetch(`${API_URL}/api/v1/agent-decisions/stats`),
          fetch(`${API_URL}/api/v1/agent-decisions/usage?days=30`),
        ]);

        if (!cancelled) {
          const listJson = await listRes.json();
          const statsJson = await statsRes.json();
          const usageJson = await usageRes.json();
          setDecisions(listJson.data?.items || []);
          setTotal(listJson.data?.total || 0);
          setStats(statsJson.data || null);
          setDailyUsage(usageJson.data || []);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [outcomeFilter, actionFilter, agentTypeFilter]);

  const filtered = search
    ? decisions.filter(d =>
        d.summary.toLowerCase().includes(search.toLowerCase()) ||
        d.entityId?.toLowerCase().includes(search.toLowerCase()) ||
        d.triggerEventType?.toLowerCase().includes(search.toLowerCase())
      )
    : decisions;

  const correctCount = stats?.byOutcomeStatus.find(s => s.outcomeStatus === 'correct')?.count || 0;
  const incorrectCount = stats?.byOutcomeStatus.find(s => s.outcomeStatus === 'incorrect')?.count || 0;
  const reviewedCount = correctCount + incorrectCount + (stats?.byOutcomeStatus.find(s => s.outcomeStatus === 'partially_correct')?.count || 0);
  const accuracyPct = reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : null;

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading decisions...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vn-alert vn-alert-error">
        <span className="material-icons">error</span>
        <div className="vn-alert-content">{error}</div>
      </div>
    );
  }

  return (
    <>
      <VnPageHeader title="Agent Decisions" subtitle={`${total} decisions logged`} />

      {/* Stats row */}
      <div className="vn-stats">
        <VnStatCard icon="smart_toy" iconVariant="primary" value={stats?.totalDecisions ?? 0} label="Total Decisions" />
        <VnStatCard icon="rate_review" iconVariant="warning" value={stats?.pendingReviewCount ?? 0} label="Pending Review" />
        <VnStatCard icon="check_circle" iconVariant="success" value={accuracyPct !== null ? `${accuracyPct}%` : '-'} label="Accuracy Rate" />
        <VnStatCard
          icon="avg_pace"
          iconVariant="info"
          value={stats?.averageConfidence !== null ? `${Math.round((stats?.averageConfidence ?? 0) * 100)}%` : '-'}
          label="Avg Confidence"
        />
        <VnStatCard icon="auto_fix_high" iconVariant="primary" value={stats?.promotedCount ?? 0} label="Promoted" />
        <VnStatCard
          icon="token"
          iconVariant="error"
          value={stats?.totalTokens ? stats.totalTokens.toLocaleString() : '0'}
          label="Total Tokens"
        />
      </div>

      {/* Daily usage chart */}
      {dailyUsage.length > 0 && (
        <div className="vn-card" style={{ marginTop: 24 }}>
          <div className="vn-card-header">
            <h2>Usage (Last 30 Days)</h2>
            <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
              {stats?.totalInputTokens?.toLocaleString() ?? 0} input + {stats?.totalOutputTokens?.toLocaleString() ?? 0} output tokens
            </span>
          </div>
          <div className="vn-card-body">
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 120 }}>
              {dailyUsage.map((d) => {
                const maxInvocations = Math.max(...dailyUsage.map(x => x.invocations), 1);
                const height = Math.max(4, (d.invocations / maxInvocations) * 100);
                const totalTokens = d.inputTokens + d.outputTokens;
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.invocations} invocations, ${totalTokens.toLocaleString()} tokens`}
                    style={{
                      flex: 1,
                      height: `${height}%`,
                      background: 'var(--primary)',
                      borderRadius: '4px 4px 0 0',
                      opacity: 0.8,
                      minWidth: 4,
                      cursor: 'default',
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--on-surface-variant)' }}>
              <span>{dailyUsage[0]?.date}</span>
              <span>Invocations per day</span>
              <span>{dailyUsage[dailyUsage.length - 1]?.date}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters + table */}
      <div className="vn-card" style={{ marginTop: 24 }}>
        <VnFilterBar searchPlaceholder="Search decisions..." searchValue={search} onSearchChange={setSearch}>
          <select className="vn-filter-select" value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>
            <option value="all">All Outcomes</option>
            <option value="pending">Pending Review</option>
            <option value="correct">Correct</option>
            <option value="incorrect">Incorrect</option>
            <option value="partially_correct">Partially Correct</option>
          </select>
          <select className="vn-filter-select" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
            <option value="all">All Actions</option>
            <option value="create_issue">Created Issue</option>
            <option value="escalate_issue">Escalated</option>
            <option value="no_action">No Action</option>
          </select>
          <select className="vn-filter-select" value={agentTypeFilter} onChange={e => setAgentTypeFilter(e.target.value)}>
            <option value="all">All Agents</option>
            <option value="triage">Triage</option>
            <option value="quality_analysis">Quality Analysis</option>
            <option value="route_optimization">Route Optimization</option>
          </select>
        </VnFilterBar>

        <VnDataTable
          columns={[
            {
              key: 'summary', label: 'Decision',
              render: (d) => (
                <div>
                  <span className="vn-table-id">{d.summary}</span>
                  <div className="vn-table-secondary">
                    {d.triggerEventType || d.triggerType} {d.entityType ? `on ${d.entityType}` : ''}
                  </div>
                </div>
              ),
            },
            {
              key: 'agentType', label: 'Agent',
              render: (d) => (
                <span style={{ textTransform: 'capitalize', fontSize: 13 }}>{d.agentType.replace(/_/g, ' ')}</span>
              ),
            },
            {
              key: 'actionType', label: 'Action',
              render: (d) => actionChip(d.actionType),
            },
            {
              key: 'confidence', label: 'Confidence',
              render: (d) => confidenceBar(d.confidence),
            },
            {
              key: 'outcomeStatus', label: 'Outcome',
              render: (d) => outcomeChip(d.outcomeStatus),
            },
            {
              key: 'createdAt', label: 'When',
              render: (d) => (
                <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{timeAgo(d.createdAt)}</span>
              ),
            },
          ]}
          data={filtered}
          onRowClick={(d) => navigate(`/agent-decisions/${d.id}`)}
          emptyIcon="smart_toy"
          emptyTitle="No decisions yet"
          emptyMessage="Agent decisions will appear here when the triage agent processes events."
        />
      </div>
    </>
  );
}
