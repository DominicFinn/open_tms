import React, { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ShipmentDetailsProps {}

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

interface LaneStop {
  id: string;
  laneId: string;
  locationId: string;
  order: number;
  notes?: string;
  location: Location;
}

interface Carrier {
  id: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

interface LaneCarrier {
  id: string;
  price?: number;
  currency: string;
  serviceLevel?: string;
  notes?: string;
  assigned: boolean;
  carrier: Carrier;
}

interface Lane {
  id: string;
  name: string;
  distance?: number;
  notes?: string;
  status: string;
  origin: Location;
  destination: Location;
  stops: LaneStop[];
  laneCarriers?: LaneCarrier[];
}

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
  origin: Location;
  destination: Location;
  lane?: Lane | null;
  carrier?: Carrier | null; // Manual carrier assignment
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

      // Add markers for origin, stops, and destination
      const markers: L.Marker[] = [];

      if (shipment.origin.lat && shipment.origin.lng) {
        const originMarker = L.marker([shipment.origin.lat, shipment.origin.lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `
              <div style="
                background-color: #4CAF50;
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
                O
              </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        }).addTo(map);

        originMarker.bindPopup(`<b>Origin:</b> ${shipment.origin.name}<br>${shipment.origin.address1}, ${shipment.origin.city}`);
        markers.push(originMarker);
      }

      // Add lane stops if they exist
      if (shipment.lane && shipment.lane.stops) {
        shipment.lane.stops.forEach((stop, index) => {
          if (stop.location.lat && stop.location.lng) {
            const stopMarker = L.marker([stop.location.lat, stop.location.lng], {
              icon: L.divIcon({
                className: 'custom-marker',
                html: `
                  <div style="
                    background-color: #FF9800;
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
                    ${stop.order}
                  </div>
                `,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
              })
            }).addTo(map);

            stopMarker.bindPopup(`
              <b>Stop ${stop.order}:</b> ${stop.location.name}<br>
              ${stop.location.address1}, ${stop.location.city}
              ${stop.notes ? `<br><i>Note: ${stop.notes}</i>` : ''}
            `);
            markers.push(stopMarker);
          }
        });
      }

      if (shipment.destination.lat && shipment.destination.lng) {
        const destMarker = L.marker([shipment.destination.lat, shipment.destination.lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `
              <div style="
                background-color: #F44336;
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
                D
              </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        }).addTo(map);

        destMarker.bindPopup(`<b>Destination:</b> ${shipment.destination.name}<br>${shipment.destination.address1}, ${shipment.destination.city}`);
        markers.push(destMarker);
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
      if (markers.length > 0) {
        const group = new (L as any).featureGroup(markers);
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

        {/* Lane Information */}
        {shipment.lane && (
          <div style={{ marginTop: '24px' }}>
            <h3>Lane Information</h3>
            <div style={{
              backgroundColor: 'var(--surface-variant)',
              padding: 'var(--spacing-2)',
              borderRadius: '8px',
              border: '1px solid var(--outline-variant)',
              marginBottom: 'var(--spacing-2)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <div><strong>Lane Name:</strong> {shipment.lane.name}</div>
                  <div><strong>Status:</strong> <span className={`chip ${
                    shipment.lane.status === 'active' ? 'chip-success' : 'chip-warning'
                  }`}>{shipment.lane.status}</span></div>
                </div>
                <div>
                  {shipment.lane.distance && (
                    <div><strong>Distance:</strong> {shipment.lane.distance.toFixed(1)} km</div>
                  )}
                  {shipment.lane.notes && (
                    <div><strong>Notes:</strong> {shipment.lane.notes}</div>
                  )}
                </div>
              </div>

              {/* Lane Stops */}
              {shipment.lane.stops && shipment.lane.stops.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--on-surface)' }}>
                    Stops ({shipment.lane.stops.length})
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {shipment.lane.stops.map((stop, index) => (
                      <div
                        key={stop.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 1fr auto',
                          gap: '12px',
                          alignItems: 'center',
                          padding: '12px',
                          backgroundColor: 'var(--surface)',
                          borderRadius: '4px',
                          border: '1px solid var(--outline-variant)'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#FF9800',
                          color: 'white',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          fontSize: '0.875rem',
                          fontWeight: 'bold'
                        }}>
                          {stop.order}
                        </div>

                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                            {stop.location.name}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
                            {stop.location.address1}, {stop.location.city}
                            {stop.location.state && `, ${stop.location.state}`}
                          </div>
                          {stop.notes && (
                            <div style={{
                              fontSize: '0.875rem',
                              color: 'var(--on-surface-variant)',
                              fontStyle: 'italic',
                              marginTop: '4px'
                            }}>
                              Note: {stop.notes}
                            </div>
                          )}
                        </div>

                        {stop.location.lat && stop.location.lng && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--on-surface-variant)',
                            textAlign: 'right'
                          }}>
                            📍 {stop.location.lat.toFixed(4)}, {stop.location.lng.toFixed(4)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Carrier Information */}
        {(shipment.carrier || (shipment.lane?.laneCarriers && shipment.lane.laneCarriers.length > 0)) && (
          <div style={{ marginTop: '24px' }}>
            <h3>Carrier Information</h3>

            {/* Assigned Carrier - From Lane or Manual */}
            {(() => {
              const assignedCarrier = shipment.carrier || shipment.lane?.laneCarriers?.find(lc => lc.assigned)?.carrier;
              if (assignedCarrier) {
                return (
                  <div style={{
                    backgroundColor: 'var(--primary-container)',
                    padding: 'var(--spacing-2)',
                    borderRadius: '8px',
                    border: '2px solid var(--primary)',
                    marginBottom: 'var(--spacing-2)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', marginBottom: 'var(--spacing-1)' }}>
                      <span className="material-icons" style={{ color: 'var(--primary)' }}>check_circle</span>
                      <strong style={{ color: 'var(--on-primary-container)' }}>Assigned Carrier</strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div><strong>Name:</strong> {assignedCarrier.name}</div>
                      {assignedCarrier.mcNumber && <div><strong>MC #:</strong> {assignedCarrier.mcNumber}</div>}
                      {assignedCarrier.dotNumber && <div><strong>DOT #:</strong> {assignedCarrier.dotNumber}</div>}
                      {assignedCarrier.contactName && <div><strong>Contact:</strong> {assignedCarrier.contactName}</div>}
                      {assignedCarrier.contactEmail && <div><strong>Email:</strong> {assignedCarrier.contactEmail}</div>}
                      {assignedCarrier.contactPhone && <div><strong>Phone:</strong> {assignedCarrier.contactPhone}</div>}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* All Carrier Quotes (for lane-based shipments) */}
            {shipment.lane?.laneCarriers && shipment.lane.laneCarriers.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--on-surface)' }}>
                  Carrier Quotes ({shipment.lane.laneCarriers.length})
                </h4>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Carrier</th>
                        <th>Price</th>
                        <th>Service Level</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipment.lane.laneCarriers.map(laneCarrier => (
                        <tr key={laneCarrier.id} style={laneCarrier.assigned ? { backgroundColor: 'var(--primary-container)' } : {}}>
                          <td>
                            <strong>{laneCarrier.carrier.name}</strong>
                            {laneCarrier.carrier.mcNumber && <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>MC: {laneCarrier.carrier.mcNumber}</div>}
                          </td>
                          <td>
                            {laneCarrier.price ? `${laneCarrier.currency} ${laneCarrier.price.toFixed(2)}` : '—'}
                          </td>
                          <td>{laneCarrier.serviceLevel || '—'}</td>
                          <td>
                            {laneCarrier.assigned ? (
                              <span className="chip chip-success">
                                <span className="material-icons" style={{ fontSize: '14px' }}>check</span>
                                Assigned
                              </span>
                            ) : (
                              <span className="chip chip-default">Quote</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
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
