import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { VnPageHeader, VnChip, VnFilterBar, VnAlert, VnModal } from './components';

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
  executionCount: number;
  lastExecutedAt: string | null;
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

const EVENT_PATTERNS = [
  { value: 'shipment.exception', label: 'Shipment Exception' },
  { value: 'shipment.status_changed', label: 'Shipment Status Changed' },
  { value: 'shipment.delivered', label: 'Shipment Delivered' },
  { value: 'shipment.*', label: 'All Shipment Events' },
  { value: 'sla.breached', label: 'SLA Breached' },
  { value: 'sla.warning', label: 'SLA Warning' },
  { value: 'sla.*', label: 'All SLA Events' },
  { value: 'cargo.misdrop_detected', label: 'Cargo Misdrop' },
  { value: 'cargo.missing_at_stop', label: 'Cargo Missing' },
  { value: 'cargo.left_on_vehicle', label: 'Cargo Left on Vehicle' },
  { value: 'cold_chain.excursion_detected', label: 'Cold Chain Excursion' },
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

function conditionsPreview(conditions: { field: string; operator: string; value?: unknown }[]): string {
  return conditions.map((c) => {
    const op = OPERATORS.find((o) => o.value === c.operator)?.label || c.operator;
    if (c.operator === 'exists' || c.operator === 'notExists') return `${c.field} ${op}`;
    return `${c.field} ${op} ${JSON.stringify(c.value)}`;
  }).join(' AND ');
}

export default function VNextAutomationRules() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create/edit form state
  const [formName, setFormName] = useState('');
  const [formEventPattern, setFormEventPattern] = useState('shipment.exception');
  const [formConditions, setFormConditions] = useState<{ field: string; operator: string; value: string }[]>([
    { field: 'payload.exceptionType', operator: 'equals', value: '' },
  ]);
  const [formActionType, setFormActionType] = useState('create_issue');
  const [formSkillChainId, setFormSkillChainId] = useState('');
  const [skillChains, setSkillChains] = useState<{ id: string; name: string; description: string | null }[]>([]);
  const [formIssuePriority, setFormIssuePriority] = useState('high');
  const [formIssueCategory, setFormIssueCategory] = useState('exception');
  const [formIssueTitle, setFormIssueTitle] = useState('');
  const [formPriority, setFormPriority] = useState(50);
  const [saving, setSaving] = useState(false);

  const loadRules = async () => {
    try {
      const [rulesRes, chainsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/automation-rules`),
        fetch(`${API_URL}/api/v1/skill-chains`),
      ]);
      const json = await rulesRes.json();
      const chainsJson = await chainsRes.json();
      setRules(json.data || []);
      setSkillChains(chainsJson.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRules(); }, []);

  async function toggleRule(id: string) {
    await fetch(`${API_URL}/api/v1/automation-rules/${id}/toggle`, { method: 'POST' });
    await loadRules();
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this automation rule?')) return;
    await fetch(`${API_URL}/api/v1/automation-rules/${id}`, { method: 'DELETE' });
    await loadRules();
    setSuccessMsg('Rule deleted');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function createRule() {
    setSaving(true);
    setError('');
    try {
      // Parse condition values (try JSON parse for numbers/arrays)
      const conditions = formConditions.map((c) => {
        let value: unknown = c.value;
        if (c.operator !== 'exists' && c.operator !== 'notExists') {
          try { value = JSON.parse(c.value); } catch { /* keep as string */ }
        }
        return { field: c.field, operator: c.operator, value };
      });

      const res = await fetch(`${API_URL}/api/v1/automation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          eventPattern: formEventPattern,
          conditions,
          actionType: formActionType,
          actionConfig: formActionType === 'skill_chain'
            ? {}
            : {
                issuePriority: formIssuePriority,
                issueCategory: formIssueCategory,
                issueTitle: formIssueTitle || formName,
              },
          priority: formPriority,
          ...(formActionType === 'skill_chain' && formSkillChainId ? { skillChainId: formSkillChainId } : {}),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setShowCreate(false);
      setFormName('');
      setFormConditions([{ field: 'payload.exceptionType', operator: 'equals', value: '' }]);
      await loadRules();
      setSuccessMsg('Rule created');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = search
    ? rules.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.eventPattern.includes(search.toLowerCase()))
    : rules;

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading rules...</h3>
      </div>
    );
  }

  return (
    <>
      <VnPageHeader title="Automation Rules" subtitle={`${rules.length} rules`}>
        <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={() => setShowCreate(true)}>
          <span className="material-icons">add</span>Create Rule
        </button>
      </VnPageHeader>

      {successMsg && <VnAlert variant="success" onClose={() => setSuccessMsg('')}>{successMsg}</VnAlert>}
      {error && <VnAlert variant="error" onClose={() => setError('')}>{error}</VnAlert>}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">bolt</span></div>
          <div>
            <div className="vn-stat-value">{rules.length}</div>
            <div className="vn-stat-label">Total Rules</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{rules.filter((r) => r.enabled).length}</div>
            <div className="vn-stat-label">Active</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">play_circle</span></div>
          <div>
            <div className="vn-stat-value">{rules.reduce((sum, r) => sum + r.executionCount, 0)}</div>
            <div className="vn-stat-label">Total Executions</div>
          </div>
        </div>
      </div>

      {/* Rules table */}
      <div className="vn-card" style={{ marginTop: 24 }}>
        <VnFilterBar searchPlaceholder="Search rules..." searchValue={search} onSearchChange={setSearch} />

        {filtered.length === 0 ? (
          <div className="vn-empty">
            <span className="material-icons">bolt</span>
            <h3>No automation rules yet</h3>
            <p>Create rules manually or promote agent decisions to automate proven patterns.</p>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Event</th>
                  <th>Conditions</th>
                  <th>Action</th>
                  <th>Executions</th>
                  <th>Last Run</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rule) => (
                  <tr key={rule.id} onClick={() => navigate(`/automation-rules/${rule.id}`)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="vn-table-id">{rule.name}</span>
                      {rule.sourceDecisionId && (
                        <div className="vn-table-secondary">Promoted from agent</div>
                      )}
                    </td>
                    <td><code style={{ fontSize: 12 }}>{rule.eventPattern}</code></td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
                        {conditionsPreview(rule.conditions).substring(0, 60)}{conditionsPreview(rule.conditions).length > 60 ? '...' : ''}
                      </span>
                    </td>
                    <td>
                      {rule.actionType === 'create_issue' && <VnChip variant="info">Create Issue</VnChip>}
                      {rule.actionType === 'escalate_issue' && <VnChip variant="warning">Escalate</VnChip>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{rule.executionCount}</td>
                    <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{timeAgo(rule.lastExecutedAt)}</td>
                    <td>
                      <button
                        className={`vn-chip vn-chip-${rule.enabled ? 'success' : 'secondary'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => toggleRule(rule.id)}
                      >
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td>
                      <button className="vn-btn-icon" onClick={() => deleteRule(rule.id)} title="Delete">
                        <span className="material-icons" style={{ fontSize: 18, color: 'var(--error)' }}>delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create rule modal */}
      <VnModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Automation Rule"
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={createRule} disabled={saving || !formName}>
              {saving ? 'Creating...' : 'Create Rule'}
            </button>
          </div>
        }
      >
        {/* Name */}
        <div className="vn-field" style={{ marginBottom: 16 }}>
          <label className="vn-field-label">Rule Name</label>
          <input className="vn-input" placeholder="e.g. Critical delay auto-escalation" value={formName} onChange={(e) => setFormName(e.target.value)} />
        </div>

        {/* WHEN: Event pattern */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>WHEN</h3>
          <div className="vn-field">
            <label className="vn-field-label">Event Type</label>
            <select className="vn-input" value={formEventPattern} onChange={(e) => setFormEventPattern(e.target.value)}>
              {EVENT_PATTERNS.map((ep) => (
                <option key={ep.value} value={ep.value}>{ep.label} ({ep.value})</option>
              ))}
            </select>
          </div>
        </div>

        {/* GIVEN: Conditions */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>GIVEN</h3>
          {formConditions.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                className="vn-input"
                style={{ flex: 2, fontFamily: 'monospace', fontSize: 13 }}
                placeholder="payload.delayMinutes"
                value={c.field}
                onChange={(e) => { const arr = [...formConditions]; arr[i].field = e.target.value; setFormConditions(arr); }}
              />
              <select
                className="vn-input"
                style={{ flex: 1 }}
                value={c.operator}
                onChange={(e) => { const arr = [...formConditions]; arr[i].operator = e.target.value; setFormConditions(arr); }}
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              {c.operator !== 'exists' && c.operator !== 'notExists' && (
                <input
                  className="vn-input"
                  style={{ flex: 2, fontFamily: 'monospace', fontSize: 13 }}
                  placeholder='60 or "critical" or ["a","b"]'
                  value={c.value}
                  onChange={(e) => { const arr = [...formConditions]; arr[i].value = e.target.value; setFormConditions(arr); }}
                />
              )}
              <button
                className="vn-btn-icon"
                onClick={() => setFormConditions(formConditions.filter((_, j) => j !== i))}
                style={{ opacity: formConditions.length === 1 ? 0.3 : 1 }}
                disabled={formConditions.length === 1}
              >
                <span className="material-icons" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
          ))}
          <button
            className="vn-btn vn-btn-ghost vn-btn-sm"
            onClick={() => setFormConditions([...formConditions, { field: '', operator: 'equals', value: '' }])}
          >
            <span className="material-icons">add</span>Add Condition
          </button>
        </div>

        {/* THEN: Action */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>THEN</h3>
          <div className="vn-form-grid">
            <div className="vn-field">
              <label className="vn-field-label">Action</label>
              <select className="vn-input" value={formActionType} onChange={(e) => setFormActionType(e.target.value)}>
                <option value="create_issue">Create Issue</option>
                <option value="escalate_issue">Escalate Issue</option>
                {skillChains.length > 0 && <option value="skill_chain">Skill Chain</option>}
              </select>
            </div>
            {formActionType === 'create_issue' && (
              <>
                <div className="vn-field">
                  <label className="vn-field-label">Priority</label>
                  <select className="vn-input" value={formIssuePriority} onChange={(e) => setFormIssuePriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Category</label>
                  <select className="vn-input" value={formIssueCategory} onChange={(e) => setFormIssueCategory(e.target.value)}>
                    <option value="exception">Exception</option>
                    <option value="delay">Delay</option>
                    <option value="damage">Damage</option>
                    <option value="compliance">Compliance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="vn-field-label">Issue Title</label>
                  <input className="vn-input" placeholder="Leave blank to use rule name" value={formIssueTitle} onChange={(e) => setFormIssueTitle(e.target.value)} />
                </div>
              </>
            )}
            {formActionType === 'skill_chain' && (
              <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                <label className="vn-field-label">Skill Chain</label>
                <select className="vn-input" value={formSkillChainId} onChange={(e) => setFormSkillChainId(e.target.value)}>
                  <option value="">Select a skill chain...</option>
                  {skillChains.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.name}{sc.description ? ` - ${sc.description}` : ''}</option>
                  ))}
                </select>
                {skillChains.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4, display: 'block' }}>
                    No skill chains created yet. Create one at Settings &gt; Skill Chains first.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Priority */}
        <div className="vn-field">
          <label className="vn-field-label">Rule Priority ({formPriority})</label>
          <input type="range" min="1" max="100" value={formPriority} onChange={(e) => setFormPriority(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
          <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Lower number = higher priority. First matching rule executes.</span>
        </div>
      </VnModal>
    </>
  );
}
