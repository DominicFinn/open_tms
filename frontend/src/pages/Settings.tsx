import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface OrganizationSettings {
  id: string;
  name: string;
  trackingMode: 'group' | 'item';
  trackableUnitType: 'pallet' | 'tote' | 'box' | 'stillage' | 'custom';
  customUnitName?: string;
  weightUnit?: 'kg' | 'lb';
  dimUnit?: 'cm' | 'in';
  createdAt: string;
  updatedAt: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [trackingMode, setTrackingMode] = useState<'group' | 'item'>('item');
  const [trackableUnitType, setTrackableUnitType] = useState<'pallet' | 'tote' | 'box' | 'stillage' | 'custom'>('box');
  const [customUnitName, setCustomUnitName] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [dimUnit, setDimUnit] = useState<'cm' | 'in'>('cm');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/organization/settings`);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();

      if (result.data) {
        setSettings(result.data);
        setName(result.data.name || '');
        setTrackingMode(result.data.trackingMode || 'item');
        setTrackableUnitType(result.data.trackableUnitType || 'box');
        setCustomUnitName(result.data.customUnitName || '');
        setWeightUnit(result.data.weightUnit || 'kg');
        setDimUnit(result.data.dimUnit || 'cm');
      } else {
        // If no data but successful response, use defaults
        setWeightUnit('kg');
        setDimUnit('cm');
      }
    } catch (err: any) {
      const errorMessage = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')
        ? 'Cannot connect to the server. Please make sure the backend is running on ' + API_URL
        : err.message || 'Failed to load settings';
      setError(errorMessage);
      console.error('Failed to load settings:', err);
      // Still allow editing with defaults even if load fails
      setWeightUnit('kg');
      setDimUnit('cm');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (trackableUnitType === 'custom' && !customUnitName.trim()) {
      setError('Please enter a custom unit name');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updateData: any = {
        name,
        trackingMode,
        trackableUnitType,
        weightUnit,
        dimUnit
      };

      if (trackableUnitType === 'custom') {
        updateData.customUnitName = customUnitName;
      }

      const response = await fetch(`${API_URL}/api/v1/organization/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save settings');
      }

      setSettings(result.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const getUnitTypeOptions = () => {
    if (trackingMode === 'group') {
      return [
        { value: 'pallet', label: 'Pallet' },
        { value: 'tote', label: 'Tote' },
        { value: 'custom', label: 'Custom (specify below)' }
      ];
    } else {
      return [
        { value: 'box', label: 'Box' },
        { value: 'stillage', label: 'Stillage' },
        { value: 'custom', label: 'Custom (specify below)' }
      ];
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Organization Settings</h2>
        <p style={{ color: 'var(--color-grey)', marginBottom: 'var(--spacing-3)' }}>
          Configure how your organization tracks inventory within orders
        </p>

        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>
            <div className="loading-spinner"></div>
            <p>Loading settings...</p>
          </div>
        )}

        {!loading && (
          <form onSubmit={handleSave} className="form-grid">
            {error && (
              <div className="alert alert-error" style={{ gridColumn: '1 / -1' }}>
                <span className="material-icons">error</span>
                {error}
              </div>
            )}

            {success && (
              <div className="alert alert-success" style={{ gridColumn: '1 / -1' }}>
                <span className="material-icons">check_circle</span>
                Settings saved successfully!
              </div>
            )}

            <h3 style={{ gridColumn: '1 / -1', marginTop: 0 }}>General</h3>

            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                required
              />
              <label>Organization Name</label>
            </div>

            <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-2)' }}>Inventory Tracking Configuration</h3>

            <div style={{
              gridColumn: '1 / -1',
              padding: 'var(--spacing-2)',
              backgroundColor: 'var(--color-surface-variant)',
              borderRadius: '8px',
              marginBottom: 'var(--spacing-2)'
            }}>
              <h4 style={{ marginTop: 0 }}>What is the Lowest Trackable Unit?</h4>
              <p style={{ color: 'var(--color-grey)', fontSize: '14px', marginBottom: 'var(--spacing-2)' }}>
                This setting determines the smallest unit of inventory that the system will track within orders.
                Each order will contain one or more of these trackable units.
              </p>

              <div style={{
                padding: 'var(--spacing-2)',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid var(--color-border)'
              }}>
                <strong>Example Hierarchy:</strong>
                <ul style={{ marginTop: 'var(--spacing-1)', paddingLeft: '20px' }}>
                  <li>Order #12345</li>
                  <li style={{ marginLeft: '20px' }}>→ Trackable Unit (e.g., Pallet #1, Box #1)</li>
                  <li style={{ marginLeft: '40px' }}>→ Contains Line Items (individual products)</li>
                </ul>
              </div>
            </div>

            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
              <select
                value={trackingMode}
                onChange={(e) => {
                  setTrackingMode(e.target.value as 'group' | 'item');
                  // Reset unit type when mode changes
                  setTrackableUnitType(e.target.value === 'group' ? 'pallet' : 'box');
                }}
                className="input"
                required
              >
                <option value="group">Group Level Tracking (Pallets, Totes, etc.)</option>
                <option value="item">Item Level Tracking (Boxes, Stillages, etc.)</option>
              </select>
              <label>Tracking Mode</label>
            </div>

            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
              <select
                value={trackableUnitType}
                onChange={(e) => setTrackableUnitType(e.target.value as any)}
                className="input"
                required
              >
                {getUnitTypeOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label>Trackable Unit Type</label>
            </div>

            {trackableUnitType === 'custom' && (
              <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
                <input
                  type="text"
                  value={customUnitName}
                  onChange={(e) => setCustomUnitName(e.target.value)}
                  className="input"
                  required
                  placeholder="e.g., Container, Crate, Bundle"
                />
                <label>Custom Unit Name</label>
              </div>
            )}

            <h3 style={{ gridColumn: '1 / -1', marginTop: 'var(--spacing-3)' }}>Unit of Measure</h3>

            <div style={{
              gridColumn: '1 / -1',
              padding: 'var(--spacing-2)',
              backgroundColor: 'var(--color-surface-variant)',
              borderRadius: '8px',
              marginBottom: 'var(--spacing-2)'
            }}>
              <p style={{ color: 'var(--color-grey)', fontSize: '14px', margin: 0 }}>
                These settings define the default units used when entering weight and dimensions for line items in orders.
                Users can override these defaults on individual items if needed.
              </p>
            </div>

            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
              <select
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value as 'kg' | 'lb')}
                className="input"
                required
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="lb">Pounds (lb)</option>
              </select>
              <label>Default Weight Unit</label>
            </div>

            <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
              <select
                value={dimUnit}
                onChange={(e) => setDimUnit(e.target.value as 'cm' | 'in')}
                className="input"
                required
              >
                <option value="cm">Centimeters (cm)</option>
                <option value="in">Inches (in)</option>
              </select>
              <label>Default Dimension Unit</label>
            </div>

            <div style={{
              gridColumn: '1 / -1',
              padding: 'var(--spacing-2)',
              backgroundColor: 'var(--color-warning-bg)',
              borderLeft: '4px solid var(--color-warning)',
              borderRadius: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--spacing-1)' }}>
                <span className="material-icons" style={{ color: 'var(--color-warning)' }}>warning</span>
                <div>
                  <strong>Important:</strong> Changing these settings will affect how new orders are created.
                  Existing orders will retain their current unit configuration.
                </div>
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end', marginTop: 'var(--spacing-2)' }}>
              <button type="button" onClick={loadSettings} className="button button-outline" disabled={saving}>
                Reset
              </button>
              <button type="submit" className="button" disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Current Configuration Summary */}
      {!loading && settings && (
        <div className="card" style={{ marginTop: 'var(--spacing-2)' }}>
          <h3>Current Configuration Summary</h3>
          <div style={{ display: 'grid', gap: 'var(--spacing-2)' }}>
            <div>
              <strong>Tracking Mode:</strong>{' '}
              <span style={{ color: 'var(--color-primary)' }}>
                {trackingMode === 'group' ? 'Group Level' : 'Item Level'}
              </span>
            </div>
            <div>
              <strong>Trackable Unit Type:</strong>{' '}
              <span style={{ color: 'var(--color-primary)' }}>
                {trackableUnitType === 'custom'
                  ? customUnitName || 'Custom (not specified)'
                  : trackableUnitType.charAt(0).toUpperCase() + trackableUnitType.slice(1)
                }
              </span>
            </div>
            <div>
              <strong>Default Weight Unit:</strong>{' '}
              <span style={{ color: 'var(--color-primary)' }}>
                {weightUnit === 'kg' ? 'Kilograms (kg)' : 'Pounds (lb)'}
              </span>
            </div>
            <div>
              <strong>Default Dimension Unit:</strong>{' '}
              <span style={{ color: 'var(--color-primary)' }}>
                {dimUnit === 'cm' ? 'Centimeters (cm)' : 'Inches (in)'}
              </span>
            </div>
            <div style={{
              padding: 'var(--spacing-2)',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <strong>This means:</strong> When creating orders, users will add one or more{' '}
              <strong>
                {trackableUnitType === 'custom'
                  ? (customUnitName || 'units')
                  : trackableUnitType + 's'
                }
              </strong>{' '}
              to each order, and each unit will contain line items (products).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
