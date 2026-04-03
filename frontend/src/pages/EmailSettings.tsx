import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import { useTheme } from '../ThemeProvider';

interface EmailConfig {
  emailProvider: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  emailFromAddress: string | null;
  emailFromName: string | null;
  emailEnabled: boolean;
}

export default function EmailSettings() {
  const { systemName } = useTheme();
  const [config, setConfig] = useState<EmailConfig>({
    emailProvider: 'console',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: null,
    emailFromAddress: '',
    emailFromName: '',
    emailEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/email/settings`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setConfig(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const body: any = { ...config };
      // Don't send masked password
      if (body.smtpPassword === '••••••••') delete body.smtpPassword;
      // If password is empty string, send null to clear it
      if (body.smtpPassword === '') body.smtpPassword = null;

      const res = await fetch(`${API_URL}/api/v1/email/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        setSaveResult({ type: 'error', message: data.error });
      } else {
        setSaveResult({ type: 'success', message: 'Email settings saved successfully.' });
        if (data.data) setConfig({ ...config, ...data.data, smtpPassword: config.smtpPassword });
      }
    } catch (err) {
      setSaveResult({ type: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) return;
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/email/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      if (data.error) {
        setTestResult({ type: 'error', message: data.error });
      } else {
        setTestResult({ type: 'success', message: `Test email sent! Message ID: ${data.data.messageId}` });
      }
    } catch (err) {
      setTestResult({ type: 'error', message: (err as Error).message });
    }
  };

  if (loading) {
    return <div className="loading-spinner-page"><div className="loading-spinner" /></div>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px' }}>
      <div className="page-header">
        <h1>Email Settings</h1>
        <p style={{ color: 'var(--on-surface-variant)', margin: '4px 0 0' }}>
          Configure how {systemName} sends email notifications.
        </p>
      </div>

      {/* Global enable/disable */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>Email Notifications</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--on-surface-variant)', fontSize: '14px' }}>
              When enabled, domain events will trigger email notifications to users.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={config.emailEnabled}
              onChange={(e) => setConfig({ ...config, emailEnabled: e.target.checked })}
            />
            <span className="switch-slider"></span>
          </label>
        </div>
      </div>

      {/* Provider selection */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 16px' }}>Provider</h3>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div>
            <label className="field-label">Email Provider</label>
            <select
              className="text-field"
              value={config.emailProvider}
              onChange={(e) => setConfig({ ...config, emailProvider: e.target.value })}
            >
              <option value="console">Console (development - logs to stdout)</option>
              <option value="smtp">SMTP (SendGrid, SES, Mailgun, self-hosted, etc.)</option>
            </select>
            <span className="field-hint">
              {config.emailProvider === 'console'
                ? 'Emails are logged to the worker stdout. No real emails are sent.'
                : 'Connects to an SMTP server. Works with SendGrid, AWS SES, Mailgun, or any SMTP relay.'}
            </span>
          </div>
        </div>
      </div>

      {/* SMTP settings */}
      {config.emailProvider === 'smtp' && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 16px' }}>SMTP Configuration</h3>
          <div className="form-grid">
            <div>
              <label className="field-label">SMTP Host</label>
              <input
                type="text"
                className="text-field"
                value={config.smtpHost || ''}
                onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                placeholder="smtp.sendgrid.net"
              />
              <span className="field-hint">e.g. smtp.sendgrid.net, email-smtp.us-east-1.amazonaws.com</span>
            </div>
            <div>
              <label className="field-label">SMTP Port</label>
              <input
                type="number"
                className="text-field"
                value={config.smtpPort || 587}
                onChange={(e) => setConfig({ ...config, smtpPort: Number(e.target.value) })}
              />
              <span className="field-hint">587 (STARTTLS) or 465 (SSL)</span>
            </div>
            <div>
              <label className="field-label">Username</label>
              <input
                type="text"
                className="text-field"
                value={config.smtpUser || ''}
                onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
                placeholder="apikey"
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                type="password"
                className="text-field"
                value={config.smtpPassword || ''}
                onChange={(e) => setConfig({ ...config, smtpPassword: e.target.value })}
                placeholder="Enter password or API key"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={config.smtpSecure}
                  onChange={(e) => setConfig({ ...config, smtpSecure: e.target.checked })}
                />
                <span className="switch-slider"></span>
              </label>
              <span>Use SSL/TLS (port 465)</span>
            </div>
          </div>
        </div>
      )}

      {/* From address */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 16px' }}>Sender Identity</h3>
        <div className="form-grid">
          <div>
            <label className="field-label">From Email Address</label>
            <input
              type="email"
              className="text-field"
              value={config.emailFromAddress || ''}
              onChange={(e) => setConfig({ ...config, emailFromAddress: e.target.value })}
              placeholder="noreply@yourcompany.com"
            />
          </div>
          <div>
            <label className="field-label">From Display Name</label>
            <input
              type="text"
              className="text-field"
              value={config.emailFromName || ''}
              onChange={(e) => setConfig({ ...config, emailFromName: e.target.value })}
              placeholder="Your Company TMS"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      {saveResult && (
        <div className={`alert alert-${saveResult.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '16px' }}>
          {saveResult.message}
        </div>
      )}
      <div className="form-actions" style={{ marginBottom: '24px' }}>
        <button className="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Test email */}
      <div className="card">
        <h3 style={{ margin: '0 0 16px' }}>Send Test Email</h3>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '16px' }}>
          Verify your configuration by sending a test email.
        </p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <input
            type="email"
            className="text-field"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            style={{ flex: 1 }}
          />
          <button className="button-outline" onClick={handleTest} disabled={!testEmail}>
            Send Test
          </button>
        </div>
        {testResult && (
          <div className={`alert alert-${testResult.type === 'success' ? 'success' : 'error'}`} style={{ marginTop: '12px' }}>
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
