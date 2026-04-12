import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { VnPageHeader, VnChip, VnAlert, VnInfoGrid, VnModal } from './components';

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  eventPattern: string;
  conditions: { field: string; operator: string; value?: unknown }[];
  actionType: string;
  actionConfig: Record<string, unknown>;
  sourceDecisionId: string | null;
  skillChainId: string | null;
  inlineSteps: unknown[] | null;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExecutionLog {
  id: string;
  ruleName: string;
  eventType: string;
  eventId: string;
  entityType: string;
  entityId: string;
  actionType: string;
  actionResult: Record<string, unknown> | null;
  conditionsMatched: boolean;
  evaluationMs: number | null;
  createdAt: string;
}

const OPERATORS = [
  { value: 'equals', label: '=' },
  { value: 'notEquals', label: '!=' },
  { value: 'greaterThan', label: '>' },
  { value: 'lessThan', label: '<' },
  { value: 'greaterThanOrEqual', label: '>=' },
  { value: 'lessThanOrEqual', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'in' },
  { value: 'exists', label: 'exists' },
  { value: 'notExists', label: 'not exists' },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function VNextAutomationRuleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rule, setRule] = useState<AutomationRule | null>(null);
  const [executions, setExecutions] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState(50);
  const [editConditions, setEditConditions] = useState<{ field: string; operator: string; value: string }[]>([]);
  const [editActionConfig, setEditActionConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Test/dry-run
  const [showTest, setShowTest] = useState(false);
  const [testEventType, setTestEventType] = useState('');
  const [testPayload, setTestPayload] = useState('{}');
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [ruleRes, execRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/automation-rules/${id}`),
        fetch(`${API_URL}/api/v1/automation-rules/${id}/executions?limit=20`),
      ]);
      const ruleJson = await ruleRes.json();
      const execJson = await execRes.json();

      if (ruleJson.data) {
        setRule(ruleJson.data);
        setEditName(ruleJson.data.name);
        setEditDescription(ruleJson.data.description || '');
        setEditPriority(ruleJson.data.priority);
        setEditConditions(ruleJson.data.conditions.map((c: { field: string; operator: string; value?: unknown }) => ({
          field: c.field, operator: c.operator, value: c.value !== undefined ? JSON.stringify(c.value) : '',
        })));
        setEditActionConfig(Object.fromEntries(
          Object.entries(ruleJson.data.actionConfig as Record<string, unknown>).map(([k, v]) => [k, String(v)])
        ));
        setTestEventType(ruleJson.data.eventPattern);
      }
      setExecutions(execJson.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    setSaving(true);
    setError('');
    try {
      const conditions = editConditions.map((c) => {
        let value: unknown = c.value;
        if (c.operator !== 'exists' && c.operator !== 'notExists') {
          try { value = JSON.parse(c.value); } catch { /* keep as string */ }
        }
        return { field: c.field, operator: c.operator, value };
      });

      const res = await fetch(`${API_URL}/api/v1/automation-rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription || null,
          priority: editPriority,
          conditions,
          actionConfig: editActionConfig,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRule(json.data);
      setEditing(false);
      setSuccessMsg('Rule updated');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      let payload: Record<string, unknown> = {};
      try { payload = JSON.parse(testPayload); } catch { /* empty */ }

      const res = await fetch(`${API_URL}/api/v1/automation-rules/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            type: testEventType || rule?.eventPattern || 'shipment.exception',
            entityType: 'shipment',
            entityId: 'test-entity',
            timestamp: new Date().toISOString(),
            payload,
          },
        }),
      });
      const json = await res.json();
      setTestResult(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  async function toggleRule() {
    await fetch(`${API_URL}/api/v1/automation-rules/${id}/toggle`, { method: 'POST' });
    await loadData();
  }

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading rule...</h3>
      </div>
    );
  }

  if (!rule) {
    return <div className="vn-alert vn-alert-error"><span className="material-icons">error</span><div className="vn-alert-content">Rule not found</div></div>;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/automation-rules')}>
          <span className="material-icons">arrow_back</span>Rules
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ {rule.name}</span>
      </div>

      {successMsg && <VnAlert variant="success" onClose={() => setSuccessMsg('')}>{successMsg}</VnAlert>}
      {error && <VnAlert variant="error" onClose={() => setError('')}>{error}</VnAlert>}

      <VnPageHeader title={rule.name}>
        <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => setShowTest(true)}>
          <span className="material-icons">science</span>Test Rule
        </button>
        <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => setEditing(!editing)}>
          <span className="material-icons">{editing ? 'close' : 'edit'}</span>{editing ? 'Cancel' : 'Edit'}
        </button>
        <button className={`vn-btn vn-btn-sm ${rule.enabled ? 'vn-btn-outline' : 'vn-btn-success'}`} onClick={toggleRule}>
          {rule.enabled ? 'Disable' : 'Enable'}
        </button>
      </VnPageHeader>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <VnChip variant={rule.enabled ? 'success' : 'secondary'}>{rule.enabled ? 'Active' : 'Disabled'}</VnChip>
        <VnChip variant="info">Priority {rule.priority}</VnChip>
        <VnChip variant="secondary">{rule.executionCount} executions</VnChip>
        {rule.sourceDecisionId && <VnChip variant="primary">Promoted from agent</VnChip>}
      </div>

      <div className="vn-detail-grid">
        <div className="vn-detail-main">
          {/* Conditions */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>When: {rule.eventPattern}</h2></div>
            <div className="vn-card-body">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBottom: 12 }}>Given these conditions match:</h3>
              {editing ? (
                <>
                  {editConditions.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input className="vn-input" style={{ flex: 2, fontFamily: 'monospace', fontSize: 13 }} value={c.field} onChange={(e) => { const arr = [...editConditions]; arr[i].field = e.target.value; setEditConditions(arr); }} />
                      <select className="vn-input" style={{ flex: 1 }} value={c.operator} onChange={(e) => { const arr = [...editConditions]; arr[i].operator = e.target.value; setEditConditions(arr); }}>
                        {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                      {c.operator !== 'exists' && c.operator !== 'notExists' && (
                        <input className="vn-input" style={{ flex: 2, fontFamily: 'monospace', fontSize: 13 }} value={c.value} onChange={(e) => { const arr = [...editConditions]; arr[i].value = e.target.value; setEditConditions(arr); }} />
                      )}
                      <button className="vn-btn-icon" onClick={() => setEditConditions(editConditions.filter((_, j) => j !== i))} disabled={editConditions.length === 1}>
                        <span className="material-icons" style={{ fontSize: 18 }}>close</span>
                      </button>
                    </div>
                  ))}
                  <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => setEditConditions([...editConditions, { field: '', operator: 'equals', value: '' }])}>
                    <span className="material-icons">add</span>Add Condition
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rule.conditions.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: 'var(--surface-container)', borderRadius: 8, fontFamily: 'monospace', fontSize: 13 }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{c.field}</span>
                      <span style={{ color: 'var(--on-surface-variant)' }}>{OPERATORS.find((o) => o.value === c.operator)?.label || c.operator}</span>
                      {c.value !== undefined && <span>{JSON.stringify(c.value)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Then: {rule.actionType.replace(/_/g, ' ')}</h2></div>
            <div className="vn-card-body">
              {editing ? (
                <div className="vn-form-grid">
                  {Object.entries(editActionConfig).map(([key, value]) => (
                    <div className="vn-field" key={key}>
                      <label className="vn-field-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</label>
                      <input className="vn-input" value={value} onChange={(e) => setEditActionConfig({ ...editActionConfig, [key]: e.target.value })} />
                    </div>
                  ))}
                </div>
              ) : (
                <VnInfoGrid items={Object.entries(rule.actionConfig).map(([k, v]) => ({
                  label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
                  value: String(v),
                }))} />
              )}
            </div>
          </div>

          {editing && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          )}

          {/* Execution log */}
          <div className="vn-card">
            <div className="vn-card-header">
              <h2>Execution Log</h2>
              <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{executions.length} recent</span>
            </div>
            {executions.length === 0 ? (
              <div className="vn-empty" style={{ padding: 40 }}>
                <span className="material-icons">history</span>
                <h3>No executions yet</h3>
                <p>This rule hasn't matched any events yet.</p>
              </div>
            ) : (
              <div className="vn-card-body vn-card-flush">
                <div className="vn-table-wrap">
                  <table className="vn-table">
                    <thead><tr><th>Event</th><th>Entity</th><th>Result</th><th>Time</th><th>Speed</th></tr></thead>
                    <tbody>
                      {executions.map((ex) => (
                        <tr key={ex.id}>
                          <td><code style={{ fontSize: 12 }}>{ex.eventType}</code></td>
                          <td style={{ fontSize: 13 }}>{ex.entityType}/{ex.entityId.slice(0, 8)}</td>
                          <td>
                            <VnChip variant={ex.conditionsMatched ? 'success' : 'secondary'}>
                              {ex.conditionsMatched ? 'Matched' : 'No match'}
                            </VnChip>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{timeAgo(ex.createdAt)}</td>
                          <td style={{ fontSize: 13 }}>{ex.evaluationMs !== null ? `${ex.evaluationMs}ms` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="vn-detail-sidebar">
          <div className="vn-card">
            <div className="vn-card-header"><h2>Details</h2></div>
            <div className="vn-card-body">
              <VnInfoGrid items={[
                { label: 'Event Pattern', value: <code style={{ fontSize: 13 }}>{rule.eventPattern}</code> },
                { label: 'Priority', value: editing ? <input className="vn-input" type="number" min="1" max="100" value={editPriority} onChange={(e) => setEditPriority(parseInt(e.target.value, 10))} style={{ width: 80 }} /> : String(rule.priority) },
                { label: 'Executions', value: String(rule.executionCount) },
                { label: 'Last Run', value: timeAgo(rule.lastExecutedAt) },
                { label: 'Created', value: new Date(rule.createdAt).toLocaleDateString() },
              ]} />
            </div>
          </div>

          {rule.sourceDecisionId && (
            <div className="vn-card">
              <div className="vn-card-header"><h2>Source Decision</h2></div>
              <div className="vn-card-body">
                <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ width: '100%' }} onClick={() => navigate(`/agent-decisions/${rule.sourceDecisionId}`)}>
                  <span className="material-icons">open_in_new</span>View Decision
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test/dry-run modal */}
      <VnModal open={showTest} onClose={() => { setShowTest(false); setTestResult(null); }} title="Test Rule (Dry Run)" size="lg"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => setShowTest(false)}>Close</button>
            <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={runTest} disabled={testing}>{testing ? 'Testing...' : 'Run Test'}</button>
          </div>
        }
      >
        <div className="vn-field" style={{ marginBottom: 16 }}>
          <label className="vn-field-label">Event Type</label>
          <input className="vn-input" value={testEventType} onChange={(e) => setTestEventType(e.target.value)} placeholder="shipment.exception" />
        </div>
        <div className="vn-field" style={{ marginBottom: 16 }}>
          <label className="vn-field-label">Event Payload (JSON)</label>
          <textarea className="vn-input" rows={6} value={testPayload} onChange={(e) => setTestPayload(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 13 }} />
        </div>

        {testResult && (
          <div style={{ marginTop: 16 }}>
            <div className={`vn-alert vn-alert-${testResult.allConditionsMatched ? 'success' : 'warning'}`} style={{ marginBottom: 16 }}>
              <span className="material-icons">{testResult.allConditionsMatched ? 'check_circle' : 'info'}</span>
              <div className="vn-alert-content">
                {testResult.allConditionsMatched ? 'Rule would fire and execute action' : 'Rule would NOT fire - conditions not met'}
              </div>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Condition Results:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(testResult.conditionResults as Array<{ field: string; operator: string; expected: unknown; actual: unknown; matched: boolean }>)?.map((cr, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontFamily: 'monospace',
                  background: cr.matched ? 'var(--success-container)' : 'var(--error-container)',
                  color: cr.matched ? 'var(--on-success-container)' : 'var(--on-error-container)',
                }}>
                  <span className="material-icons" style={{ fontSize: 16 }}>{cr.matched ? 'check' : 'close'}</span>
                  <span>{cr.field} {cr.operator} {JSON.stringify(cr.expected)}</span>
                  <span style={{ marginLeft: 'auto', opacity: 0.7 }}>actual: {JSON.stringify(cr.actual)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </VnModal>
    </>
  );
}
