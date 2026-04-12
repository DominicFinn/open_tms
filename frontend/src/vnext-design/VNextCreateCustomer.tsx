import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

export default function VNextCreateCustomer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [billingEmail, setBillingEmail] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [creditLimit, setCreditLimit] = useState('');
  const [invoiceConsolidation, setInvoiceConsolidation] = useState('per_shipment');
  const [autoInvoice, setAutoInvoice] = useState(false);
  const [taxId, setTaxId] = useState('');
  const [defaultMode, setDefaultMode] = useState('FTL');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/customers/${id}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then(json => {
        const c = json.data;
        if (!c) return;
        setCompanyName(c.name || '');
        setEmail(c.contactEmail || '');
        setBillingEmail(c.billingEmail || '');
        setCurrency(c.currency || 'USD');
        setCreditLimit(c.creditLimitCents ? String(c.creditLimitCents / 100) : '');
        setInvoiceConsolidation(c.invoiceConsolidation || 'per_shipment');
        setAutoInvoice(c.autoInvoice || false);
        setTaxId(c.taxId || '');
        setPaymentTerms(c.paymentTermsDays ? `Net ${c.paymentTermsDays}` : 'Net 30');
      })
      .catch(err => setSubmitError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const paymentTermsDays = parseInt(paymentTerms.replace(/\D/g, '')) || 30;
      const body: any = {
        name: companyName,
        contactEmail: email,
        billingEmail: billingEmail || undefined,
        currency,
        paymentTermsDays,
        creditLimitCents: creditLimit ? Math.round(parseFloat(creditLimit) * 100) : undefined,
        invoiceConsolidation,
        autoInvoice,
        taxId: taxId || undefined,
      };
      const url = isEdit ? `${API_URL}/api/v1/customers/${id}` : `${API_URL}/api/v1/customers`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save customer');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate('/customers');
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-spinner" style={{ margin: '2rem auto' }} />;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link to="/customers" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Customers</Link>
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_right</span>
            <span>{isEdit ? 'Edit Customer' : 'New Customer'}</span>
          </div>
          <h1>{isEdit ? 'Edit Customer' : 'New Customer'}</h1>
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
                  <option value="CAD">CAD</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Credit Limit ($)</label>
                <input className="vn-input" type="number" min="0" step="100" placeholder="No limit" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Invoice Consolidation</label>
                <select className="vn-select" value={invoiceConsolidation} onChange={e => setInvoiceConsolidation(e.target.value)}>
                  <option value="per_shipment">Per Shipment</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Tax ID (VAT/EIN)</label>
                <input className="vn-input" type="text" placeholder="e.g. 12-3456789" value={taxId} onChange={e => setTaxId(e.target.value)} />
              </div>
              <div className="vn-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoInvoice} onChange={e => setAutoInvoice(e.target.checked)} />
                  <span className="vn-field-label" style={{ margin: 0 }}>Auto-generate draft invoices on delivery</span>
                </label>
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

      {submitError && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{submitError}</div>}

      {/* Form Actions */}
      <div className="vn-form-actions">
        <Link to="/customers" className="vn-btn vn-btn-outline">Cancel</Link>
        <button className="vn-btn vn-btn-primary" onClick={handleSubmit} disabled={submitting}>
          <span className="material-icons">save</span>
          {submitting ? 'Saving...' : isEdit ? 'Update Customer' : 'Create Customer'}
        </button>
      </div>
    </>
  );
}
