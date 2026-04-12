import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import { VnPageHeader, VnAlert, VnChip, VnModal } from './components';

interface SkillDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  fields: { key: string; label: string; type: string; required: boolean; placeholder?: string }[];
  requiresConfig: boolean;
}

interface SkillChain {
  id: string;
  name: string;
  description: string | null;
  steps: SkillChainStep[];
  createdAt: string;
}

type SkillChainStep =
  | { type: 'skill'; skillType: string; fields: Record<string, string> }
  | { type: 'question'; question: string; conditions: { field: string; operator: string; value?: string }[]; branches: { label: string; matched: boolean; steps: SkillChainStep[] }[] };

const OPERATORS = [
  { value: 'equals', label: '=' },
  { value: 'notEquals', label: '!=' },
  { value: 'greaterThan', label: '>' },
  { value: 'lessThan', label: '<' },
  { value: 'contains', label: 'contains' },
  { value: 'exists', label: 'exists' },
];

function StepDisplay({ step, skills, depth = 0 }: { step: SkillChainStep; skills: SkillDefinition[]; depth?: number }) {
  const indent = depth * 24;
  if (step.type === 'skill') {
    const def = skills.find((s) => s.type === step.skillType);
    return (
      <div style={{ marginLeft: indent, padding: '10px 14px', background: 'var(--surface-container)', borderRadius: 8, borderLeft: '3px solid var(--primary)', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="material-icons" style={{ fontSize: 16, color: 'var(--primary)' }}>{def?.icon || 'extension'}</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{def?.name || step.skillType}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
          {Object.entries(step.fields).map(([k, v]) => <div key={k}>{k}: {v}</div>)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginLeft: indent, marginBottom: 8 }}>
      <div style={{ padding: '10px 14px', background: 'var(--surface-container-high)', borderRadius: 8, borderLeft: '3px solid var(--warning)', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="material-icons" style={{ fontSize: 16, color: 'var(--warning)' }}>help</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{step.question}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
          {step.conditions.map((c, i) => <div key={i}>{c.field} {c.operator} {c.value !== undefined ? JSON.stringify(c.value) : ''}</div>)}
        </div>
      </div>
      {step.branches.map((branch, bi) => (
        <div key={bi} style={{ marginLeft: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: branch.matched ? 'var(--success)' : 'var(--error)', marginBottom: 4 }}>
            {branch.matched ? 'Yes' : 'No'}: {branch.label}
          </div>
          {branch.steps.map((s, si) => <StepDisplay key={si} step={s} skills={skills} depth={depth + 1} />)}
        </div>
      ))}
    </div>
  );
}

export default function VNextSkillChains() {
  const [chains, setChains] = useState<SkillChain[]>([]);
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSteps, setFormSteps] = useState<SkillChainStep[]>([]);
  const [saving, setSaving] = useState(false);

  // Add step modal
  const [showAddStep, setShowAddStep] = useState(false);
  const [addStepType, setAddStepType] = useState<'skill' | 'question'>('skill');
  const [addSkillType, setAddSkillType] = useState('');
  const [addSkillFields, setAddSkillFields] = useState<Record<string, string>>({});
  const [addQuestion, setAddQuestion] = useState('');
  const [addConditions, setAddConditions] = useState<{ field: string; operator: string; value: string }[]>([{ field: '', operator: 'equals', value: '' }]);
  // For question branches - simplified: each branch gets one skill
  const [addYesSkillType, setAddYesSkillType] = useState('');
  const [addYesFields, setAddYesFields] = useState<Record<string, string>>({});
  const [addNoSkillType, setAddNoSkillType] = useState('');
  const [addNoFields, setAddNoFields] = useState<Record<string, string>>({});

  const loadData = async () => {
    try {
      const [chainsRes, skillsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/skill-chains`),
        fetch(`${API_URL}/api/v1/skills`),
      ]);
      setChains((await chainsRes.json()).data || []);
      setSkills((await skillsRes.json()).data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  function openAddStep() {
    setAddStepType('skill');
    setAddSkillType(skills[0]?.type || '');
    setAddSkillFields({});
    setAddQuestion('');
    setAddConditions([{ field: '', operator: 'equals', value: '' }]);
    setAddYesSkillType(skills[0]?.type || '');
    setAddYesFields({});
    setAddNoSkillType(skills[0]?.type || '');
    setAddNoFields({});
    setShowAddStep(true);
  }

  function confirmAddStep() {
    if (addStepType === 'skill') {
      setFormSteps([...formSteps, { type: 'skill', skillType: addSkillType, fields: { ...addSkillFields } }]);
    } else {
      const conditions = addConditions.map((c) => {
        let value: unknown = c.value;
        try { value = JSON.parse(c.value); } catch { /* keep string */ }
        return { field: c.field, operator: c.operator, value: String(value) };
      });
      setFormSteps([...formSteps, {
        type: 'question',
        question: addQuestion,
        conditions,
        branches: [
          { label: 'Yes', matched: true, steps: addYesSkillType ? [{ type: 'skill', skillType: addYesSkillType, fields: { ...addYesFields } }] : [] },
          { label: 'No', matched: false, steps: addNoSkillType ? [{ type: 'skill', skillType: addNoSkillType, fields: { ...addNoFields } }] : [] },
        ],
      }]);
    }
    setShowAddStep(false);
  }

  async function saveChain() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/skill-chains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, description: formDescription || undefined, steps: formSteps }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setShowCreate(false);
      setFormName('');
      setFormDescription('');
      setFormSteps([]);
      await loadData();
      setSuccessMsg('Skill chain created');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteChain(chainId: string) {
    if (!confirm('Delete this skill chain?')) return;
    await fetch(`${API_URL}/api/v1/skill-chains/${chainId}`, { method: 'DELETE' });
    await loadData();
    setSuccessMsg('Chain deleted');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  const selectedSkillDef = skills.find((s) => s.type === addSkillType);
  const yesSkillDef = skills.find((s) => s.type === addYesSkillType);
  const noSkillDef = skills.find((s) => s.type === addNoSkillType);

  if (loading) {
    return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  }

  return (
    <>
      <VnPageHeader title="Skill Chains" subtitle={`${chains.length} chains`}>
        <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={() => setShowCreate(true)}>
          <span className="material-icons">add</span>Create Chain
        </button>
      </VnPageHeader>

      {successMsg && <VnAlert variant="success" onClose={() => setSuccessMsg('')}>{successMsg}</VnAlert>}
      {error && <VnAlert variant="error" onClose={() => setError('')}>{error}</VnAlert>}

      {chains.length === 0 ? (
        <div className="vn-empty">
          <span className="material-icons">account_tree</span>
          <h3>No skill chains yet</h3>
          <p>Create a chain to compose multiple skills with conditional branching.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {chains.map((chain) => (
            <div key={chain.id} className="vn-card">
              <div className="vn-card-header">
                <div>
                  <h2>{chain.name}</h2>
                  {chain.description && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-surface-variant)' }}>{chain.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <VnChip variant="secondary">{chain.steps.length} steps</VnChip>
                  <button className="vn-btn-icon" onClick={() => deleteChain(chain.id)} title="Delete">
                    <span className="material-icons" style={{ fontSize: 18, color: 'var(--error)' }}>delete</span>
                  </button>
                </div>
              </div>
              <div className="vn-card-body">
                {chain.steps.map((step, i) => <StepDisplay key={i} step={step} skills={skills} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create chain modal */}
      <VnModal open={showCreate} onClose={() => setShowCreate(false)} title="Create Skill Chain" size="lg"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={saveChain} disabled={saving || !formName || formSteps.length === 0}>
              {saving ? 'Saving...' : 'Create Chain'}
            </button>
          </div>
        }
      >
        <div className="vn-field" style={{ marginBottom: 16 }}>
          <label className="vn-field-label">Chain Name</label>
          <input className="vn-input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Critical Delay Response" />
        </div>
        <div className="vn-field" style={{ marginBottom: 16 }}>
          <label className="vn-field-label">Description</label>
          <input className="vn-input" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Optional" />
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Steps ({formSteps.length})</h3>
        {formSteps.map((step, i) => (
          <div key={i} style={{ marginBottom: 8, position: 'relative' }}>
            <StepDisplay step={step} skills={skills} />
            <button className="vn-btn-icon" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => setFormSteps(formSteps.filter((_, j) => j !== i))}>
              <span className="material-icons" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
        ))}

        <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ width: '100%' }} onClick={openAddStep}>
          <span className="material-icons">add</span>Add Step
        </button>
      </VnModal>

      {/* Add step modal */}
      <VnModal open={showAddStep} onClose={() => setShowAddStep(false)} title="Add Step" size="lg"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => setShowAddStep(false)}>Cancel</button>
            <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={confirmAddStep}>Add</button>
          </div>
        }
      >
        {/* Step type toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button className={`vn-btn vn-btn-sm ${addStepType === 'skill' ? 'vn-btn-primary' : 'vn-btn-outline'}`} onClick={() => setAddStepType('skill')}>
            <span className="material-icons">extension</span>Skill
          </button>
          <button className={`vn-btn vn-btn-sm ${addStepType === 'question' ? 'vn-btn-primary' : 'vn-btn-outline'}`} onClick={() => setAddStepType('question')}>
            <span className="material-icons">help</span>Question (Branch)
          </button>
        </div>

        {addStepType === 'skill' && (
          <>
            <div className="vn-field" style={{ marginBottom: 16 }}>
              <label className="vn-field-label">Skill</label>
              <select className="vn-input" value={addSkillType} onChange={(e) => { setAddSkillType(e.target.value); setAddSkillFields({}); }}>
                {skills.map((s) => <option key={s.type} value={s.type}>{s.name}</option>)}
              </select>
            </div>
            {selectedSkillDef?.fields.map((f) => (
              <div className="vn-field" key={f.key} style={{ marginBottom: 12 }}>
                <label className="vn-field-label">{f.label} {f.required && '*'}</label>
                <input className="vn-input" placeholder={f.placeholder || `Use {{template}} syntax`} value={addSkillFields[f.key] || ''} onChange={(e) => setAddSkillFields({ ...addSkillFields, [f.key]: e.target.value })} />
              </div>
            ))}
          </>
        )}

        {addStepType === 'question' && (
          <>
            <div className="vn-field" style={{ marginBottom: 16 }}>
              <label className="vn-field-label">Question</label>
              <input className="vn-input" value={addQuestion} onChange={(e) => setAddQuestion(e.target.value)} placeholder="Is the delay greater than 60 minutes?" />
            </div>

            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Conditions</h4>
            {addConditions.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="vn-input" style={{ flex: 2, fontFamily: 'monospace', fontSize: 13 }} placeholder="payload.delayMinutes" value={c.field} onChange={(e) => { const arr = [...addConditions]; arr[i].field = e.target.value; setAddConditions(arr); }} />
                <select className="vn-input" style={{ flex: 1 }} value={c.operator} onChange={(e) => { const arr = [...addConditions]; arr[i].operator = e.target.value; setAddConditions(arr); }}>
                  {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                <input className="vn-input" style={{ flex: 2, fontFamily: 'monospace', fontSize: 13 }} placeholder="60" value={c.value} onChange={(e) => { const arr = [...addConditions]; arr[i].value = e.target.value; setAddConditions(arr); }} />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
              {/* Yes branch */}
              <div style={{ flex: 1, padding: 12, background: 'var(--success-container)', borderRadius: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-success-container)', marginBottom: 8 }}>Yes Branch</h4>
                <select className="vn-input" value={addYesSkillType} onChange={(e) => { setAddYesSkillType(e.target.value); setAddYesFields({}); }}>
                  <option value="">No action</option>
                  {skills.map((s) => <option key={s.type} value={s.type}>{s.name}</option>)}
                </select>
                {yesSkillDef?.fields.map((f) => (
                  <div key={f.key} style={{ marginTop: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 2 }}>{f.label}</label>
                    <input className="vn-input" style={{ fontSize: 12 }} placeholder={f.placeholder} value={addYesFields[f.key] || ''} onChange={(e) => setAddYesFields({ ...addYesFields, [f.key]: e.target.value })} />
                  </div>
                ))}
              </div>

              {/* No branch */}
              <div style={{ flex: 1, padding: 12, background: 'var(--error-container)', borderRadius: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-error-container)', marginBottom: 8 }}>No Branch</h4>
                <select className="vn-input" value={addNoSkillType} onChange={(e) => { setAddNoSkillType(e.target.value); setAddNoFields({}); }}>
                  <option value="">No action</option>
                  {skills.map((s) => <option key={s.type} value={s.type}>{s.name}</option>)}
                </select>
                {noSkillDef?.fields.map((f) => (
                  <div key={f.key} style={{ marginTop: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 2 }}>{f.label}</label>
                    <input className="vn-input" style={{ fontSize: 12 }} placeholder={f.placeholder} value={addNoFields[f.key] || ''} onChange={(e) => setAddNoFields({ ...addNoFields, [f.key]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </VnModal>
    </>
  );
}
