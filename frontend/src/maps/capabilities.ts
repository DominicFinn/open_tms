/**
 * What each map mode can actually do.
 *
 * The app has two map modes. OSM mode is the default and needs no credentials: free tiles, a
 * basic view, and geocoding through Nominatim. Google mode turns on when an organisation
 * configures a Maps API key, and unlocks the things only Google can give us.
 *
 * BUSINESS RULE: features gate on a named capability, never on `mode === 'google'`. A screen
 * should say what it needs ("I need route planning"), not who provides it. That way adding a
 * third mode, or moving a capability between modes, touches this file and nothing else.
 *
 * A note on basemaps, because it surprises people: Google's terms require their tiles be
 * rendered through the Google Maps JS API, so they cannot be used as a Leaflet tile layer.
 * Our Leaflet surfaces therefore draw OSM tiles in both modes, and `googleCanvas` stays false
 * until a real google.maps.Map adapter exists. Google mode changes what the map can do, not
 * what it looks like.
 */

export type MapMode = 'google' | 'osm';

export interface MapCapabilities {
  mode: MapMode;
  /** Type-ahead address search that fills in a full structured address. */
  addressAutocomplete: boolean;
  /** Turn a lat/lng back into a postal address. */
  reverseGeocode: boolean;
  /** Draw and drag a road route between stops, and read back its geometry. */
  routePlanning: boolean;
  /** Reorder a route by dragging it on the map. Needs a live directions service. */
  draggableRoute: boolean;
  /** Live traffic overlay. */
  trafficLayer: boolean;
  /** Street-level imagery. */
  streetView: boolean;
  /** Whether map surfaces render through google.maps.Map rather than Leaflet. */
  googleCanvas: boolean;
}

const OSM_CAPABILITIES: MapCapabilities = {
  mode: 'osm',
  // Nominatim covers both of these. It is slower and coarser than Places, and its usage policy
  // caps us at one request a second, which is why the search box debounces hard.
  addressAutocomplete: true,
  reverseGeocode: true,
  // Straight-line and manually placed waypoints only. A server-side routing provider can still
  // give real road geometry — see ROUTING_PROVIDER in the backend — but the map cannot draw it
  // interactively, so we do not claim the capability here.
  routePlanning: false,
  draggableRoute: false,
  trafficLayer: false,
  streetView: false,
  googleCanvas: false,
};

const GOOGLE_CAPABILITIES: MapCapabilities = {
  mode: 'google',
  addressAutocomplete: true,
  reverseGeocode: true,
  routePlanning: true,
  draggableRoute: true,
  trafficLayer: true,
  streetView: true,
  // Deferred, not impossible. See the note at the top of this file.
  googleCanvas: false,
};

export function capabilitiesFor(mode: MapMode): MapCapabilities {
  return mode === 'google' ? GOOGLE_CAPABILITIES : OSM_CAPABILITIES;
}

/** Shown where a capability is missing, so the user learns why rather than seeing a dead control. */
export const CAPABILITY_UNAVAILABLE_HINT =
  'This needs a Google Maps API key. An administrator can add one under Settings, Map settings.';
