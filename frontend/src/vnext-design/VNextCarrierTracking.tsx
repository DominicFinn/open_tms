/**
 * VNextCarrierTracking - List page for carrier tracking integrations.
 * Shows all configured integrations with filtering by provider and status.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface CarrierTrackingIntegration {
  id: string;
  carrierId: string;
  carrierName: string;
  providerType: string;
  status: string;
  pollingEnabled: boolean;
  pollingIntervalMinutes: number;
  lastPolledAt: string | null;
  lastError: string | null;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  fedex: 'FedEx',
  ups: 'UPS',
  dhl: 'DHL',
  easypost: 'EasyPost',
  edi_214: 'EDI 214',
  manual: 'Manual',
};

const PROVIDER_ICONS: Record<string, string> = {
  fedex: 'local_shipping',
  ups: 'inventory_2',
  dhl: 'flight',
  easypost: 'all_inbox',
  edi_214: 'swap_horiz',
  manual: 'edit_note',
};

const STATUS_CHIP: Record<string, string> = {
  active: 'vn-chip-success',
  pending_setup: 'vn-chip-warning',
  error: 'vn-chip-error',
  disabled: 'vn-chip-secondary',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending_setup: 'Pending Setup',
  error: 'Error',
  disabled: 'Disabled',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function VNextCarrierTracking() {
  const [integrations, setIntegrations] = useState<CarrierTrackingIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load integrations');
      setIntegrations(json.data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  const handleDelete = async (id: string, carrierName: string) => {
    if (!confirm(`Delete tracking integration for ${carrierName}? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete');
      }
      setIntegrations(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}/test`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Test failed');
      alert(json.data?.message || 'Connection test successful');
      fetchIntegrations();
    } catch (err) {
      alert(`Test failed: ${(err as Error).message}`);
    }
  };

  const filtered = integrations.filter(i => {
    if (providerFilter && i.providerType !== providerFilter) return false;
    if (statusFilter && i.status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--on-surface)' }}>
            Carrier Tracking Integrations
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
            {integrations.length} integration{integrations.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Link to="/integrations/carrier-tracking/setup" className="vn-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
          Add Integration
        </Link>
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

      {/* Filters */}
      <div className="vn-filters" style={{ marginBottom: '16px' }}>
        <select
          className="vn-filter-select"
          value={providerFilter}
          onChange={e => setProviderFilter(e.target.value)}
        >
          <option value="">All Providers</option>
          {Object.entries(PROVIDER_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          className="vn-filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--on-surface-variant)', border: '2px dashed var(--outline-variant)', borderRadius: '8px' }}>
          <span className="material-icons" style={{ fontSize: '48px', display: 'block', marginBottom: '8px', opacity: 0.4 }}>gps_off</span>
          {integrations.length === 0 ? (
            <>
              <p style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 500 }}>No tracking integrations yet</p>
              <p style={{ margin: 0, fontSize: '14px' }}>Set up a carrier tracking integration to start receiving real-time shipment updates.</p>
              <Link to="/integrations/carrier-tracking/setup" className="vn-btn" style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
                Add Integration
              </Link>
            </>
          ) : (
            <p style={{ margin: 0 }}>No integrations match the current filters.</p>
          )}
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Carrier</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Last Polled</th>
                <th>Errors</th>
                <th style={{ width: '140px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(integration => (
                <tr key={integration.id}>
                  <td>
                    <Link to={`/integrations/carrier-tracking/${integration.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {integration.carrierName}
                    </Link>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-icons" style={{ fontSize: '18px', color: 'var(--primary)' }}>
                        {PROVIDER_ICONS[integration.providerType] || 'local_shipping'}
                      </span>
                      <span>{PROVIDER_LABELS[integration.providerType] || integration.providerType}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`vn-chip ${STATUS_CHIP[integration.status] || 'vn-chip-secondary'}`}>
                      {STATUS_LABELS[integration.status] || integration.status}
                    </span>
                  </td>
                  <td>
                    <span className="vn-table-secondary">{timeAgo(integration.lastPolledAt)}</span>
                  </td>
                  <td>
                    {integration.errorCount > 0 ? (
                      <span style={{ color: 'var(--color-error)', fontWeight: 500 }}>{integration.errorCount}</span>
                    ) : (
                      <span className="vn-table-secondary">0</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <Link
                        to={`/integrations/carrier-tracking/${integration.id}`}
                        className="icon-btn"
                        title="View details"
                      >
                        <span className="material-icons" style={{ fontSize: '18px' }}>visibility</span>
                      </Link>
                      <button
                        className="icon-btn"
                        title="Test connection"
                        onClick={() => handleTest(integration.id)}
                      >
                        <span className="material-icons" style={{ fontSize: '18px' }}>wifi_tethering</span>
                      </button>
                      <button
                        className="icon-btn"
                        title="Delete"
                        onClick={() => handleDelete(integration.id, integration.carrierName)}
                        disabled={deleting === integration.id}
                        style={{ color: 'var(--color-error)' }}
                      >
                        <span className="material-icons" style={{ fontSize: '18px' }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
