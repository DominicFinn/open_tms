/**
 * VNextCarrierTrackingDetail - Detail page for a single carrier tracking integration.
 *
 * Two-column layout: main (connection status, recent events) + sidebar (config, credentials, actions).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface TrackingIntegration {
  id: string;
  carrierId: string;
  carrierName: string;
  providerType: string;
  status: string;
  pollingEnabled: boolean;
  pollingIntervalMinutes: number;
  webhookEnabled?: boolean;
  lastPolledAt: string | null;
  lastError: string | null;
  errorCount: number;
  callsToday?: number;
  dailyMax?: number;
  notes?: string;
  credentials?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface TrackingEvent {
  id: string;
  trackingNumber: string;
  status: string;
  location: string;
  occurredAt: string;
  source: string;
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

const EVENT_STATUS_CHIP: Record<string, string> = {
  delivered: 'vn-chip-success',
  in_transit: 'vn-chip-info',
  out_for_delivery: 'vn-chip-primary',
  exception: 'vn-chip-error',
  pending: 'vn-chip-warning',
  picked_up: 'vn-chip-info',
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function maskCredential(value: string): string {
  if (!value || value.length < 8) return '********';
  return '****' + value.slice(-4);
}

export default function VNextCarrierTrackingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [integration, setIntegration] = useState<TrackingIntegration | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [editingCredentials, setEditingCredentials] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const [intRes, eventsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`),
        fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}/events?limit=20`),
      ]);
      const intJson = await intRes.json();
      if (!intRes.ok) throw new Error(intJson.error || 'Failed to load integration');
      setIntegration(intJson.data);
      setNotes(intJson.data?.notes || '');

      if (eventsRes.ok) {
        const evJson = await eventsRes.json();
        setEvents(evJson.data || []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}/test`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: json.error || 'Test failed' });
      } else {
        setMessage({ type: 'success', text: json.data?.message || 'Connection test successful' });
        fetchDetail();
      }
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handlePoll = async () => {
    setPolling(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}/poll`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Poll failed');
      setMessage({ type: 'success', text: 'Manual poll completed' });
      fetchDetail();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setPolling(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!integration) return;
    const newStatus = integration.status === 'disabled' ? 'active' : 'disabled';
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update');
      setMessage({ type: 'success', text: `Integration ${newStatus === 'active' ? 'enabled' : 'disabled'}` });
      fetchDetail();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    }
  };

  const handleTogglePolling = async () => {
    if (!integration) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollingEnabled: !integration.pollingEnabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update');
      fetchDetail();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    }
  };

  const handleSaveNotes = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save notes');
      setEditingNotes(false);
      fetchDetail();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete');
      }
      navigate('/integrations/carrier-tracking');
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error || !integration) {
    return (
      <div style={{ padding: '24px' }}>
        <div className="vn-alert vn-alert-error">{error || 'Integration not found'}</div>
        <Link to="/integrations/carrier-tracking" style={{ color: 'var(--primary)', marginTop: '12px', display: 'inline-block' }}>
          Back to list
        </Link>
      </div>
    );
  }

  const callsPercent = integration.dailyMax
    ? Math.min(100, Math.round(((integration.callsToday || 0) / integration.dailyMax) * 100))
    : 0;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Back link */}
      <Link to="/integrations/carrier-tracking" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', textDecoration: 'none', fontSize: '14px', marginBottom: '16px' }}>
        <span className="material-icons" style={{ fontSize: '18px' }}>arrow_back</span>
        Back to Carrier Tracking
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <span className="material-icons" style={{ fontSize: '32px', color: 'var(--primary)' }}>
          {PROVIDER_ICONS[integration.providerType] || 'local_shipping'}
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--on-surface)' }}>
            {integration.carrierName}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span className="vn-chip vn-chip-info">{PROVIDER_LABELS[integration.providerType] || integration.providerType}</span>
            <span className={`vn-chip ${STATUS_CHIP[integration.status] || 'vn-chip-secondary'}`}>
              {STATUS_LABELS[integration.status] || integration.status}
            </span>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`vn-alert vn-alert-${message.type}`} style={{ marginBottom: '16px' }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="vn-detail-grid">
        {/* Main column */}
        <div className="vn-detail-main">
          {/* Connection status card */}
          <div className="vn-card" style={{ padding: '20px', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: 'var(--on-surface)' }}>
              <span className="material-icons" style={{ fontSize: '20px', verticalAlign: 'text-bottom', marginRight: '6px', color: 'var(--primary)' }}>monitor_heart</span>
              Connection Status
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginBottom: '4px' }}>Last Polled</div>
                <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--on-surface)' }}>{timeAgo(integration.lastPolledAt)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginBottom: '4px' }}>Error Count</div>
                <div style={{ fontSize: '15px', fontWeight: 500, color: integration.errorCount > 0 ? 'var(--color-error)' : 'var(--on-surface)' }}>
                  {integration.errorCount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginBottom: '4px' }}>Created</div>
                <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--on-surface)' }}>{formatDate(integration.createdAt)}</div>
              </div>
            </div>

            {/* Last error */}
            {integration.lastError && (
              <div className="vn-alert vn-alert-error" style={{ marginTop: '16px' }}>
                <span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'text-bottom', marginRight: '6px' }}>error</span>
                {integration.lastError}
              </div>
            )}

            {/* Rate limit */}
            {integration.dailyMax && integration.dailyMax > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--on-surface-variant)', marginBottom: '6px' }}>
                  <span>API Usage Today</span>
                  <span>{integration.callsToday || 0} / {integration.dailyMax}</span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface-container)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${callsPercent}%`,
                    borderRadius: '4px',
                    background: callsPercent > 80 ? 'var(--color-error)' : callsPercent > 50 ? 'var(--color-warning)' : 'var(--color-success)',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Manual poll button */}
            <div style={{ marginTop: '16px' }}>
              <button className="vn-btn" onClick={handlePoll} disabled={polling} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {polling ? (
                  <span className="material-icons" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>sync</span>
                ) : (
                  <span className="material-icons" style={{ fontSize: '18px' }}>refresh</span>
                )}
                {polling ? 'Polling...' : 'Poll Now'}
              </button>
            </div>
          </div>

          {/* Recent tracking events */}
          <div className="vn-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: 'var(--on-surface)' }}>
              <span className="material-icons" style={{ fontSize: '20px', verticalAlign: 'text-bottom', marginRight: '6px', color: 'var(--primary)' }}>timeline</span>
              Recent Tracking Events
            </h3>

            {events.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--on-surface-variant)', border: '2px dashed var(--outline-variant)', borderRadius: '8px' }}>
                <span className="material-icons" style={{ fontSize: '36px', display: 'block', marginBottom: '8px', opacity: 0.4 }}>event_note</span>
                <p style={{ margin: 0 }}>No tracking events yet. Events will appear here once shipments are tracked.</p>
              </div>
            ) : (
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr>
                      <th>Tracking Number</th>
                      <th>Status</th>
                      <th>Location</th>
                      <th>Occurred</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(event => (
                      <tr key={event.id}>
                        <td>
                          <span className="vn-table-id">{event.trackingNumber}</span>
                        </td>
                        <td>
                          <span className={`vn-chip ${EVENT_STATUS_CHIP[event.status] || 'vn-chip-secondary'}`}>
                            {event.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <span className="vn-table-secondary">{event.location || '-'}</span>
                        </td>
                        <td>
                          <span className="vn-table-secondary">{formatDate(event.occurredAt)}</span>
                        </td>
                        <td>
                          <span className="vn-table-secondary">{event.source}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="vn-detail-sidebar">
          {/* Config card */}
          <div className="vn-card" style={{ padding: '16px', marginBottom: '12px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)' }}>Configuration</h4>
            <div style={{ fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--outline-variant)' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>Provider</span>
                <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{PROVIDER_LABELS[integration.providerType] || integration.providerType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--outline-variant)' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>Polling</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={integration.pollingEnabled} onChange={handleTogglePolling} />
                  <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{integration.pollingEnabled ? 'Enabled' : 'Disabled'}</span>
                </label>
              </div>
              {integration.pollingEnabled && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--outline-variant)' }}>
                  <span style={{ color: 'var(--on-surface-variant)' }}>Interval</span>
                  <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{integration.pollingIntervalMinutes} min</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>Webhook</span>
                <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{integration.webhookEnabled ? 'Active' : 'Not configured'}</span>
              </div>
            </div>
          </div>

          {/* Credentials card */}
          {integration.credentials && Object.keys(integration.credentials).length > 0 && (
            <div className="vn-card" style={{ padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)' }}>Credentials</h4>
                <button
                  className="icon-btn"
                  title="Edit credentials"
                  onClick={() => setEditingCredentials(!editingCredentials)}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>{editingCredentials ? 'close' : 'edit'}</span>
                </button>
              </div>
              <div style={{ fontSize: '13px' }}>
                {Object.entries(integration.credentials).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--outline-variant)' }}>
                    <span style={{ color: 'var(--on-surface-variant)' }}>{key}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--on-surface)' }}>
                      {editingCredentials ? value : maskCredential(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions card */}
          <div className="vn-card" style={{ padding: '16px', marginBottom: '12px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)' }}>Actions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="vn-btn" onClick={handleTest} disabled={testing} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {testing ? (
                  <span className="material-icons" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>sync</span>
                ) : (
                  <span className="material-icons" style={{ fontSize: '18px' }}>wifi_tethering</span>
                )}
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                className="vn-btn"
                onClick={handleToggleStatus}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)',
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  {integration.status === 'disabled' ? 'play_arrow' : 'pause'}
                </span>
                {integration.status === 'disabled' ? 'Enable' : 'Disable'}
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--color-error)', color: 'var(--color-error)',
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>delete</span>
                Delete Integration
              </button>
            </div>
          </div>

          {/* Notes card */}
          <div className="vn-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)' }}>Notes</h4>
              {!editingNotes && (
                <button className="icon-btn" title="Edit notes" onClick={() => setEditingNotes(true)}>
                  <span className="material-icons" style={{ fontSize: '16px' }}>edit</span>
                </button>
              )}
            </div>
            {editingNotes ? (
              <div>
                <textarea
                  className="vn-input"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes about this integration..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }}>
                  <button
                    className="vn-btn"
                    onClick={() => { setEditingNotes(false); setNotes(integration.notes || ''); }}
                    style={{ background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)', fontSize: '13px', padding: '4px 12px' }}
                  >
                    Cancel
                  </button>
                  <button className="vn-btn" onClick={handleSaveNotes} style={{ fontSize: '13px', padding: '4px 12px' }}>
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: integration.notes ? 'var(--on-surface)' : 'var(--on-surface-variant)', whiteSpace: 'pre-wrap' }}>
                {integration.notes || 'No notes.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="vn-modal-backdrop" onClick={() => setShowDeleteConfirm(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="vn-modal-header">
              <h2 style={{ margin: 0, fontSize: '18px' }}>Delete Integration</h2>
            </div>
            <div className="vn-modal-body">
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--on-surface-variant)' }}>
                Are you sure you want to delete the tracking integration for <strong>{integration.carrierName}</strong>?
                This will stop all tracking updates from this carrier. This action cannot be undone.
              </p>
            </div>
            <div className="vn-modal-footer">
              <button
                className="vn-btn"
                style={{ background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)' }}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="vn-btn"
                style={{ background: 'var(--color-error)', color: 'var(--on-primary)' }}
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
