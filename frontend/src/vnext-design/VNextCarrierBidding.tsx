import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_URL } from '../api';

interface Bid {
  carrier: string;
  rating: number;
  onTime: number;
  loads: number;
  price: number;
  transit: string;
  equipment: string;
  submitted: string;
  status: 'pending' | 'accepted' | 'declined';
}

function mapTenderToLane(t: any) {
  const origin = t.shipment?.origin;
  const dest = t.shipment?.destination;
  const originLabel = origin ? `${origin.city}, ${origin.state || ''}`.trim() : 'N/A';
  const destLabel = dest ? `${dest.city}, ${dest.state || ''}`.trim() : 'N/A';

  const statusMap: Record<string, string> = {
    draft: 'Draft',
    open: 'Open',
    evaluating: 'Open',
    awarded: 'Awarded',
    cancelled: 'Cancelled',
  };

  const relativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const bids: Bid[] = (t.offers || []).flatMap((offer: any) =>
    (offer.bids || []).map((bid: any) => ({
      carrier: offer.carrier?.name || 'Unknown Carrier',
      rating: 0,
      onTime: 0,
      loads: 0,
      price: bid.rate || 0,
      transit: bid.transitDays ? `${bid.transitDays} days` : 'N/A',
      equipment: bid.equipmentType || t.equipmentType || 'N/A',
      submitted: relativeTime(bid.createdAt),
      status: (bid.status === 'accepted' ? 'accepted' : bid.status === 'declined' ? 'declined' : 'pending') as Bid['status'],
    }))
  );

  return {
    id: t.reference || `TNR-${t.id?.slice(0, 6)}`,
    origin: originLabel,
    dest: destLabel,
    customer: t.shipment?.customer?.name || 'N/A',
    mode: t.equipmentType || 'FTL',
    weight: 'N/A',
    pickup: t.shipment?.pickupDate ? new Date(t.shipment.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
    delivery: t.shipment?.deliveryDate ? new Date(t.shipment.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
    targetRate: t.targetRate || 0,
    status: statusMap[t.status] || t.status || 'Unknown',
    bids,
    originCoords: [39.5, -98.5] as [number, number],
    destCoords: [39.5, -95.5] as [number, number],
  };
}

function BidStars({ rating }: { rating: number }) {
  return (
    <div className="vn-rating" title={`${rating}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`material-icons ${i < Math.floor(rating) ? '' : 'empty'}`}>
          {i < Math.floor(rating) ? 'star' : 'star_outline'}
        </span>
      ))}
    </div>
  );
}

export default function VNextCarrierBidding() {
  const navigate = useNavigate();
  const [lanes, setLanes] = useState<any[]>([]);
  const [selectedLane, setSelectedLane] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/tenders`)
      .then(r => r.json())
      .then(json => {
        const mapped = (json.data || []).map(mapTenderToLane);
        setLanes(mapped);
        if (mapped.length > 0) setSelectedLane(mapped[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mapRef.current || !selectedLane) return;
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([39.5, -98.5], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

    // Read marker colours from CSS custom properties
    const cs = getComputedStyle(document.documentElement);
    const cOrigin = cs.getPropertyValue('--marker-origin').trim();
    const cDest = cs.getPropertyValue('--marker-destination').trim();
    const cDefault = cs.getPropertyValue('--marker-default').trim();

    // Route line
    L.polyline([selectedLane.originCoords, selectedLane.destCoords], {
      color: cDefault, weight: 3, opacity: 0.6, dashArray: '10 6',
    }).addTo(map);

    // Origin
    const oIcon = L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:${cOrigin};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10],
    });
    L.marker(selectedLane.originCoords, { icon: oIcon }).addTo(map).bindPopup(`<strong>Origin</strong><br/>${selectedLane.origin}`);

    // Dest
    const dIcon = L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:${cDest};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10],
    });
    L.marker(selectedLane.destCoords, { icon: dIcon }).addTo(map).bindPopup(`<strong>Destination</strong><br/>${selectedLane.dest}`);

    map.fitBounds(L.latLngBounds([selectedLane.originCoords, selectedLane.destCoords]).pad(0.3));
    setTimeout(() => map.invalidateSize(), 100);
    mapInstance.current = map;

    return () => { map.remove(); mapInstance.current = null; };
  }, [selectedLane?.id]);

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  if (!selectedLane || lanes.length === 0) {
    return (
      <>
        <div className="vn-page-header">
          <div>
            <h1>Carrier Bidding</h1>
            <p>0 open bid requests</p>
          </div>
          <div className="vn-page-actions">
            <button className="vn-btn vn-btn-primary" onClick={() => navigate('/tenders/create')}>
              <span className="material-icons">add</span>
              New Bid Request
            </button>
          </div>
        </div>
        <div className="vn-empty">
          <span className="material-icons">gavel</span>
          <h3>No tenders found</h3>
          <p>Create a new bid request to get started</p>
        </div>
      </>
    );
  }

  const lowestBid = selectedLane.bids.length > 0 ? Math.min(...selectedLane.bids.map((b: Bid) => b.price)) : 0;
  const highestBid = selectedLane.bids.length > 0 ? Math.max(...selectedLane.bids.map((b: Bid) => b.price)) : 0;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Carrier Bidding</h1>
          <p>{lanes.filter(l => l.status === 'Open').length} open bid requests · {lanes.reduce((s, l) => s + l.bids.length, 0)} total bids</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            New Bid Request
          </button>
        </div>
      </div>

      <div className="vn-detail-grid">
        {/* Left: Lane list + bid details */}
        <div className="vn-detail-main">
          {/* Lane Selector Tabs */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header"><h2>Bid Requests</h2></div>
            <div className="vn-card-body vn-card-flush">
              {lanes.map(lane => (
                <div
                  key={lane.id}
                  onClick={() => setSelectedLane(lane)}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--outline-variant)',
                    cursor: 'pointer',
                    background: selectedLane.id === lane.id ? 'var(--surface-container)' : 'transparent',
                    transition: 'background 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 13 }}>{lane.id}</span>
                      <span className={`vn-chip ${lane.status === 'Open' ? 'vn-chip-info' : 'vn-chip-success'}`}>{lane.status}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--on-surface)' }}>
                      {lane.origin} → {lane.dest}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                      {lane.customer} · {lane.mode} · {lane.weight}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>Target: ${lane.targetRate.toLocaleString()}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{lane.bids.length} bids</div>
                  </div>
                  <span className="material-icons" style={{ color: 'var(--on-surface-variant)', fontSize: 20 }}>chevron_right</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bids for selected lane */}
          <div className="vn-card">
            <div className="vn-card-header">
              <h2>
                Bids for {selectedLane.origin} → {selectedLane.dest}
              </h2>
              <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--on-surface-variant)' }}>
                <span>Target: <strong style={{ color: 'var(--on-surface)' }}>${selectedLane.targetRate.toLocaleString()}</strong></span>
                <span>Range: <strong style={{ color: 'var(--on-surface)' }}>${lowestBid.toLocaleString()} – ${highestBid.toLocaleString()}</strong></span>
              </div>
            </div>
            <div className="vn-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedLane.bids
                .slice()
                .sort((a: Bid, b: Bid) => a.price - b.price)
                .map((bid: Bid, i: number) => (
                  <div key={bid.carrier} className={`vn-bid-card ${bid.status === 'accepted' ? 'selected' : ''}`}>
                    {i === 0 && bid.status === 'pending' && (
                      <div style={{
                        position: 'absolute', top: -1, left: 16, background: 'var(--success)', color: 'var(--on-success)',
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: '0 0 6px 6px',
                      }}>
                        BEST VALUE
                      </div>
                    )}
                    <div className="vn-bid-carrier">
                      <div className="vn-bid-carrier-icon">
                        <span className="material-icons">local_shipping</span>
                      </div>
                      <div>
                        <div className="vn-bid-carrier-name">{bid.carrier}</div>
                        <div className="vn-bid-carrier-info">
                          <BidStars rating={bid.rating} />
                        </div>
                        <div className="vn-bid-carrier-info" style={{ marginTop: 4 }}>
                          {bid.onTime}% on-time · {bid.loads} loads YTD · {bid.equipment}
                        </div>
                      </div>
                    </div>
                    <div className="vn-bid-price">
                      <div className="vn-bid-amount" style={{
                        color: bid.price <= selectedLane.targetRate ? 'var(--success)' : 'var(--on-surface)',
                      }}>
                        ${bid.price.toLocaleString()}
                      </div>
                      <div className="vn-bid-transit">{bid.transit} transit</div>
                      <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                        Submitted {bid.submitted}
                      </div>
                    </div>
                    <div className="vn-bid-actions">
                      {bid.status === 'pending' ? (
                        <>
                          <button className="vn-btn vn-btn-success vn-btn-sm">
                            <span className="material-icons">check</span>
                            Accept
                          </button>
                          <button className="vn-btn vn-btn-outline vn-btn-sm">
                            <span className="material-icons">close</span>
                          </button>
                        </>
                      ) : bid.status === 'accepted' ? (
                        <span className="vn-chip vn-chip-success">
                          <span className="material-icons">check_circle</span>
                          Accepted
                        </span>
                      ) : (
                        <span className="vn-chip vn-chip-secondary">Declined</span>
                      )}
                    </div>
                  </div>
                ))}

              {selectedLane.bids.length === 0 && (
                <div className="vn-empty">
                  <span className="material-icons">gavel</span>
                  <h3>No bids yet</h3>
                  <p>Waiting for carrier responses</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Map + Lane Details */}
        <div className="vn-detail-sidebar">
          {/* Map */}
          <div ref={mapRef} className="vn-map" style={{ height: 280 }} />

          {/* Lane details */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Lane Details</h2></div>
            <div className="vn-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="vn-info-item"><label>Customer</label><span>{selectedLane.customer}</span></div>
                <div className="vn-info-item"><label>Mode</label><span>{selectedLane.mode}</span></div>
                <div className="vn-info-item"><label>Weight</label><span>{selectedLane.weight}</span></div>
                <div className="vn-info-item"><label>Pickup Date</label><span>{selectedLane.pickup}</span></div>
                <div className="vn-info-item"><label>Required Delivery</label><span>{selectedLane.delivery}</span></div>
                <div className="vn-info-item"><label>Target Rate</label><span style={{ fontWeight: 700, fontSize: 18 }}>${selectedLane.targetRate.toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          {/* Bid Summary */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Bid Summary</h2></div>
            <div className="vn-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--on-surface-variant)' }}>Total Bids</span>
                  <span style={{ fontWeight: 600 }}>{selectedLane.bids.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--on-surface-variant)' }}>Lowest Bid</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>${lowestBid.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--on-surface-variant)' }}>Highest Bid</span>
                  <span style={{ fontWeight: 600 }}>${highestBid.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--on-surface-variant)' }}>vs Target</span>
                  <span style={{
                    fontWeight: 600,
                    color: lowestBid <= selectedLane.targetRate ? 'var(--success)' : 'var(--error)',
                  }}>
                    {lowestBid <= selectedLane.targetRate ? '-' : '+'}${Math.abs(lowestBid - selectedLane.targetRate).toLocaleString()}
                    {' '}({lowestBid <= selectedLane.targetRate ? 'under' : 'over'})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
