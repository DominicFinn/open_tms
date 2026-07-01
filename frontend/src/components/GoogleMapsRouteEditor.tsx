/**
 * GoogleMapsRouteEditor - Interactive Google Maps route editor with draggable directions.
 *
 * Features:
 * - Auto-calculates route from origin to destination (with intermediate stops as waypoints)
 * - Users can drag the route on the map to adjust it
 * - Shows distance, duration, and route summary
 * - Returns encoded polyline and metadata for saving
 *
 * Requires Google Maps API key configured in organization settings.
 * Falls back to a warning message if Google Maps is not available.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Hand, Loader2, MapPinned, Route, Ruler, Timer } from 'lucide-react';

import { useMapProvider } from '../MapProvider';

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteEditorProps {
  origin: LatLng | null;
  destination: LatLng | null;
  stops?: LatLng[];
  /** Existing encoded polyline to display (for edit mode) */
  existingPolyline?: string;
  /** Corridor radius in meters (for visualization) */
  corridorMeters?: number;
  /** Called when route changes (drag, recalculate) */
  onRouteChange?: (route: {
    encodedPolyline: string;
    distanceMeters: number;
    durationSeconds: number;
    summary: string;
    waypoints: LatLng[];
  }) => void;
  /** Height of the map container */
  height?: number | string;
  /** Whether the route is editable (draggable) */
  editable?: boolean;
}

// Google Maps polyline needs a real CSS color string, not a CSS variable.
// Brand primary blue (matches `--shadcn-primary` in dark mode).
const POLYLINE_COLOR = '#3b82f6';

