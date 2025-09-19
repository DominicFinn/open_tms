import React, { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ShipmentDetailsProps {}

interface Shipment {
  id: string;
  reference: string;
  status: string;
  pickupDate?: string;
  deliveryDate?: string;
  items?: any[];
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    contactEmail?: string;
  };
  origin: {
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
  };
  destination: {
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
  };
  loads: any[];
}

export default function ShipmentDetails() {
  const { id } = useParams<{ id: string }>();
  const [shipment, setShipment] = React.useState<Shipment | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!id) return;
    
    fetch(`${API_URL}/api/v1/shipments/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setShipment(data.data);
        }
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load shipment details');
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!shipment || !mapRef.current) return;

    // Load Leaflet dynamically
    const loadMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      // Create map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapRef.current!).setView([40.7128, -74.0060], 10); // Default to NYC
      mapInstanceRef.current = map;

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Add markers for origin and destination
      if (shipment.origin.lat && shipment.origin.lng) {
        L.marker([shipment.origin.lat, shipment.origin.lng])
          .addTo(map)
          .bindPopup(`<b>Origin:</b> ${shipment.origin.name}<br>${shipment.origin.address1}, ${shipment.origin.city}`);
      }

      if (shipment.destination.lat && shipment.destination.lng) {
        L.marker([shipment.destination.lat, shipment.destination.lng])
          .addTo(map)
          .bindPopup(`<b>Destination:</b> ${shipment.destination.name}<br>${shipment.destination.address1}, ${shipment.destination.city}`);
      }

      // If no coordinates, add a mock location marker
      if (!shipment.origin.lat && !shipment.destination.lat) {
        const mockLat = 40.7128 + (Math.random() - 0.5) * 0.1;
        const mockLng = -74.0060 + (Math.random() - 0.5) * 0.1;
        L.marker([mockLat, mockLng])
          .addTo(map)
          .bindPopup(`<b>Mock Location:</b> Shipment in transit<br>Lat: ${mockLat.toFixed(4)}, Lng: ${mockLng.toFixed(4)}`);
      }

      // Fit map to show all markers
      const group = new (L as any).featureGroup();
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          group.addLayer(layer);
        }
      });
      if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds().pad(0.1));
      }
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [shipment]);

  if (loading) {
    return (
      <div className="card">
        <h2>Loading shipment details...</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
          Please wait...
        </div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="card">
        <h2>Error</h2>
        <p>{error || 'Shipment not found'}</p>
        <Link to="/shipments" className="button outlined">
          <span className="material-icons" style={{ fontSize: '18px' }}>arrow_back</span>
          Back to Shipments
        </Link>
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h2>Shipment Details: {shipment.reference}</h2>
          <Link to="/shipments" className="button outlined">
            <span className="material-icons" style={{ fontSize: '18px' }}>arrow_back</span>
            Back to Shipments
          </Link>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div>
            <h3>Basic Information</h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div><strong>Reference:</strong> {shipment.reference}</div>
              <div><strong>Status:</strong> <span className={`chip ${
                shipment.status === 'delivered' ? 'chip-success' : 
                shipment.status === 'in_transit' ? 'chip-warning' : 
                'chip-primary'
              }`}>{shipment.status}</span></div>
              <div><strong>Customer:</strong> {shipment.customer.name}</div>
              <div><strong>Created:</strong> {formatDateTime(shipment.createdAt)}</div>
              <div><strong>Updated:</strong> {formatDateTime(shipment.updatedAt)}</div>
            </div>
          </div>
          
          <div>
            <h3>Schedule</h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div><strong>Pickup Date:</strong> {formatDate(shipment.pickupDate)}</div>
              <div><strong>Delivery Date:</strong> {formatDate(shipment.deliveryDate)}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <h3>Origin</h3>
            <div style={{ display: 'grid', gap: '4px' }}>
              <div><strong>{shipment.origin.name}</strong></div>
              <div>{shipment.origin.address1}</div>
              {shipment.origin.address2 && <div>{shipment.origin.address2}</div>}
              <div>{shipment.origin.city}{shipment.origin.state && `, ${shipment.origin.state}`} {shipment.origin.postalCode}</div>
              <div>{shipment.origin.country}</div>
              {shipment.origin.lat && shipment.origin.lng && (
                <div style={{ fontSize: '0.9em', color: '#666' }}>
                  📍 {shipment.origin.lat.toFixed(4)}, {shipment.origin.lng.toFixed(4)}
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h3>Destination</h3>
            <div style={{ display: 'grid', gap: '4px' }}>
              <div><strong>{shipment.destination.name}</strong></div>
              <div>{shipment.destination.address1}</div>
              {shipment.destination.address2 && <div>{shipment.destination.address2}</div>}
              <div>{shipment.destination.city}{shipment.destination.state && `, ${shipment.destination.state}`} {shipment.destination.postalCode}</div>
              <div>{shipment.destination.country}</div>
              {shipment.destination.lat && shipment.destination.lng && (
                <div style={{ fontSize: '0.9em', color: '#666' }}>
                  📍 {shipment.destination.lat.toFixed(4)}, {shipment.destination.lng.toFixed(4)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3>Location Map</h3>
        <div 
          ref={mapRef} 
          style={{ 
            height: '400px', 
            width: '100%', 
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}
        />
      </div>

      <div className="card">
        <h3>Shipment Events</h3>
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          Event tracking will be implemented in a future update.
        </p>
        <div className="table-container" style={{ marginTop: 'var(--spacing-2)' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Description</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--on-surface-variant)' }}>
                  No events recorded yet
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
