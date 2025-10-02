import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface Carrier {
  id: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface CarrierCreationFormProps {
  onCarrierCreated?: (carrier: Carrier) => void;
  onCarrierUpdated?: (carrier: Carrier) => void;
  editingCarrier?: Carrier | null;
  onCancel?: () => void;
}

export default function CarrierCreationForm({
  onCarrierCreated,
  onCarrierUpdated,
  editingCarrier,
  onCancel
}: CarrierCreationFormProps) {
  const [name, setName] = useState('');
  const [mcNumber, setMcNumber] = useState('');
  const [dotNumber, setDotNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('USA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when editing
  useEffect(() => {
    if (editingCarrier) {
      setName(editingCarrier.name);
      setMcNumber(editingCarrier.mcNumber || '');
      setDotNumber(editingCarrier.dotNumber || '');
      setContactName(editingCarrier.contactName || '');
      setContactEmail(editingCarrier.contactEmail || '');
      setContactPhone(editingCarrier.contactPhone || '');
      setAddress1(editingCarrier.address1 || '');
      setAddress2(editingCarrier.address2 || '');
      setCity(editingCarrier.city || '');
      setState(editingCarrier.state || '');
      setPostalCode(editingCarrier.postalCode || '');
      setCountry(editingCarrier.country || 'USA');
    } else {
      clearForm();
    }
  }, [editingCarrier]);

  const clearForm = () => {
    setName('');
    setMcNumber('');
    setDotNumber('');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setAddress1('');
    setAddress2('');
    setCity('');
    setState('');
    setPostalCode('');
    setCountry('USA');
    setError(null);
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Please enter a carrier name');
      return false;
    }

    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError('Please enter a valid email address');
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
      const carrierData = {
        name: name.trim(),
        mcNumber: mcNumber.trim() || undefined,
        dotNumber: dotNumber.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        address1: address1.trim() || undefined,
        address2: address2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim() || undefined
      };

      const url = editingCarrier
        ? `${API_URL}/api/v1/carriers/${editingCarrier.id}`
        : `${API_URL}/api/v1/carriers`;

      const method = editingCarrier ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(carrierData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save carrier');
      }

      const result = await response.json();
      const savedCarrier = result.data;

      if (editingCarrier && onCarrierUpdated) {
        onCarrierUpdated(savedCarrier);
      } else if (onCarrierCreated) {
        onCarrierCreated(savedCarrier);
        clearForm();
      }
    } catch (error) {
      console.error('Failed to save carrier:', error);
      setError(error instanceof Error ? error.message : 'Failed to save carrier');
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
      <h2>{editingCarrier ? 'Edit Carrier' : 'Create New Carrier'}</h2>

      <form onSubmit={submit} style={{ marginBottom: 'var(--spacing-2)' }}>
        {/* Basic Information */}
        <h3 style={{ marginBottom: 'var(--spacing-2)', fontSize: '1rem' }}>Basic Information</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-3)'
        }}>
          <div className="text-field">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder=" "
              required
              disabled={loading}
            />
            <label>Carrier Name</label>
          </div>
          <div className="text-field">
            <input
              value={mcNumber}
              onChange={e => setMcNumber(e.target.value)}
              placeholder=" "
              disabled={loading}
            />
            <label>MC Number (optional)</label>
          </div>
          <div className="text-field">
            <input
              value={dotNumber}
              onChange={e => setDotNumber(e.target.value)}
              placeholder=" "
              disabled={loading}
            />
            <label>DOT Number (optional)</label>
          </div>
        </div>

        {/* Contact Information */}
        <h3 style={{ marginBottom: 'var(--spacing-2)', fontSize: '1rem' }}>Contact Information</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-3)'
        }}>
          <div className="text-field">
            <input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder=" "
              disabled={loading}
            />
            <label>Contact Name (optional)</label>
          </div>
          <div className="text-field">
            <input
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder=" "
              type="email"
              disabled={loading}
            />
            <label>Contact Email (optional)</label>
          </div>
          <div className="text-field">
            <input
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder=" "
              type="tel"
              disabled={loading}
            />
            <label>Contact Phone (optional)</label>
          </div>
        </div>

        {/* Address Information */}
        <h3 style={{ marginBottom: 'var(--spacing-2)', fontSize: '1rem' }}>Address</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-2)'
        }}>
          <div className="text-field">
            <input
              value={address1}
              onChange={e => setAddress1(e.target.value)}
              placeholder=" "
              disabled={loading}
            />
            <label>Address Line 1 (optional)</label>
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

        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 2fr',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-3)'
        }}>
          <div className="text-field">
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder=" "
              disabled={loading}
            />
            <label>City (optional)</label>
          </div>
          <div className="text-field">
            <input
              value={state}
              onChange={e => setState(e.target.value)}
              placeholder=" "
              disabled={loading}
            />
            <label>State (optional)</label>
          </div>
          <div className="text-field">
            <input
              value={postalCode}
              onChange={e => setPostalCode(e.target.value)}
              placeholder=" "
              disabled={loading}
            />
            <label>Postal Code (optional)</label>
          </div>
          <div className="text-field">
            <input
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder=" "
              disabled={loading}
            />
            <label>Country (optional)</label>
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
            disabled={loading || !name.trim()}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {editingCarrier ? 'save' : 'add'}
            </span>
            {loading ? 'Saving...' : (editingCarrier ? 'Update Carrier' : 'Create Carrier')}
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
          💡 Tips for adding carriers:
        </h4>
        <ul style={{ margin: 0, paddingLeft: 'var(--spacing-2)' }}>
          <li>Carrier name is required and should be unique</li>
          <li>MC (Motor Carrier) and DOT numbers are used for regulatory compliance tracking</li>
          <li>Contact information helps with communication and dispatching</li>
          <li>Address information is useful for documentation and compliance</li>
        </ul>
      </div>
    </div>
  );
}
