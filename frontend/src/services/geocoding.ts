/**
 * Geocoding service — common interface with Google and Nominatim (OSM) implementations.
 */

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

// --- Google Implementation ---

let autocompleteService: google.maps.places.AutocompleteService | null = null;
let placesService: google.maps.places.PlacesService | null = null;

function getAutocompleteService(): google.maps.places.AutocompleteService {
  if (!autocompleteService) {
    autocompleteService = new google.maps.places.AutocompleteService();
  }
  return autocompleteService;
}

function getPlacesService(): google.maps.places.PlacesService {
  if (!placesService) {
    // PlacesService needs an HTML element — create a hidden one
    const div = document.createElement('div');
    placesService = new google.maps.places.PlacesService(div);
  }
  return placesService;
}

export async function googleAutocomplete(input: string): Promise<{ placeId: string; description: string }[]> {
  const service = getAutocompleteService();
  return new Promise((resolve) => {
    service.getPlacePredictions({ input, types: ['geocode', 'establishment'] }, (predictions, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
        resolve([]);
        return;
      }
      resolve(predictions.map((p) => ({ placeId: p.place_id, description: p.description })));
    });
  });
}

export async function googleGetPlaceDetails(placeId: string): Promise<GeocodingResult | null> {
  const service = getPlacesService();
  return new Promise((resolve) => {
    service.getDetails({ placeId, fields: ['geometry', 'formatted_address', 'address_components'] }, (place, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
        resolve(null);
        return;
      }
      resolve(parseGoogleResult(place));
    });
  });
}

function parseGoogleResult(place: google.maps.places.PlaceResult | google.maps.GeocoderResult): GeocodingResult {
  const components = place.address_components || [];
  const get = (type: string) => components.find((c) => c.types.includes(type))?.long_name || '';

  const lat = 'geometry' in place && place.geometry?.location
    ? (typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : 0)
    : 0;
  const lng = 'geometry' in place && place.geometry?.location
    ? (typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : 0)
    : 0;

  return {
    lat,
    lng,
    formattedAddress: place.formatted_address || '',
    address1: [get('street_number'), get('route')].filter(Boolean).join(' ') || undefined,
    city: get('locality') || get('postal_town') || get('sublocality') || undefined,
    state: get('administrative_area_level_1') || undefined,
    postalCode: get('postal_code') || undefined,
    country: get('country') || undefined,
  };
}

// --- Nominatim (OSM) Implementation ---

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export async function nominatimSearch(query: string): Promise<GeocodingResult[]> {
  const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
  // Note: the browser refuses to let us set User-Agent, so Nominatim identifies us by Referer.
  // Their usage policy caps us at one request a second, which the caller's debounce respects.
  const res = await fetch(url);
  if (!res.ok) return [];
  const data: NominatimResult[] = await res.json();
  return data.map(parseNominatimResult);
}

export async function nominatimReverse(lat: number, lng: number): Promise<GeocodingResult | null> {
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'OpenTMS/1.0' },
  });
  const data: NominatimResult = await res.json();
  if (!data.lat) {
    return { lat, lng, formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
  }
  return parseNominatimResult(data);
}

function parseNominatimResult(result: NominatimResult): GeocodingResult {
  const addr = result.address || {};
  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    formattedAddress: result.display_name,
    address1: [addr.house_number, addr.road].filter(Boolean).join(' ') || undefined,
    city: addr.city || addr.town || addr.village || undefined,
    state: addr.state || undefined,
    postalCode: addr.postcode || undefined,
    country: addr.country || undefined,
  };
}

// --- Mode-agnostic surface ---------------------------------------------------
//
// Screens ask for an address search without caring who answers. Google returns a place id that
// has to be exchanged for details in a second call; Nominatim hands back the full address up
// front. That difference is hidden here: a suggestion always carries an opaque id, and
// `resolveSuggestion` knows how to turn it back into an address for whichever mode produced it.

import type { MapMode } from '../maps/capabilities';

export interface AddressSuggestion {
  id: string;
  description: string;
}

/** Nominatim gives us the whole answer with the suggestion, so resolving it costs no request. */
const nominatimResults = new Map<string, GeocodingResult>();

/**
 * Nominatim's usage policy allows roughly one request a second. Google Places has no such limit
 * and feels sluggish if we wait that long, so the debounce differs by mode.
 */
export function searchDebounceMs(mode: MapMode): number {
  return mode === 'google' ? 250 : 800;
}

export async function searchAddresses(mode: MapMode, query: string): Promise<AddressSuggestion[]> {
  if (mode === 'google') {
    const predictions = await googleAutocomplete(query);
    return predictions.map((p) => ({ id: p.placeId, description: p.description }));
  }

  const results = await nominatimSearch(query);
  nominatimResults.clear();
  return results.map((result, index) => {
    const id = `nominatim:${index}:${result.lat},${result.lng}`;
    nominatimResults.set(id, result);
    return { id, description: result.formattedAddress };
  });
}

export async function resolveSuggestion(
  mode: MapMode,
  suggestion: AddressSuggestion
): Promise<GeocodingResult | null> {
  if (mode === 'google') return googleGetPlaceDetails(suggestion.id);
  return nominatimResults.get(suggestion.id) ?? null;
}
