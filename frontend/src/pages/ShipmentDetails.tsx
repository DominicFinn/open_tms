import React, { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../api';
import AttachmentPanel from '../components/AttachmentPanel';

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

interface ShipmentEvent {
  id: string;
  shipmentId: string;
  eventType: string;
  deviceId?: string;
  deviceName?: string;
  lat?: number;
  lng?: number;
  address?: string;
  locationSummary?: string;
  rawPayload?: any;
  eventTime: string;
  createdAt: string;
  updatedAt: string;
}

interface StopOrder {
  id: string;
  orderNumber: string;
  deliveryStatus: string;
  status: string;
  customer: { name: string };
}

interface ShipmentStop {
  id: string;
  sequenceNumber: number;
  stopType: string;
  status: string;
  estimatedArrival?: string;
  actualArrival?: string;
  actualDeparture?: string;
  location: Location;
  orders: StopOrder[];
  notes?: string;
  instructions?: string;
}

interface Shipment {
  id: string;
  reference: string;
  proNumber?: string;
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
  carrier?: Carrier | null;
  loads: any[];
  events?: ShipmentEvent[];
  stops?: ShipmentStop[];
  orderShipments?: { order: StopOrder }[];
}

type TabId = 'overview' | 'activity' | 'information' | 'documents' | 'audit';

export default function ShipmentDetails() {
  const { id } = useParams<{ id: string }>();
  const [shipment, setShipment] = React.useState<Shipment | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<TabId>('overview');

  const loadShipment = async () => {
    if (!id) return;
    try {
      const r = await fetch(`${API_URL}/api/v1/shipments/${id}`);
      const data = await r.json();
      if (data.error) {
        setError(data.error);
      } else {
        setShipment(data.data);
      }
    } catch {
      setError('Failed to load shipment details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipment();
  }, [id]);

  const handleGenerateDoc = async (type: 'bol' | 'customs') => {
    if (!id) return;
    setGenerating(type);
    try {
      const response = await fetch(`${API_URL}/api/v1/documents/generate/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentId: id }),
      });
      const result = await response.json();
      if (result.error) {
        alert(`Error: ${result.error}`);
        return;
      }
      window.open(`${API_URL}/api/v1/documents/${result.data.id}/download`, '_blank');
    } catch {
      alert(`Failed to generate ${type === 'bol' ? 'Bill of Lading' : 'Customs Form'}`);
    } finally {
      setGenerating(null);
    }
  };

  const handleUpdateStop = async (stopId: string, status: string) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/shipment-stops/${stopId}/update-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, method: 'manual' })
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.error || 'Failed to update stop');
        return;
      }
      loadShipment();
    } catch {
      alert('Failed to update stop');
    }
  };

  const handleBulkMarkDelivered = async (stopId: string, orderCount: number) => {
    if (!confirm(`Mark all ${orderCount} orders at this stop as delivered?`)) return;
    await handleUpdateStop(stopId, 'completed');
  };

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
        <Link to="/shipments" className="button button-outline">
          <span className="material-icons" style={{ fontSize: '18px' }}>arrow_back</span>
          Back to Shipments
        </Link>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'activity', label: 'Activity & Events', icon: 'timeline' },
    { id: 'information', label: 'Information', icon: 'info' },
    { id: 'documents', label: 'Documents', icon: 'folder' },
    { id: 'audit', label: 'Audit', icon: 'history' },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-1)', color: 'var(--on-surface-variant)' }}>
        <Link to="/shipments" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Shipments</Link>
        {' > '}
        <span>{shipment.reference}</span>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '2px solid var(--outline-variant)',
        marginBottom: 'var(--spacing-2)',
        overflowX: 'auto',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: 'var(--spacing-1) var(--spacing-2)',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--on-surface-variant)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Title + Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <h2 style={{ margin: 0 }}>{shipment.reference}</h2>
          <button
            className="icon-btn"
            title="Copy reference"
            onClick={() => navigator.clipboard.writeText(shipment.reference)}
            style={{ padding: '4px' }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>content_copy</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-1)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to={`/shipments/${id}/edit`} className="button button-outline" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>edit</span>
            Edit
          </Link>
          <button onClick={() => handleGenerateDoc('bol')} disabled={generating !== null}
            className="button button-outline" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>description</span>
            {generating === 'bol' ? 'Generating...' : 'Generate BOL'}
          </button>
          <button onClick={() => handleGenerateDoc('customs')} disabled={generating !== null}
            className="button button-outline" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>public</span>
            {generating === 'customs' ? 'Generating...' : 'Customs Form'}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          shipment={shipment}
          onUpdateStop={handleUpdateStop}
          onBulkMarkDelivered={handleBulkMarkDelivered}
        />
      )}
      {activeTab === 'activity' && <ActivityEventsTab shipment={shipment} />}
      {activeTab === 'information' && <InformationTab shipment={shipment} />}
      {activeTab === 'documents' && <DocumentsTab shipmentId={id!} generating={generating} onGenerateDoc={handleGenerateDoc} />}
      {activeTab === 'audit' && <AuditTab shipment={shipment} />}
    </div>
  );
}

/* ─── Overview Tab (Dashboard Grid) ───────────────────────── */

function OverviewTab({ shipment, onUpdateStop, onBulkMarkDelivered }: {
  shipment: Shipment;
  onUpdateStop: (stopId: string, status: string) => Promise<void>;
  onBulkMarkDelivered: (stopId: string, orderCount: number) => Promise<void>;
}) {
  const assignedCarrier = shipment.carrier || shipment.lane?.laneCarriers?.find(lc => lc.assigned)?.carrier;

  // Tracking devices (unique from events)
  const devices = React.useMemo(() => {
    if (!shipment.events) return [];
    const dmap = new Map<string, { deviceId: string; deviceName?: string; eventCount: number; lastSeen: string }>();
    shipment.events.forEach(e => {
      const key = e.deviceId || e.deviceName || '';
      if (!key) return;
      const existing = dmap.get(key);
      if (existing) {
        existing.eventCount++;
        if (new Date(e.eventTime) > new Date(existing.lastSeen)) existing.lastSeen = e.eventTime;
      } else {
        dmap.set(key, { deviceId: e.deviceId || '', deviceName: e.deviceName, eventCount: 1, lastSeen: e.eventTime });
      }
    });
    return Array.from(dmap.values());
  }, [shipment.events]);

  // Last known event with location
  const lastLocationEvent = React.useMemo(() => {
    if (!shipment.events) return null;
    const located = shipment.events
      .filter(e => e.lat && e.lng)
      .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
    return located[0] || null;
  }, [shipment.events]);

  return (
    <div style={{ display: 'grid', gap: 'var(--spacing-2)' }}>
      {/* Dashboard top row: Info | Tracking Devices | Logistics Map */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 'var(--spacing-2)' }}>
        {/* Information Card */}
        <div className="card">
          <h3 style={{ margin: '0 0 var(--spacing-2) 0', fontSize: '1rem' }}>Information</h3>
          <div style={{ display: 'grid', gap: 'var(--spacing-1)', fontSize: '0.875rem' }}>
            <InfoRow label="State">
              <span className={`chip ${
                shipment.status === 'delivered' ? 'chip-success' :
                shipment.status === 'in_transit' ? 'chip-warning' :
                shipment.status === 'cancelled' ? 'chip-error' :
                'chip-primary'
              }`}>
                {shipment.status.replace(/_/g, ' ')}
              </span>
            </InfoRow>
            <InfoRow label="PRO Number">{shipment.proNumber || '—'}</InfoRow>
            <InfoRow label="Customer">{shipment.customer.name}</InfoRow>
            {shipment.customer.contactEmail && (
              <InfoRow label="Email">{shipment.customer.contactEmail}</InfoRow>
            )}
            <InfoRow label="Carrier">{assignedCarrier?.name || '—'}</InfoRow>
            <InfoRow label="Pickup">{shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : 'Not scheduled'}</InfoRow>
            <InfoRow label="Delivery">{shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : 'Not scheduled'}</InfoRow>
          </div>
        </div>

        {/* Tracking Devices Card */}
        <div className="card">
          <h3 style={{ margin: '0 0 var(--spacing-2) 0', fontSize: '1rem' }}>Tracking Devices</h3>
          {devices.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 'var(--spacing-2)', color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: '32px', marginBottom: 'var(--spacing-1)' }}>sensors_off</span>
              <span style={{ fontSize: '0.875rem' }}>No devices attached</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--spacing-1)' }}>
              {devices.map(d => (
                <div key={d.deviceId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-1)',
                  padding: 'var(--spacing-1)',
                  backgroundColor: 'var(--surface-variant)',
                  borderRadius: '6px',
                  border: '1px solid var(--outline-variant)',
                }}>
                  <span className="material-icons" style={{ fontSize: '24px', color: 'var(--on-surface-variant)' }}>sensors</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{d.deviceName || d.deviceId}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                      Last seen: {new Date(d.lastSeen).toLocaleString()}
                    </div>
                  </div>
                  <span className="chip chip-success" style={{ fontSize: '0.7rem' }}>
                    {d.eventCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logistics / Map Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 var(--spacing-1) 0', fontSize: '1rem' }}>Logistics</h3>
          <OverviewMap shipment={shipment} />
          {/* Last known location below map */}
          {lastLocationEvent && (
            <div style={{ marginTop: 'var(--spacing-1)', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <span className="material-icons" style={{ fontSize: '16px', color: 'var(--primary)' }}>my_location</span>
                <strong>Last Known Location</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '2px' }}>
                {new Date(lastLocationEvent.eventTime).toLocaleString()}
              </div>
              {(lastLocationEvent.locationSummary || lastLocationEvent.address) && (
                <div style={{ fontSize: '0.8rem' }}>
                  {lastLocationEvent.locationSummary || lastLocationEvent.address}
                </div>
              )}
            </div>
          )}
          {/* Origin/Destination summary below */}
          <div style={{ marginTop: 'var(--spacing-1)', borderTop: '1px solid var(--outline-variant)', paddingTop: 'var(--spacing-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.8rem' }}>
              <span className="material-icons" style={{ fontSize: '14px', color: 'var(--color-success)' }}>trip_origin</span>
              <span>{shipment.origin.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
              <span className="material-icons" style={{ fontSize: '14px', color: 'var(--error)' }}>flag</span>
              <span>{shipment.destination.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Drivers row */}
      <div className="card">
        <h3 style={{ margin: '0 0 var(--spacing-1) 0', fontSize: '1rem' }}>Drivers</h3>
        {shipment.loads && shipment.loads.length > 0 && shipment.loads.some((ld: any) => ld.driverName) ? (
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap', fontSize: '0.875rem' }}>
            {shipment.loads.filter((ld: any) => ld.driverName).map((ld: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                <span className="material-icons" style={{ fontSize: '20px', color: 'var(--on-surface-variant)' }}>badge</span>
                <div>
                  <div style={{ fontWeight: 500 }}>{ld.driverName}</div>
                  {ld.vehiclePlate && <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Vehicle: {ld.vehiclePlate}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', margin: 0 }}>
            No drivers were assigned to this shipment
          </p>
        )}
      </div>

      {/* What's Being Delivered */}
      <div className="card">
        <h3 style={{ margin: '0 0 var(--spacing-2) 0', fontSize: '1rem' }}>What's Being Delivered</h3>

        {/* Delivery Stops */}
        {shipment.stops && shipment.stops.length > 0 && (
          <div style={{ display: 'grid', gap: 'var(--spacing-1)' }}>
            {shipment.stops.map(stop => (
              <DeliveryStopCard key={stop.id} stop={stop} onUpdateStop={onUpdateStop} onBulkMarkDelivered={onBulkMarkDelivered} />
            ))}
          </div>
        )}

        {/* Orders (not linked to stops) */}
        {shipment.orderShipments && shipment.orderShipments.length > 0 && (!shipment.stops || shipment.stops.length === 0) && (
          <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap' }}>
            {shipment.orderShipments.map(os => {
              const deliveryChip: { [key: string]: string } = {
                unassigned: 'chip-primary', assigned: 'chip-info',
                in_transit: 'chip-warning', delivered: 'chip-success',
                exception: 'chip-error', cancelled: 'chip-primary'
              };
              return (
                <Link key={os.order.id} to={`/orders/${os.order.id}`} style={{ textDecoration: 'none' }}>
                  <span className={`chip ${deliveryChip[os.order.deliveryStatus] || 'chip-primary'}`}>
                    {os.order.orderNumber} — {os.order.deliveryStatus.replace(/_/g, ' ')}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {(!shipment.stops || shipment.stops.length === 0) && (!shipment.orderShipments || shipment.orderShipments.length === 0) && (
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', margin: 0 }}>
            No deliveries assigned yet.
          </p>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '2px' }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

/* ─── Overview Map (lazy Leaflet) ─────────────────────────── */

function OverviewMap({ shipment }: { shipment: Shipment }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    let cancelled = false;

    const loadMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapContainerRef.current) return;
      if (mapInstanceRef.current) mapInstanceRef.current.remove();

      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([40.7128, -74.0060], 10);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      const markers: any[] = [];

      if (shipment.origin.lat && shipment.origin.lng) {
        const m = L.marker([shipment.origin.lat, shipment.origin.lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color:var(--marker-origin);color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">O</div>`,
            iconSize: [28, 28], iconAnchor: [14, 14]
          })
        }).addTo(map);
        m.bindPopup(`<b>Origin:</b> ${shipment.origin.name}<br>${shipment.origin.city}`);
        markers.push(m);
      }

      if (shipment.lane?.stops) {
        shipment.lane.stops.forEach(stop => {
          if (stop.location.lat && stop.location.lng) {
            const m = L.marker([stop.location.lat, stop.location.lng], {
              icon: L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color:var(--marker-stop);color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${stop.order}</div>`,
                iconSize: [28, 28], iconAnchor: [14, 14]
              })
            }).addTo(map);
            m.bindPopup(`<b>Stop ${stop.order}:</b> ${stop.location.name}`);
            markers.push(m);
          }
        });
      }

      // Latest tracking event marker
      if (shipment.events) {
        const lastEvent = [...shipment.events].filter(e => e.lat && e.lng).sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())[0];
        if (lastEvent) {
          const m = L.marker([lastEvent.lat!, lastEvent.lng!], {
            icon: L.divIcon({
              className: 'custom-marker',
              html: `<div style="background-color:var(--marker-default);color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"><span class='material-icons' style='font-size:14px'>my_location</span></div>`,
              iconSize: [24, 24], iconAnchor: [12, 12]
            })
          }).addTo(map);
          m.bindPopup(`<b>Last Location</b><br>${new Date(lastEvent.eventTime).toLocaleString()}`);
          markers.push(m);
        }
      }

      if (shipment.destination.lat && shipment.destination.lng) {
        const m = L.marker([shipment.destination.lat, shipment.destination.lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color:var(--marker-destination);color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">D</div>`,
            iconSize: [28, 28], iconAnchor: [14, 14]
          })
        }).addTo(map);
        m.bindPopup(`<b>Destination:</b> ${shipment.destination.name}<br>${shipment.destination.city}`);
        markers.push(m);
      }

      if (markers.length > 0) {
        const group = (L as any).featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.15));
      }
    };

    loadMap();
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, [shipment]);

  const hasCoords = (shipment.origin.lat && shipment.origin.lng) || (shipment.destination.lat && shipment.destination.lng);

  if (!hasCoords) {
    return (
      <div style={{
        height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--surface-variant)', borderRadius: '8px', color: 'var(--on-surface-variant)',
      }}>
        <span className="material-icons" style={{ fontSize: '24px', marginRight: '8px' }}>map</span>
        No coordinates available
      </div>
    );
  }

  return (
    <div ref={mapContainerRef} style={{
      height: '200px', width: '100%', borderRadius: '8px',
      border: '1px solid var(--outline-variant)', flex: '0 0 200px',
    }} />
  );
}