export default function GoogleMapsRouteEditor({
  origin,
  destination,
  stops = [],
  existingPolyline,
  corridorMeters: _corridorMeters = 5000,
  onRouteChange,
  height = 450,
  editable = true,
}: RouteEditorProps) {
  const { provider, isLoaded } = useMapProvider();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const savedRoutePolylineRef = useRef<google.maps.Polyline | null>(null);
  const savedRouteMarkersRef = useRef<google.maps.Marker[]>([]);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
    summary: string;
  } | null>(null);
  const [error, setError] = useState<string>('');
  const [calculating, setCalculating] = useState(false);

  // Handle directions result (extract polyline, distance, duration)
  const handleDirectionsResult = useCallback((result: google.maps.DirectionsResult) => {
    const route = result.routes[0];
    if (!route) return;

    let totalDistance = 0;
    let totalDuration = 0;

    for (const leg of route.legs) {
      totalDistance += leg.distance?.value || 0;
      totalDuration += leg.duration?.value || 0;
    }

    const distanceMiles = (totalDistance / 1609.34).toFixed(1);
    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.round((totalDuration % 3600) / 60);
    const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    setRouteInfo({
      distance: `${distanceMiles} mi`,
      duration: durationStr,
      summary: route.summary || '',
    });

    const encodedPolyline = route.overview_polyline as unknown as string;

    const google = (window as any).google;
    const decodedPath = google.maps.geometry
      ? google.maps.geometry.encoding.decodePath(encodedPolyline)
      : [];

    const waypoints: LatLng[] = decodedPath.map((p: any) => ({
      lat: p.lat(),
      lng: p.lng(),
    }));

    if (onRouteChange) {
      onRouteChange({
        encodedPolyline,
        distanceMeters: totalDistance,
        durationSeconds: totalDuration,
        summary: route.summary || '',
        waypoints,
      });
    }
  }, [onRouteChange]);

  // Initialize the map
  useEffect(() => {
    if (provider !== 'google' || !isLoaded || !mapRef.current) return;
    if (mapInstanceRef.current) return;

    const google = (window as any).google;
    if (!google?.maps) return;

    const map = new google.maps.Map(mapRef.current, {
      zoom: 5,
      center: origin || { lat: 39.8283, lng: -98.5795 },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });

    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      draggable: editable,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: POLYLINE_COLOR,
        strokeWeight: 5,
        strokeOpacity: 0.8,
      },
    });

    directionsRenderer.addListener('directions_changed', () => {
      const result = directionsRenderer.getDirections();
      if (result) handleDirectionsResult(result);
    });

    mapInstanceRef.current = map;
    directionsServiceRef.current = directionsService;
    directionsRendererRef.current = directionsRenderer;
  }, [provider, isLoaded, editable, handleDirectionsResult, origin]);

  // Read-only view of a previously saved route: draw the actual stored polyline
  // instead of silently firing a fresh Directions request, which would discard
  // any manual drag adjustments made when the route was planned and could show
  // a different path than what was actually saved (e.g. two lanes sharing an
  // origin/destination but with different saved routes would otherwise both
  // render the same freshly-recalculated default route).
  useEffect(() => {
    if (editable || !existingPolyline) return;
    if (provider !== 'google' || !isLoaded || !mapInstanceRef.current) return;

    const google = (window as any).google;
    if (!google?.maps?.geometry) return;

    const path = google.maps.geometry.encoding.decodePath(existingPolyline);
    if (!path.length) return;

    directionsRendererRef.current?.setMap(null);

    savedRoutePolylineRef.current?.setMap(null);
    savedRoutePolylineRef.current = new google.maps.Polyline({
      path,
      map: mapInstanceRef.current,
      strokeColor: POLYLINE_COLOR,
      strokeWeight: 5,
      strokeOpacity: 0.8,
    });

    savedRouteMarkersRef.current.forEach(m => m.setMap(null));
    savedRouteMarkersRef.current = [
      new google.maps.Marker({ position: origin ?? path[0], map: mapInstanceRef.current }),
      new google.maps.Marker({ position: destination ?? path[path.length - 1], map: mapInstanceRef.current }),
    ];

    const bounds = new google.maps.LatLngBounds();
    path.forEach((p: google.maps.LatLng) => bounds.extend(p));
    mapInstanceRef.current.fitBounds(bounds);

    return () => {
      savedRoutePolylineRef.current?.setMap(null);
      savedRoutePolylineRef.current = null;
      savedRouteMarkersRef.current.forEach(m => m.setMap(null));
      savedRouteMarkersRef.current = [];
    };
  }, [editable, existingPolyline, provider, isLoaded, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // Calculate route when origin/destination/stops change (skipped for the
  // read-only saved-route case above, which renders the stored polyline directly)
  useEffect(() => {
    if (!editable && existingPolyline) return;
    if (provider !== 'google' || !isLoaded) return;
    if (!directionsServiceRef.current || !directionsRendererRef.current) return;
    if (!origin || !destination) return;

    setCalculating(true);
    setError('');

    const google = (window as any).google;
    const waypoints = stops
      .filter(s => s.lat && s.lng)
      .map(s => ({ location: new google.maps.LatLng(s.lat, s.lng), stopover: true }));

    directionsServiceRef.current.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        setCalculating(false);
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRendererRef.current!.setDirections(result);
          handleDirectionsResult(result);
        } else {
          setError(`Could not calculate route: ${status}`);
          directionsRendererRef.current!.setDirections({ routes: [] } as any);
        }
      },
    );
  }, [editable, existingPolyline, provider, isLoaded, origin?.lat, origin?.lng, destination?.lat, destination?.lng, stops.length, handleDirectionsResult, destination, origin, stops]);

  // No Google Maps available
  if (provider !== 'google' || !isLoaded) {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <strong className="block">Google Maps API key required</strong>
          <p className="mt-1 text-xs text-muted-foreground">
            Route planning requires a Google Maps API key with the Directions API enabled.
            Go to <strong>Admin &gt; Map settings</strong> to configure your API key.
          </p>
        </div>
      </div>
    );
  }

  // No origin/destination yet
  if (!origin || !destination) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground"
        style={{
          height: typeof height === 'number' ? height : undefined,
          minHeight: 200,
        }}
      >
        <div className="text-center">
          <Route className="mx-auto h-12 w-12 opacity-40" />
          <div className="mt-2 text-sm">Select origin and destination to plan a route</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className="w-full overflow-hidden rounded-lg border border-border"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      />

      {routeInfo && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-4 rounded-lg border border-border bg-card/90 px-4 py-2.5 text-sm shadow-lg backdrop-blur">
          <div className="flex items-center gap-1.5 text-foreground">
            <Ruler className="h-4 w-4 text-primary" />
            <strong>{routeInfo.distance}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-foreground">
            <Timer className="h-4 w-4 text-primary" />
            <strong>{routeInfo.duration}</strong>
          </div>
          {routeInfo.summary && (
            <div className="text-xs text-muted-foreground">via {routeInfo.summary}</div>
          )}
        </div>
      )}

      {calculating && (
        <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Calculating route...</span>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {editable && routeInfo && !calculating && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Hand className="h-3.5 w-3.5" />
          Drag the route on the map to adjust the planned path
        </div>
      )}
    </div>
  );
}
