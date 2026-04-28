import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  Building,
  ChevronRight,
  CircleAlert,
  Crosshair,
  Factory,
  Loader2,
  Map as MapIcon,
  MapPin,
  Network,
  Save,
  ShieldCheck,
  Ship,
  Store,
  Tag,
  Train,
  User,
  Warehouse,
} from 'lucide-react';

import { API_URL } from '../api';
import { LOCATION_TYPE_META } from './locationTypesMeta';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';

const LOCATION_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  warehouse: Warehouse,
  distribution_centre: Network,
  cross_dock: ArrowRightLeft,
  terminal: Building,
  port: Ship,
  rail_yard: Train,
  customer: Store,
  store: Store,
  manufacturing: Factory,
};

const LOCATION_TYPE_VARIANT: Record<string, BadgeVariant> = {
  warehouse: 'default',
  distribution_centre: 'info',
  cross_dock: 'warning',
  terminal: 'secondary',
  port: 'info',
  rail_yard: 'secondary',
  customer: 'success',
  store: 'success',
  manufacturing: 'destructive',
};

export default function VNextCreateLocation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

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

  const [locationType, setLocationType] = useState('');
  const [appointmentRequired, setAppointmentRequired] = useState(false);
  const [dockCount, setDockCount] = useState('');
  const [maxTrailerLengthFt, setMaxTrailerLengthFt] = useState('');

  const [crossDockCapable, setCrossDockCapable] = useState(false);
  const [hasColdStorage, setHasColdStorage] = useState(false);
  const [hasHazmatCert, setHasHazmatCert] = useState(false);
  const [hasBondedStorage, setHasBondedStorage] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/locations/${id}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then(json => {
        const l = json.data;
        if (!l) return;
        setName(l.name || '');
        setAddress1(l.address1 || '');
        setAddress2(l.address2 || '');
        setCity(l.city || '');
        setState(l.state || '');
        setPostalCode(l.postalCode || '');
        setCountry(l.country || '');
        setLatitude(l.lat != null ? String(l.lat) : '');
        setLongitude(l.lng != null ? String(l.lng) : '');
        setContactName(l.contactName || '');
        setPhone(l.contactPhone || '');
        setEmail(l.contactEmail || '');
        setLocationType(l.locationType || '');
        setAppointmentRequired(l.appointmentRequired || false);
        setDockCount(l.dockCount != null ? String(l.dockCount) : '');
        setMaxTrailerLengthFt(l.maxTrailerLengthFt != null ? String(l.maxTrailerLengthFt) : '');
        const caps = l.facilityCapabilities || {};
        setCrossDockCapable(caps.crossDockCapable || false);
        setHasColdStorage(caps.hasColdStorage || false);
        setHasHazmatCert(caps.hasHazmatCert || false);
        setHasBondedStorage(caps.hasBondedStorage || false);
      })
      .catch(err => setSubmitError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const body: any = {
        name, address1, address2, city, state, postalCode, country,
        lat: latitude ? parseFloat(latitude) : undefined,
        lng: longitude ? parseFloat(longitude) : undefined,
        locationType: locationType || undefined,
        appointmentRequired,
        dockCount: dockCount ? parseInt(dockCount, 10) : undefined,
        maxTrailerLengthFt: maxTrailerLengthFt ? parseInt(maxTrailerLengthFt, 10) : undefined,
        contactName: contactName || undefined,
        contactPhone: phone || undefined,
        contactEmail: email || undefined,
        facilityCapabilities: {
          crossDockCapable,
          hasColdStorage,
          hasHazmatCert,
          hasBondedStorage,
        },
      };
      const url = isEdit ? `${API_URL}/api/v1/locations/${id}` : `${API_URL}/api/v1/locations`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save location');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate('/locations');
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

  const selectedTypeMeta = locationType ? LOCATION_TYPE_META[locationType] : null;
  const SelectedTypeIcon = locationType ? (LOCATION_TYPE_ICONS[locationType] || MapPin) : null;
  const selectedTypeVariant: BadgeVariant = locationType ? (LOCATION_TYPE_VARIANT[locationType] || 'secondary') : 'secondary';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/locations" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Locations
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{isEdit ? 'Edit location' : 'New location'}</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight">{isEdit ? 'Edit location' : 'New location'}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Location details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input type="text" placeholder="Location name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address line 1</Label>
            <Input type="text" placeholder="Street address" value={address1} onChange={e => setAddress1(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address line 2</Label>
            <Input type="text" placeholder="Suite, unit, floor, etc." value={address2} onChange={e => setAddress2(e.target.value)} />
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
            <Input type="text" placeholder="ZIP / Postal code" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue placeholder="Select country..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="MX">Mexico</SelectItem>
                <SelectItem value="UK">United Kingdom</SelectItem>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="AU">Australia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Classification &amp; facility
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Location type</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select value={locationType} onValueChange={setLocationType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOCATION_TYPE_META).map(([value, meta]) => (
                      <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTypeMeta && SelectedTypeIcon && (
                <Badge variant={selectedTypeVariant} className="whitespace-nowrap">
                  <SelectedTypeIcon className="mr-1 h-3.5 w-3.5" />
                  {selectedTypeMeta.label}
                </Badge>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dock count</Label>
            <Input type="number" min="0" step="1" placeholder="Number of docks" value={dockCount} onChange={e => setDockCount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Max trailer length (ft)</Label>
            <Input type="number" min="0" step="1" placeholder="e.g. 53" value={maxTrailerLengthFt} onChange={e => setMaxTrailerLengthFt(e.target.value)} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={appointmentRequired}
                onChange={e => setAppointmentRequired(e.target.checked)}
                className="h-4 w-4 rounded border border-input bg-background accent-primary"
              />
              Appointment required
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Facility capabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={crossDockCapable}
                onChange={e => setCrossDockCapable(e.target.checked)}
                className="h-4 w-4 rounded border border-input bg-background accent-primary"
              />
              Cross-dock capable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasColdStorage}
                onChange={e => setHasColdStorage(e.target.checked)}
                className="h-4 w-4 rounded border border-input bg-background accent-primary"
              />
              Cold storage
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasHazmatCert}
                onChange={e => setHasHazmatCert(e.target.checked)}
                className="h-4 w-4 rounded border border-input bg-background accent-primary"
              />
              Hazmat certified
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasBondedStorage}
                onChange={e => setHasBondedStorage(e.target.checked)}
                className="h-4 w-4 rounded border border-input bg-background accent-primary"
              />
              Bonded storage
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-primary" />
            Coordinates
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input type="number" step="any" placeholder="e.g. 41.8827" value={latitude} onChange={e => setLatitude(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input type="number" step="any" placeholder="e.g. -87.6588" value={longitude} onChange={e => setLongitude(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <div className="flex h-[200px] items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground">
              <MapIcon className="h-8 w-8 opacity-50" />
              <span className="text-sm">Map preview will appear here</span>
            </div>
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
            <Label>Phone</Label>
            <Input type="tel" placeholder="(555) 123-4567" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
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
          <Link to="/locations">Cancel</Link>
        </Button>
        <Button variant="gradient" onClick={handleSubmit} disabled={submitting}>
          <Save className="h-4 w-4" />
          {submitting ? 'Saving...' : isEdit ? 'Update location' : 'Save location'}
        </Button>
      </div>
    </div>
  );
}
