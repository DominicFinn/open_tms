import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { VnPageHeader, VnChip, VnInfoGrid, VnModal, VnAlert } from './components';

interface Decision {
  id: string;
  orgId: string;
  agentType: string;
  modelProvider: string | null;
  modelId: string | null;
  triggerType: string;
  triggerEventType: string | null;
  triggerEventId: string | null;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  reasoning: string;
  context: Record<string, unknown>;
  conversationLog: { role: string; content: string }[] | null;
  confidence: number | null;
  actionType: string;
  actionPayload: Record<string, unknown> | null;
  actionEntityType: string | null;
  actionEntityId: string | null;
  outcomeStatus: string | null;
  outcomeNotes: string | null;
  outcomeRecordedAt: string | null;
  outcomeRecordedBy: string | null;
  promotedToAutomation: boolean;
  promotedAt: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

function outcomeChip(status: string | null) {
  if (!status || status === 'pending') return <VnChip variant="secondary">Pending review</VnChip>;
  if (status === 'correct') return <VnChip variant="success">Correct</VnChip>;
  if (status === 'incorrect') return <VnChip variant="error">Incorrect</VnChip>;
  if (status === 'partially_correct') return <VnChip variant="warning">Partially correct</VnChip>;
  return <VnChip variant="secondary">{status}</VnChip>;
}

function actionChip(actionType: string) {
  if (actionType === 'create_issue') return <VnChip variant="info">Created issue</VnChip>;
  if (actionType === 'escalate_issue') return <VnChip variant="warning">Escalated issue</VnChip>;
  if (actionType === 'no_action') return <VnChip variant="secondary">No action</VnChip>;
  return <VnChip variant="secondary">{actionType}</VnChip>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export default function VNextAgentDecisionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Outcome recording
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeStatus, setOutcomeStatus] = useState('correct');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Context/conversation toggle
  const [showContext, setShowContext] = useState(false);
  const [showConversation, setShowConversation] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/agent-decisions/${id}`);
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setDecision(json.data);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function recordOutcome() {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/agent-decisions/${id}/outcome`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeStatus, outcomeNotes: outcomeNotes || undefined }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Failed (${res.status})`);
      }
      const json = await res.json();
      setDecision(json.data);
      setShowOutcomeModal(false);
      setSuccessMsg('Outcome recorded successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function promoteDecision() {
    try {
      const res = await fetch(`${API_URL}/api/v1/agent-decisions/${id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to promote');
      const json = await res.json();
      setDecision(json.data);
      setSuccessMsg('Decision promoted to automation');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setSaveError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading decision...</h3>
      </div>
    );
  }

  if (error || !decision) {
    return (
      <div className="vn-alert vn-alert-error">
        <span className="material-icons">error</span>
        <div className="vn-alert-content">{error || 'Decision not found'}</div>
      </div>
    );
  }

  const confidencePct = decision.confidence !== null ? Math.round(decision.confidence * 100) : null;

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/agent-decisions')}>
          <span className="material-icons">arrow_back</span>Decisions
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ {decision.id.slice(0, 8)}</span>
      </div>

      {successMsg && (
        <VnAlert variant="success" onClose={() => setSuccessMsg('')}>{successMsg}</VnAlert>
      )}

      {/* Header */}
      <VnPageHeader title={decision.summary}>
        {decision.outcomeStatus === 'pending' && (
          <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={() => setShowOutcomeModal(true)}>
            <span className="material-icons">rate_review</span>Record Outcome
          </button>
        )}
        {decision.outcomeStatus === 'correct' && !decision.promotedToAutomation && (
          <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={promoteDecision}>
            <span className="material-icons">auto_fix_high</span>Promote to Automation
          </button>
        )}
      </VnPageHeader>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {actionChip(decision.actionType)}
        {outcomeChip(decision.outcomeStatus)}
        {decision.promotedToAutomation && <VnChip variant="primary">Promoted</VnChip>}
        <VnChip variant="secondary" icon="smart_toy">{decision.agentType}</VnChip>
        {confidencePct !== null && (
          <VnChip variant={confidencePct >= 80 ? 'success' : confidencePct >= 50 ? 'warning' : 'error'}>
            {confidencePct}% confidence
          </VnChip>
        )}
      </div>

      {/* Detail grid */}
      <div className="vn-detail-grid">
        {/* Main content */}
        <div className="vn-detail-main">
          {/* Reasoning card */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Agent Reasoning</h2></div>
            <div className="vn-card-body">
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>{decision.reasoning}</p>
            </div>
          </div>

          {/* Action details */}
          {decision.actionPayload && Object.keys(decision.actionPayload).length > 0 && (
            <div className="vn-card">
              <div className="vn-card-header"><h2>Action Details</h2></div>
              <div className="vn-card-body">
                <VnInfoGrid items={Object.entries(decision.actionPayload).map(([k, v]) => ({
                  label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
                  value: String(v),
                }))} />
              </div>
            </div>
          )}

          {/* Context snapshot (collapsible) */}
          <div className="vn-card">
            <div className="vn-card-header" style={{ cursor: 'pointer' }} onClick={() => setShowContext(!showContext)}>
              <h2>Context Snapshot</h2>
              <span className="material-icons" style={{ color: 'var(--on-surface-variant)' }}>
                {showContext ? 'expand_less' : 'expand_more'}
              </span>
            </div>
            {showContext && (
              <div className="vn-card-body">
                <pre style={{
                  background: 'var(--surface-container)',
                  padding: 16,
                  borderRadius: 8,
                  overflow: 'auto',
                  fontSize: 12,
                  lineHeight: 1.5,
                  maxHeight: 400,
                  margin: 0,
                }}>{JSON.stringify(decision.context, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Conversation log (collapsible) */}
          {decision.conversationLog && decision.conversationLog.length > 0 && (
            <div className="vn-card">
              <div className="vn-card-header" style={{ cursor: 'pointer' }} onClick={() => setShowConversation(!showConversation)}>
                <h2>LLM Conversation</h2>
                <span className="material-icons" style={{ color: 'var(--on-surface-variant)' }}>
                  {showConversation ? 'expand_less' : 'expand_more'}
                </span>
              </div>
              {showConversation && (
                <div className="vn-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {decision.conversationLog.map((msg, i) => (
                    <div key={i} style={{
                      padding: 12,
                      borderRadius: 8,
                      background: msg.role === 'system'
                        ? 'var(--surface-container-high)'
                        : msg.role === 'assistant'
                          ? 'var(--primary-container)'
                          : 'var(--surface-container)',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6, color: 'var(--on-surface-variant)' }}>
                        {msg.role}
                      </div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, margin: 0 }}>{msg.content}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Outcome details (if recorded) */}
          {decision.outcomeStatus && decision.outcomeStatus !== 'pending' && (
            <div className="vn-card">
              <div className="vn-card-header"><h2>Outcome Review</h2></div>
              <div className="vn-card-body">
                <VnInfoGrid items={[
                  { label: 'Verdict', value: outcomeChip(decision.outcomeStatus) },
                  { label: 'Reviewed At', value: decision.outcomeRecordedAt ? formatDate(decision.outcomeRecordedAt) : '-' },
                  { label: 'Reviewed By', value: decision.outcomeRecordedBy || 'System' },
                  ...(decision.outcomeNotes ? [{ label: 'Notes', value: decision.outcomeNotes }] : []),
                ]} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="vn-detail-sidebar">
          <div className="vn-card">
            <div className="vn-card-header"><h2>Details</h2></div>
            <div className="vn-card-body">
              <VnInfoGrid items={[
                { label: 'Agent Type', value: <span style={{ textTransform: 'capitalize' }}>{decision.agentType.replace(/_/g, ' ')}</span> },
                { label: 'Trigger', value: decision.triggerEventType || decision.triggerType },
                { label: 'Entity', value: decision.entityType ? `${decision.entityType} / ${decision.entityId?.slice(0, 8)}...` : '-' },
                { label: 'Model', value: decision.modelId || '-' },
                { label: 'Provider', value: decision.modelProvider || '-' },
                { label: 'Created', value: formatDate(decision.createdAt) },
              ]} />
            </div>
          </div>

          {/* Token usage card */}
          {(decision.inputTokens || decision.outputTokens || decision.durationMs) && (
            <div className="vn-card">
              <div className="vn-card-header"><h2>Token Usage</h2></div>
              <div className="vn-card-body">
                <VnInfoGrid items={[
                  { label: 'Input Tokens', value: decision.inputTokens?.toLocaleString() ?? '-' },
                  { label: 'Output Tokens', value: decision.outputTokens?.toLocaleString() ?? '-' },
                  { label: 'Total Tokens', value: ((decision.inputTokens || 0) + (decision.outputTokens || 0)).toLocaleString() },
                  { label: 'Duration', value: decision.durationMs ? `${(decision.durationMs / 1000).toFixed(1)}s` : '-' },
                ]} />
              </div>
            </div>
          )}

          {decision.actionEntityType && decision.actionEntityId && (
            <div className="vn-card">
              <div className="vn-card-header"><h2>Created Entity</h2></div>
              <div className="vn-card-body">
                <VnInfoGrid items={[
                  { label: 'Type', value: <span style={{ textTransform: 'capitalize' }}>{decision.actionEntityType}</span> },
                  { label: 'ID', value: decision.actionEntityId.slice(0, 8) + '...' },
                ]} />
                {decision.actionEntityType === 'issue' && (
                  <button
                    className="vn-btn vn-btn-outline vn-btn-sm"
                    style={{ marginTop: 12, width: '100%' }}
                    onClick={() => navigate('/issues')}
                  >
                    <span className="material-icons">open_in_new</span>View Issues
                  </button>
                )}
              </div>
            </div>
          )}

          {decision.triggerEventId && (
            <div className="vn-card">
              <div className="vn-card-header"><h2>Trigger Event</h2></div>
              <div className="vn-card-body">
                <VnInfoGrid items={[
                  { label: 'Event Type', value: decision.triggerEventType || '-' },
                  { label: 'Event ID', value: decision.triggerEventId.slice(0, 8) + '...' },
                ]} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Outcome recording modal */}
      <VnModal
        open={showOutcomeModal}
        onClose={() => setShowOutcomeModal(false)}
        title="Record Decision Outcome"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => setShowOutcomeModal(false)}>Cancel</button>
            <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={recordOutcome} disabled={saving}>
              {saving ? 'Saving...' : 'Save Outcome'}
            </button>
          </div>
        }
      >
        {saveError && (
          <VnAlert variant="error">{saveError}</VnAlert>
        )}
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 500 }}>Was this decision correct?</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['correct', 'partially_correct', 'incorrect'] as const).map(status => (
              <button
                key={status}
                className={`vn-btn vn-btn-sm ${outcomeStatus === status ? 'vn-btn-primary' : 'vn-btn-outline'}`}
                onClick={() => setOutcomeStatus(status)}
                style={{ textTransform: 'capitalize' }}
              >
                {status === 'correct' && <span className="material-icons">check_circle</span>}
                {status === 'partially_correct' && <span className="material-icons">remove_circle</span>}
                {status === 'incorrect' && <span className="material-icons">cancel</span>}
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="vn-field">
          <label className="vn-field-label">Notes (optional)</label>
          <textarea
            className="vn-input"
            rows={3}
            placeholder="Why was this decision correct/incorrect?"
            value={outcomeNotes}
            onChange={e => setOutcomeNotes(e.target.value)}
          />
        </div>
      </VnModal>
    </>
  );
}
