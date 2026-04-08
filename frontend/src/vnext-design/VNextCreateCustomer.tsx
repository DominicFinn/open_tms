import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function VNextCreateCustomer() {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [billingEmail, setBillingEmail] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [defaultMode, setDefaultMode] = useState('FTL');
  const [notes, setNotes] = useState('');

  return (
    <>
      <div className="vn-page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link to="/vnext/customers" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Customers</Link>
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_right</span>
            <span>New Customer</span>
          </div>
          <h1>New Customer</h1>
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
                <label className="vn-field-label">Company Name</label>
                <input className="vn-input" type="text" placeholder="Company name" value={companyName} onChange={e => setCompanyName(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Industry</label>
                <select className="vn-select" value={industry} onChange={e => setIndustry(e.target.value)}>
                  <option value="">Select industry...</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Retail">Retail</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Food & Beverage">Food &amp; Beverage</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Primary Contact */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">person</span>
              Primary Contact
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

          {/* Billing */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">payments</span>
              Billing
            </div>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Payment Terms</label>
                <select className="vn-select" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Net 90">Net 90</option>
                  <option value="Prepaid">Prepaid</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Billing Email</label>
                <input className="vn-input" type="email" placeholder="billing@example.com" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Currency</label>
                <select className="vn-select" value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">tune</span>
              Preferences
            </div>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Default Mode</label>
                <select className="vn-select" value={defaultMode} onChange={e => setDefaultMode(e.target.value)}>
                  <option value="FTL">FTL</option>
                  <option value="LTL">LTL</option>
                </select>
              </div>
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Notes</label>
                <textarea className="vn-textarea" rows={3} placeholder="Additional notes about this customer..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Form Actions */}
      <div className="vn-form-actions">
        <Link to="/vnext/customers" className="vn-btn vn-btn-outline">Cancel</Link>
        <button className="vn-btn vn-btn-primary">
          <span className="material-icons">save</span>
          Create Customer
        </button>
      </div>
    </>
  );
}
