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

export default function GoogleMapsRouteEditor({
  origin,
  destination,
  stops = [],
  existingPolyline,
  corridorMeters = 5000,
  onRouteChange,
  height = 450,
  editable = true,
}: RouteEditorProps) {
  const { provider, isLoaded, apiKey } = useMapProvider();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
    summary: string;
  } | null>(null);
  const [error, setError] = useState<string>('');
  const [calculating, setCalculating] = useState(false);

  // Initialize the map
  useEffect(() => {
    if (provider !== 'google' || !isLoaded || !mapRef.current) return;
    if (mapInstanceRef.current) return; // Already initialized

    const google = (window as any).google;
    if (!google?.maps) return;

    const map = new google.maps.Map(mapRef.current, {
      zoom: 5,
      center: origin || { lat: 39.8283, lng: -98.5795 }, // Center of US
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      draggable: editable,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: 'var(--primary, #1976d2)',
        strokeWeight: 5,
        strokeOpacity: 0.8,
      },
      markerOptions: {
        // Custom marker styling handled by Google defaults
      },
    });

    // Listen for route changes (drag events)
    directionsRenderer.addListener('directions_changed', () => {
      const result = directionsRenderer.getDirections();
      if (result) {
        handleDirectionsResult(result);
      }
    });

    mapInstanceRef.current = map;
    directionsServiceRef.current = directionsService;
    directionsRendererRef.current = directionsRenderer;
  }, [provider, isLoaded, editable]);

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

    // Extract the encoded polyline from the overview_polyline
    const encodedPolyline = route.overview_polyline;

    // Decode to get waypoints
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

  // Calculate route when origin/destination/stops change
  useEffect(() => {
    if (provider !== 'google' || !isLoaded) return;
    if (!directionsServiceRef.current || !directionsRendererRef.current) return;
    if (!origin || !destination) return;

    setCalculating(true);
    setError('');

    const google = (window as any).google;
    const waypoints = stops
      .filter(s => s.lat && s.lng)
      .map(s => ({
        location: new google.maps.LatLng(s.lat, s.lng),
        stopover: true,
      }));

    directionsServiceRef.current.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
        provideRouteAlternatives: false,
      },
      (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
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
  }, [provider, isLoaded, origin?.lat, origin?.lng, destination?.lat, destination?.lng, stops.length]);

  // No Google Maps available
  if (provider !== 'google' || !isLoaded) {
    return (
      <div
        className="vn-alert vn-alert-warning"
        style={{ marginBottom: 16 }}
      >
        <span className="material-icons" style={{ marginRight: 8 }}>warning</span>
        <div>
          <strong>Google Maps API key required</strong>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Route planning requires a Google Maps API key with the Directions API enabled.
            Go to <strong>Admin &gt; Map Settings</strong> to configure your API key.
          </p>
        </div>
      </div>
    );
  }

  // No origin/destination yet
  if (!origin || !destination) {
    return (
      <div style={{
        height: typeof height === 'number' ? height : undefined,
        minHeight: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-container)',
        border: '1px solid var(--outline-variant)',
        borderRadius: 'var(--border-radius, 8px)',
      }}>
        <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)' }}>
          <span className="material-icons" style={{ fontSize: 48, opacity: 0.4 }}>route</span>
          <div style={{ fontSize: 14, marginTop: 8 }}>Select origin and destination to plan a route</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Map container */}
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: typeof height === 'number' ? `${height}px` : height,
          borderRadius: 'var(--border-radius, 8px)',
          border: '1px solid var(--outline-variant)',
          overflow: 'hidden',
        }}
      />

      {/* Route info overlay */}
      {routeInfo && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          background: 'var(--surface, #fff)',
          borderRadius: 'var(--border-radius, 8px)',
          padding: '10px 14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          fontSize: 13,
          zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--on-surface)' }}>
            <span className="material-icons" style={{ fontSize: 16, color: 'var(--primary)' }}>straighten</span>
            <strong>{routeInfo.distance}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--on-surface)' }}>
            <span className="material-icons" style={{ fontSize: 16, color: 'var(--primary)' }}>schedule</span>
            <strong>{routeInfo.duration}</strong>
          </div>
          {routeInfo.summary && (
            <div style={{ color: 'var(--on-surface-variant)', fontSize: 12 }}>
              via {routeInfo.summary}
            </div>
          )}
        </div>
      )}

      {/* Calculating indicator */}
      {calculating && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--surface, #fff)',
          borderRadius: 'var(--border-radius, 8px)',
          padding: '12px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 2,
        }}>
          <div className="loading-spinner" style={{ width: 20, height: 20 }} />
          <span style={{ fontSize: 13, color: 'var(--on-surface)' }}>Calculating route...</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="vn-alert vn-alert-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      {/* Drag hint */}
      {editable && routeInfo && !calculating && (
        <div style={{
          marginTop: 8,
          fontSize: 12,
          color: 'var(--on-surface-variant)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span className="material-icons" style={{ fontSize: 14 }}>touch_app</span>
          Drag the route on the map to adjust the planned path
        </div>
      )}
    </div>
  );
}
