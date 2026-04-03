import { useState, useEffect, useRef, useCallback } from 'react';
import { useMapProvider } from '../MapProvider';
import {
  googleAutocomplete,
  googleGetPlaceDetails,
  nominatimSearch,
  GeocodingResult,
} from '../services/geocoding';

interface AddressAutocompleteProps {
  onPlaceSelected: (result: GeocodingResult) => void;
  placeholder?: string;
  value?: string;
}

export default function AddressAutocomplete({
  onPlaceSelected,
  placeholder = 'Search for an address...',
  value = '',
}: AddressAutocompleteProps) {
  const { provider } = useMapProvider();
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<
    { description: string; placeId?: string; lat?: number; lng?: number }[]
  >([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = useCallback(
    async (input: string) => {
      if (input.length < 3) {
        setSuggestions([]);
        return;
      }

      try {
        if (provider === 'google') {
          const results = await googleAutocomplete(input);
          setSuggestions(results.map((r) => ({ description: r.description, placeId: r.placeId })));
        } else {
          const results = await nominatimSearch(input);
          setSuggestions(results.map((r) => ({ description: r.description, lat: r.lat, lng: r.lng })));
        }
        setShowDropdown(true);
      } catch {
        setSuggestions([]);
      }
    },
    [provider],
  );

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = provider === 'google' ? 300 : 1000;
    debounceRef.current = setTimeout(() => search(val), delay);
  };

  const handleSelect = async (suggestion: (typeof suggestions)[0]) => {
    setShowDropdown(false);
    setQuery(suggestion.description);

    if (provider === 'google' && suggestion.placeId) {
      const result = await googleGetPlaceDetails(suggestion.placeId);
      if (result) onPlaceSelected(result);
    } else if (suggestion.lat != null && suggestion.lng != null) {
      // For Nominatim, we already have the lat/lng — do reverse for full address details
      const { nominatimReverse } = await import('../services/geocoding');
      const result = await nominatimReverse(suggestion.lat, suggestion.lng);
      if (result) onPlaceSelected(result);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div className="text-field" style={{ marginBottom: 0 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder=" "
        />
        <label>{placeholder}</label>
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--outline)',
            borderRadius: '0 0 4px 4px',
            maxHeight: '240px',
            overflowY: 'auto',
            boxShadow: 'var(--modal-shadow)',
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={i}
              onClick={() => handleSelect(s)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--on-surface)',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--outline-variant)' : undefined,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span className="material-icons" style={{ fontSize: '16px', marginRight: '8px', verticalAlign: 'middle', color: 'var(--on-surface-variant)' }}>
                location_on
              </span>
              {s.description}
            </div>
          ))}
          {provider === 'osm' && (
            <div style={{ padding: '4px 12px', fontSize: '0.6875rem', color: 'var(--on-surface-variant)', textAlign: 'right' }}>
              Data from OpenStreetMap
            </div>
          )}
        </div>
      )}
    </div>
  );
}
