import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function VNextCreateShipment() {
  const [customer, setCustomer] = useState('');
  const [reference, setReference] = useState('');
  const [mode, setMode] = useState('');
  const [proNumber, setProNumber] = useState('');

  const [originLocation, setOriginLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupWindowStart, setPickupWindowStart] = useState('');
  const [pickupWindowEnd, setPickupWindowEnd] = useState('');

  const [destLocation, setDestLocation] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryWindowStart, setDeliveryWindowStart] = useState('');
  const [deliveryWindowEnd, setDeliveryWindowEnd] = useState('');

  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('lb');
  const [pieces, setPieces] = useState('');
  const [commodity, setCommodity] = useState('');
  const [tempControlled, setTempControlled] = useState(false);
  const [tempMode, setTempMode] = useState('ambient');
  const [hazmat, setHazmat] = useState(false);

  const [notes, setNotes] = useState('');

  return (
    <>
      <div className="vn-page-header">
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            <Link to="/vnext/shipments" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Shipments</Link>
            {' '}&gt; New Shipment
          </p>
          <h1>New Shipment</h1>
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-card-body" style={{ padding: '2rem' }}>

          {/* Basic Information */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">info</span>
              Basic Information
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Customer</label>
                <select className="vn-select" value={customer} onChange={e => setCustomer(e.target.value)}>
                  <option value="">Select customer...</option>
                  <option value="acme">Acme Corp</option>
                  <option value="global">Global Widgets</option>
                  <option value="techstart">TechStart Inc</option>
                  <option value="freshfoods">FreshFoods LLC</option>
                  <option value="industrial">Industrial Co</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Reference</label>
                <input className="vn-input" type="text" placeholder="Enter reference number" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Mode</label>
                <select className="vn-select" value={mode} onChange={e => setMode(e.target.value)}>
                  <option value="">Select mode...</option>
                  <option value="ftl">FTL</option>
                  <option value="ltl">LTL</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">PRO Number</label>
                <input className="vn-input" type="text" placeholder="Enter PRO number" value={proNumber} onChange={e => setProNumber(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Origin */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">flight_takeoff</span>
              Origin
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Location</label>
                <select className="vn-select" value={originLocation} onChange={e => setOriginLocation(e.target.value)}>
                  <option value="">Select origin...</option>
                  <option value="chi">Chicago Distribution Center</option>
                  <option value="la">Los Angeles Terminal</option>
                  <option value="atl">Atlanta Hub</option>
                  <option value="nyc">New York Cross-Dock</option>
                  <option value="den">Denver Cold Storage</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Pickup Date</label>
                <input className="vn-input" type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Pickup Window Start</label>
                <input className="vn-input" type="time" value={pickupWindowStart} onChange={e => setPickupWindowStart(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Pickup Window End</label>
                <input className="vn-input" type="time" value={pickupWindowEnd} onChange={e => setPickupWindowEnd(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Destination */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">flight_land</span>
              Destination
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Location</label>
                <select className="vn-select" value={destLocation} onChange={e => setDestLocation(e.target.value)}>
                  <option value="">Select destination...</option>
                  <option value="dal">Dallas Warehouse</option>
                  <option value="phx">Phoenix Staging Area</option>
                  <option value="mia">Miami Import Yard</option>
                  <option value="sea">Seattle Port Facility</option>
                  <option value="min">Minneapolis Yard</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Delivery Date</label>
                <input className="vn-input" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Delivery Window Start</label>
                <input className="vn-input" type="time" value={deliveryWindowStart} onChange={e => setDeliveryWindowStart(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Delivery Window End</label>
                <input className="vn-input" type="time" value={deliveryWindowEnd} onChange={e => setDeliveryWindowEnd(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Cargo */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">inventory</span>
              Cargo
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Weight</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input className="vn-input" type="number" placeholder="0" value={weight} onChange={e => setWeight(e.target.value)} style={{ flex: 1 }} />
                  <select className="vn-select" value={weightUnit} onChange={e => setWeightUnit(e.target.value)} style={{ width: '5rem' }}>
                    <option value="lb">lb</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Pieces</label>
                <input className="vn-input" type="number" placeholder="0" value={pieces} onChange={e => setPieces(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Commodity</label>
                <input className="vn-input" type="text" placeholder="Enter commodity description" value={commodity} onChange={e => setCommodity(e.target.value)} />
              </div>
              <div className="vn-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label className="vn-checkbox">
                  <input type="checkbox" checked={tempControlled} onChange={e => setTempControlled(e.target.checked)} />
                  Temperature Controlled
                </label>
                {tempControlled && (
                  <select className="vn-select" value={tempMode} onChange={e => setTempMode(e.target.value)}>
                    <option value="ambient">Ambient</option>
                    <option value="refrigerated">Refrigerated</option>
                    <option value="frozen">Frozen</option>
                  </select>
                )}
                <label className="vn-checkbox">
                  <input type="checkbox" checked={hazmat} onChange={e => setHazmat(e.target.checked)} />
                  Hazmat
                </label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">notes</span>
              Notes
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Additional Notes</label>
                <textarea className="vn-textarea" rows={4} placeholder="Enter any additional notes or special instructions..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="vn-form-actions">
            <Link to="/vnext/shipments" className="vn-btn vn-btn-outline">Cancel</Link>
            <button className="vn-btn vn-btn-outline">
              <span className="material-icons">save</span>
              Save Draft
            </button>
            <button className="vn-btn vn-btn-primary">
              <span className="material-icons">add</span>
              Create Shipment
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
