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
  validationTier?: string;
  registrationChecked?: boolean;
  insuranceDocReceived?: boolean;
  insuranceVerified?: boolean;
  identityConfirmed?: boolean;
  complianceChecked?: boolean;
  validationNotes?: string;
  validatedAt?: string;
  validatedBy?: string;
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
  const [validationTier, setValidationTier] = useState('');
  const [registrationChecked, setRegistrationChecked] = useState(false);
  const [insuranceDocReceived, setInsuranceDocReceived] = useState(false);
  const [insuranceVerified, setInsuranceVerified] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [validationNotes, setValidationNotes] = useState('');
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
      setValidationTier(editingCarrier.validationTier || '');
      setRegistrationChecked(editingCarrier.registrationChecked || false);
      setInsuranceDocReceived(editingCarrier.insuranceDocReceived || false);
      setInsuranceVerified(editingCarrier.insuranceVerified || false);
      setIdentityConfirmed(editingCarrier.identityConfirmed || false);
      setComplianceChecked(editingCarrier.complianceChecked || false);
      setValidationNotes(editingCarrier.validationNotes || '');
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
    setValidationTier('');
    setRegistrationChecked(false);
    setInsuranceDocReceived(false);
    setInsuranceVerified(false);
    setIdentityConfirmed(false);
    setComplianceChecked(false);
    setValidationNotes('');
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
      const carrierData: Record<string, any> = {
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
        country: country.trim() || undefined,
        validationTier: validationTier || undefined,
        registrationChecked,
        insuranceDocReceived,
        insuranceVerified,
        identityConfirmed,
        complianceChecked,
        validationNotes: validationNotes.trim() || undefined,
      };
      // Set validatedAt if any check is done
      if (registrationChecked || insuranceDocReceived || insuranceVerified || identityConfirmed || complianceChecked) {
        carrierData.validatedAt = new Date().toISOString();
      }

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

        {/* Carrier Validation Checklist */}
        <div style={{ marginBottom: 'var(--spacing-3)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-2)', fontSize: '1rem' }}>Carrier Validation</h3>

          <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-2)' }}>
            <span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px' }}>warning</span>
            Carrier fraud and impersonation is a serious risk. Before engaging any carrier, complete the validation checks below.
            These checks must be performed outside this system using the linked resources.
          </div>

          {/* Tier Selection */}
          <div className="text-field" style={{ marginBottom: 'var(--spacing-2)', maxWidth: '400px' }}>
            <select value={validationTier} onChange={e => setValidationTier(e.target.value)} disabled={loading}>
              <option value="">No validation tier</option>
              <option value="tier1">Tier 1 — Basic</option>
              <option value="tier2">Tier 2 — Verified</option>
              <option value="tier3">Tier 3 — High-Risk / High-Value</option>
            </select>
            <label>Validation Tier</label>
          </div>

          {/* Checkboxes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
            <label className="check-field" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={registrationChecked} onChange={e => setRegistrationChecked(e.target.checked)} disabled={loading} style={{ marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 500 }}>Registration verified</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
                  UK: <a href="https://www.gov.uk/manage-vehicle-operator-licence" target="_blank" rel="noopener noreferrer">GOV.UK O-Licence</a> |
                  US: <a href="https://safer.fmcsa.dot.gov/" target="_blank" rel="noopener noreferrer">FMCSA SAFER</a> |
                  EU: National registry + <a href="https://ec.europa.eu/taxation_customs/vies/" target="_blank" rel="noopener noreferrer">VIES VAT</a>
                </div>
              </div>
            </label>

            <label className="check-field" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={insuranceDocReceived} onChange={e => setInsuranceDocReceived(e.target.checked)} disabled={loading} style={{ marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 500 }}>Insurance documents received</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
                  Goods in transit / cargo insurance + public liability. Check coverage values and expiry dates.
                </div>
              </div>
            </label>

            <label className="check-field" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={insuranceVerified} onChange={e => setInsuranceVerified(e.target.checked)} disabled={loading} style={{ marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 500 }}>Insurance verified with provider</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
                  Contacted insurer directly to confirm policy is active and covers shipment values.
                </div>
              </div>
            </label>

            <label className="check-field" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={identityConfirmed} onChange={e => setIdentityConfirmed(e.target.checked)} disabled={loading} style={{ marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 500 }}>Identity confirmed</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
                  Called carrier using publicly listed phone number. Verified email domain matches company. Checked for red flags (new company, domain mismatch, urgent change requests).
                </div>
              </div>
            </label>

            <label className="check-field" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={complianceChecked} onChange={e => setComplianceChecked(e.target.checked)} disabled={loading} style={{ marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 500 }}>Compliance & safety checked</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
                  UK: <a href="https://www.gov.uk/check-vehicle-operator-compliance-risk-score" target="_blank" rel="noopener noreferrer">OCRS score</a> |
                  US: <a href="https://safer.fmcsa.dot.gov/" target="_blank" rel="noopener noreferrer">FMCSA safety rating</a> |
                  EU: National enforcement records. No suspensions/revocations.
                </div>
              </div>
            </label>
          </div>

          {/* Validation Notes */}
          <div className="text-field" style={{ marginTop: 'var(--spacing-2)' }}>
            <textarea
              value={validationNotes}
              onChange={e => setValidationNotes(e.target.value)}
              placeholder=" "
              rows={3}
              disabled={loading}
              style={{ resize: 'vertical' }}
            />
            <label>Validation Notes (optional)</label>
          </div>

          {/* Tier Requirements Guide */}
          {validationTier && (
            <div style={{
              marginTop: 'var(--spacing-2)',
              padding: 'var(--spacing-2)',
              backgroundColor: 'var(--surface-container-low)',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              color: 'var(--on-surface-variant)',
            }}>
              <strong>Requirements for {validationTier === 'tier1' ? 'Tier 1 (Basic)' : validationTier === 'tier2' ? 'Tier 2 (Verified)' : 'Tier 3 (High-Risk/High-Value)'}:</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
                <li>Registration verified + Insurance documents received</li>
                {(validationTier === 'tier2' || validationTier === 'tier3') && (
                  <>
                    <li>Insurance verified with provider</li>
                    <li>Identity confirmed</li>
                    <li>Previous successful shipment history</li>
                  </>
                )}
                {validationTier === 'tier3' && (
                  <>
                    <li>Full compliance & safety check</li>
                    <li>Driver/vehicle pre-confirmed</li>
                    <li>Live tracking capability</li>
                  </>
                )}
              </ul>
            </div>
          )}
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
