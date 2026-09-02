/**
 * The declarative map surface every screen talks to.
 *
 * A screen describes what it wants on the map. It does not touch Leaflet or google.maps, so the
 * same screen renders through either adapter without knowing which one it got. That is what makes
 * the Google canvas addable without rewriting five surfaces (#176).
 *
 * The vocabulary is deliberately small: markers, polylines, a viewport and a few callbacks. Where
 * the two libraries disagree, this picks the lowest common shape rather than exposing both. Marker
 * appearance is HTML because both libraries can render a DOM node, and popups are HTML for the
 * same reason.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapMarker {
  /** Stable across renders. Used to diff rather than rebuild every marker on every change. */
  id: string;
  position: LatLng;
  /**
   * The marker's appearance as an HTML fragment. Leaflet renders it in a divIcon, Google in an
   * advanced marker's content element. Keep it self-contained: no external stylesheet is applied
   * inside a Google marker.
   */
  html: string;
  /** Rendered size in pixels, so both adapters can anchor the icon on its centre. */
  size?: { width: number; height: number };
  /** HTML shown when the marker is clicked. Leaflet popup, Google InfoWindow. */
  popupHtml?: string;
  onClick?: () => void;
  /** Higher sits on top. Both libraries support this, with different names. */
  zIndex?: number;
}

export interface MapPolyline {
  id: string;
  points: LatLng[];
  /** A concrete CSS colour. Neither library can resolve a CSS custom property. */
  color: string;
  weight?: number;
  opacity?: number;
  /** Rendered as a dash pattern in Leaflet and as a dashed symbol path in Google. */
  dashed?: boolean;
}

export interface MapViewport {
  center: LatLng;
  zoom: number;
}

export interface MapProps {
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  /** Initial viewport. Ignored once the user moves the map, and overridden by `fitTo`. */
  initialViewport?: MapViewport;
  /**
   * Points or bounds to frame. Passing a new value re-frames the map; passing the same value does
   * nothing, so a parent can re-render freely without fighting the user's panning.
   */
  fitTo?: LatLng[] | MapBounds | null;
  /** Fires after the user finishes panning or zooming, debounced by the adapter. */
  onBoundsChange?: (bounds: MapBounds) => void;
  onZoomChange?: (zoom: number) => void;
  height?: number | string;
  className?: string;
  /** Rendered above the map, inside its container. Toolbars, legends and layer toggles. */
  children?: React.ReactNode;
  /** Announced to screen readers, since a map is otherwise opaque to them. */
  ariaLabel?: string;
}
