import React, { useEffect, useState } from 'react';
import { Loader2, Radio } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface IotVendor {
  vendorKey: string;
  name: string;
  enabled: boolean;
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

  useEffect(() => {
    fetch(`${API_URL}/api/v1/settings/iot-vendors`)
      .then(r => r.json())
      .then(j => { if (!j.error) setVendors(j.data || []); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

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
                <li key={vendor.vendorKey} className="flex items-center justify-between gap-4 py-4">
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
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
