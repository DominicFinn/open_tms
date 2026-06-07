/**
 * VNextCarrierTrackingSetup - Multi-step wizard for setting up a new carrier tracking integration.
 *
 * Steps: Select Carrier -> Select Provider -> Configure -> Test Connection -> Done
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Eye,
  Inbox,
  Info,
  List as ListIcon,
  Loader2,
  Plane,
  Repeat,
  Truck,
  Wifi,
  Pencil,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

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

interface ProviderField {
  key: string;
  label: string;
  type: 'text' | 'password';
  required: boolean;
  placeholder?: string;
}

interface ProviderDef {
  key: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  supportsWebhook: boolean;
  supportsPolling: boolean;
  fields: ProviderField[];
  infoUrl?: string;
  infoText?: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    key: 'fedex',
    name: 'FedEx',
    icon: Truck,
    description: 'Track shipments via the FedEx Track API with full status and proof of delivery.',
    supportsWebhook: true,
    supportsPolling: true,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Your FedEx API client ID' },
      { key: 'clientSecret', label: 'Client secret', type: 'password', required: true, placeholder: 'Your FedEx API client secret' },
      { key: 'accountNumber', label: 'Account number', type: 'text', required: false, placeholder: 'Optional - FedEx account number' },
    ],
    infoUrl: 'https://developer.fedex.com',
    infoText: 'Get your credentials at developer.fedex.com',
  },
  {
    key: 'ups',
    name: 'UPS',
    icon: Inbox,
    description: 'Track packages through the UPS Tracking API with detailed milestone events.',
    supportsWebhook: true,
    supportsPolling: true,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Your UPS API client ID' },
      { key: 'clientSecret', label: 'Client secret', type: 'password', required: true, placeholder: 'Your UPS API client secret' },
    ],
    infoUrl: 'https://developer.ups.com',
    infoText: 'Get your credentials at developer.ups.com',
  },
  {
    key: 'dhl',
    name: 'DHL',
    icon: Plane,
    description: 'Track DHL Express, eCommerce, and Freight shipments via the Unified Tracking API.',
    supportsWebhook: false,
    supportsPolling: true,
    fields: [
      { key: 'apiKey', label: 'API key', type: 'password', required: true, placeholder: 'Your DHL API key' },
    ],
    infoUrl: 'https://developer.dhl.com',
    infoText: 'Get your API key at developer.dhl.com',
  },
  {
    key: 'easypost',
    name: 'EasyPost',
    icon: Inbox,
    description: 'Multi-carrier tracking through EasyPost. Supports 100+ carriers with a single integration.',
    supportsWebhook: true,
    supportsPolling: true,
    fields: [
      { key: 'apiKey', label: 'API key', type: 'password', required: true, placeholder: 'Your EasyPost API key' },
    ],
    infoUrl: 'https://easypost.com/account',
    infoText: 'Get your API key at easypost.com/account',
  },
  {
    key: 'edi_214',
    name: 'EDI 214',
    icon: Repeat,
    description: 'Receive tracking updates via EDI 214 Shipment Status messages from trading partners.',
    supportsWebhook: false,
    supportsPolling: false,
    fields: [],
    infoText: 'No credentials needed. Uses your existing Trading Partner configuration.',
  },
  {
    key: 'manual',
    name: 'Manual',
    icon: Pencil,
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

const STEPS = ['Select carrier', 'Select provider', 'Configure', 'Test connection', 'Done'];

export default function VNextCarrierTrackingSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [existingIntegrations, setExistingIntegrations] = useState<ExistingIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [pollingInterval, setPollingInterval] = useState(15);
  const [saving, setSaving] = useState(false);

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
      // Defensive: the integrations endpoint historically returned an empty
      // object instead of an array when its Fastify response schema typed
      // `data` as object. Treat anything non-array as an empty list so the
      // wizard keeps working.
      setCarriers(Array.isArray(carriersJson.data) ? carriersJson.data : []);
      setExistingIntegrations(Array.isArray(integrationsJson.data) ? integrationsJson.data : []);
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
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-3 self-start">
        <Link to="/integrations/carrier-tracking">
          <ArrowLeft className="h-4 w-4" />
          Back to carrier tracking
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Set up carrier tracking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a carrier to receive automatic shipment tracking updates.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((label, idx) => (
          <React.Fragment key={label}>
            {idx > 0 && (
              <div className={cn('h-0.5 w-6 flex-shrink-0', idx <= step ? 'bg-primary' : 'bg-border')} />
            )}
            <div className={cn('flex flex-shrink-0 items-center gap-2', idx > step && 'opacity-50')}>
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                idx < step ? 'bg-success text-white' : idx === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>
                {idx < step ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span className={cn('whitespace-nowrap text-sm', idx === step && 'font-semibold')}>
                {label}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      {step === 0 && (
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Select carrier</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the carrier you want to set up tracking for. Only carriers without an existing integration are shown.
            </p>
          </div>

          {availableCarriers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-border p-8 text-center text-muted-foreground">
              <Truck className="h-10 w-10 opacity-40" />
              <p>All carriers already have tracking integrations, or no carriers exist yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Select value={selectedCarrierId} onValueChange={setSelectedCarrierId}>
                <SelectTrigger><SelectValue placeholder="Select a carrier..." /></SelectTrigger>
                <SelectContent>
                  {availableCarriers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.mcNumber ? ` (MC-${c.mcNumber})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="gradient" disabled={!canProceedStep0} onClick={() => setStep(1)}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Select provider</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose how you want to receive tracking updates for {selectedCarrier?.name || 'this carrier'}.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PROVIDERS.map(provider => {
              const Icon = provider.icon;
              const isActive = selectedProvider === provider.key;
              return (
                <button
                  key={provider.key}
                  type="button"
                  onClick={() => setSelectedProvider(provider.key)}
                  className={cn(
                    'rounded-lg border p-4 text-left transition-colors',
                    isActive ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  <Icon className={cn('mb-2 h-7 w-7', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <div className="text-sm font-semibold">{provider.name}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{provider.description}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {provider.supportsPolling && <Badge variant="info">Polling</Badge>}
                    {provider.supportsWebhook && <Badge variant="info">Webhook</Badge>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button variant="gradient" disabled={!canProceedStep1} onClick={() => setStep(2)}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && providerDef && (
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Configure {providerDef.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {providerDef.fields.length > 0
                ? `Enter your ${providerDef.name} API credentials to enable tracking.`
                : `No additional configuration needed for ${providerDef.name}.`}
            </p>
          </div>

          {providerDef.fields.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {providerDef.fields.map(field => (
                <div key={field.key} className="space-y-2">
                  <Label>
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Input
                    type={field.type}
                    value={credentials[field.key] || ''}
                    onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          )}

          {providerDef.infoText && (
            <div className="flex items-start gap-3 rounded-md border border-info/30 bg-info/10 p-3 text-sm text-info">
              <Info className="mt-0.5 h-4 w-4" />
              {providerDef.infoUrl ? (
                <a href={providerDef.infoUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {providerDef.infoText}
                </a>
              ) : (
                providerDef.infoText
              )}
            </div>
          )}

          {providerDef.supportsPolling && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Polling configuration</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pollingEnabled}
                  onChange={e => setPollingEnabled(e.target.checked)}
                />
                Enable automatic polling
              </label>
              {pollingEnabled && (
                <div className="space-y-2">
                  <Label>Polling interval</Label>
                  <Select value={String(pollingInterval)} onValueChange={v => setPollingInterval(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {POLLING_INTERVALS.map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="text-xs">
            <a
              href="https://github.com/dominicfinn/open_tms/issues/new?title=Carrier+Tracking+Setup+Issue"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline"
            >
              Instructions did not work? Create an issue
            </a>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button variant="gradient" disabled={!canProceedStep2 || saving} onClick={handleCreateIntegration}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Creating...' : 'Create integration'}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-4 p-6 text-center">
          <h2 className="text-lg font-semibold">Test connection</h2>
          <p className="text-sm text-muted-foreground">
            Integration created successfully. Test the connection to make sure everything is working.
          </p>

          {testResult && (
            <div className={cn(
              'flex items-start gap-3 rounded-md border p-3 text-sm text-left',
              testResult.success
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-destructive/30 bg-destructive/10 text-destructive',
            )}>
              {testResult.success ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <CircleAlert className="mt-0.5 h-4 w-4" />}
              {testResult.message}
            </div>
          )}

          <div className="flex justify-center gap-3">
            <Button variant="gradient" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              {testing ? 'Testing...' : testResult ? 'Retry test' : 'Test connection'}
            </Button>
            <Button variant="outline" onClick={() => setStep(4)}>
              {testResult?.success ? 'Continue' : 'Skip'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="space-y-4 p-10 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
          <h2 className="text-xl font-semibold">All set</h2>
          <p className="text-sm text-muted-foreground">
            Carrier tracking integration for {selectedCarrier?.name} with {providerDef?.name} has been configured.
          </p>
          <div className="flex justify-center gap-3">
            {createdId && (
              <Button variant="gradient" asChild>
                <Link to={`/integrations/carrier-tracking/${createdId}`}>
                  <Eye className="h-4 w-4" />
                  View integration
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/integrations/carrier-tracking">
                <ListIcon className="h-4 w-4" />
                Back to list
              </Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
