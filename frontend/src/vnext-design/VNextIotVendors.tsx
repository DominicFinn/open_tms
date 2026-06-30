import React, { useEffect, useState } from 'react';
import { Loader2, Radio, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface IotVendor {
  vendorKey: string;
  name: string;
  enabled: boolean;
  hasWebhookSecret: boolean;
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export default function VNextIotVendors() {
  const [vendors, setVendors] = useState<IotVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState<Record<string, string>>({});
  const [savingSecret, setSavingSecret] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/settings/iot-vendors`)
      .then(r => r.json())
      .then(j => { if (!j.error) setVendors(j.data || []); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const saveSecret = async (vendor: IotVendor, rawValue: string) => {
    const value = rawValue.trim();
    setSavingSecret(vendor.vendorKey);
    try {
      const res = await fetch(`${API_URL}/api/v1/settings/iot-vendors/${vendor.vendorKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookSecret: value || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to save secret', { duration: 8000 });
        return;
      }
      setVendors(vs => vs.map(v => v.vendorKey === vendor.vendorKey ? { ...v, hasWebhookSecret: !!value } : v));
      setSecretInput(s => ({ ...s, [vendor.vendorKey]: '' }));
      toast.success(value ? 'Webhook secret saved' : 'Webhook secret cleared');
    } catch {
      toast.error('Failed to save secret');
    } finally {
      setSavingSecret(null);
    }
  };

  const toggle = async (vendor: IotVendor) => {
    const next = !vendor.enabled;
    setSaving(vendor.vendorKey);
    try {
      const res = await fetch(`${API_URL}/api/v1/settings/iot-vendors/${vendor.vendorKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to update vendor', { duration: 8000 });
        return;
      }
      setVendors(vs => vs.map(v => v.vendorKey === vendor.vendorKey ? { ...v, enabled: next } : v));
      toast.success(`${vendor.name} ${next ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update vendor');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">IoT Vendors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Switch IoT tracking vendors on or off. When a vendor is enabled, its devices can be added to
          shipments and its inbound webhooks are processed. When disabled, its webhooks are ignored and
          the IoT section is hidden on the shipment form.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : vendors.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No IoT vendors available.</p>
          ) : (
            <ul className="divide-y divide-border">
              {vendors.map(vendor => (
                <li key={vendor.vendorKey} className="space-y-3 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/15 text-info">
                        <Radio className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="text-sm font-medium">{vendor.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {vendor.enabled ? 'Enabled' : 'Disabled'}
                        </div>
                      </div>
                    </div>
                    <Toggle
                      checked={vendor.enabled}
                      disabled={saving === vendor.vendorKey}
                      onChange={() => toggle(vendor)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-14">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <KeyRound className="h-3.5 w-3.5" />
                      Webhook secret
                      <span className={cn('rounded px-1.5 py-0.5', vendor.hasWebhookSecret ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                        {vendor.hasWebhookSecret ? 'Configured' : 'Not set'}
                      </span>
                    </div>
                    <Input
                      type="password"
                      placeholder={vendor.hasWebhookSecret ? 'Enter a new secret to replace' : 'Paste signing secret'}
                      value={secretInput[vendor.vendorKey] ?? ''}
                      onChange={e => setSecretInput(s => ({ ...s, [vendor.vendorKey]: e.target.value }))}
                      className="h-8 w-[260px]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={savingSecret === vendor.vendorKey || (secretInput[vendor.vendorKey] ?? '').trim() === ''}
                      onClick={() => saveSecret(vendor, secretInput[vendor.vendorKey] ?? '')}
                    >
                      {savingSecret === vendor.vendorKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                    </Button>
                    {vendor.hasWebhookSecret && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={savingSecret === vendor.vendorKey}
                        onClick={() => saveSecret(vendor, '')}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
