import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

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

const LANES = [
  {
    id: 'BID-201',
    origin: 'Chicago, IL',
    dest: 'Dallas, TX',
    customer: 'Acme Corp',
    mode: 'FTL',
    weight: '42,000 lbs',
    pickup: 'Apr 9',
    delivery: 'Apr 11',
    targetRate: 2800,
    status: 'Open',
    bids: [
      { carrier: 'Swift Transport', rating: 4.8, onTime: 97, loads: 342, price: 2750, transit: '2 days', equipment: "53' Dry Van", submitted: '2h ago', status: 'pending' as const },
      { carrier: 'Lone Star Freight', rating: 4.9, onTime: 98, loads: 412, price: 2900, transit: '2 days', equipment: "53' Dry Van", submitted: '3h ago', status: 'pending' as const },
      { carrier: 'Mountain Haul', rating: 4.6, onTime: 95, loads: 215, price: 2680, transit: '3 days', equipment: "53' Dry Van", submitted: '5h ago', status: 'pending' as const },
    ],
    originCoords: [41.88, -87.63] as [number, number],
    destCoords: [32.78, -96.80] as [number, number],
  },
  {
    id: 'BID-200',
    origin: 'Los Angeles, CA',
    dest: 'Seattle, WA',
    customer: 'Global Widgets',
    mode: 'LTL',
    weight: '8,500 lbs',
    pickup: 'Apr 10',
    delivery: 'Apr 13',
    targetRate: 1800,
    status: 'Open',
    bids: [
      { carrier: 'Pacific Lines', rating: 4.2, onTime: 89, loads: 98, price: 1650, transit: '3 days', equipment: 'LTL Shared', submitted: '1h ago', status: 'pending' as const },
      { carrier: 'Desert Freight', rating: 4.5, onTime: 94, loads: 186, price: 1920, transit: '2 days', equipment: 'LTL Shared', submitted: '4h ago', status: 'pending' as const },
    ],
    originCoords: [34.05, -118.24] as [number, number],
    destCoords: [47.61, -122.33] as [number, number],
  },
  {
    id: 'BID-199',
    origin: 'Atlanta, GA',
    dest: 'New York, NY',
    customer: 'BioPharm Inc',
    mode: 'Reefer',
    weight: '22,000 lbs',
    pickup: 'Apr 8',
    delivery: 'Apr 10',
    targetRate: 3500,
    status: 'Awarded',
    bids: [
      { carrier: 'Southeast Express', rating: 4.7, onTime: 96, loads: 528, price: 3350, transit: '2 days', equipment: "53' Reefer", submitted: '1d ago', status: 'accepted' as const },
      { carrier: 'NorthEast Carriers', rating: 4.3, onTime: 91, loads: 124, price: 3600, transit: '2 days', equipment: "53' Reefer", submitted: '1d ago', status: 'declined' as const },
    ],
    originCoords: [33.75, -84.39] as [number, number],
    destCoords: [40.71, -74.01] as [number, number],
  },
];

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
  const [selectedLane, setSelectedLane] = useState(LANES[0]);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
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
  }, [selectedLane.id]);

  const lowestBid = Math.min(...selectedLane.bids.map(b => b.price));
  const highestBid = Math.max(...selectedLane.bids.map(b => b.price));

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Carrier Bidding</h1>
          <p>{LANES.filter(l => l.status === 'Open').length} open bid requests · {LANES.reduce((s, l) => s + l.bids.length, 0)} total bids</p>
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
              {LANES.map(lane => (
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
                .sort((a, b) => a.price - b.price)
                .map((bid, i) => (
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
