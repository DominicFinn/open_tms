import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  city: string;
  state?: string;
  country: string;
  lat?: number;
  lng?: number;
}

interface LocationMapProps {
  origin?: Location | null;
  destination?: Location | null;
  onDistanceCalculated?: (distance: number) => void;
  height?: string;
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

export default function LocationMap({ 
  origin, 
  destination, 
  onDistanceCalculated,
  height = '400px' 
}: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

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
    
    // Clear existing markers and polyline
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];
    
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    const locations: Location[] = [];
    if (origin && origin.lat && origin.lng) locations.push(origin);
    if (destination && destination.lat && destination.lng) locations.push(destination);

    if (locations.length === 0) {
      // Reset to default view
      map.setView([39.8283, -98.5795], 4);
      setDistance(null);
      if (onDistanceCalculated) {
        onDistanceCalculated(0);
      }
      return;
    }

    // Add markers for each location
    locations.forEach((location, index) => {
      if (location.lat && location.lng) {
        const isOrigin = location.id === origin?.id;
        const isDestination = location.id === destination?.id;
        
        const marker = L.marker([location.lat, location.lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `
              <div style="
                background-color: ${isOrigin ? '#4CAF50' : isDestination ? '#F44336' : '#2196F3'};
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
                ${isOrigin ? 'O' : isDestination ? 'D' : index + 1}
              </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        }).addTo(map);

        // Add popup with location details
        marker.bindPopup(`
          <div style="min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: var(--on-surface);">${location.name}</h4>
            <p style="margin: 0 0 4px 0; color: var(--on-surface-variant); font-size: 14px;">
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

    // Draw polyline and calculate distance if both locations are available
    if (origin?.lat && origin?.lng && destination?.lat && destination?.lng) {
      const distanceKm = calculateDistance(
        origin.lat, 
        origin.lng, 
        destination.lat, 
        destination.lng
      );
      
      setDistance(distanceKm);
      if (onDistanceCalculated) {
        onDistanceCalculated(distanceKm);
      }

      // Draw polyline between locations
      const polyline = L.polyline(
        [[origin.lat, origin.lng], [destination.lat, destination.lng]],
        {
          color: '#2196F3',
          weight: 3,
          opacity: 0.7
        }
      ).addTo(map);

      // Add distance label to polyline
      const midLat = (origin.lat + destination.lat) / 2;
      const midLng = (origin.lng + destination.lng) / 2;
      
      L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: 'distance-label',
          html: `
            <div style="
              background-color: rgba(33, 150, 243, 0.9);
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">
              ${distanceKm.toFixed(1)} km
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        })
      }).addTo(map);

      polylineRef.current = polyline;

      // Fit map to show both locations
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    } else if (locations.length === 1) {
      // Center on single location
      const location = locations[0];
      if (location.lat && location.lng) {
        map.setView([location.lat, location.lng], 10);
      }
    }

  }, [origin, destination, onDistanceCalculated]);

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
      {distance !== null && (
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
          color: 'var(--on-surface)'
        }}>
          Distance: {distance.toFixed(1)} km
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
