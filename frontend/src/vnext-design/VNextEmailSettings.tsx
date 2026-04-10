import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import {
  VnPageHeader,
  VnCard,
  VnButton,
  VnField,
  VnInput,
  VnSelect,
  VnFormGrid,
  VnFormSection,
  VnFormActions,
  VnAlert,
} from './components';

interface EmailSettings {
  emailProvider: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  emailFromAddress: string;
  emailFromName: string;
  emailEnabled: boolean;
}

const EMPTY_SETTINGS: EmailSettings = {
  emailProvider: 'console',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  emailFromAddress: '',
  emailFromName: '',
  emailEnabled: false,
};

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="vn-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="vn-switch-track" />
      {label}
    </label>
  );
}

export default function VNextEmailSettings() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<EmailSettings>(EMPTY_SETTINGS);
  const [original, setOriginal] = useState<EmailSettings>(EMPTY_SETTINGS);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/email/settings`);
      if (!res.ok) throw new Error('Failed to load email settings');
      const json = await res.json();
      const data = json.data || EMPTY_SETTINGS;
      setSettings(data);
      setOriginal(data);
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to load email settings' });
    } finally {
      setLoading(false);
    }
  }

  function handleChange<K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function handleCancel() {
    setSettings(original);
    setPassword('');
    setAlert(null);
  }

  async function handleSave() {
    setSaving(true);
    setAlert(null);
    try {
      const body: any = { ...settings };
      if (password) {
        body.smtpPassword = password;
      }
      const res = await fetch(`${API_URL}/api/v1/email/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save email settings');
      setAlert({ type: 'success', message: 'Email settings saved successfully.' });
      setPassword('');
      await loadSettings();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to save email settings' });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    if (!testEmail.trim()) return;
    setSendingTest(true);
    setAlert(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/email/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to send test email');
      }
      setAlert({ type: 'success', message: `Test email sent to ${testEmail.trim()}.` });
      setTestEmail('');
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to send test email' });
    } finally {
      setSendingTest(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="vn-page">
      <VnPageHeader title="Email Settings" subtitle="Configure email delivery for your system" />

      <nav style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginBottom: '24px' }}>
        <span style={{ cursor: 'pointer', color: 'var(--primary)' }}>Settings</span>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Email</span>
      </nav>

      {alert && (
        <div style={{ marginBottom: '16px' }}>
          <VnAlert variant={alert.type} onClose={() => setAlert(null)}>
            {alert.message}
          </VnAlert>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <VnCard title="Email Provider">
          <VnFormGrid>
            <VnField label="Provider">
              <VnSelect
                value={settings.emailProvider}
                onChange={e => handleChange('emailProvider', e.target.value)}
              >
                <option value="console">Console (development)</option>
                <option value="smtp">SMTP</option>
                <option value="sendgrid">SendGrid</option>
                <option value="ses">Amazon SES</option>
              </VnSelect>
            </VnField>
            <VnField label="Email Enabled">
              <div style={{ marginTop: '4px' }}>
                <Switch
                  label="Enable email delivery"
                  checked={settings.emailEnabled}
                  onChange={v => handleChange('emailEnabled', v)}
                />
              </div>
            </VnField>
          </VnFormGrid>
        </VnCard>

        {settings.emailProvider === 'smtp' && (
          <VnCard title="SMTP Configuration">
            <VnFormSection title="Server Settings" icon="dns">
              <VnFormGrid>
                <VnField label="Host" required>
                  <VnInput
                    value={settings.smtpHost}
                    onChange={e => handleChange('smtpHost', e.target.value)}
                    placeholder="smtp.example.com"
                  />
                </VnField>
                <VnField label="Port" required>
                  <VnInput
                    type="number"
                    value={settings.smtpPort}
                    onChange={e => handleChange('smtpPort', parseInt(e.target.value, 10) || 0)}
                    placeholder="587"
                  />
                </VnField>
                <VnField label="Secure (TLS)">
                  <div style={{ marginTop: '4px' }}>
                    <Switch
                      label="Use TLS connection"
                      checked={settings.smtpSecure}
                      onChange={v => handleChange('smtpSecure', v)}
                    />
                  </div>
                </VnField>
              </VnFormGrid>
            </VnFormSection>

            <VnFormSection title="Authentication" icon="lock">
              <VnFormGrid>
                <VnField label="Username">
                  <VnInput
                    value={settings.smtpUser}
                    onChange={e => handleChange('smtpUser', e.target.value)}
                    placeholder="user@example.com"
                  />
                </VnField>
                <VnField label="Password" hint="Leave blank to keep current password">
                  <VnInput
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Leave blank to keep existing"
                  />
                </VnField>
              </VnFormGrid>
            </VnFormSection>

            <VnFormSection title="Sender Identity" icon="person">
              <VnFormGrid>
                <VnField label="From Address" required>
                  <VnInput
                    type="email"
                    value={settings.emailFromAddress}
                    onChange={e => handleChange('emailFromAddress', e.target.value)}
                    placeholder="noreply@example.com"
                  />
                </VnField>
                <VnField label="From Name">
                  <VnInput
                    value={settings.emailFromName}
                    onChange={e => handleChange('emailFromName', e.target.value)}
                    placeholder="Open TMS"
                  />
                </VnField>
              </VnFormGrid>
            </VnFormSection>
          </VnCard>
        )}

        <VnFormActions>
          <VnButton variant="outline" onClick={handleCancel}>Cancel</VnButton>
          <VnButton variant="primary" icon="save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </VnButton>
        </VnFormActions>

        <VnCard title="Send Test Email">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <VnField label="Recipient Email" className="vn-col-span-2">
              <VnInput
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </VnField>
            <VnButton
              variant="outline"
              icon="send"
              onClick={handleTestEmail}
              disabled={sendingTest || !testEmail.trim()}
              style={{ marginBottom: '2px' }}
            >
              {sendingTest ? 'Sending...' : 'Send Test'}
            </VnButton>
          </div>
        </VnCard>
      </div>
    </div>
  );
}
