import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface Location {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  lat?: number;
  lng?: number;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface LocationCreationFormProps {
  onLocationCreated?: (location: Location) => void;
  onLocationUpdated?: (location: Location) => void;
  editingLocation?: Location | null;
  onCancel?: () => void;
}

export default function LocationCreationForm({
  onLocationCreated,
  onLocationUpdated,
  editingLocation,
  onCancel
}: LocationCreationFormProps) {
  const [name, setName] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when editing
  useEffect(() => {
    if (editingLocation) {
      setName(editingLocation.name);
      setAddress1(editingLocation.address1);
      setAddress2(editingLocation.address2 || '');
      setCity(editingLocation.city);
      setState(editingLocation.state || '');
      setPostalCode(editingLocation.postalCode || '');
      setCountry(editingLocation.country);
      setLat(editingLocation.lat?.toString() || '');
      setLng(editingLocation.lng?.toString() || '');
    } else {
      clearForm();
    }
  }, [editingLocation]);

  const clearForm = () => {
    setName('');
    setAddress1('');
    setAddress2('');
    setCity('');
    setState('');
    setPostalCode('');
    setCountry('');
    setLat('');
    setLng('');
    setError(null);
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Please enter a location name');
      return false;
    }

    if (!address1.trim()) {
      setError('Please enter address line 1');
      return false;
    }

    if (!city.trim()) {
      setError('Please enter a city');
      return false;
    }

    if (!country.trim()) {
      setError('Please enter a country');
      return false;
    }

    // Validate coordinates if provided
    if (lat && (isNaN(parseFloat(lat)) || parseFloat(lat) < -90 || parseFloat(lat) > 90)) {
      setError('Latitude must be a number between -90 and 90');
      return false;
    }

    if (lng && (isNaN(parseFloat(lng)) || parseFloat(lng) < -180 || parseFloat(lng) > 180)) {
      setError('Longitude must be a number between -180 and 180');
      return false;
    }

    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const locationData = {
        name: name.trim(),
        address1: address1.trim(),
        address2: address2.trim() || undefined,
        city: city.trim(),
        state: state.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim(),
        lat: lat ? parseFloat(lat) : undefined,
        lng: lng ? parseFloat(lng) : undefined
      };

      const url = editingLocation
        ? `${API_URL}/api/v1/locations/${editingLocation.id}`
        : `${API_URL}/api/v1/locations`;

      const method = editingLocation ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save location');
      }

      const result = await response.json();
      const savedLocation = result.data;

      if (editingLocation && onLocationUpdated) {
        onLocationUpdated(savedLocation);
        // Don't clear form for updates - let the parent handle closing
      } else if (onLocationCreated) {
        onLocationCreated(savedLocation);
        clearForm();
      }
    } catch (error) {
      console.error('Failed to save location:', error);
      setError(error instanceof Error ? error.message : 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    clearForm();
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="card">
      <h2>{editingLocation ? 'Edit Location' : 'Create New Location'}</h2>

      <form onSubmit={submit} style={{ marginBottom: 'var(--spacing-2)' }}>
        {/* Basic Information */}
        <div style={{ marginBottom: 'var(--spacing-2)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-1)', fontSize: '1.1rem' }}>
            Basic Information
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--spacing-2)'
          }}>
            <div className="text-field">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder=" "
                required
                disabled={loading}
              />
              <label>Location Name</label>
            </div>
            <div className="text-field">
              <input
                value={address1}
                onChange={e => setAddress1(e.target.value)}
                placeholder=" "
                required
                disabled={loading}
              />
              <label>Address Line 1</label>
            </div>
            <div className="text-field">
              <input
                value={address2}
                onChange={e => setAddress2(e.target.value)}
                placeholder=" "
                disabled={loading}
              />
              <label>Address Line 2 (optional)</label>
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div style={{ marginBottom: 'var(--spacing-2)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-1)', fontSize: '1.1rem' }}>
            Address Details
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 2fr',
            gap: 'var(--spacing-2)'
          }}>
            <div className="text-field">
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder=" "
                required
                disabled={loading}
              />
              <label>City</label>
            </div>
            <div className="text-field">
              <input
                value={state}
                onChange={e => setState(e.target.value)}
                placeholder=" "
                disabled={loading}
              />
              <label>State/Province</label>
            </div>
            <div className="text-field">
              <input
                value={postalCode}
                onChange={e => setPostalCode(e.target.value)}
                placeholder=" "
                disabled={loading}
              />
              <label>Postal Code</label>
            </div>
            <div className="text-field">
              <input
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder=" "
                required
                disabled={loading}
              />
              <label>Country</label>
            </div>
          </div>
        </div>

        {/* Coordinates */}
        <div style={{ marginBottom: 'var(--spacing-2)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-1)', fontSize: '1.1rem' }}>
            Coordinates (Optional)
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--spacing-2)'
          }}>
            <div className="text-field">
              <input
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder=" "
                type="number"
                step="any"
                disabled={loading}
              />
              <label>Latitude (-90 to 90)</label>
            </div>
            <div className="text-field">
              <input
                value={lng}
                onChange={e => setLng(e.target.value)}
                placeholder=" "
                type="number"
                step="any"
                disabled={loading}
              />
              <label>Longitude (-180 to 180)</label>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: 'var(--error-container)',
            color: 'var(--on-error-container)',
            padding: 'var(--spacing-1)',
            borderRadius: '4px',
            marginBottom: 'var(--spacing-2)',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
          <button
            className="button"
            type="submit"
            disabled={loading || !name.trim() || !address1.trim() || !city.trim() || !country.trim()}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {editingLocation ? 'save' : 'add'}
            </span>
            {loading ? 'Saving...' : (editingLocation ? 'Update Location' : 'Create Location')}
          </button>

          <button
            type="button"
            className="button outlined"
            onClick={handleCancel}
            disabled={loading}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>cancel</span>
            Cancel
          </button>
        </div>
      </form>

      {/* Help Text */}
      <div style={{
        backgroundColor: 'var(--surface-variant)',
        padding: 'var(--spacing-2)',
        borderRadius: '4px',
        fontSize: '0.875rem',
        color: 'var(--on-surface-variant)'
      }}>
        <h4 style={{ margin: '0 0 var(--spacing-1) 0', fontSize: '0.875rem' }}>
          💡 Tips for adding locations:
        </h4>
        <ul style={{ margin: 0, paddingLeft: 'var(--spacing-2)' }}>
          <li>Location name should be descriptive and unique (e.g., "Walmart DC - Dallas")</li>
          <li>Address details help with accurate route planning</li>
          <li>Adding coordinates enables precise mapping and distance calculations</li>
          <li>You can find coordinates using Google Maps or other mapping services</li>
        </ul>
      </div>
    </div>
  );
}