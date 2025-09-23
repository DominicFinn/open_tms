import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_URL } from '../api';

// Fix for default markers in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Location {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  lat?: number;
  lng?: number;
}

interface StopLocation {
  location: Location;
  order: number;
  notes?: string;
}

interface LocationMapProps {
  origin?: Location | null;
  destination?: Location | null;
  stops?: StopLocation[];
  onDistanceCalculated?: (distance: number) => void;
  height?: string;
}

// Calculate distance between two coordinates using Haversine formula (fallback)
function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate distance using the backend API (more accurate)
async function calculateDistanceFromAPI(originId: string, destinationId: string): Promise<{ distance: number; duration?: number; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/v1/distance/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originId,
        destinationId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to calculate distance');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('API distance calculation failed:', error);
    return {
      distance: 0,
      error: error instanceof Error ? error.message : 'Failed to calculate distance'
    };
  }
}

export default function LocationMap({
  origin,
  destination,
  stops = [],
  onDistanceCalculated,
  height = '400px'
}: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const distanceLabelsRef = useRef<L.Marker[]>([]);
  const [totalDistance, setTotalDistance] = useState<number | null>(null);
  const [segmentDistances, setSegmentDistances] = useState<number[]>([]);
  const [distanceSource, setDistanceSource] = useState<'api' | 'haversine' | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([39.8283, -98.5795], 4); // Center of US
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map when locations change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing markers, polylines, and distance labels
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    polylinesRef.current.forEach(polyline => map.removeLayer(polyline));
    polylinesRef.current = [];

    distanceLabelsRef.current.forEach(label => map.removeLayer(label));
    distanceLabelsRef.current = [];

    // Build complete route: origin -> stops (in order) -> destination
    const route: Location[] = [];
    if (origin && origin.lat && origin.lng) {
      route.push(origin);
    }

    // Add stops in order
    const sortedStops = [...stops]
      .filter(stop => stop.location.lat && stop.location.lng)
      .sort((a, b) => a.order - b.order);

    sortedStops.forEach(stop => {
      route.push(stop.location);
    });

    if (destination && destination.lat && destination.lng) {
      route.push(destination);
    }

    if (route.length === 0) {
      // Reset to default view
      map.setView([39.8283, -98.5795], 4);
      setTotalDistance(null);
      setSegmentDistances([]);
      if (onDistanceCalculated) {
        onDistanceCalculated(0);
      }
      return;
    }

    // Add markers for each location in the route
    route.forEach((location, index) => {
      if (location.lat && location.lng) {
        const isOrigin = location.id === origin?.id;
        const isDestination = location.id === destination?.id;
        const stopIndex = sortedStops.findIndex(stop => stop.location.id === location.id);

        let markerColor = '#2196F3'; // Default blue for stops
        let markerLabel = (index + 1).toString();

        if (isOrigin) {
          markerColor = '#4CAF50'; // Green for origin
          markerLabel = 'O';
        } else if (isDestination) {
          markerColor = '#F44336'; // Red for destination
          markerLabel = 'D';
        } else if (stopIndex >= 0) {
          markerColor = '#FF9800'; // Orange for stops
          markerLabel = (stopIndex + 1).toString();
        }

        const marker = L.marker([location.lat, location.lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `
              <div style="
                background-color: ${markerColor};
                color: white;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 14px;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              ">
                ${markerLabel}
              </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        }).addTo(map);

        // Add popup with location details
        let locationTypeLabel = 'Location';
        if (isOrigin) locationTypeLabel = 'Origin';
        else if (isDestination) locationTypeLabel = 'Destination';
        else if (stopIndex >= 0) {
          const stop = sortedStops[stopIndex];
          locationTypeLabel = `Stop ${stopIndex + 1}${stop.notes ? ` - ${stop.notes}` : ''}`;
        }

        marker.bindPopup(`
          <div style="min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: var(--on-surface);">${location.name}</h4>
            <p style="margin: 0 0 4px 0; color: var(--primary); font-size: 12px; font-weight: bold;">
              ${locationTypeLabel}
            </p>
            <p style="margin: 0 0 4px 0; color: var(--on-surface-variant); font-size: 14px;">
              ${location.address1}<br>
              ${location.city}${location.state ? `, ${location.state}` : ''}<br>
              ${location.country}
            </p>
            <p style="margin: 0; color: var(--on-surface-variant); font-size: 12px;">
              📍 ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}
            </p>
          </div>
        `);

        markersRef.current.push(marker);
      }
    });

    // Calculate distances and draw polylines for each segment
    if (route.length >= 2) {
      const calculateSegmentDistances = async () => {
        const distances: number[] = [];
        let useHaversine = false;

        for (let i = 0; i < route.length - 1; i++) {
          const from = route[i];
          const to = route[i + 1];

          if (from.lat && from.lng && to.lat && to.lng) {
            // Try API calculation first
            let segmentDistance = 0;
            if (from.id && to.id && !useHaversine) {
              try {
                const result = await calculateDistanceFromAPI(from.id, to.id);
                if (result.distance > 0) {
                  segmentDistance = result.distance;
                  setDistanceSource('api');
                } else {
                  useHaversine = true;
                  segmentDistance = calculateHaversineDistance(from.lat, from.lng, to.lat, to.lng);
                  setDistanceSource('haversine');
                }
              } catch {
                useHaversine = true;
                segmentDistance = calculateHaversineDistance(from.lat, from.lng, to.lat, to.lng);
                setDistanceSource('haversine');
              }
            } else {
              segmentDistance = calculateHaversineDistance(from.lat, from.lng, to.lat, to.lng);
              setDistanceSource('haversine');
            }

            distances.push(segmentDistance);

            // Draw polyline for this segment
            const polyline = L.polyline(
              [[from.lat, from.lng], [to.lat, to.lng]],
              {
                color: '#2196F3',
                weight: 3,
                opacity: 0.7,
                dashArray: i === 0 ? undefined : '5, 5' // Dashed lines for segments after first
              }
            ).addTo(map);

            polylinesRef.current.push(polyline);

            // Add distance label for this segment
            const midLat = (from.lat + to.lat) / 2;
            const midLng = (from.lng + to.lng) / 2;

            const distanceLabel = L.marker([midLat, midLng], {
              icon: L.divIcon({
                className: 'distance-label',
                html: `
                  <div style="
                    background-color: rgba(33, 150, 243, 0.9);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: bold;
                    white-space: nowrap;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                  ">
                    ${segmentDistance.toFixed(1)}km
                  </div>
                `,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
              })
            }).addTo(map);

            distanceLabelsRef.current.push(distanceLabel);
          }
        }

        const total = distances.reduce((sum, dist) => sum + dist, 0);
        setTotalDistance(total);
        setSegmentDistances(distances);

        if (onDistanceCalculated) {
          onDistanceCalculated(total);
        }
      };

      calculateSegmentDistances();

      // Fit map to show all locations
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    } else if (route.length === 1) {
      // Center on single location
      const location = route[0];
      if (location.lat && location.lng) {
        map.setView([location.lat, location.lng], 10);
      }
    }

  }, [origin, destination, stops, onDistanceCalculated]);

  return (
    <div style={{ position: 'relative' }}>
      <div 
        ref={mapRef} 
        style={{ 
          height, 
          width: '100%', 
          borderRadius: '8px',
          border: '1px solid var(--outline)'
        }} 
      />
      
      {/* Distance display */}
      {totalDistance !== null && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: 'var(--surface)',
          padding: '8px 12px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid var(--outline)',
          fontSize: '14px',
          fontWeight: '500',
          color: 'var(--on-surface)',
          minWidth: '160px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            Total Distance: {totalDistance.toFixed(1)} km
          </div>
          {segmentDistances.length > 1 && (
            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>
              {segmentDistances.length} segments
            </div>
          )}
          {distanceSource === 'api' && (
            <div style={{ fontSize: '12px', color: '#4CAF50', marginTop: '2px' }}>
              ✓ Route-based
            </div>
          )}
          {distanceSource === 'haversine' && (
            <div style={{ fontSize: '12px', color: '#FF9800', marginTop: '2px' }}>
              ⚠ Straight-line
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {(origin || destination) && (
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          backgroundColor: 'var(--surface)',
          padding: '8px 12px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid var(--outline)',
          fontSize: '12px',
          color: 'var(--on-surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#4CAF50',
              borderRadius: '50%'
            }}></div>
            <span>Origin</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#F44336',
              borderRadius: '50%'
            }}></div>
            <span>Destination</span>
          </div>
        </div>
      )}
    </div>
  );
}
