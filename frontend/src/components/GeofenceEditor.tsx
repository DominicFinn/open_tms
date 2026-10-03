/**
 * Radial or polygon geofence editor for a Location, drawn by hand on a Leaflet map — no drawing
 * plugin installed, same hand-rolled click-to-place approach as OsmRouteEditor.tsx.
 *
 * Fully controlled: local map state (center/radius or vertex list) is seeded once from `value`
 * (editing an existing geofence) and every user action re-emits the finished shape via `onChange`,
 * or `null` while the shape is incomplete (no center yet, or fewer than 3 polygon points) or after
 * Clear. The caller owns persistence — this component only produces geometry.
 *
 * The radial center, the radius handle, and every polygon vertex are draggable and redraw the
 * shape live (via direct Leaflet layer mutation) during the drag, only committing to React state —
 * and re-emitting — on drag end. A separate, non-interactive marker shows the location's own
 * lat/lng (distinct from the geofence's own center) so it's clear where the shape sits relative to
 * the location it belongs to.
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Info, Trash2, Undo2 } from 'lucide-react';
import {
  GEOFENCE_MIN_RADIUS_METERS,
  GEOFENCE_MAX_RADIUS_METERS,
  radiusOutOfBoundsMessage,
  polygonAreaOutOfBoundsMessage,
} from '@open-tms/shared';
import { keepMapSized, worldBoundsMapOptions, capWorldZoomOut, addBaseTileLayer } from '../lib/leafletMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const GEOFENCE_COLOUR = '#3b82f6';
const DEFAULT_RADIUS_METERS = 250;
const DEFAULT_VIEW: [number, number] = [39.5, -98.5];
const DEFAULT_ZOOM = 4;
const LOCATION_ZOOM = 14;

export interface RadialGeometry {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}

export interface PolygonGeometry {
  points: { lat: number; lng: number }[];
}

export interface GeofenceValue {
  name?: string;
  shapeType: 'radial' | 'polygon';
  geometry: RadialGeometry | PolygonGeometry;
}

export interface GeofenceEditorProps {
  value: GeofenceValue | null;
  onChange: (value: GeofenceValue | null) => void;
  centerLat?: number | null;
  centerLng?: number | null;
  height?: number | string;
}

type LatLng = { lat: number; lng: number };

const dotIcon = () =>
  L.divIcon({
    className: '',
    html: `<div class="h-4 w-4 cursor-move rounded-full border-2 border-background bg-primary shadow"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const numberIcon = (text: string) =>
  L.divIcon({
    className: '',
    html: `<div class="flex h-6 w-6 cursor-move items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-semibold text-primary-foreground shadow">${text}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

/** Small diamond handle on the circle's edge — visually distinct from the round move handles. */
const resizeHandleIcon = () =>
  L.divIcon({
    className: '',
    html: `<div class="h-3 w-3 rotate-45 cursor-ew-resize border-2 border-background bg-primary shadow"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

/** Marks the location's own lat/lng — a fixed reference point, not part of the geofence shape. */
const locationIcon = () =>
  L.divIcon({
    className: '',
    html: `<div class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-foreground/70 bg-background/60"><div class="h-1.5 w-1.5 rounded-full bg-foreground"></div></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

export default function GeofenceEditor({
  value,
  onChange,
  centerLat,
  centerLng,
  height = 380,
}: GeofenceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const shapeLayerRef = useRef<L.Circle | L.Polygon | L.Polyline | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const locationMarkerRef = useRef<L.Marker | null>(null);

  const [shapeType, setShapeType] = useState<'radial' | 'polygon'>(value?.shapeType ?? 'radial');
  const [name, setName] = useState(value?.name ?? '');
  const [center, setCenter] = useState<LatLng | null>(
    value?.shapeType === 'radial' ? { lat: (value.geometry as RadialGeometry).centerLat, lng: (value.geometry as RadialGeometry).centerLng } : null
  );
  const [radiusMeters, setRadiusMeters] = useState(
    value?.shapeType === 'radial' ? (value.geometry as RadialGeometry).radiusMeters : DEFAULT_RADIUS_METERS
  );
  const [points, setPoints] = useState<LatLng[]>(
    value?.shapeType === 'polygon' ? (value.geometry as PolygonGeometry).points : []
  );
  const [geometryError, setGeometryError] = useState<string | null>(null);

  // Map setup — created once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialView: [number, number] =
      centerLat != null && centerLng != null ? [centerLat, centerLng] : DEFAULT_VIEW;
    const initialZoom = centerLat != null && centerLng != null ? LOCATION_ZOOM : DEFAULT_ZOOM;

    const map = L.map(containerRef.current, { zoomControl: true, ...worldBoundsMapOptions }).setView(
      initialView,
      initialZoom
    );
    addBaseTileLayer(map);
    capWorldZoomOut(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const stopSizing = keepMapSized(map, containerRef.current);

    return () => {
      stopSizing();
      map.remove();
      mapRef.current = null;
      shapeLayerRef.current = null;
      markersRef.current = null;
      locationMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The location's own lat/lng — a fixed reference marker, independent of the geofence shape and
  // never cleared by the shape-redraw effect below. Also keeps the map panned there as the
  // coordinates change, as long as nothing has been drawn yet — once a shape exists, further
  // coordinate edits move the marker but leave the view alone rather than yanking it away from
  // an in-progress edit (use the "Center on location" button for that).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    locationMarkerRef.current?.remove();
    locationMarkerRef.current = null;

    if (centerLat != null && centerLng != null) {
      locationMarkerRef.current = L.marker([centerLat, centerLng], {
        icon: locationIcon(),
        interactive: false,
        keyboard: false,
      })
        .bindTooltip('Location', { direction: 'top', offset: [0, -10] })
        .addTo(map);

      const hasShape = shapeType === 'radial' ? !!center : points.length > 0;
      if (!hasShape) {
        map.setView([centerLat, centerLng], Math.max(map.getZoom(), LOCATION_ZOOM));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerLat, centerLng]);

  const handleCenterOnLocation = () => {
    const map = mapRef.current;
    if (!map || centerLat == null || centerLng == null) return;
    map.setView([centerLat, centerLng], Math.max(map.getZoom(), LOCATION_ZOOM));
  };

  const emitChange = (
    nextShapeType: 'radial' | 'polygon',
    nextCenter: LatLng | null,
    nextRadius: number,
    nextPoints: LatLng[],
    nextName: string
  ) => {
    if (nextShapeType === 'radial') {
      if (!nextCenter || nextRadius <= 0) {
        setGeometryError(null);
        onChange(null);
        return;
      }
      const error = radiusOutOfBoundsMessage(nextRadius);
      setGeometryError(error);
      if (error) {
        onChange(null);
        return;
      }
      onChange({
        name: nextName || undefined,
        shapeType: 'radial',
        geometry: { centerLat: nextCenter.lat, centerLng: nextCenter.lng, radiusMeters: nextRadius },
      });
    } else {
      if (nextPoints.length < 3) {
        setGeometryError(null);
        onChange(null);
        return;
      }
      const error = polygonAreaOutOfBoundsMessage(nextPoints);
      setGeometryError(error);
      if (error) {
        onChange(null);
        return;
      }
      onChange({ name: nextName || undefined, shapeType: 'polygon', geometry: { points: nextPoints } });
    }
  };

  const handleTabChange = (tab: string) => {
    const nextShapeType = tab as 'radial' | 'polygon';
    setShapeType(nextShapeType);
    setCenter(null);
    setPoints([]);
    setGeometryError(null);
    onChange(null);
  };

  const handleRadiusChange = (raw: string) => {
    const next = Number(raw);
    setRadiusMeters(next);
    emitChange('radial', center, next, points, name);
  };

  const handleNameChange = (next: string) => {
    setName(next);
    emitChange(shapeType, center, radiusMeters, points, next);
  };

  const handleClear = () => {
    setCenter(null);
    setPoints([]);
    setGeometryError(null);
    onChange(null);
  };

  const handleUndoPoint = () => {
    const next = points.slice(0, -1);
    setPoints(next);
    emitChange('polygon', center, radiusMeters, next, name);
  };

  // Map click: place/move the radial center, or append a polygon vertex.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: L.LeafletMouseEvent) => {
      const pt = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (shapeType === 'radial') {
        setCenter(pt);
        emitChange('radial', pt, radiusMeters, points, name);
      } else {
        const next = [...points, pt];
        setPoints(next);
        emitChange('polygon', center, radiusMeters, next, name);
      }
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [shapeType, radiusMeters, points, center, name]);

  // Redraw the shape whenever its geometry changes.
  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;

    shapeLayerRef.current?.remove();
    shapeLayerRef.current = null;
    markers.clearLayers();

    if (shapeType === 'radial' && center) {
      const circle = L.circle([center.lat, center.lng], {
        radius: radiusMeters,
        color: GEOFENCE_COLOUR,
        fillColor: GEOFENCE_COLOUR,
        fillOpacity: 0.15,
      }).addTo(map);
      shapeLayerRef.current = circle;

      const centerMarker = L.marker([center.lat, center.lng], { icon: dotIcon(), draggable: true }).addTo(markers);
      const edgeStart = circle.getBounds().getEast();
      const edgeMarker = L.marker([center.lat, edgeStart], { icon: resizeHandleIcon(), draggable: true }).addTo(
        markers
      );

      centerMarker.on('drag', () => {
        const ll = centerMarker.getLatLng();
        circle.setLatLng(ll);
        edgeMarker.setLatLng([ll.lat, circle.getBounds().getEast()]);
      });
      centerMarker.on('dragend', () => {
        const ll = centerMarker.getLatLng();
        const next = { lat: ll.lat, lng: ll.lng };
        setCenter(next);
        emitChange('radial', next, radiusMeters, points, name);
      });

      edgeMarker.on('drag', () => {
        const ll = edgeMarker.getLatLng();
        const newRadius = map.distance(circle.getLatLng(), ll);
        if (newRadius > 0) circle.setRadius(newRadius);
      });
      edgeMarker.on('dragend', () => {
        const ll = edgeMarker.getLatLng();
        const rawRadius = Math.round(map.distance(circle.getLatLng(), ll));
        const newRadius = Math.min(GEOFENCE_MAX_RADIUS_METERS, Math.max(GEOFENCE_MIN_RADIUS_METERS, rawRadius));
        circle.setRadius(newRadius);
        setRadiusMeters(newRadius);
        emitChange('radial', center, newRadius, points, name);
      });

      map.fitBounds(circle.getBounds(), { padding: [40, 40] });
    } else if (shapeType === 'polygon' && points.length > 0) {
      if (points.length >= 3) {
        const polygon = L.polygon(points.map((p) => [p.lat, p.lng] as [number, number]), {
          color: GEOFENCE_COLOUR,
          fillColor: GEOFENCE_COLOUR,
          fillOpacity: 0.15,
        }).addTo(map);
        shapeLayerRef.current = polygon;
        map.fitBounds(polygon.getBounds(), { padding: [40, 40] });
      } else {
        shapeLayerRef.current = L.polyline(points.map((p) => [p.lat, p.lng] as [number, number]), {
          color: GEOFENCE_COLOUR,
          dashArray: '4 4',
        }).addTo(map);
      }
      points.forEach((p, i) => {
        const marker = L.marker([p.lat, p.lng], { icon: numberIcon(String(i + 1)), draggable: true }).addTo(
          markers
        );
        marker.on('drag', () => {
          const ll = marker.getLatLng();
          const live = points.map((pt, idx) => (idx === i ? { lat: ll.lat, lng: ll.lng } : pt));
          const layer = shapeLayerRef.current as L.Polygon | L.Polyline | null;
          layer?.setLatLngs(live.map((pt) => [pt.lat, pt.lng] as [number, number]));
        });
        marker.on('dragend', () => {
          const ll = marker.getLatLng();
          const next = points.map((pt, idx) => (idx === i ? { lat: ll.lat, lng: ll.lng } : pt));
          setPoints(next);
          emitChange('polygon', center, radiusMeters, next, name);
        });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const next = points.filter((_, idx) => idx !== i);
          setPoints(next);
          emitChange('polygon', center, radiusMeters, next, name);
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeType, center, radiusMeters, points]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={shapeType} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="radial">Radial</TabsTrigger>
            <TabsTrigger value="polygon">Polygon</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          {centerLat != null && centerLng != null && (
            <Button variant="outline" size="sm" onClick={handleCenterOnLocation}>
              <Crosshair className="h-4 w-4" />
              Center on location
            </Button>
          )}
          {shapeType === 'polygon' && (
            <Button variant="outline" size="sm" onClick={handleUndoPoint} disabled={points.length === 0}>
              <Undo2 className="h-4 w-4" />
              Undo point
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={!center && points.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Name (optional)</Label>
          <Input
            type="text"
            placeholder="e.g. Yard boundary"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>
        {shapeType === 'radial' && (
          <div className="space-y-2">
            <Label>Radius (meters)</Label>
            <Input
              type="number"
              min={GEOFENCE_MIN_RADIUS_METERS}
              max={GEOFENCE_MAX_RADIUS_METERS}
              step="10"
              value={radiusMeters}
              onChange={(e) => handleRadiusChange(e.target.value)}
            />
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {shapeType === 'radial'
          ? `Click the map to place the center. Drag the center to move it, or drag the small diamond handle on the edge to resize (${GEOFENCE_MIN_RADIUS_METERS}m–${GEOFENCE_MAX_RADIUS_METERS}m).`
          : `Click the map to add corner points (${points.length} placed, 3+ needed). Drag a point to move it, or click it to remove it.`}
      </p>
      {geometryError && <p className="text-xs font-medium text-destructive">{geometryError}</p>}

      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-lg border border-border"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      />
    </div>
  );
}
