import { useState, useEffect } from 'react';
import { API_URL } from '../api';

export interface OrgContext {
  organizationType: 'shipper' | 'broker' | 'carrier' | '3pl';
  mcNumber?: string | null;
  marginAlertEnabled: boolean;
  minMarginPercent?: number | null;
}

let cachedOrg: OrgContext | null = null;

export function useOrgContext() {
  const [org, setOrg] = useState<OrgContext | null>(cachedOrg);
  const [loading, setLoading] = useState(!cachedOrg);

  useEffect(() => {
    if (cachedOrg) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/organization/settings`);
        if (!res.ok) throw new Error('Failed to load org settings');
        const json = await res.json();
        const data = json.data;
        const ctx: OrgContext = {
          organizationType: data.organizationType || 'shipper',
          mcNumber: data.mcNumber,
          marginAlertEnabled: data.marginAlertEnabled || false,
          minMarginPercent: data.minMarginPercent,
        };
        cachedOrg = ctx;
        if (!cancelled) {
          setOrg(ctx);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isBroker = org?.organizationType === 'broker' || org?.organizationType === '3pl';

  return { org, loading, isBroker };
}
