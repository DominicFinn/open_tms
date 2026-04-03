import { useState, useEffect, useRef, useCallback } from 'react';
import { useMapProvider } from '../MapProvider';
import { googleReverseGeocode, nominatimReverse, GeocodingResult } from '../services/geocoding';
import AddressAutocomplete from './AddressAutocomplete';

interface MapPickerProps {
  lat?: number;
  lng?: number;
  onLocationSelected: (result: GeocodingResult) => void;
  height?: string;
  showSearch?: boolean;
}

// Default center: London
const DEFAULT_LAT = 51.5074;
const DEFAULT_LNG = -0.1278;
const DEFAULT_ZOOM = 4;
const MARKER_ZOOM = 14;

export default function MapPicker({
  lat,
  lng,
  onLocationSelected,
  height = '400px',
  showSearch = true,
}: MapPickerProps) {
  const { provider, isLoaded } = useMapProvider();

  if (!isLoaded) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--surface-container-low)', borderRadius: '8px', border: '1px solid var(--outline-variant)' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (provider === 'google') {
    return <GoogleMapPicker lat={lat} lng={lng} onLocationSelected={onLocationSelected} height={height} showSearch={showSearch} />;
  }

  return <OSMMapPicker lat={lat} lng={lng} onLocationSelected={onLocationSelected} height={height} showSearch={showSearch} />;
}

// --- Google Maps Picker ---

function GoogleMapPicker({ lat, lng, onLocationSelected, height, showSearch }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const placeMarker = useCallback(async (position: google.maps.LatLng) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      markerRef.current = new google.maps.Marker({
        position,
        map,
        draggable: true,
      });
      markerRef.current.addListener('dragend', () => {
        const pos = markerRef.current?.getPosition();
        if (pos) handleReverseGeocode(pos.lat(), pos.lng());
      });
    }

    handleReverseGeocode(position.lat(), position.lng());
  }, []);

  const handleReverseGeocode = async (lat: number, lng: number) => {
    const result = await googleReverseGeocode(lat, lng);
    if (result) onLocationSelected(result);
  };

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const center = lat && lng ? { lat, lng } : { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
    const zoom = lat && lng ? MARKER_ZOOM : DEFAULT_ZOOM;

    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapInstanceRef.current = map;

    if (lat && lng) {
      markerRef.current = new google.maps.Marker({
        position: { lat, lng },
        map,
        draggable: true,
      });
      markerRef.current.addListener('dragend', () => {
        const pos = markerRef.current?.getPosition();
        if (pos) handleReverseGeocode(pos.lat(), pos.lng());
      });
    }

    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) placeMarker(e.latLng);
    });
  }, []);

  // Update marker when lat/lng props change externally
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (lat && lng) {
      const pos = new google.maps.LatLng(lat, lng);
      if (markerRef.current) {
        markerRef.current.setPosition(pos);
      } else {
        markerRef.current = new google.maps.Marker({
          position: pos,
          map,
          draggable: true,
        });
        markerRef.current.addListener('dragend', () => {
          const p = markerRef.current?.getPosition();
          if (p) handleReverseGeocode(p.lat(), p.lng());
        });
      }
      map.panTo(pos);
      if (map.getZoom()! < MARKER_ZOOM) map.setZoom(MARKER_ZOOM);
    }
  }, [lat, lng]);

  const handleSearch = (result: GeocodingResult) => {
    const map = mapInstanceRef.current;
    if (map) {
      const pos = new google.maps.LatLng(result.lat, result.lng);
      placeMarker(pos);
      map.panTo(pos);
      map.setZoom(MARKER_ZOOM);
    }
  };

  return (
    <div>
      {showSearch && (
        <div style={{ marginBottom: 'var(--spacing-1)' }}>
          <AddressAutocomplete onPlaceSelected={handleSearch} placeholder="Search for a location on map..." />
        </div>
      )}
      <div
        ref={mapRef}
        style={{ height, borderRadius: '8px', border: '1px solid var(--outline-variant)' }}
      />
      <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
        Click the map to place a marker, or drag the marker to refine the location.
      </div>
    </div>
  );
}

// --- OpenStreetMap (Leaflet-free, simple image-based) Picker ---