/* ─── Activity & Events Tab (Split View) ──────────────────── */

function ActivityEventsTab({ shipment }: { shipment: Shipment }) {
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  const events = shipment.events || [];

  const eventTypes = React.useMemo(() => {
    const types = [...new Set(events.map(e => e.eventType))];
    return types.sort();
  }, [events]);

  const filteredEvents = React.useMemo(() => {
    let filtered = events;
    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(e => e.eventType === eventTypeFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.eventType.toLowerCase().includes(term) ||
        (e.address && e.address.toLowerCase().includes(term)) ||
        (e.locationSummary && e.locationSummary.toLowerCase().includes(term)) ||
        (e.deviceName && e.deviceName.toLowerCase().includes(term))
      );
    }
    return filtered.sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
  }, [events, eventTypeFilter, searchTerm]);

  const selectedEvent = selectedEventId ? events.find(e => e.id === selectedEventId) : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedEvent ? '1fr 380px' : '1fr', gap: 'var(--spacing-2)' }}>
      {/* Events Table (left) */}
      <div className="card">
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 'var(--spacing-1)', alignItems: 'center', marginBottom: 'var(--spacing-2)', flexWrap: 'wrap' }}>
          <div className="text-field" style={{ flex: '1 1 200px', minWidth: '150px' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder=" "
            />
            <label>Search events</label>
          </div>
          <div className="text-field" style={{ flex: '0 0 160px' }}>
            <select value={eventTypeFilter} onChange={e => setEventTypeFilter(e.target.value)}>
              <option value="all">All</option>
              {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label>Event Type</label>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <p style={{ color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
            {events.length === 0
              ? 'No events recorded yet. Events will appear here when the shipment is tracked via GPS devices.'
              : 'No events match your filters.'}
          </p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>State</th>
                  <th>Activity</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(event => (
                  <tr
                    key={event.id}
                    onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedEventId === event.id ? 'var(--primary-container)' : undefined,
                    }}
                  >
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                      {new Date(event.eventTime).toLocaleString()}
                    </td>
                    <td>{event.eventType}</td>
                    <td>
                      <span className="chip chip-success" style={{ fontSize: '0.75rem' }}>Active</span>
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>
                      {event.locationSummary || event.address || '—'}
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>
                      {event.deviceName || event.deviceId || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Event Detail Panel (right) */}
      {selectedEvent && (
        <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEventId(null)} />
      )}
    </div>
  );
}

function EventDetailPanel({ event, onClose }: { event: ShipmentEvent; onClose: () => void }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current || !event.lat || !event.lng) return;
    let cancelled = false;

    const loadMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapContainerRef.current) return;
      if (mapInstanceRef.current) mapInstanceRef.current.remove();

      const map = L.map(mapContainerRef.current).setView([event.lat!, event.lng!], 14);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      L.marker([event.lat!, event.lng!], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: `<div style="background-color:var(--marker-default);color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"><span class='material-icons' style='font-size:16px'>my_location</span></div>`,
          iconSize: [28, 28], iconAnchor: [14, 14]
        })
      }).addTo(map);
    };

    loadMap();
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, [event.id, event.lat, event.lng]);

  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      borderRadius: '8px',
      border: '1px solid var(--outline-variant)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'var(--primary)',
        color: 'var(--on-primary)',
        padding: 'var(--spacing-1) var(--spacing-2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
          <span className="material-icons" style={{ fontSize: '16px' }}>schedule</span>
          {new Date(event.eventTime).toLocaleString()}
        </div>
        <button
          className="icon-btn"
          onClick={onClose}
          style={{ color: 'var(--on-primary)', padding: '2px' }}
        >
          <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
        </button>
      </div>

      {/* Event info */}
      <div style={{ padding: 'var(--spacing-2)' }}>
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{event.eventType}</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginBottom: 'var(--spacing-2)' }}>
          {event.locationSummary || event.address || 'Location event recorded'}
        </div>

        {/* Map */}
        {event.lat && event.lng ? (
          <div ref={mapContainerRef} style={{
            height: '180px', width: '100%', borderRadius: '8px',
            border: '1px solid var(--outline-variant)', marginBottom: 'var(--spacing-2)',
          }} />
        ) : (
          <div style={{
            height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--surface-variant)', borderRadius: '8px',
            marginBottom: 'var(--spacing-2)', color: 'var(--on-surface-variant)', fontSize: '0.875rem',
          }}>
            No coordinates available
          </div>
        )}

        {/* Address */}
        {(event.address || event.locationSummary) && (
          <div style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
            backgroundColor: 'var(--surface-variant)',
            borderRadius: '6px',
            marginBottom: 'var(--spacing-1)',
            fontSize: '0.875rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px', fontWeight: 500 }}>Address</div>
            {event.address || event.locationSummary}
          </div>
        )}

        {/* Coordinates */}
        {event.lat && event.lng && (
          <div style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
            backgroundColor: 'var(--surface-variant)',
            borderRadius: '6px',
            marginBottom: 'var(--spacing-1)',
            fontSize: '0.875rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px', fontWeight: 500 }}>Coordinates</div>
            {event.lat.toFixed(6)}, {event.lng.toFixed(6)}
          </div>
        )}

        {/* Device */}
        {(event.deviceName || event.deviceId) && (
          <div style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
            backgroundColor: 'var(--surface-variant)',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px', fontWeight: 500 }}>Device</div>
            {event.deviceName || event.deviceId}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Information Tab ─────────────────────────────────────── */

function InformationTab({ shipment }: { shipment: Shipment }) {
  const assignedCarrier = shipment.carrier || shipment.lane?.laneCarriers?.find(lc => lc.assigned)?.carrier;

  return (
    <div style={{ display: 'grid', gap: 'var(--spacing-2)' }}>
      {/* Top row: Shipment Info + Carrier Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)' }}>
        {/* Shipment Information */}
        <div className="card">
          <h3 style={{ margin: '0 0 var(--spacing-2) 0', fontSize: '1rem' }}>Shipment Information</h3>
          <div style={{ display: 'grid', gap: 'var(--spacing-1)', fontSize: '0.875rem' }}>
            <InfoRow label="State">
              <span className={`chip ${
                shipment.status === 'delivered' ? 'chip-success' :
                shipment.status === 'in_transit' ? 'chip-warning' :
                shipment.status === 'cancelled' ? 'chip-error' :
                'chip-primary'
              }`}>
                {shipment.status.replace(/_/g, ' ')}
              </span>
            </InfoRow>
            <InfoRow label="Customer">{shipment.customer.name}</InfoRow>
            {shipment.customer.contactEmail && <InfoRow label="Contact Email">{shipment.customer.contactEmail}</InfoRow>}
            <InfoRow label="Pickup Date">{shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : '—'}</InfoRow>
            <InfoRow label="Delivery Date">{shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : '—'}</InfoRow>
            {shipment.lane && <InfoRow label="Lane">{shipment.lane.name}</InfoRow>}
          </div>
        </div>

        {/* Carrier / Logistics Info */}
        <div className="card">
          <h3 style={{ margin: '0 0 var(--spacing-2) 0', fontSize: '1rem' }}>Carrier Information</h3>
          {assignedCarrier ? (
            <div style={{ display: 'grid', gap: 'var(--spacing-1)', fontSize: '0.875rem' }}>
              <InfoRow label="Carrier Name">{assignedCarrier.name}</InfoRow>
              {assignedCarrier.mcNumber && <InfoRow label="MC Number">{assignedCarrier.mcNumber}</InfoRow>}
              {assignedCarrier.dotNumber && <InfoRow label="DOT Number">{assignedCarrier.dotNumber}</InfoRow>}
              {assignedCarrier.contactName && <InfoRow label="Contact">{assignedCarrier.contactName}</InfoRow>}
              {assignedCarrier.contactEmail && <InfoRow label="Email">{assignedCarrier.contactEmail}</InfoRow>}
              {assignedCarrier.contactPhone && <InfoRow label="Phone">{assignedCarrier.contactPhone}</InfoRow>}
            </div>
          ) : (
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', margin: 0 }}>
              No carrier assigned
            </p>
          )}
        </div>
      </div>

      {/* Origin / Destination */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)' }}>
        <LocationCard label="Origin" location={shipment.origin} icon="trip_origin" color="var(--color-success)" />
        <LocationCard label="Destination" location={shipment.destination} icon="flag" color="var(--error)" />
      </div>

      {/* Lane stops */}
      {shipment.lane && shipment.lane.stops && shipment.lane.stops.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 var(--spacing-2) 0', fontSize: '1rem' }}>Lane Stops ({shipment.lane.stops.length})</h3>
          <div style={{ display: 'grid', gap: 'var(--spacing-1)' }}>
            {shipment.lane.stops.map(stop => (
              <div key={stop.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)',
                padding: 'var(--spacing-1)', backgroundColor: 'var(--surface-variant)',
                borderRadius: '4px', border: '1px solid var(--outline-variant)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'var(--marker-stop)', color: 'white',
                  borderRadius: '50%', width: '28px', height: '28px',
                  fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0,
                }}>
                  {stop.order}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{stop.location.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                    {stop.location.address1}, {stop.location.city}{stop.location.state ? `, ${stop.location.state}` : ''}
                  </div>
                </div>
                {stop.notes && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>{stop.notes}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Carrier Quotes */}
      {shipment.lane?.laneCarriers && shipment.lane.laneCarriers.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 var(--spacing-2) 0', fontSize: '1rem' }}>
            Carrier Quotes ({shipment.lane.laneCarriers.length})
          </h3>
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
                {shipment.lane.laneCarriers.map(lc => (
                  <tr key={lc.id} style={lc.assigned ? { backgroundColor: 'var(--primary-container)' } : {}}>
                    <td>
                      <strong>{lc.carrier.name}</strong>
                      {lc.carrier.mcNumber && <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>MC: {lc.carrier.mcNumber}</div>}
                    </td>
                    <td>{lc.price ? `${lc.currency} ${lc.price.toFixed(2)}` : '—'}</td>
                    <td>{lc.serviceLevel || '—'}</td>
                    <td>
                      {lc.assigned ? (
                        <span className="chip chip-success">
                          <span className="material-icons" style={{ fontSize: '14px' }}>check</span>
                          Assigned
                        </span>
                      ) : (
                        <span className="chip">Quote</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drivers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)' }}>
        <div className="card">
          <h3 style={{ margin: '0 0 var(--spacing-1) 0', fontSize: '1rem' }}>Drivers</h3>
          {shipment.loads && shipment.loads.length > 0 && shipment.loads.some((ld: any) => ld.driverName) ? (
            <div style={{ display: 'grid', gap: 'var(--spacing-1)', fontSize: '0.875rem' }}>
              {shipment.loads.filter((ld: any) => ld.driverName).map((ld: any, i: number) => (
                <div key={i}>
                  <div style={{ fontWeight: 500 }}>{ld.driverName}</div>
                  {ld.vehiclePlate && <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Vehicle: {ld.vehiclePlate}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', margin: 0 }}>
              No drivers were assigned to this shipment
            </p>
          )}
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 var(--spacing-1) 0', fontSize: '1rem' }}>Custom Fields</h3>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', margin: 0 }}>
            No custom fields were added to this shipment
          </p>
        </div>
      </div>
    </div>
  );
}

function LocationCard({ label, location, icon, color }: { label: string; location: Location; icon: string; color: string }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', marginBottom: 'var(--spacing-1)' }}>
        <span className="material-icons" style={{ color, fontSize: '20px' }}>{icon}</span>
        <h4 style={{ margin: 0 }}>{label}</h4>
      </div>
      <div style={{ fontSize: '0.875rem' }}>
        <div style={{ fontWeight: 500, marginBottom: '2px' }}>{location.name}</div>
        <div>{location.address1}</div>
        {location.address2 && <div>{location.address2}</div>}
        <div>{location.city}{location.state ? `, ${location.state}` : ''} {location.postalCode || ''}</div>
        <div>{location.country}</div>
        {location.lat != null && location.lng != null && (
          <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveryStopCard({ stop, onUpdateStop, onBulkMarkDelivered }: {
  stop: ShipmentStop;
  onUpdateStop: (stopId: string, status: string) => Promise<void>;
  onBulkMarkDelivered: (stopId: string, orderCount: number) => Promise<void>;
}) {
  const stopStatusChip: { [key: string]: string } = {
    pending: 'chip chip-warning',
    arrived: 'chip chip-info',
    in_progress: 'chip chip-warning',
    completed: 'chip chip-success',
    skipped: 'chip chip-primary'
  };

  const activeOrders = stop.orders.filter(
    o => o.deliveryStatus !== 'delivered' && o.deliveryStatus !== 'cancelled'
  );

  return (
    <div style={{
      padding: 'var(--spacing-2)',
      backgroundColor: 'var(--surface-container)',
      borderRadius: '8px',
      border: stop.status === 'completed' ? '2px solid var(--color-success)' : '1px solid var(--outline-variant)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: stop.status === 'completed' ? 'var(--color-success)' : 'var(--marker-stop)',
            color: 'white', borderRadius: '50%', width: '32px', height: '32px',
            fontSize: '0.875rem', fontWeight: 'bold',
          }}>
            {stop.status === 'completed' ? (
              <span className="material-icons" style={{ fontSize: '18px' }}>check</span>
            ) : stop.sequenceNumber}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{stop.location.name}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
              {stop.location.address1}, {stop.location.city}{stop.location.state ? `, ${stop.location.state}` : ''}
            </div>
          </div>
        </div>
        <span className={stopStatusChip[stop.status] || 'chip chip-primary'}>
          {stop.status.replace(/_/g, ' ')}
        </span>
      </div>

      {(stop.actualArrival || stop.actualDeparture || stop.estimatedArrival) && (
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginBottom: 'var(--spacing-1)', flexWrap: 'wrap' }}>
          {stop.estimatedArrival && <span>ETA: {new Date(stop.estimatedArrival).toLocaleString()}</span>}
          {stop.actualArrival && <span>Arrived: {new Date(stop.actualArrival).toLocaleString()}</span>}
          {stop.actualDeparture && <span>Departed: {new Date(stop.actualDeparture).toLocaleString()}</span>}
        </div>
      )}

      {stop.orders.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-1)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', color: 'var(--on-surface-variant)' }}>
            Orders ({stop.orders.length})
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap' }}>
            {stop.orders.map(o => {
              const deliveryChip: { [key: string]: string } = {
                unassigned: 'chip-primary', assigned: 'chip-info',
                in_transit: 'chip-warning', delivered: 'chip-success',
                exception: 'chip-error', cancelled: 'chip-primary'
              };
              return (
                <Link key={o.id} to={`/orders/${o.id}`} style={{ textDecoration: 'none' }}>
                  <span className={`chip ${deliveryChip[o.deliveryStatus] || 'chip-primary'}`}>
                    {o.orderNumber} — {o.deliveryStatus.replace(/_/g, ' ')}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {stop.status !== 'completed' && stop.status !== 'skipped' && (
        <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap' }} className="no-print">
          {stop.status === 'pending' && (
            <button onClick={() => onUpdateStop(stop.id, 'arrived')} className="button button-sm button-outline">
              <span className="material-icons" style={{ fontSize: '16px' }}>place</span>
              Mark Arrived
            </button>
          )}
          {stop.status === 'arrived' && (
            <button onClick={() => onUpdateStop(stop.id, 'in_progress')} className="button button-sm button-outline">
              <span className="material-icons" style={{ fontSize: '16px' }}>local_shipping</span>
              Mark In Progress
            </button>
          )}
          {(stop.status === 'arrived' || stop.status === 'in_progress') && (
            <button onClick={() => onBulkMarkDelivered(stop.id, activeOrders.length)} className="button button-sm button-success">
              <span className="material-icons" style={{ fontSize: '16px' }}>check_circle</span>
              Complete Stop ({activeOrders.length} orders)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Documents Tab ─────────────────────────────────────────── */

function DocumentsTab({ shipmentId, generating, onGenerateDoc }: {
  shipmentId: string;
  generating: string | null;
  onGenerateDoc: (type: 'bol' | 'customs') => Promise<void>;
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--spacing-2)' }}>
      <div className="card">
        <h3 style={{ margin: '0 0 var(--spacing-2) 0', fontSize: '1rem' }}>Generate Documents</h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap' }}>
          <button onClick={() => onGenerateDoc('bol')} disabled={generating !== null}
            className="button button-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>description</span>
            {generating === 'bol' ? 'Generating...' : 'Generate Bill of Lading'}
          </button>
          <button onClick={() => onGenerateDoc('customs')} disabled={generating !== null}
            className="button button-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>public</span>
            {generating === 'customs' ? 'Generating...' : 'Generate Customs Form'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 var(--spacing-1) 0', fontSize: '1rem' }}>Attachments</h3>
        <AttachmentPanel entityType="shipment" entityId={shipmentId} />
      </div>
    </div>
  );
}

/* ─── Audit Tab ─────────────────────────────────────────────── */

function AuditTab({ shipment }: { shipment: Shipment }) {
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 var(--spacing-2) 0', fontSize: '1rem' }}>Audit Information</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)', fontSize: '0.875rem' }}>
        <InfoRow label="Created">{new Date(shipment.createdAt).toLocaleString()}</InfoRow>
        <InfoRow label="Last Updated">{new Date(shipment.updatedAt).toLocaleString()}</InfoRow>
        <InfoRow label="Shipment ID">
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shipment.id}</span>
        </InfoRow>
        <InfoRow label="Status">{shipment.status.replace(/_/g, ' ')}</InfoRow>
        {shipment.lane && <InfoRow label="Lane">{shipment.lane.name} (ID: {shipment.lane.id})</InfoRow>}
      </div>

      <div style={{
        marginTop: 'var(--spacing-3)',
        padding: 'var(--spacing-2)',
        backgroundColor: 'var(--surface-variant)',
        borderRadius: '8px',
        border: '1px solid var(--outline-variant)',
        fontSize: '0.875rem',
        color: 'var(--on-surface-variant)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', marginBottom: '4px' }}>
          <span className="material-icons" style={{ fontSize: '18px' }}>info</span>
          <strong>Audit Log</strong>
        </div>
        <p style={{ margin: 0 }}>
          Detailed audit logging for field-level changes is planned for a future release.
        </p>
      </div>
    </div>
  );
}
