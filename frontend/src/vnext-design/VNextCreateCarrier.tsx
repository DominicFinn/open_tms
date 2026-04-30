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
  MapPin,
  Save,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react';

import { API_URL } from '../api';
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

const EQUIPMENT_TYPES = [
  { key: 'dryVan', label: 'Dry van' },
  { key: 'reefer', label: 'Reefer' },
  { key: 'flatbed', label: 'Flatbed' },
  { key: 'tanker', label: 'Tanker' },
  { key: 'intermodal', label: 'Intermodal' },
];

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
    dryVan: false, reefer: false, flatbed: false, tanker: false, intermodal: false,
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
      .then(r => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
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
      const newId = json.data?.id ?? id;
      const label = json.data?.name || name || newId?.slice(0, 8);
      if (isEdit) {
        toast.success(`Carrier ${label} updated`);
      } else {
        toast.success(`Carrier ${label} created`, {
          action: newId ? { label: 'View', onClick: () => navigate(`/carriers/${newId}/edit`) } : undefined,
        });
      }
      navigate('/carriers');
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

  const toggleEquipment = (key: string) => setEquipment(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/carriers" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Carriers
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{isEdit ? 'Edit carrier' : 'New carrier'}</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight">{isEdit ? 'Edit carrier' : 'New carrier'}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Company information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-3">
            <Label>Name</Label>
            <Input type="text" placeholder="Carrier name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>MC number</Label>
            <Input type="text" placeholder="MC-000000" value={mcNumber} onChange={e => setMcNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>DOT number</Label>
            <Input type="text" placeholder="0000000" value={dotNumber} onChange={e => setDotNumber(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Contact
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
            <MapPin className="h-4 w-4 text-primary" />
            Address
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Address 1</Label>
            <Input type="text" placeholder="Street address" value={address1} onChange={e => setAddress1(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address 2</Label>
            <Input type="text" placeholder="Suite, unit, etc." value={address2} onChange={e => setAddress2(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input type="text" placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input type="text" placeholder="State / Province" value={state} onChange={e => setState(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Postal code</Label>
            <Input type="text" placeholder="00000" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="MX">Mexico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            Equipment &amp; capabilities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Equipment types</Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {EQUIPMENT_TYPES.map(eq => (
                <label key={eq.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={equipment[eq.key]}
                    onChange={() => toggleEquipment(eq.key)}
                    className="h-4 w-4 rounded border border-input bg-background accent-primary"
                  />
                  {eq.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Service mode</Label>
            <div className="mt-2 flex gap-4">
              {['FTL', 'LTL', 'Both'].map(mode => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="serviceMode"
                    value={mode}
                    checked={serviceMode === mode}
                    onChange={e => setServiceMode(e.target.value)}
                    className="h-4 w-4 border border-input bg-background accent-primary"
                  />
                  {mode}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Payment terms
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Payment terms (days)</Label>
            <Select value={paymentTermsDays} onValueChange={setPaymentTermsDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Net 15</SelectItem>
                <SelectItem value="30">Net 30</SelectItem>
                <SelectItem value="45">Net 45</SelectItem>
                <SelectItem value="60">Net 60</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={carrierCurrency} onValueChange={setCarrierCurrency}>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Insurance
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Insurance amount</Label>
            <Input type="number" placeholder="1000000" value={insuranceAmount} onChange={e => setInsuranceAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Expiry date</Label>
            <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <textarea
              rows={3}
              placeholder="Additional insurance notes..."
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
          <Link to="/carriers">Cancel</Link>
        </Button>
        <Button variant="gradient" onClick={handleSubmit} disabled={submitting}>
          <Save className="h-4 w-4" />
          {submitting ? 'Saving...' : isEdit ? 'Update carrier' : 'Save carrier'}
        </Button>
      </div>
    </div>
  );
}
