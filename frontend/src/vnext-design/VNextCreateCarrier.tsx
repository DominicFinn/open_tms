import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

export default function VNextCreateCarrier() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [mcNumber, setMcNumber] = useState('');
  const [dotNumber, setDotNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('US');
  const [equipment, setEquipment] = useState<Record<string, boolean>>({
    dryVan: false,
    reefer: false,
    flatbed: false,
    tanker: false,
    intermodal: false,
  });
  const [serviceMode, setServiceMode] = useState('FTL');
  const [insuranceAmount, setInsuranceAmount] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [carrierCurrency, setCarrierCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/carriers/${id}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then(json => {
        const c = json.data;
        if (!c) return;
        setName(c.name || '');
        setMcNumber(c.mcNumber || '');
        setDotNumber(c.dotNumber || '');
        setContactName(c.contactName || '');
        setEmail(c.contactEmail || '');
        setPhone(c.contactPhone || '');
        setAddress1(c.address1 || '');
        setAddress2(c.address2 || '');
        setCity(c.city || '');
        setState(c.state || '');
        setPostalCode(c.postalCode || '');
        setCountry(c.country || 'US');
        setPaymentTermsDays(c.paymentTermsDays ? String(c.paymentTermsDays) : '30');
        setCarrierCurrency(c.currency || 'USD');
      })
      .catch(err => setSubmitError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const body: any = {
        name, mcNumber, dotNumber, contactName, contactEmail: email, contactPhone: phone,
        address1, address2, city, state, postalCode, country,
        paymentTermsDays: parseInt(paymentTermsDays) || 30,
        currency: carrierCurrency,
      };
      const url = isEdit ? `${API_URL}/api/v1/carriers/${id}` : `${API_URL}/api/v1/carriers`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save carrier');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate('/carriers');
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-spinner" style={{ margin: '2rem auto' }} />;

  const toggleEquipment = (key: string) => {
    setEquipment(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <div className="vn-page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link to="/carriers" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Carriers</Link>
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_right</span>
            <span>{isEdit ? 'Edit Carrier' : 'New Carrier'}</span>
          </div>
          <h1>{isEdit ? 'Edit Carrier' : 'New Carrier'}</h1>
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-card-body" style={{ padding: 0 }}>

          {/* Company Information */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">business</span>
              Company Information
            </div>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Name</label>
                <input className="vn-input" type="text" placeholder="Carrier name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">MC Number</label>
                <input className="vn-input" type="text" placeholder="MC-000000" value={mcNumber} onChange={e => setMcNumber(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">DOT Number</label>
                <input className="vn-input" type="text" placeholder="0000000" value={dotNumber} onChange={e => setDotNumber(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">person</span>
              Contact
            </div>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Contact Name</label>
                <input className="vn-input" type="text" placeholder="Full name" value={contactName} onChange={e => setContactName(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Email</label>
                <input className="vn-input" type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Phone</label>
                <input className="vn-input" type="tel" placeholder="(555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">location_on</span>
              Address
            </div>
            <div className="vn-form-grid">
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Address 1</label>
                <input className="vn-input" type="text" placeholder="Street address" value={address1} onChange={e => setAddress1(e.target.value)} />
              </div>
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Address 2</label>
                <input className="vn-input" type="text" placeholder="Suite, unit, etc." value={address2} onChange={e => setAddress2(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">City</label>
                <input className="vn-input" type="text" placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">State</label>
                <input className="vn-input" type="text" placeholder="State / Province" value={state} onChange={e => setState(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Postal Code</label>
                <input className="vn-input" type="text" placeholder="00000" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Country</label>
                <select className="vn-select" value={country} onChange={e => setCountry(e.target.value)}>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="MX">Mexico</option>
                </select>
              </div>
            </div>
          </div>

          {/* Equipment & Capabilities */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">local_shipping</span>
              Equipment &amp; Capabilities
            </div>
            <div className="vn-form-grid">
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Equipment Types</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 4 }}>
                  {[
                    { key: 'dryVan', label: 'Dry Van' },
                    { key: 'reefer', label: 'Reefer' },
                    { key: 'flatbed', label: 'Flatbed' },
                    { key: 'tanker', label: 'Tanker' },
                    { key: 'intermodal', label: 'Intermodal' },
                  ].map(eq => (
                    <label key={eq.key} className="vn-checkbox">
                      <input type="checkbox" checked={equipment[eq.key]} onChange={() => toggleEquipment(eq.key)} />
                      <span>{eq.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Service Mode</label>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  {['FTL', 'LTL', 'Both'].map(mode => (
                    <label key={mode} className="vn-radio">
                      <input type="radio" name="serviceMode" value={mode} checked={serviceMode === mode} onChange={e => setServiceMode(e.target.value)} />
                      <span>{mode}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">payments</span>
              Payment Terms
            </div>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Payment Terms (days)</label>
                <select className="vn-select" value={paymentTermsDays} onChange={e => setPaymentTermsDays(e.target.value)}>
                  <option value="15">Net 15</option>
                  <option value="30">Net 30</option>
                  <option value="45">Net 45</option>
                  <option value="60">Net 60</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Currency</label>
                <select className="vn-select" value={carrierCurrency} onChange={e => setCarrierCurrency(e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Insurance */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">verified_user</span>
              Insurance
            </div>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Insurance Amount</label>
                <input className="vn-input" type="number" placeholder="1000000" value={insuranceAmount} onChange={e => setInsuranceAmount(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Expiry Date</label>
                <input className="vn-input" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
              </div>
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Notes</label>
                <textarea className="vn-textarea" rows={3} placeholder="Additional insurance notes..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {submitError && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{submitError}</div>}

      {/* Form Actions */}
      <div className="vn-form-actions">
        <Link to="/carriers" className="vn-btn vn-btn-outline">Cancel</Link>
        <button className="vn-btn vn-btn-primary" onClick={handleSubmit} disabled={submitting}>
          <span className="material-icons">save</span>
          {submitting ? 'Saving...' : isEdit ? 'Update Carrier' : 'Save Carrier'}
        </button>
      </div>
    </>
  );
}
