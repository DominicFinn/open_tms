import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

export default function MapsSettings() {
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/maps/settings`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          setHasKey(res.data.hasKey);
          setMaskedKey(res.data.maskedKey);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/maps/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleMapsApiKey: apiKey || null }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ type: 'error', text: data.error });
      } else {
        setHasKey(data.data.hasKey);
        setMaskedKey(data.data.maskedKey);
        setApiKey('');
        setMessage({ type: 'success', text: 'Maps settings saved. Reload the page to use the new key.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/maps/test`, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setMessage({ type: 'error', text: data.error });
      } else {
        setMessage({ type: 'success', text: data.data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await fetch(`${API_URL}/api/v1/maps/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleMapsApiKey: null }),
      });
      setHasKey(false);
      setMaskedKey(null);
      setApiKey('');
      setMessage({ type: 'success', text: 'API key removed. Maps will use OpenStreetMap fallback.' });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner-page"><div className="loading-spinner" /></div>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px' }}>
      <div className="page-header">
        <h1>Maps & Geocoding</h1>
        <p style={{ color: 'var(--on-surface-variant)', margin: '4px 0 0' }}>
          Configure map providers for location search and geocoding.
        </p>
      </div>

      {/* Status Card */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span className="material-icons" style={{ fontSize: '32px', color: hasKey ? 'var(--color-success)' : 'var(--on-surface-variant)' }}>
            {hasKey ? 'check_circle' : 'map'}
          </span>
          <div>
            <h3 style={{ margin: 0 }}>
              {hasKey ? 'Google Maps Active' : 'OpenStreetMap (Fallback)'}
            </h3>
            <p style={{ margin: '2px 0 0', color: 'var(--on-surface-variant)', fontSize: '14px' }}>
              {hasKey
                ? `Using Google Maps API. Key: ${maskedKey}`
                : 'No Google Maps API key configured. Using free OpenStreetMap + Nominatim for geocoding.'}
            </p>
          </div>
        </div>
        {hasKey && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="button-outline" onClick={handleTest} disabled={testing}>
              {testing ? 'Testing...' : 'Test API Key'}
            </button>
            <button className="button button-danger" onClick={handleRemove} disabled={saving}>
              Remove Key
            </button>
          </div>
        )}
      </div>

      {/* API Key Input */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px' }}>
          {hasKey ? 'Replace API Key' : 'Add Google Maps API Key'}
        </h3>
        <div className="text-field" style={{ marginBottom: '12px' }}>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder=" "
          />
          <label>Google Maps API Key</label>
        </div>
        <button className="button" onClick={handleSave} disabled={saving || !apiKey.trim()}>
          {saving ? 'Saving...' : 'Save API Key'}
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '16px' }}>
          {message.text}
        </div>
      )}

      {/* Info Card */}
      <div className="card" style={{ backgroundColor: 'var(--info-container)', color: 'var(--on-info-container)' }}>
        <h3 style={{ margin: '0 0 8px' }}>
          <span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '4px' }}>info</span>
          Google Maps Setup Guide
        </h3>
        <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
          <li>Go to the <a href="https://console.cloud.google.com/apis" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
          <li>Enable these APIs: <strong>Maps JavaScript API</strong>, <strong>Places API</strong>, <strong>Geocoding API</strong></li>
          <li>Create an API key under <strong>Credentials</strong></li>
          <li>Set <strong>HTTP referrer restrictions</strong> to your domain for security</li>
          <li>Paste the key above and click "Test API Key" to verify</li>
        </ol>
        <p style={{ margin: '12px 0 0', fontSize: '13px' }}>
          Without a Google Maps key, the system will use OpenStreetMap with Nominatim geocoding (free, no API key required, 1-second rate limit on searches).
        </p>
      </div>
    </div>
  );
}
