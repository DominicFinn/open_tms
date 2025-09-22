import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../api';

interface Location {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  lat?: number;
  lng?: number;
}

interface LocationSearchProps {
  value: string;
  onChange: (locationId: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  onLocationSelect?: (location: Location) => void;
}

export default function LocationSearch({
  value,
  onChange,
  placeholder = "Search locations...",
  label = "Location",
  disabled = false,
  onLocationSelect
}: LocationSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load all locations on mount
  useEffect(() => {
    const loadLocations = async () => {
      setLoading(true);
      try {
        const response = await fetch(API_URL + '/api/v1/locations');
        const result = await response.json();
        setLocations(result.data || []);
      } catch (error) {
        console.error('Failed to load locations:', error);
      } finally {
        setLoading(false);
      }
    };
    loadLocations();
  }, []);

  // Debounced search function
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredLocations([]);
      return;
    }

    const searchLocations = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/v1/locations/search?q=${encodeURIComponent(searchTerm)}`);
        const result = await response.json();
        setFilteredLocations(result.data || []);
      } catch (error) {
        console.error('Failed to search locations:', error);
        // Fallback to local filtering
        const filtered = locations.filter(location => {
          const searchLower = searchTerm.toLowerCase();
          return (
            location.name.toLowerCase().includes(searchLower) ||
            location.city.toLowerCase().includes(searchLower) ||
            location.state?.toLowerCase().includes(searchLower) ||
            location.country.toLowerCase().includes(searchLower) ||
            location.address1.toLowerCase().includes(searchLower)
          );
        });
        setFilteredLocations(filtered);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchLocations, 300); // 300ms debounce
    return () => clearTimeout(timeoutId);
  }, [searchTerm, locations]);

  // Find selected location when value changes
  useEffect(() => {
    if (value && locations.length > 0) {
      const location = locations.find(l => l.id === value);
      if (location) {
        setSelectedLocation(location);
        setSearchTerm(`${location.name} - ${location.city}${location.state ? `, ${location.state}` : ''}`);
      }
    } else {
      setSelectedLocation(null);
      setSearchTerm('');
    }
  }, [value, locations]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setIsOpen(term.length > 0);
    
    // Clear selection if user is typing
    if (selectedLocation && term !== `${selectedLocation.name} - ${selectedLocation.city}${selectedLocation.state ? `, ${selectedLocation.state}` : ''}`) {
      onChange('');
      setSelectedLocation(null);
    }
  };

  // Handle location selection
  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location);
    setSearchTerm(`${location.name} - ${location.city}${location.state ? `, ${location.state}` : ''}`);
    onChange(location.id);
    setIsOpen(false);
    
    if (onLocationSelect) {
      onLocationSelect(location);
    }
  };

  // Handle input focus
  const handleFocus = () => {
    if (searchTerm.length > 0) {
      setIsOpen(true);
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    const items = filteredLocations;
    const currentIndex = items.findIndex(item => item.id === value);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        if (items[nextIndex]) {
          handleLocationSelect(items[nextIndex]);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        if (items[prevIndex]) {
          handleLocationSelect(items[prevIndex]);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredLocations.length > 0) {
          handleLocationSelect(filteredLocations[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="text-field" style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        style={{ paddingRight: '40px' }}
      />
      <label>{label}</label>
      
      {/* Search icon */}
      <span 
        className="material-icons" 
        style={{ 
          position: 'absolute', 
          right: '12px', 
          top: '50%', 
          transform: 'translateY(-50%)',
          color: 'var(--on-surface-variant)',
          pointerEvents: 'none'
        }}
      >
        search
      </span>

      {/* Loading indicator */}
      {loading && (
        <span 
          className="material-icons" 
          style={{ 
            position: 'absolute', 
            right: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--primary)',
            animation: 'spin 1s linear infinite'
          }}
        >
          refresh
        </span>
      )}

      {/* Dropdown */}
      {isOpen && filteredLocations.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--outline)',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {filteredLocations.map((location) => (
            <div
              key={location.id}
              onClick={() => handleLocationSelect(location)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--outline-variant)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-variant)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ fontWeight: '500', color: 'var(--on-surface)' }}>
                {location.name}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
                {location.address1}, {location.city}
                {location.state && `, ${location.state}`}
                {location.postalCode && ` ${location.postalCode}`}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                {location.country}
                {location.lat && location.lng && (
                  <span style={{ marginLeft: '8px' }}>
                    📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && searchTerm.length > 0 && filteredLocations.length === 0 && !loading && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--outline)',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            padding: '12px 16px',
            color: 'var(--on-surface-variant)',
            textAlign: 'center'
          }}
        >
          No locations found
        </div>
      )}
    </div>
  );
}
