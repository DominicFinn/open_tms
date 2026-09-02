/**
 * Google Maps implementation of the declarative map surface.
 *
 * Used when an organisation has configured a browser key. It renders through `google.maps.Map`,
 * so the map carries Google's own basemap, controls and imagery rather than OSM tiles. That is
 * the only legitimate way to show Google's cartography: their terms forbid feeding their tiles to
 * a third-party library such as Leaflet.
 *
 * The Maps JS script is loaded by MapProvider before this ever mounts, so `window.google.maps` is
 * assumed present. It is still checked, because a script that failed to load leaves the app in
 * OSM mode and this component should never have been selected.
 *
 * Markers use AdvancedMarkerElement where the marker library is available, since it takes a DOM
 * node and can therefore render the same HTML the Leaflet adapter puts in a divIcon. Where it is
 * not, it falls back to a classic Marker with the HTML rasterised out, which loses the styling but
 * keeps the map usable.
 */

import { useEffect, useRef } from 'react';
import type { MapBounds, MapProps, MapMarker, MapPolyline } from '../types';

const BOUNDS_DEBOUNCE_MS = 300;

type AnyMarker = google.maps.Marker | google.maps.marker.AdvancedMarkerElement;

function toBounds(map: google.maps.Map): MapBounds | null {
  const b = map.getBounds();
  if (!b) return null;
  const ne = b.getNorthEast();
  const sw = b.getSouthWest();
  return { north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng() };
}

function markerContent(spec: MapMarker): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = spec.html;
  if (spec.size) {
    el.style.width = `${spec.size.width}px`;
    el.style.height = `${spec.size.height}px`;
  }
  return el;
}

export default function GoogleMapAdapter({
  markers = [],
  polylines = [],
  initialViewport,
  fitTo,
  onBoundsChange,
  onZoomChange,
  height = 400,
  className,
  children,
  ariaLabel,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<Map<string, AnyMarker>>(new Map());
  const lineRef = useRef<Map<string, google.maps.Polyline>>(new Map());
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const lastFitRef = useRef<string | null>(null);

  const boundsHandler = useRef(onBoundsChange);
  const zoomHandler = useRef(onZoomChange);
  boundsHandler.current = onBoundsChange;
  zoomHandler.current = onZoomChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!window.google?.maps) return;

    const map = new google.maps.Map(containerRef.current, {
      center: initialViewport?.center ?? { lat: 39.5, lng: -98.5 },
      zoom: initialViewport?.zoom ?? 4,
      // An operations map is for reading positions, not for exploring places, so the extra
      // surfaces Google turns on by default are noise here.
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
    });
    mapRef.current = map;
    infoRef.current = new google.maps.InfoWindow();

    let debounce: ReturnType<typeof setTimeout>;
    const idleListener = map.addListener('idle', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const b = toBounds(map);
        if (b) boundsHandler.current?.(b);
      }, BOUNDS_DEBOUNCE_MS);
    });
    const zoomListener = map.addListener('zoom_changed', () => {
      const z = map.getZoom();
      if (typeof z === 'number') zoomHandler.current?.(z);
    });

    return () => {
      clearTimeout(debounce);
      idleListener.remove();
      zoomListener.remove();
      markerRef.current.forEach(removeMarker);
      markerRef.current.clear();
      lineRef.current.forEach((line) => line.setMap(null));
      lineRef.current.clear();
      infoRef.current?.close();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncMarkers(map, markerRef.current, markers, infoRef.current);
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncPolylines(map, lineRef.current, polylines);
  }, [polylines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitTo) return;

    const signature = JSON.stringify(fitTo);
    if (signature === lastFitRef.current) return;
    lastFitRef.current = signature;

    const bounds = new google.maps.LatLngBounds();
    if (Array.isArray(fitTo)) {
      if (fitTo.length === 0) return;
      fitTo.forEach((p) => bounds.extend(p));
    } else {
      bounds.extend({ lat: fitTo.south, lng: fitTo.west });
      bounds.extend({ lat: fitTo.north, lng: fitTo.east });
    }
    map.fitBounds(bounds, 40);
  }, [fitTo]);

  return (
    <div className={className} style={{ position: 'relative', height: typeof height === 'number' ? `${height}px` : height }}>
      <div
        ref={containerRef}
        role="application"
        aria-label={ariaLabel ?? 'Map'}
        style={{ position: 'absolute', inset: 0 }}
      />
      {children}
    </div>
  );
}

function removeMarker(marker: AnyMarker) {
  if ('setMap' in marker) marker.setMap(null);
  else (marker as google.maps.marker.AdvancedMarkerElement).map = null;
}

function syncMarkers(
  map: google.maps.Map,
  existing: Map<string, AnyMarker>,
  next: MapMarker[],
  info: google.maps.InfoWindow | null
) {
  const wanted = new Set(next.map((m) => m.id));

  for (const [id, marker] of existing) {
    if (!wanted.has(id)) {
      removeMarker(marker);
      existing.delete(id);
    }
  }

  const AdvancedMarker = google.maps.marker?.AdvancedMarkerElement;

  for (const spec of next) {
    const current = existing.get(spec.id);
    if (current) {
      if (AdvancedMarker && current instanceof AdvancedMarker) {
        current.position = spec.position;
        current.content = markerContent(spec);
      } else {
        (current as google.maps.Marker).setPosition(spec.position);
      }
      continue;
    }

    let marker: AnyMarker;
    if (AdvancedMarker) {
      marker = new AdvancedMarker({
        map,
        position: spec.position,
        content: markerContent(spec),
        zIndex: spec.zIndex,
      });
    } else {
      // The marker library is unavailable, so the HTML cannot be rendered. A plain pin keeps the
      // map readable rather than dropping the marker entirely.
      marker = new google.maps.Marker({ map, position: spec.position, zIndex: spec.zIndex });
    }

    marker.addListener('click', () => {
      if (spec.popupHtml && info) {
        info.setContent(spec.popupHtml);
        info.open({ map, anchor: marker as google.maps.marker.AdvancedMarkerElement });
      }
      spec.onClick?.();
    });

    existing.set(spec.id, marker);
  }
}

function syncPolylines(
  map: google.maps.Map,
  existing: Map<string, google.maps.Polyline>,
  next: MapPolyline[]
) {
  const wanted = new Set(next.map((p) => p.id));

  for (const [id, line] of existing) {
    if (!wanted.has(id)) {
      line.setMap(null);
      existing.delete(id);
    }
  }

  for (const spec of next) {
    const options: google.maps.PolylineOptions = {
      path: spec.points,
      strokeColor: spec.color,
      strokeWeight: spec.weight ?? 3,
      // Google draws a dashed line by repeating a dash symbol along an otherwise invisible stroke.
      strokeOpacity: spec.dashed ? 0 : spec.opacity ?? 0.8,
      icons: spec.dashed
        ? [{
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: spec.opacity ?? 0.8,
              strokeColor: spec.color,
              scale: 3,
            },
            offset: '0',
            repeat: '16px',
          }]
        : undefined,
    };

    const current = existing.get(spec.id);
    if (current) {
      current.setOptions(options);
      continue;
    }

    existing.set(spec.id, new google.maps.Polyline({ ...options, map }));
  }
}
