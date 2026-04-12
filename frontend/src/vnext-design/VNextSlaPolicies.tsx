/**
 * VNextSlaPolicies — Admin page for managing SLA policies and rules.
 *
 * Two-tab layout: "Organization Default" and "Customer Overrides".
 * Each policy contains typed rules that are managed as a unit.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { API_URL } from '../api';

interface SlaRule {
  ruleType: string;
  name: string;
  description?: string;
  active?: boolean;
  warningThresholdMinutes?: number | null;
  breachThresholdMinutes?: number | null;
  criticalThresholdMinutes?: number | null;
  issuePriority?: string | null;
  issueCategory?: string | null;
  maxDeliveryMinutes?: number | null;
  maxDwellMinutes?: number | null;
  dwellLocationType?: string | null;
  maxOccurrences?: number | null;
  maxExcursionMinutes?: number | null;
  autoCreateIssue?: boolean;
  issuePriorityOnBreach?: string;
}

interface SlaPolicy {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  customerId?: string | null;
  customer?: { id: string; name: string } | null;
  active: boolean;
  rules: (SlaRule & { id?: string })[];
  createdAt: string;
  updatedAt: string;
}

interface Customer {
  id: string;
  name: string;
}

const RULE_TYPES = [
  { value: 'eta_delivery', label: 'ETA Delivery', icon: 'schedule', description: 'Shipment must arrive within X minutes of pickup' },
  { value: 'issue_response', label: 'Issue Response', icon: 'reply', description: 'Issue must be acknowledged within X minutes' },
  { value: 'issue_resolution', label: 'Issue Resolution', icon: 'check_circle', description: 'Issue must be resolved within X minutes' },
  { value: 'dwell_time', label: 'Dwell Time', icon: 'hourglass_top', description: 'Max time a shipment can be stationary at a location' },
  { value: 'light_event', label: 'Light Sensor Event', icon: 'light_mode', description: 'Light detection outside known locations (tampering)' },
  { value: 'seal_event', label: 'Security Seal Event', icon: 'lock_open', description: 'Seal break detected outside known locations' },
  { value: 'temperature_excursion', label: 'Temperature Excursion', icon: 'thermostat', description: 'Single excursion duration limit' },
  { value: 'temperature_out_of_range', label: 'Cumulative Out-of-Range', icon: 'device_thermostat', description: 'Total time out of acceptable temperature range' },
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const CATEGORIES = ['exception', 'delay', 'damage', 'compliance', 'other'];
const DWELL_LOCATION_TYPES = ['any', 'origin', 'intermediate', 'destination'];

function emptyRule(ruleType: string): SlaRule {
  const meta = RULE_TYPES.find((r) => r.value === ruleType);
  return {
    ruleType,
    name: meta?.label || ruleType,
    active: true,
    autoCreateIssue: true,
    issuePriorityOnBreach: 'high',
  };
}

function RuleEditor({ rule, onChange, onRemove }: { rule: SlaRule; onChange: (r: SlaRule) => void; onRemove: () => void }) {
  const meta = RULE_TYPES.find((r) => r.value === rule.ruleType);
  const isTimeThreshold = ['issue_response', 'issue_resolution', 'dwell_time', 'temperature_excursion', 'temperature_out_of_range'].includes(rule.ruleType);
  const isEta = rule.ruleType === 'eta_delivery';
  const isOccurrence = ['light_event', 'seal_event'].includes(rule.ruleType);
  const isDwell = rule.ruleType === 'dwell_time';
  const isIssue = ['issue_response', 'issue_resolution'].includes(rule.ruleType);

  const set = (field: string, value: any) => onChange({ ...rule, [field]: value });
  const setNum = (field: string, v: string) => set(field, v === '' ? null : parseInt(v, 10));

  return (
    <div className="vn-card" style={{ padding: '16px', marginBottom: '12px', borderLeft: `4px solid ${rule.active !== false ? 'var(--primary)' : 'var(--outline-variant)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons" style={{ fontSize: '20px', color: 'var(--primary)' }}>{meta?.icon || 'rule'}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{meta?.label || rule.ruleType}</div>
            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{meta?.description}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--on-surface-variant)', cursor: 'pointer' }}>
            <input type="checkbox" checked={rule.active !== false} onChange={(e) => set('active', e.target.checked)} />
            Active
          </label>
          <button onClick={onRemove} className="icon-btn" title="Remove rule" style={{ color: 'var(--color-error)' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>delete</span>
          </button>
        </div>
      </div>

      <div className="vn-form-grid" style={{ gap: '12px' }}>
        {/* Name */}
        <div className="vn-field">
          <label className="vn-field-label">Rule Name</label>
          <input className="vn-input" value={rule.name} onChange={(e) => set('name', e.target.value)} />
        </div>

        {/* ETA: max delivery minutes */}
        {isEta && (
          <div className="vn-field">
            <label className="vn-field-label">Max Delivery Time (minutes)</label>
            <input className="vn-input" type="number" value={rule.maxDeliveryMinutes ?? ''} onChange={(e) => setNum('maxDeliveryMinutes', e.target.value)} placeholder="e.g. 1440 (24 hours)" />
          </div>
        )}

        {/* Time thresholds */}
        {(isTimeThreshold || isEta) && (
          <>
            <div className="vn-field">
              <label className="vn-field-label">Warning Threshold (min)</label>
              <input className="vn-input" type="number" value={rule.warningThresholdMinutes ?? ''} onChange={(e) => setNum('warningThresholdMinutes', e.target.value)} placeholder="e.g. 60" />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Breach Threshold (min)</label>
              <input className="vn-input" type="number" value={rule.breachThresholdMinutes ?? ''} onChange={(e) => setNum('breachThresholdMinutes', e.target.value)} placeholder="e.g. 120" />
            </div>
          </>
        )}

        {/* Dwell: max dwell + location type */}
        {isDwell && (
          <>
            <div className="vn-field">
              <label className="vn-field-label">Max Dwell Time (min)</label>
              <input className="vn-input" type="number" value={rule.maxDwellMinutes ?? ''} onChange={(e) => setNum('maxDwellMinutes', e.target.value)} placeholder="e.g. 240" />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Location Type</label>
              <select className="vn-input" value={rule.dwellLocationType ?? 'any'} onChange={(e) => set('dwellLocationType', e.target.value)}>
                {DWELL_LOCATION_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </>
        )}

        {/* Issue filters */}
        {isIssue && (
          <>
            <div className="vn-field">
              <label className="vn-field-label">Issue Priority Filter</label>
              <select className="vn-input" value={rule.issuePriority ?? ''} onChange={(e) => set('issuePriority', e.target.value || null)}>
                <option value="">All priorities</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Issue Category Filter</label>
              <select className="vn-input" value={rule.issueCategory ?? ''} onChange={(e) => set('issueCategory', e.target.value || null)}>
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </>
        )}

        {/* Occurrence-based */}
        {isOccurrence && (
          <div className="vn-field">
            <label className="vn-field-label">Max Occurrences Before Breach</label>
            <input className="vn-input" type="number" value={rule.maxOccurrences ?? ''} onChange={(e) => setNum('maxOccurrences', e.target.value)} placeholder="0 = any occurrence" />
          </div>
        )}

        {/* Temperature */}
        {(rule.ruleType === 'temperature_excursion' || rule.ruleType === 'temperature_out_of_range') && (
          <div className="vn-field">
            <label className="vn-field-label">Max Excursion Duration (min)</label>
            <input className="vn-input" type="number" value={rule.maxExcursionMinutes ?? ''} onChange={(e) => setNum('maxExcursionMinutes', e.target.value)} placeholder="e.g. 30" />
          </div>
        )}

        {/* Breach action */}
        <div className="vn-field">
          <label className="vn-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" checked={rule.autoCreateIssue !== false} onChange={(e) => set('autoCreateIssue', e.target.checked)} />
            Auto-create issue on breach
          </label>
        </div>
        {rule.autoCreateIssue !== false && (
          <div className="vn-field">
            <label className="vn-field-label">Issue Priority on Breach</label>
            <select className="vn-input" value={rule.issuePriorityOnBreach ?? 'high'} onChange={(e) => set('issuePriorityOnBreach', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function PolicyEditor({ policy, onSave, saving }: { policy: SlaPolicy | null; onSave: (data: any) => void; saving: boolean }) {
  const [name, setName] = useState(policy?.name || '');
  const [description, setDescription] = useState(policy?.description || '');
  const [rules, setRules] = useState<SlaRule[]>(policy?.rules || []);
  const [showAddMenu, setShowAddMenu] = useState(false);

  useEffect(() => {
    setName(policy?.name || '');
    setDescription(policy?.description || '');
    setRules(policy?.rules || []);
  }, [policy]);

  const addRule = (ruleType: string) => {
    setRules((prev) => [...prev, emptyRule(ruleType)]);
    setShowAddMenu(false);
  };

  const updateRule = (idx: number, updated: SlaRule) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? updated : r)));
  };

  const removeRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave({ name, description, rules });
  };

  // Which rule types are already added?
  const usedTypes = new Set(rules.map((r) => r.ruleType));
  const availableTypes = RULE_TYPES.filter((rt) => !usedTypes.has(rt.value));

  return (
    <div>
      {/* Policy header fields */}
      <div className="vn-form-grid" style={{ marginBottom: '20px' }}>
        <div className="vn-field">
          <label className="vn-field-label">Policy Name</label>
          <input className="vn-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard SLA" />
        </div>
        <div className="vn-field">
          <label className="vn-field-label">Description</label>
          <input className="vn-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
        </div>
      </div>

      {/* Rules */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Rules ({rules.length})</h3>
        <div style={{ position: 'relative' }}>
          <button
            className="vn-btn"
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={availableTypes.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Add Rule
          </button>
          {showAddMenu && availableTypes.length > 0 && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: '4px',
              background: 'var(--surface)', border: '1px solid var(--outline-variant)',
              borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 100, minWidth: '280px', overflow: 'hidden',
            }}>
              {availableTypes.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => addRule(rt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '10px 14px', border: 'none',
                    background: 'transparent', cursor: 'pointer', textAlign: 'left',
                    color: 'var(--on-surface)', fontSize: '13px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-container)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="material-icons" style={{ fontSize: '18px', color: 'var(--primary)' }}>{rt.icon}</span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{rt.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>{rt.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {rules.length === 0 && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--on-surface-variant)', border: '2px dashed var(--outline-variant)', borderRadius: '8px', marginBottom: '16px' }}>
          <span className="material-icons" style={{ fontSize: '40px', display: 'block', marginBottom: '8px', opacity: 0.4 }}>rule</span>
          No rules configured. Click "Add Rule" to define SLA thresholds.
        </div>
      )}

      {rules.map((rule, idx) => (
        <RuleEditor key={`${rule.ruleType}-${idx}`} rule={rule} onChange={(r) => updateRule(idx, r)} onRemove={() => removeRule(idx)} />
      ))}

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
        <button className="vn-btn" onClick={handleSave} disabled={saving || !name.trim()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {saving && <span className="material-icons" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>sync</span>}
          {policy?.id ? 'Save Changes' : 'Create Policy'}
        </button>
      </div>
    </div>
  );
}

