import { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface MapsSettings {
  hasKey: boolean;
  maskedKey: string | null;
}

export default function VNextMapsSettings() {
  const [settings, setSettings] = useState<MapsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newKey, setNewKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/maps/settings`);
      if (!res.ok) throw new Error('Failed to load maps settings');
      const json = await res.json();
      setSettings(json.data || { hasKey: false, maskedKey: null });
    } catch (e: any) {
      setError(e.message || 'Failed to load maps settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveKey() {
    if (!newKey.trim()) {
      setError('API key is required');
      return;
    }
    setSavingKey(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/v1/maps/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleMapsApiKey: newKey.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to save API key');
      }
      setSuccess('Google Maps API key saved successfully');
      setNewKey('');
      setShowKeyInput(false);
      setTestResult(null);
      await loadSettings();
    } catch (e: any) {
      setError(e.message || 'Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/maps/test`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setTestResult({ ok: false, message: json.error || 'Connection test failed' });
      } else {
        setTestResult({ ok: true, message: 'Connection successful! Google Maps API is working.' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  const hasKey = settings?.hasKey || false;
  const provider = hasKey ? 'Google Maps' : 'OpenStreetMap (Nominatim)';

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Maps Settings</h1>
          <p>Configure geocoding and mapping provider</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="vn-btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setError('')}>
            <span className="material-icons" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {success}
          <button className="vn-btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setSuccess('')}>
            <span className="material-icons" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className={`vn-stat-icon ${hasKey ? 'success' : 'warning'}`}>
            <span className="material-icons">map</span>
          </div>
          <div>
            <div className="vn-stat-value" style={{ fontSize: 20 }}>{provider}</div>
            <div className="vn-stat-label">Active Provider</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className={`vn-stat-icon ${hasKey ? 'success' : 'error'}`}>
            <span className="material-icons">vpn_key</span>
          </div>
          <div>
            <div className="vn-stat-value" style={{ fontSize: 20 }}>{hasKey ? 'Configured' : 'Not Set'}</div>
            <div className="vn-stat-label">API Key Status</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* API Key Card */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Google Maps API Key</h2>
          </div>
          <div className="vn-card-body">
            {hasKey && !showKeyInput ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span className="material-icons" style={{ fontSize: 20, color: 'var(--success)' }}>check_circle</span>
                  <span style={{ fontSize: 14, color: 'var(--on-surface)' }}>API key is configured</span>
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  background: 'var(--surface-container)',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: 'var(--border-radius-sm)',
                  padding: '10px 14px',
                  color: 'var(--on-surface-variant)',
                  marginBottom: 16,
                }}>
                  {settings?.maskedKey || '****...****'}
                </div>
                <button className="vn-btn vn-btn-outline" onClick={() => setShowKeyInput(true)}>
                  <span className="material-icons">edit</span>
                  Update Key
                </button>
              </div>
            ) : (
              <div>
                {!hasKey && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span className="material-icons" style={{ fontSize: 20, color: 'var(--warning)' }}>warning</span>
                    <span style={{ fontSize: 14, color: 'var(--on-surface-variant)' }}>
                      No API key configured. Using OpenStreetMap (Nominatim) as fallback.
                    </span>
                  </div>
                )}
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', marginBottom: 4 }}>
                  API Key
                </label>
                <input
                  className="vn-input"
                  type="password"
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  placeholder="Enter your Google Maps API key"
                  style={{ width: '100%', marginBottom: 12 }}
                  onKeyDown={e => e.key === 'Enter' && saveKey()}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="vn-btn vn-btn-primary" onClick={saveKey} disabled={savingKey || !newKey.trim()}>
                    <span className="material-icons">save</span>
                    {savingKey ? 'Saving...' : 'Save Key'}
                  </button>
                  {showKeyInput && (
                    <button className="vn-btn vn-btn-outline" onClick={() => { setShowKeyInput(false); setNewKey(''); }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Test Connection Card */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Test Connection</h2>
          </div>
          <div className="vn-card-body">
            <p style={{ fontSize: 14, color: 'var(--on-surface-variant)', marginBottom: 16 }}>
              Verify that the Google Maps API key is valid and the geocoding service is reachable.
            </p>
            <button
              className="vn-btn vn-btn-outline"
              onClick={testConnection}
              disabled={testing}
              style={{ marginBottom: 16 }}
            >
              <span className="material-icons">{testing ? 'hourglass_empty' : 'science'}</span>
              {testing ? 'Testing...' : 'Run Test'}
            </button>
            {testResult && (
              <div className={`alert ${testResult.ok ? 'alert-success' : 'alert-error'}`}>
                <span className="material-icons" style={{ fontSize: 20 }}>
                  {testResult.ok ? 'check_circle' : 'error'}
                </span>
                {testResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Current Provider Card */}
      <div className="vn-card">
        <div className="vn-card-header">
          <h2>Current Provider</h2>
        </div>
        <div className="vn-card-body">
          <div style={{ display: 'flex', gap: 24 }}>
            {/* Google Maps */}
            <div style={{
              flex: 1,
              border: `2px solid ${hasKey ? 'var(--primary)' : 'var(--outline-variant)'}`,
              borderRadius: 'var(--border-radius-md)',
              padding: 20,
              position: 'relative',
            }}>
              {hasKey && (
                <span className="vn-chip success" style={{ position: 'absolute', top: 12, right: 12 }}>
                  Active
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span className="material-icons" style={{
                  fontSize: 32,
                  color: hasKey ? 'var(--primary)' : 'var(--on-surface-variant)',
                }}>
                  map
                </span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--on-surface)' }}>Google Maps</div>
                  <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>Premium geocoding and maps</div>
                </div>
              </div>
              <ul style={{ fontSize: 13, color: 'var(--on-surface-variant)', margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                <li>High-accuracy geocoding</li>
                <li>Interactive map tiles</li>
                <li>Route optimization</li>
                <li>Requires API key</li>
              </ul>
            </div>

            {/* OpenStreetMap */}
            <div style={{
              flex: 1,
              border: `2px solid ${!hasKey ? 'var(--primary)' : 'var(--outline-variant)'}`,
              borderRadius: 'var(--border-radius-md)',
              padding: 20,
              position: 'relative',
            }}>
              {!hasKey && (
                <span className="vn-chip warning" style={{ position: 'absolute', top: 12, right: 12 }}>
                  Fallback
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span className="material-icons" style={{
                  fontSize: 32,
                  color: !hasKey ? 'var(--primary)' : 'var(--on-surface-variant)',
                }}>
                  public
                </span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--on-surface)' }}>OpenStreetMap (Nominatim)</div>
                  <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>Free geocoding fallback</div>
                </div>
              </div>
              <ul style={{ fontSize: 13, color: 'var(--on-surface-variant)', margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                <li>Free to use</li>
                <li>Basic geocoding</li>
                <li>Rate-limited</li>
                <li>No API key needed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
