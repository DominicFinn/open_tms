/**
 * Lane route editor for OSM mode.
 *
 * Google mode gets a live directions service: you drag the line and it snaps to roads. There is
 * no keyless equivalent, so this offers the honest alternative rather than a broken imitation.
 * The lane's stops are joined in order, and the planner clicks the map to add corner points
 * where the real route differs from a straight line.
 *
 * What that means downstream: the geometry is stored in the same encoded polyline format, so
 * deviation monitoring and every existing consumer work unchanged, but the distance is measured
 * along the drawn line rather than along roads, and there is no duration. The route is saved
 * with `provider: 'manual'` so nothing mistakes it for a road-network answer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Info, Undo2, Trash2 } from 'lucide-react';
import {
  keepMapSized,
  worldBoundsMapOptions,
  capWorldZoomOut,
  addBaseTileLayer,
} from '../lib/leafletMap';
import { encodePolyline, decodePolyline, pathLengthMetres, type LatLng } from '../maps/polyline';
import { Button } from '@/components/ui/button';

const ROUTE_COLOUR = '#3b82f6';

export interface OsmRouteEditorProps {
  origin: LatLng | null;
  destination: LatLng | null;
  stops?: LatLng[];
  existingPolyline?: string;
  onRouteChange?: (route: {
    encodedPolyline: string;
    distanceMeters: number;
    durationSeconds: number;
    summary: string;
    waypoints: LatLng[];
  }) => void;
  height?: number | string;
  editable?: boolean;
}

export default function OsmRouteEditor({
  origin,
  destination,
  stops = [],
  existingPolyline,
  onRouteChange,
  height = 450,
  editable = true,
}: OsmRouteEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  /** Corner points the planner has added between the fixed lane stops. */
  const [corners, setCorners] = useState<LatLng[]>([]);
  const [seededFromExisting, setSeededFromExisting] = useState(false);

  /** The fixed points a lane always has, in order. Corners sit between origin and destination. */
  const fixedPoints = useMemo(() => {
    if (!origin || !destination) return null;
    return { origin, stops, destination };
  }, [origin, destination, stops]);

  const path = useMemo<LatLng[]>(() => {
    if (!fixedPoints) return [];
    return [fixedPoints.origin, ...fixedPoints.stops, ...corners, fixedPoints.destination];
  }, [fixedPoints, corners]);

  // An existing route is loaded once, as corner points, so reopening a saved lane shows the line
  // that was drawn rather than snapping back to a straight one.
  useEffect(() => {
    if (seededFromExisting || !existingPolyline || !fixedPoints) return;
    const decoded = decodePolyline(existingPolyline);
    const middle = decoded.slice(1, -1);
    setCorners(middle.slice(fixedPoints.stops.length));
    setSeededFromExisting(true);
  }, [existingPolyline, fixedPoints, seededFromExisting]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true, ...worldBoundsMapOptions }).setView(
      [39.5, -98.5],
      4
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
      lineRef.current = null;
      markersRef.current = null;
    };
  }, []);

  const addCorner = useCallback((point: LatLng) => {
    setCorners((current) => [...current, point]);
  }, []);

  // Click-to-add is bound separately so toggling `editable` doesn't tear the map down.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!editable) return;

    const onClick = (event: L.LeafletMouseEvent) =>
      addCorner({ lat: event.latlng.lat, lng: event.latlng.lng });
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [editable, addCorner]);

  // Redraw whenever the path changes, and report the new geometry upward.
  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers || path.length < 2) return;

    lineRef.current?.remove();
    markers.clearLayers();

    lineRef.current = L.polyline(
      path.map((p) => [p.lat, p.lng] as [number, number]),
      { color: ROUTE_COLOUR, weight: 4, opacity: 0.85 }
    ).addTo(map);

    const label = (text: string, tone: string) =>
      L.divIcon({
        className: '',
        html: `<div class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background ${tone} text-[10px] font-semibold text-primary-foreground shadow">${text}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

    L.marker([path[0].lat, path[0].lng], { icon: label('A', 'bg-primary') }).addTo(markers);
    L.marker([path[path.length - 1].lat, path[path.length - 1].lng], {
      icon: label('B', 'bg-success'),
    }).addTo(markers);
    corners.forEach((corner, index) => {
      L.marker([corner.lat, corner.lng], { icon: label(String(index + 1), 'bg-muted') }).addTo(markers);
    });

    map.fitBounds(lineRef.current.getBounds(), { padding: [40, 40] });

    onRouteChange?.({
      encodedPolyline: encodePolyline(path),
      distanceMeters: pathLengthMetres(path),
      // No road network, so no travel time. The backend leaves duration null for manual routes.
      durationSeconds: 0,
      summary: corners.length > 0 ? `Manual route via ${corners.length} point(s)` : 'Direct route',
      waypoints: path,
    });
  }, [path, corners, onRouteChange]);

  if (!origin || !destination) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground"
        style={{ height: typeof height === 'number' ? height : undefined, minHeight: 200 }}
      >
        Pick an origin and a destination to plan the route.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Click the map to bend the route. Without a Google Maps key it follows the points you
            place rather than the road network, and distance is measured along that line.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCorners((c) => c.slice(0, -1))}
              disabled={corners.length === 0}
            >
              <Undo2 className="h-4 w-4" />
              Undo point
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCorners([])}
              disabled={corners.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              Straighten
            </Button>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-lg border border-border"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      />
    </div>
  );
}