export default function VNextSlaPolicies() {
  const [tab, setTab] = useState<'org' | 'customer'>('org');
  const [orgPolicy, setOrgPolicy] = useState<SlaPolicy | null>(null);
  const [customerPolicies, setCustomerPolicies] = useState<SlaPolicy[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneCustomerId, setCloneCustomerId] = useState('');

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const [polRes, custRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/sla/policies`),
        fetch(`${API_URL}/api/v1/customers`),
      ]);
      if (polRes.ok) {
        const policies = (await polRes.json()).data || [];
        setOrgPolicy(policies.find((p: SlaPolicy) => !p.customerId) || null);
        setCustomerPolicies(policies.filter((p: SlaPolicy) => p.customerId));
      }
      if (custRes.ok) {
        setCustomers((await custRes.json()).data || []);
      }
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const saveOrgPolicy = async (data: any) => {
    setSaving(true);
    setMessage(null);
    try {
      const url = orgPolicy?.id
        ? `${API_URL}/api/v1/sla/policies/${orgPolicy.id}`
        : `${API_URL}/api/v1/sla/policies`;
      const method = orgPolicy?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');

      setMessage({ type: 'success', text: orgPolicy?.id ? 'Policy updated' : 'Policy created' });
      await fetchPolicies();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const saveCustomerPolicy = async (customerId: string, data: any) => {
    setSaving(true);
    setMessage(null);
    try {
      const existing = customerPolicies.find((p) => p.customerId === customerId);
      const url = existing?.id
        ? `${API_URL}/api/v1/sla/policies/${existing.id}`
        : `${API_URL}/api/v1/sla/policies`;
      const method = existing?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, customerId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');

      setMessage({ type: 'success', text: 'Customer SLA policy saved' });
      await fetchPolicies();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const cloneOrgPolicy = async () => {
    if (!orgPolicy?.id || !cloneCustomerId) return;
    setSaving(true);
    setMessage(null);
    try {
      const customer = customers.find((c) => c.id === cloneCustomerId);
      const res = await fetch(`${API_URL}/api/v1/sla/policies/${orgPolicy.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: cloneCustomerId, name: `${orgPolicy.name} — ${customer?.name || cloneCustomerId}` }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to clone');

      setMessage({ type: 'success', text: `Policy cloned for ${customer?.name}` });
      setShowCloneModal(false);
      setCloneCustomerId('');
      setTab('customer');
      setSelectedCustomerId(cloneCustomerId);
      await fetchPolicies();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const deactivatePolicy = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/v1/sla/policies/${id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Policy deactivated' });
      await fetchPolicies();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    }
  };

  // Customers that don't yet have a customer-specific override
  const customersWithoutPolicy = customers.filter(
    (c) => !customerPolicies.some((p) => p.customerId === c.id)
  );

  const selectedCustomerPolicy = selectedCustomerId
    ? customerPolicies.find((p) => p.customerId === selectedCustomerId) || null
    : null;

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--on-surface)' }}>SLA Policies</h1>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
          Configure service level agreements. The organization default applies to all entities unless a customer-specific override exists.
        </p>
      </div>

      {/* Feedback */}
      {message && (
        <div className={`vn-alert vn-alert-${message.type}`} style={{ marginBottom: '16px' }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="vn-tabs" style={{ marginBottom: '20px' }}>
        <button className={`vn-tab${tab === 'org' ? ' active' : ''}`} onClick={() => setTab('org')}>
          <span className="material-icons" style={{ fontSize: '18px' }}>business</span>
          Organization Default
        </button>
        <button className={`vn-tab${tab === 'customer' ? ' active' : ''}`} onClick={() => setTab('customer')}>
          <span className="material-icons" style={{ fontSize: '18px' }}>people</span>
          Customer Overrides ({customerPolicies.length})
        </button>
      </div>

      {/* Org default tab */}
      {tab === 'org' && (
        <div>
          <PolicyEditor
            policy={orgPolicy}
            onSave={saveOrgPolicy}
            saving={saving}
          />
          {orgPolicy?.id && (
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button
                className="vn-btn"
                onClick={() => setShowCloneModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)' }}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>content_copy</span>
                Clone for Customer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Customer overrides tab */}
      {tab === 'customer' && (
        <div>
          {/* Customer selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div className="vn-field" style={{ flex: 1, marginBottom: 0 }}>
              <select
                className="vn-input"
                value={selectedCustomerId || ''}
                onChange={(e) => setSelectedCustomerId(e.target.value || null)}
              >
                <option value="">Select a customer...</option>
                <optgroup label="Customers with overrides">
                  {customerPolicies.map((p) => (
                    <option key={p.customerId} value={p.customerId!}>
                      {p.customer?.name || p.customerId} — {p.name}
                    </option>
                  ))}
                </optgroup>
                {customersWithoutPolicy.length > 0 && (
                  <optgroup label="Create new override">
                    {customersWithoutPolicy.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} (no override)</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            {selectedCustomerPolicy && (
              <button
                onClick={() => { if (selectedCustomerPolicy?.id && confirm('Deactivate this customer SLA policy?')) deactivatePolicy(selectedCustomerPolicy.id); }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-error)', background: 'transparent', color: 'var(--color-error)', cursor: 'pointer' }}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                Deactivate
              </button>
            )}
          </div>

          {!selectedCustomerId && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: '48px', display: 'block', marginBottom: '8px', opacity: 0.4 }}>people</span>
              <p>Select a customer above to edit their SLA override, or choose a customer without an override to create one.</p>
              {orgPolicy?.id && <p style={{ fontSize: '13px' }}>Tip: Use "Clone for Customer" on the Organization tab to copy the default policy as a starting point.</p>}
            </div>
          )}

          {selectedCustomerId && (
            <PolicyEditor
              policy={selectedCustomerPolicy}
              onSave={(data) => saveCustomerPolicy(selectedCustomerId, data)}
              saving={saving}
            />
          )}
        </div>
      )}

      {/* Clone modal */}
      {showCloneModal && (
        <div className="vn-modal-backdrop" onClick={() => setShowCloneModal(false)}>
          <div className="vn-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="vn-modal-header">
              <h2 style={{ margin: 0, fontSize: '18px' }}>Clone Policy for Customer</h2>
            </div>
            <div className="vn-modal-body">
              <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
                This will create a customer-specific SLA policy based on the organization default. You can then customise the thresholds for this customer.
              </p>
              <div className="vn-field">
                <label className="vn-field-label">Customer</label>
                <select className="vn-input" value={cloneCustomerId} onChange={(e) => setCloneCustomerId(e.target.value)}>
                  <option value="">Select customer...</option>
                  {customersWithoutPolicy.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn" style={{ background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)' }} onClick={() => setShowCloneModal(false)}>
                Cancel
              </button>
              <button className="vn-btn" onClick={cloneOrgPolicy} disabled={!cloneCustomerId || saving}>
                {saving ? 'Cloning...' : 'Clone Policy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
