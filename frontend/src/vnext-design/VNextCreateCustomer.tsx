import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Loader2,
  Save,
  Settings2,
  User,
} from 'lucide-react';

import { API_URL } from '../api';
import CustomerUserManagement from '../components/CustomerUserManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      const newId = json.data?.id ?? id;
      const label = json.data?.name || name || newId?.slice(0, 8);
      if (isEdit) {
        toast.success(`Customer ${label} updated`);
      } else {
        toast.success(`Customer ${label} created`, {
          action: newId ? { label: 'View', onClick: () => navigate(`/customers/${newId}/edit`) } : undefined,
        });
      }
      navigate('/customers');
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/customers" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Customers
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{isEdit ? 'Edit customer' : 'New customer'}</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight">{isEdit ? 'Edit customer' : 'New customer'}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Company information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Company name</Label>
            <Input type="text" placeholder="Company name" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger>
                <SelectValue placeholder="Select industry..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                <SelectItem value="Retail">Retail</SelectItem>
                <SelectItem value="Logistics">Logistics</SelectItem>
                <SelectItem value="Food &amp; Beverage">Food &amp; Beverage</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Primary contact
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Contact name</Label>
            <Input type="text" placeholder="Full name" value={contactName} onChange={e => setContactName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input type="tel" placeholder="(555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Billing
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Payment terms</Label>
            <Select value={paymentTerms} onValueChange={setPaymentTerms}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Net 30">Net 30</SelectItem>
                <SelectItem value="Net 60">Net 60</SelectItem>
                <SelectItem value="Net 90">Net 90</SelectItem>
                <SelectItem value="Prepaid">Prepaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Billing email</Label>
            <Input type="email" placeholder="billing@example.com" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Credit limit ($)</Label>
            <Input type="number" min="0" step="100" placeholder="No limit" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Invoice consolidation</Label>
            <Select value={invoiceConsolidation} onValueChange={setInvoiceConsolidation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="per_shipment">Per shipment</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tax ID (VAT/EIN)</Label>
            <Input type="text" placeholder="e.g. 12-3456789" value={taxId} onChange={e => setTaxId(e.target.value)} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoInvoice}
                onChange={e => setAutoInvoice(e.target.checked)}
                className="h-4 w-4 rounded border border-input bg-background accent-primary"
              />
              Auto-generate draft invoices on delivery
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Default mode</Label>
            <Select value={defaultMode} onValueChange={setDefaultMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FTL">FTL</SelectItem>
                <SelectItem value="LTL">LTL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <textarea
              rows={3}
              placeholder="Additional notes about this customer..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </CardContent>
      </Card>

      {submitError && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {submitError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" asChild>
          <Link to="/customers">Cancel</Link>
        </Button>
        <Button variant="gradient" onClick={handleSubmit} disabled={submitting}>
          <Save className="h-4 w-4" />
          {submitting ? 'Saving...' : isEdit ? 'Update customer' : 'Create customer'}
        </Button>
      </div>

      {isEdit && id && (
        <Card>
          <CardContent className="p-5">
            <CustomerUserManagement customerId={id} customerName={companyName} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
