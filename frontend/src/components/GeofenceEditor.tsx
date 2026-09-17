/**
 * Radial or polygon geofence editor for a Location, drawn by hand on a Leaflet map — no drawing
 * plugin installed, same hand-rolled click-to-place approach as OsmRouteEditor.tsx.
 *
 * Fully controlled: local map state (center/radius or vertex list) is seeded once from `value`
 * (editing an existing geofence) and every user action re-emits the finished shape via `onChange`,
 * or `null` while the shape is incomplete (no center yet, or fewer than 3 polygon points) or after
 * Clear. The caller owns persistence — this component only produces geometry.
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Info, Trash2, Undo2 } from 'lucide-react';
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
    html: `<div class="h-4 w-4 rounded-full border-2 border-background bg-primary shadow"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const numberIcon = (text: string) =>
  L.divIcon({
    className: '',
    html: `<div class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-semibold text-primary-foreground shadow">${text}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitChange = (
    nextShapeType: 'radial' | 'polygon',
    nextCenter: LatLng | null,
    nextRadius: number,
    nextPoints: LatLng[],
    nextName: string
  ) => {
    if (nextShapeType === 'radial') {
      if (!nextCenter || nextRadius <= 0) {
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

      const marker = L.marker([center.lat, center.lng], { icon: dotIcon(), draggable: true }).addTo(markers);
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        const next = { lat: ll.lat, lng: ll.lng };
        setCenter(next);
        emitChange('radial', next, radiusMeters, points, name);
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
        L.marker([p.lat, p.lng], { icon: numberIcon(String(i + 1)) }).addTo(markers);
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
              min="1"
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
          ? 'Click the map to place the center, then drag it to fine-tune. Adjust the radius above.'
          : `Click the map to add corner points (${points.length} placed, 3+ needed).`}
      </p>

      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-lg border border-border"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      />
    </div>
  );
}
