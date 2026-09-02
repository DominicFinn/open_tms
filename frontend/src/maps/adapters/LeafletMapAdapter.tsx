/**
 * Leaflet implementation of the declarative map surface.
 *
 * This is the canvas in OSM mode, and the fallback in Google mode until a Google key is present.
 * It draws OpenStreetMap tiles through the single shared basemap factory.
 *
 * Markers and polylines are diffed by id rather than cleared and rebuilt, because the operations
 * map re-renders on every bounding-box fetch and rebuilding several hundred markers each time
 * makes panning stutter.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  keepMapSized,
  worldBoundsMapOptions,
  capWorldZoomOut,
  addBaseTileLayer,
} from '../../lib/leafletMap';
import type { MapBounds, MapProps, MapMarker, MapPolyline } from '../types';

const BOUNDS_DEBOUNCE_MS = 300;

function toBounds(map: L.Map): MapBounds {
  const b = map.getBounds();
  return { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
}

export default function LeafletMapAdapter({
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
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<Map<string, L.Marker>>(new Map());
  const lineLayerRef = useRef<Map<string, L.Polyline>>(new Map());
  const lastFitRef = useRef<string | null>(null);

  // Callbacks are read through refs so changing a handler does not tear down the map.
  const boundsHandler = useRef(onBoundsChange);
  const zoomHandler = useRef(onZoomChange);
  boundsHandler.current = onBoundsChange;
  zoomHandler.current = onZoomChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      ...worldBoundsMapOptions,
    }).setView(
      [initialViewport?.center.lat ?? 39.5, initialViewport?.center.lng ?? -98.5],
      initialViewport?.zoom ?? 4
    );
    addBaseTileLayer(map);
    capWorldZoomOut(map);
    mapRef.current = map;
    const stopSizing = keepMapSized(map, containerRef.current);

    let debounce: ReturnType<typeof setTimeout>;
    const onMoveEnd = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => boundsHandler.current?.(toBounds(map)), BOUNDS_DEBOUNCE_MS);
    };
    const onZoomEnd = () => zoomHandler.current?.(map.getZoom());
    map.on('moveend', onMoveEnd);
    map.on('zoomend', onZoomEnd);

    return () => {
      clearTimeout(debounce);
      stopSizing();
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onZoomEnd);
      map.remove();
      mapRef.current = null;
      markerLayerRef.current.clear();
      lineLayerRef.current.clear();
    };
    // Deliberately mount-only: the viewport props seed the map and are not reapplied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncMarkers(map, markerLayerRef.current, markers);
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncPolylines(map, lineLayerRef.current, polylines);
  }, [polylines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitTo) return;

    // Re-framing only when the target actually changes, so a parent re-render does not yank the
    // map back while someone is panning around it.
    const signature = JSON.stringify(fitTo);
    if (signature === lastFitRef.current) return;
    lastFitRef.current = signature;

    const bounds = Array.isArray(fitTo)
      ? fitTo.length > 0
        ? L.latLngBounds(fitTo.map((p) => [p.lat, p.lng] as [number, number]))
        : null
      : L.latLngBounds([fitTo.south, fitTo.west], [fitTo.north, fitTo.east]);

    if (bounds?.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
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

function syncMarkers(map: L.Map, existing: Map<string, L.Marker>, next: MapMarker[]) {
  const wanted = new Set(next.map((m) => m.id));

  for (const [id, marker] of existing) {
    if (!wanted.has(id)) {
      marker.remove();
      existing.delete(id);
    }
  }

  for (const spec of next) {
    const icon = L.divIcon({
      className: '',
      html: spec.html,
      iconSize: spec.size ? [spec.size.width, spec.size.height] : undefined,
      iconAnchor: spec.size ? [spec.size.width / 2, spec.size.height / 2] : undefined,
    });

    const current = existing.get(spec.id);
    if (current) {
      current.setLatLng([spec.position.lat, spec.position.lng]);
      current.setIcon(icon);
      if (spec.zIndex !== undefined) current.setZIndexOffset(spec.zIndex);
      continue;
    }

    const marker = L.marker([spec.position.lat, spec.position.lng], {
      icon,
      zIndexOffset: spec.zIndex,
    }).addTo(map);
    if (spec.popupHtml) marker.bindPopup(spec.popupHtml);
    if (spec.onClick) marker.on('click', spec.onClick);
    existing.set(spec.id, marker);
  }
}

function syncPolylines(map: L.Map, existing: Map<string, L.Polyline>, next: MapPolyline[]) {
  const wanted = new Set(next.map((p) => p.id));

  for (const [id, line] of existing) {
    if (!wanted.has(id)) {
      line.remove();
      existing.delete(id);
    }
  }

  for (const spec of next) {
    const latLngs = spec.points.map((p) => [p.lat, p.lng] as [number, number]);
    const style = {
      color: spec.color,
      weight: spec.weight ?? 3,
      opacity: spec.opacity ?? 0.8,
      dashArray: spec.dashed ? '8 8' : undefined,
    };

    const current = existing.get(spec.id);
    if (current) {
      current.setLatLngs(latLngs);
      current.setStyle(style);
      continue;
    }

    existing.set(spec.id, L.polyline(latLngs, style).addTo(map));
  }
}
