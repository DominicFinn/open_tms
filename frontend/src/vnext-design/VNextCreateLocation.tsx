import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function VNextCreateLocation() {
  const [name, setName] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  return (
    <>
      <div className="vn-page-header">
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            <Link to="/vnext/locations" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Locations</Link>
            {' '}&gt; New Location
          </p>
          <h1>New Location</h1>
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-card-body" style={{ padding: '2rem' }}>

          {/* Location Details */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">location_on</span>
              Location Details
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Name</label>
                <input className="vn-input" type="text" placeholder="Location name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Address Line 1</label>
                <input className="vn-input" type="text" placeholder="Street address" value={address1} onChange={e => setAddress1(e.target.value)} />
              </div>
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Address Line 2</label>
                <input className="vn-input" type="text" placeholder="Suite, unit, floor, etc." value={address2} onChange={e => setAddress2(e.target.value)} />
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
                <input className="vn-input" type="text" placeholder="ZIP / Postal code" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Country</label>
                <select className="vn-select" value={country} onChange={e => setCountry(e.target.value)}>
                  <option value="">Select country...</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="MX">Mexico</option>
                  <option value="UK">United Kingdom</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="AU">Australia</option>
                </select>
              </div>
            </div>
          </div>

          {/* Coordinates */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">my_location</span>
              Coordinates
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Latitude</label>
                <input className="vn-input" type="number" step="any" placeholder="e.g. 41.8827" value={latitude} onChange={e => setLatitude(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Longitude</label>
                <input className="vn-input" type="number" step="any" placeholder="e.g. -87.6588" value={longitude} onChange={e => setLongitude(e.target.value)} />
              </div>
              <div className="vn-col-span-2">
                <div
                  className="vn-map"
                  style={{
                    height: '200px',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-secondary)',
                    border: '1px dashed var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    gap: '0.5rem',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '2rem', opacity: 0.5 }}>map</span>
                  <span>Map preview will appear here</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">person</span>
              Contact
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Contact Name</label>
                <input className="vn-input" type="text" placeholder="Full name" value={contactName} onChange={e => setContactName(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Phone</label>
                <input className="vn-input" type="tel" placeholder="(555) 123-4567" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Email</label>
                <input className="vn-input" type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="vn-form-actions">
            <Link to="/vnext/locations" className="vn-btn vn-btn-outline">Cancel</Link>
            <button className="vn-btn vn-btn-primary">
              <span className="material-icons">save</span>
              Save Location
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
