import React, { useState, useEffect } from 'react';
import { Loader2, Save, Send, Server, Lock, User } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border border-input bg-background accent-primary"
      />
      {label}
    </label>
  );
}

function Banner({ variant, message, onClose }: { variant: 'success' | 'error'; message: string; onClose?: () => void }) {
  const tone =
    variant === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-destructive/30 bg-destructive/10 text-destructive';
  return (
    <div className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${tone}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-xs underline opacity-70 hover:opacity-100">Dismiss</button>
      )}
    </div>
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
      if (password) body.smtpPassword = password;
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
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure email delivery for your system</p>
        </div>
      </div>

      {alert && <Banner variant={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <Card>
        <CardHeader>
          <CardTitle>Email provider</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={settings.emailProvider} onValueChange={v => handleChange('emailProvider', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="console">Console (development)</SelectItem>
                <SelectItem value="smtp">SMTP</SelectItem>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="ses">Amazon SES</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Email enabled</Label>
            <div className="pt-2">
              <Switch label="Enable email delivery" checked={settings.emailEnabled} onChange={v => handleChange('emailEnabled', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {settings.emailProvider === 'smtp' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                Server settings
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Host</Label>
                <Input value={settings.smtpHost} onChange={e => handleChange('smtpHost', e.target.value)} placeholder="smtp.example.com" />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  type="number"
                  value={settings.smtpPort}
                  onChange={e => handleChange('smtpPort', parseInt(e.target.value, 10) || 0)}
                  placeholder="587"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Secure (TLS)</Label>
                <div className="pt-1">
                  <Switch label="Use TLS connection" checked={settings.smtpSecure} onChange={v => handleChange('smtpSecure', v)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={settings.smtpUser} onChange={e => handleChange('smtpUser', e.target.value)} placeholder="user@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Leave blank to keep existing"
                />
                <p className="text-xs text-muted-foreground">Leave blank to keep current password</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Sender identity
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>From address</Label>
                <Input
                  type="email"
                  value={settings.emailFromAddress}
                  onChange={e => handleChange('emailFromAddress', e.target.value)}
                  placeholder="noreply@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>From name</Label>
                <Input value={settings.emailFromName} onChange={e => handleChange('emailFromName', e.target.value)} placeholder="Open TMS" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
        <Button variant="gradient" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save settings'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send test email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>Recipient email</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
            <Button variant="outline" onClick={handleTestEmail} disabled={sendingTest || !testEmail.trim()}>
              <Send className="h-4 w-4" />
              {sendingTest ? 'Sending...' : 'Send test'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
