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
let geocoder: google.maps.Geocoder | null = null;

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

function getGeocoder(): google.maps.Geocoder {
  if (!geocoder) {
    geocoder = new google.maps.Geocoder();
  }
  return geocoder;
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

export async function googleReverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  const gc = getGeocoder();
  return new Promise((resolve) => {
    gc.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== 'OK' || !results?.[0]) {
        resolve({ lat, lng, formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
        return;
      }
      resolve(parseGoogleResult(results[0]));
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

export async function nominatimSearch(query: string): Promise<{ description: string; lat: number; lng: number }[]> {
  const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'OpenTMS/1.0' },
  });
  const data: NominatimResult[] = await res.json();
  return data.map((r) => ({
    description: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));
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
  const addr = data.address || {};
  return {
    lat: parseFloat(data.lat),
    lng: parseFloat(data.lon),
    formattedAddress: data.display_name,
    address1: [addr.house_number, addr.road].filter(Boolean).join(' ') || undefined,
    city: addr.city || addr.town || addr.village || undefined,
    state: addr.state || undefined,
    postalCode: addr.postcode || undefined,
    country: addr.country || undefined,
  };
}

export function nominatimGetDetails(_lat: number, _lng: number): Promise<GeocodingResult | null> {
  return nominatimReverse(_lat, _lng);
}