function OSMMapPicker({ lat, lng, onLocationSelected, height, showSearch }: MapPickerProps) {
  const [markerLat, setMarkerLat] = useState(lat || null);
  const [markerLng, setMarkerLng] = useState(lng || null);
  const [zoom, setZoom] = useState(lat && lng ? MARKER_ZOOM : DEFAULT_ZOOM);
  const [centerLat, setCenterLat] = useState(lat || DEFAULT_LAT);
  const [centerLng, setCenterLng] = useState(lng || DEFAULT_LNG);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update when props change
  useEffect(() => {
    if (lat && lng) {
      setMarkerLat(lat);
      setMarkerLng(lng);
      setCenterLat(lat);
      setCenterLng(lng);
      setZoom(MARKER_ZOOM);
    }
  }, [lat, lng]);

  const tileUrl = (x: number, y: number, z: number) =>
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  // Convert lat/lng to tile coordinates
  const latLngToTile = (lat: number, lng: number, z: number) => {
    const x = Math.floor(((lng + 180) / 360) * Math.pow(2, z));
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z),
    );
    return { x, y };
  };

  // Convert pixel click to lat/lng
  const pixelToLatLng = (px: number, py: number, containerWidth: number, containerHeight: number) => {
    const n = Math.pow(2, zoom);
    const centerTileX = ((centerLng + 180) / 360) * n;
    const centerLatRad = (centerLat * Math.PI) / 180;
    const centerTileY =
      ((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * n;

    const offsetX = px - containerWidth / 2;
    const offsetY = py - containerHeight / 2;

    const tileX = centerTileX + offsetX / 256;
    const tileY = centerTileY + offsetY / 256;

    const lng = (tileX / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n)));
    const lat = (latRad * 180) / Math.PI;

    return { lat, lng };
  };

  const handleClick = async (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { lat: clickLat, lng: clickLng } = pixelToLatLng(px, py, rect.width, rect.height);

    setMarkerLat(clickLat);
    setMarkerLng(clickLng);

    const result = await nominatimReverse(clickLat, clickLng);
    if (result) onLocationSelected(result);
  };

  const handleSearch = async (result: GeocodingResult) => {
    setMarkerLat(result.lat);
    setMarkerLng(result.lng);
    setCenterLat(result.lat);
    setCenterLng(result.lng);
    setZoom(MARKER_ZOOM);
    onLocationSelected(result);
  };

  const handleZoom = (delta: number) => {
    setZoom((z) => Math.max(2, Math.min(18, z + delta)));
  };

  // Render tiles
  const renderTiles = () => {
    const container = containerRef.current;
    if (!container) return null;

    const width = container.clientWidth || 600;
    const height_ = parseInt(height || '400');

    const n = Math.pow(2, zoom);
    const centerTileX = ((centerLng + 180) / 360) * n;
    const centerLatRad = (centerLat * Math.PI) / 180;
    const centerTileY =
      ((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * n;

    const tilesX = Math.ceil(width / 256) + 2;
    const tilesY = Math.ceil(height_ / 256) + 2;

    const tiles: React.ReactNode[] = [];
    const startTileX = Math.floor(centerTileX - tilesX / 2);
    const startTileY = Math.floor(centerTileY - tilesY / 2);

    for (let dx = 0; dx < tilesX; dx++) {
      for (let dy = 0; dy < tilesY; dy++) {
        const tx = ((startTileX + dx) % n + n) % n;
        const ty = startTileY + dy;
        if (ty < 0 || ty >= n) continue;

        const pixelX = (startTileX + dx - centerTileX) * 256 + width / 2;
        const pixelY = (startTileY + dy - centerTileY) * 256 + height_ / 2;

        tiles.push(
          <img
            key={`${tx}-${ty}-${zoom}`}
            src={tileUrl(tx, ty, zoom)}
            alt=""
            style={{
              position: 'absolute',
              left: `${pixelX}px`,
              top: `${pixelY}px`,
              width: '256px',
              height: '256px',
              imageRendering: 'auto',
            }}
            draggable={false}
          />,
        );
      }
    }

    // Marker
    if (markerLat != null && markerLng != null) {
      const markerTileX = ((markerLng + 180) / 360) * n;
      const mLatRad = (markerLat * Math.PI) / 180;
      const markerTileY =
        ((1 - Math.log(Math.tan(mLatRad) + 1 / Math.cos(mLatRad)) / Math.PI) / 2) * n;

      const mx = (markerTileX - centerTileX) * 256 + width / 2;
      const my = (markerTileY - centerTileY) * 256 + height_ / 2;

      tiles.push(
        <div
          key="marker"
          style={{
            position: 'absolute',
            left: `${mx - 12}px`,
            top: `${my - 36}px`,
            fontSize: '36px',
            color: 'var(--error)',
            pointerEvents: 'none',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            zIndex: 10,
          }}
        >
          <span className="material-icons" style={{ fontSize: '36px' }}>location_on</span>
        </div>,
      );
    }

    return tiles;
  };

  return (
    <div>
      {showSearch && (
        <div style={{ marginBottom: 'var(--spacing-1)' }}>
          <AddressAutocomplete onPlaceSelected={handleSearch} placeholder="Search for a location on map..." />
        </div>
      )}
      <div
        ref={containerRef}
        onClick={handleClick}
        style={{
          height,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '8px',
          border: '1px solid var(--outline-variant)',
          cursor: 'crosshair',
          backgroundColor: 'var(--surface-container-low)',
        }}
      >
        {renderTiles()}

        {/* Zoom controls */}
        <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 20, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            type="button"
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); handleZoom(1); }}
            style={{ backgroundColor: 'var(--surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
          >
            <span className="material-icons">add</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); handleZoom(-1); }}
            style={{ backgroundColor: 'var(--surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
          >
            <span className="material-icons">remove</span>
          </button>
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Click the map to place a marker.</span>
        <span>Map data: OpenStreetMap contributors</span>
      </div>
    </div>
  );
}
