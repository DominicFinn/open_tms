import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';

import { useMapProvider } from '../MapProvider';
import { googleAutocomplete, googleGetPlaceDetails } from '../services/geocoding';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface AddressValue {
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  lat?: number;
  lng?: number;
}

export const EMPTY_ADDRESS: AddressValue = {
  address1: '',
  address2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  lat: undefined,
  lng: undefined,
};

interface Props {
  idPrefix: string;
  value: AddressValue;
  onChange: (value: AddressValue) => void;
}

export function AddressFields({ idPrefix, value, onChange }: Props) {
  const { provider, isLoaded } = useMapProvider();
  const googleAvailable = isLoaded && provider === 'google';

  const [search, setSearch] = useState('');
  const [predictions, setPredictions] = useState<{ placeId: string; description: string }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hintId = useId();

  useEffect(() => {
    if (!googleAvailable) {
      setPredictions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < 3) {
      setPredictions([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await googleAutocomplete(search.trim());
        setPredictions(results);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, googleAvailable]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const update = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  const pickPrediction = async (placeId: string, description: string) => {
    setSearchOpen(false);
    setSearch(description);
    setResolving(true);
    try {
      const result = await googleGetPlaceDetails(placeId);
      if (!result) return;
      onChange({
        address1: result.address1 || '',
        address2: value.address2,
        city: result.city || '',
        state: result.state || '',
        postalCode: result.postalCode || '',
        country: result.country || '',
        lat: result.lat,
        lng: result.lng,
      });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-3">
      {googleAvailable && (
        <div ref={containerRef} className="relative space-y-2">
          <Label htmlFor={`${idPrefix}-search`} className="flex items-center gap-1 text-xs text-muted-foreground">
            <Search className="h-3 w-3" />
            Search address
          </Label>
          <div className="relative">
            <Input
              id={`${idPrefix}-search`}
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Start typing an address..."
              autoComplete="off"
              aria-describedby={hintId}
            />
            {(searching || resolving) && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {searchOpen && predictions.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md">
              {predictions.map(p => (
                <li key={p.placeId}>
                  <button
                    type="button"
                    onClick={() => pickPrediction(p.placeId, p.description)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/60"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span>{p.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p id={hintId} className="text-xs text-muted-foreground">
            Pick a suggestion to auto-fill the fields below, or fill them in manually.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-address1`}>Address line 1</Label>
        <Input
          id={`${idPrefix}-address1`}
          value={value.address1}
          onChange={e => update({ address1: e.target.value })}
          placeholder="Street address"
          autoComplete="address-line1"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-address2`}>Address line 2</Label>
        <Input
          id={`${idPrefix}-address2`}
          value={value.address2}
          onChange={e => update({ address2: e.target.value })}
          placeholder="Apartment, suite, unit, building, floor (optional)"
          autoComplete="address-line2"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-city`}>City / Town</Label>
          <Input
            id={`${idPrefix}-city`}
            value={value.city}
            onChange={e => update({ city: e.target.value })}
            autoComplete="address-level2"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-state`}>State / Province / Region</Label>
          <Input
            id={`${idPrefix}-state`}
            value={value.state}
            onChange={e => update({ state: e.target.value })}
            autoComplete="address-level1"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-postal`}>Postal / ZIP code</Label>
          <Input
            id={`${idPrefix}-postal`}
            value={value.postalCode}
            onChange={e => update({ postalCode: e.target.value })}
            autoComplete="postal-code"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-country`}>Country</Label>
          <Input
            id={`${idPrefix}-country`}
            value={value.country}
            onChange={e => update({ country: e.target.value })}
            autoComplete="country-name"
          />
        </div>
      </div>
    </div>
  );
}
