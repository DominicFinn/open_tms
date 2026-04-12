/**
 * VNextCarrierTrackingSetup - Multi-step wizard for setting up a new carrier tracking integration.
 *
 * Steps: Select Carrier -> Select Provider -> Configure -> Test Connection -> Done
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface Carrier {
  id: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
}

interface ExistingIntegration {
  id: string;
  carrierId: string;
}

interface ProviderDef {
  key: string;
  name: string;
  icon: string;
  description: string;
  supportsWebhook: boolean;
  supportsPolling: boolean;
  fields: ProviderField[];
  infoUrl?: string;
  infoText?: string;
}

interface ProviderField {
  key: string;
  label: string;
  type: 'text' | 'password';
  required: boolean;
  placeholder?: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    key: 'fedex',
    name: 'FedEx',
    icon: 'local_shipping',
    description: 'Track shipments via the FedEx Track API with full status and proof of delivery.',
    supportsWebhook: true,
    supportsPolling: true,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Your FedEx API client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'Your FedEx API client secret' },
      { key: 'accountNumber', label: 'Account Number', type: 'text', required: false, placeholder: 'Optional - FedEx account number' },
    ],
    infoUrl: 'https://developer.fedex.com',
    infoText: 'Get your credentials at developer.fedex.com',
  },
  {
    key: 'ups',
    name: 'UPS',
    icon: 'inventory_2',
    description: 'Track packages through the UPS Tracking API with detailed milestone events.',
    supportsWebhook: true,
    supportsPolling: true,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Your UPS API client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'Your UPS API client secret' },
    ],
    infoUrl: 'https://developer.ups.com',
    infoText: 'Get your credentials at developer.ups.com',
  },
  {
    key: 'dhl',
    name: 'DHL',
    icon: 'flight',
    description: 'Track DHL Express, eCommerce, and Freight shipments via the Unified Tracking API.',
    supportsWebhook: false,
    supportsPolling: true,
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Your DHL API key' },
    ],
    infoUrl: 'https://developer.dhl.com',
    infoText: 'Get your API key at developer.dhl.com',
  },
  {
    key: 'easypost',
    name: 'EasyPost',
    icon: 'all_inbox',
    description: 'Multi-carrier tracking through EasyPost. Supports 100+ carriers with a single integration.',
    supportsWebhook: true,
    supportsPolling: true,
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Your EasyPost API key' },
    ],
    infoUrl: 'https://easypost.com/account',
    infoText: 'Get your API key at easypost.com/account',
  },
  {
    key: 'edi_214',
    name: 'EDI 214',
    icon: 'swap_horiz',
    description: 'Receive tracking updates via EDI 214 Shipment Status messages from trading partners.',
    supportsWebhook: false,
    supportsPolling: false,
    fields: [],
    infoText: 'No credentials needed. Uses your existing Trading Partner configuration.',
  },
  {
    key: 'manual',
    name: 'Manual',
    icon: 'edit_note',
    description: 'Manually update tracking status through the UI or API. No external provider needed.',
    supportsWebhook: false,
    supportsPolling: false,
    fields: [],
  },
];

const POLLING_INTERVALS = [
  { value: 5, label: 'Every 5 minutes' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
];

const STEPS = ['Select Carrier', 'Select Provider', 'Configure', 'Test Connection', 'Done'];

export default function VNextCarrierTrackingSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [existingIntegrations, setExistingIntegrations] = useState<ExistingIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [selectedCarrierId, setSelectedCarrierId] = useState('');

  // Step 2 state
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // Step 3 state
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [pollingInterval, setPollingInterval] = useState(15);
  const [saving, setSaving] = useState(false);

  // Step 4 state
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [carriersRes, integrationsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/carriers`),
        fetch(`${API_URL}/api/v1/carrier-tracking/integrations`),
      ]);
      const carriersJson = await carriersRes.json();
      const integrationsJson = await integrationsRes.json();
      if (!carriersRes.ok) throw new Error(carriersJson.error || 'Failed to load carriers');
      setCarriers(carriersJson.data || []);
      setExistingIntegrations(integrationsJson.data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const existingCarrierIds = new Set(existingIntegrations.map(i => i.carrierId));
  const availableCarriers = carriers.filter(c => !existingCarrierIds.has(c.id));
  const providerDef = PROVIDERS.find(p => p.key === selectedProvider);
  const selectedCarrier = carriers.find(c => c.id === selectedCarrierId);

  const handleCreateIntegration = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: any = {
        carrierId: selectedCarrierId,
        providerType: selectedProvider,
        pollingEnabled: providerDef?.supportsPolling ? pollingEnabled : false,
        pollingIntervalMinutes: pollingInterval,
        credentials,
      };
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create integration');
      setCreatedId(json.data?.id || json.data?.integration?.id);
      setStep(3);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!createdId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${createdId}/test`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setTestResult({ success: false, message: json.error || 'Test failed' });
      } else {
        setTestResult({ success: true, message: json.data?.message || 'Connection successful' });
      }
    } catch (err) {
      setTestResult({ success: false, message: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const canProceedStep0 = !!selectedCarrierId;
  const canProceedStep1 = !!selectedProvider;
  const canProceedStep2 = providerDef
    ? providerDef.fields.filter(f => f.required).every(f => credentials[f.key]?.trim())
    : true;

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Back link */}
      <Link to="/integrations/carrier-tracking" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', textDecoration: 'none', fontSize: '14px', marginBottom: '16px' }}>
        <span className="material-icons" style={{ fontSize: '18px' }}>arrow_back</span>
        Back to Carrier Tracking
      </Link>

      <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700, color: 'var(--on-surface)' }}>
        Set Up Carrier Tracking
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
        Connect a carrier to receive automatic shipment tracking updates.
      </p>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '32px', overflowX: 'auto' }}>
        {STEPS.map((label, idx) => (
          <React.Fragment key={label}>
            {idx > 0 && (
              <div style={{ flex: '0 0 24px', height: '2px', background: idx <= step ? 'var(--primary)' : 'var(--outline-variant)' }} />
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
              opacity: idx <= step ? 1 : 0.5,
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600,
                background: idx < step ? 'var(--color-success)' : idx === step ? 'var(--primary)' : 'var(--surface-container)',
                color: idx <= step ? 'var(--on-primary)' : 'var(--on-surface-variant)',
              }}>
                {idx < step ? (
                  <span className="material-icons" style={{ fontSize: '16px' }}>check</span>
                ) : (
                  idx + 1
                )}
              </div>
              <span style={{ fontSize: '13px', fontWeight: idx === step ? 600 : 400, color: 'var(--on-surface)', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="vn-alert vn-alert-error" style={{ marginBottom: '16px' }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
          </button>
        </div>
      )}

      {/* Step 0: Select Carrier */}
      {step === 0 && (
        <div className="vn-card" style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: 'var(--on-surface)' }}>Select Carrier</h2>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
            Choose the carrier you want to set up tracking for. Only carriers without an existing integration are shown.
          </p>

          {availableCarriers.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--on-surface-variant)', border: '2px dashed var(--outline-variant)', borderRadius: '8px' }}>
              <span className="material-icons" style={{ fontSize: '40px', display: 'block', marginBottom: '8px', opacity: 0.4 }}>airport_shuttle</span>
              <p style={{ margin: 0 }}>All carriers already have tracking integrations, or no carriers exist yet.</p>
            </div>
          ) : (
            <div className="vn-field">
              <label className="vn-field-label">Carrier</label>
              <select className="vn-input" value={selectedCarrierId} onChange={e => setSelectedCarrierId(e.target.value)}>
                <option value="">Select a carrier...</option>
                {availableCarriers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.mcNumber ? ` (MC-${c.mcNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button className="vn-btn" disabled={!canProceedStep0} onClick={() => setStep(1)}>
              Next
              <span className="material-icons" style={{ fontSize: '18px', marginLeft: '4px' }}>arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Select Provider */}
      {step === 1 && (
        <div className="vn-card" style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: 'var(--on-surface)' }}>Select Provider</h2>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
            Choose how you want to receive tracking updates for {selectedCarrier?.name || 'this carrier'}.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {PROVIDERS.map(provider => (
              <button
                key={provider.key}
                onClick={() => setSelectedProvider(provider.key)}
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: selectedProvider === provider.key
                    ? '2px solid var(--primary)'
                    : '1px solid var(--outline-variant)',
                  background: selectedProvider === provider.key
                    ? 'var(--primary-container)'
                    : 'var(--surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span className="material-icons" style={{
                  fontSize: '28px', display: 'block', marginBottom: '8px',
                  color: selectedProvider === provider.key ? 'var(--primary)' : 'var(--on-surface-variant)',
                }}>
                  {provider.icon}
                </span>
                <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--on-surface)', marginBottom: '4px' }}>
                  {provider.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginBottom: '8px', lineHeight: 1.4 }}>
                  {provider.description}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {provider.supportsPolling && (
                    <span className="vn-chip vn-chip-info" style={{ fontSize: '11px' }}>Polling</span>
                  )}
                  {provider.supportsWebhook && (
                    <span className="vn-chip vn-chip-info" style={{ fontSize: '11px' }}>Webhook</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            <button className="vn-btn" onClick={() => setStep(0)} style={{ background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: '18px', marginRight: '4px' }}>arrow_back</span>
              Back
            </button>
            <button className="vn-btn" disabled={!canProceedStep1} onClick={() => setStep(2)}>
              Next
              <span className="material-icons" style={{ fontSize: '18px', marginLeft: '4px' }}>arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && providerDef && (
        <div className="vn-card" style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: 'var(--on-surface)' }}>
            Configure {providerDef.name}
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
            {providerDef.fields.length > 0
              ? `Enter your ${providerDef.name} API credentials to enable tracking.`
              : `No additional configuration needed for ${providerDef.name}.`}
          </p>

          {/* Credential fields */}
          {providerDef.fields.length > 0 && (
            <div className="vn-form-grid" style={{ marginBottom: '20px' }}>
              {providerDef.fields.map(field => (
                <div key={field.key} className="vn-field">
                  <label className="vn-field-label">
                    {field.label}
                    {field.required && <span style={{ color: 'var(--color-error)' }}> *</span>}
                  </label>
                  <input
                    className="vn-input"
                    type={field.type}
                    value={credentials[field.key] || ''}
                    onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Info box */}
          {providerDef.infoText && (
            <div className="vn-alert vn-alert-info" style={{ marginBottom: '20px' }}>
              <span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'text-bottom', marginRight: '6px' }}>info</span>
              {providerDef.infoUrl ? (
                <a href={providerDef.infoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                  {providerDef.infoText}
                </a>
              ) : (
                providerDef.infoText
              )}
            </div>
          )}

          {/* Polling config */}
          {providerDef.supportsPolling && (
            <div className="vn-form-section" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600, color: 'var(--on-surface)' }}>Polling Configuration</h3>
              <div className="vn-form-grid">
                <div className="vn-field">
                  <label className="vn-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      checked={pollingEnabled}
                      onChange={e => setPollingEnabled(e.target.checked)}
                    />
                    Enable automatic polling
                  </label>
                </div>
                {pollingEnabled && (
                  <div className="vn-field">
                    <label className="vn-field-label">Polling Interval</label>
                    <select className="vn-input" value={pollingInterval} onChange={e => setPollingInterval(Number(e.target.value))}>
                      {POLLING_INTERVALS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Issue link */}
          <div style={{ marginBottom: '20px', fontSize: '13px' }}>
            <a
              href="https://github.com/dominicfinn/open_tms/issues/new?title=Carrier+Tracking+Setup+Issue"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--on-surface-variant)', textDecoration: 'underline' }}
            >
              Instructions did not work? Create an issue
            </a>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="vn-btn" onClick={() => setStep(1)} style={{ background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: '18px', marginRight: '4px' }}>arrow_back</span>
              Back
            </button>
            <button className="vn-btn" disabled={!canProceedStep2 || saving} onClick={handleCreateIntegration}>
              {saving && <span className="material-icons" style={{ fontSize: '16px', animation: 'spin 1s linear infinite', marginRight: '4px' }}>sync</span>}
              {saving ? 'Creating...' : 'Create Integration'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Test Connection */}
      {step === 3 && (
        <div className="vn-card" style={{ padding: '24px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: 'var(--on-surface)' }}>Test Connection</h2>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
            Integration created successfully. Test the connection to make sure everything is working.
          </p>

          {testResult && (
            <div
              className={`vn-alert ${testResult.success ? 'vn-alert-success' : 'vn-alert-error'}`}
              style={{ marginBottom: '20px', textAlign: 'left' }}
            >
              <span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'text-bottom', marginRight: '6px' }}>
                {testResult.success ? 'check_circle' : 'error'}
              </span>
              {testResult.message}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button className="vn-btn" onClick={handleTest} disabled={testing}>
              {testing && <span className="material-icons" style={{ fontSize: '16px', animation: 'spin 1s linear infinite', marginRight: '4px' }}>sync</span>}
              <span className="material-icons" style={{ fontSize: '18px', marginRight: '4px' }}>wifi_tethering</span>
              {testing ? 'Testing...' : testResult ? 'Retry Test' : 'Test Connection'}
            </button>
            <button className="vn-btn" onClick={() => setStep(4)} style={{ background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
              {testResult?.success ? 'Continue' : 'Skip'}
              <span className="material-icons" style={{ fontSize: '18px', marginLeft: '4px' }}>arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <div className="vn-card" style={{ padding: '40px', textAlign: 'center' }}>
          <span className="material-icons" style={{ fontSize: '56px', color: 'var(--color-success)', display: 'block', marginBottom: '16px' }}>check_circle</span>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600, color: 'var(--on-surface)' }}>All Set!</h2>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
            Carrier tracking integration for {selectedCarrier?.name} with {providerDef?.name} has been configured.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            {createdId && (
              <Link to={`/integrations/carrier-tracking/${createdId}`} className="vn-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-icons" style={{ fontSize: '18px' }}>visibility</span>
                View Integration
              </Link>
            )}
            <Link
              to="/integrations/carrier-tracking"
              className="vn-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)' }}
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>list</span>
              Back to List
            </Link>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
