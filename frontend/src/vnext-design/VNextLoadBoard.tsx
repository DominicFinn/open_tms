import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface FinancialSummary {
  expectedRevenueCents?: number;
  expectedCostCents?: number;
  expectedMarginCents?: number;
}

interface LoadBoardShipment {
  id: string;
  reference?: string;
  status: string;
  pickupDate?: string;
  deliveryDate?: string;
  customer?: { id: string; name: string };
  origin?: { id: string; name: string; city: string; state: string };
  destination?: { id: string; name: string; city: string; state: string };
  lane?: { id: string; name: string };
  shipmentFinancialSummary?: FinancialSummary | null;
  tenders?: { id: string; status: string; strategy: string }[];
}

interface MatchingCarrier {
  id: string;
  name: string;
  mcNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  scacCode?: string;
  laneRate?: {
    priceCents?: number;
    rateType?: string;
    fuelSurchargePercent?: number;
    serviceLevel?: string;
    isContractRate?: boolean;
  } | null;
  tenderStats?: {
    totalBids: number;
    acceptedBids: number;
    acceptanceRate?: number | null;
  };
  matchSource: 'lane_rate' | 'historical';
}

function formatDate(d?: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCents(cents?: number | null): string {
  if (cents == null) return '-';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysUntilPickup(d?: string): string {
  if (!d) return '';
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

function pickupUrgency(d?: string): string {
  if (!d) return '';
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'error';
  if (days <= 1) return 'warning';
  return 'info';
}

export default function VNextLoadBoard() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<LoadBoardShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [carriers, setCarriers] = useState<MatchingCarrier[]>([]);
  const [carriersLoading, setCarriersLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Assign modal
  const [assignModal, setAssignModal] = useState<{ shipmentId: string; carrier: MatchingCarrier } | null>(null);
  const [assignRate, setAssignRate] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/loadboard`);
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const json = await res.json();
        if (!cancelled) setShipments(json.data || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load matching carriers when a shipment is selected
  useEffect(() => {
    if (!selectedId) { setCarriers([]); return; }
    let cancelled = false;
    (async () => {
      try {
        setCarriersLoading(true);
        const res = await fetch(`${API_URL}/api/v1/loadboard/${selectedId}/matching-carriers`);
        if (!res.ok) throw new Error('Failed to load carriers');
        const json = await res.json();
        if (!cancelled) setCarriers(json.data?.carriers || []);
      } catch {
        if (!cancelled) setCarriers([]);
      } finally {
        if (!cancelled) setCarriersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const filtered = shipments.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.reference?.toLowerCase().includes(q) ||
      s.customer?.name.toLowerCase().includes(q) ||
      s.origin?.city?.toLowerCase().includes(q) ||
      s.destination?.city?.toLowerCase().includes(q)
    );
  });

  const selectedShipment = shipments.find(s => s.id === selectedId);

  async function handleAssign() {
    if (!assignModal) return;
    const rateCents = Math.round(parseFloat(assignRate) * 100);
    if (isNaN(rateCents) || rateCents <= 0) {
      setAssignError('Enter a valid rate');
      return;
    }
    setAssigning(true);
    setAssignError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/loadboard/${assignModal.shipmentId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierId: assignModal.carrier.id,
          costRateCents: rateCents,
          notes: assignNotes || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Assignment failed');
      }
      // Remove from list
      setShipments(prev => prev.filter(s => s.id !== assignModal.shipmentId));
      setSelectedId(null);
      setAssignModal(null);
      setAssignRate('');
      setAssignNotes('');
    } catch (err: any) {
      setAssignError(err.message);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div className="vn-page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Load Board</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--on-surface-variant)', fontSize: 14 }}>
            {shipments.length} shipment{shipments.length !== 1 ? 's' : ''} awaiting carrier assignment
          </p>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Split pane */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 400px' : '1fr', gap: 24 }}>
        {/* Left: Shipment cards */}
        <div>
          <div className="vn-filters" style={{ marginBottom: 16 }}>
            <div className="vn-filter-group" style={{ flex: 1 }}>
              <span className="material-icons">search</span>
              <input
                className="vn-filter-input"
                placeholder="Search by reference, customer, city..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="loading-spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="vn-card" style={{ textAlign: 'center', padding: 40 }}>
              <span className="material-icons" style={{ fontSize: 48, color: 'var(--on-surface-variant)' }}>inventory_2</span>
              <h3 style={{ margin: '12px 0 4px' }}>No loads available</h3>
              <p style={{ color: 'var(--on-surface-variant)' }}>All shipments have carriers assigned</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(s => (
                <div
                  key={s.id}
                  className="vn-card"
                  onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '16px 20px',
                    border: s.id === selectedId ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{s.reference || s.id.slice(0, 8)}</span>
                        <span className="vn-chip vn-chip-secondary" style={{ fontSize: 11 }}>{s.status}</span>
                        {s.tenders && s.tenders.length > 0 && (
                          <span className="vn-chip vn-chip-info" style={{ fontSize: 11 }}>
                            Tender {s.tenders[0].status}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4 }}>
                        {s.customer?.name || 'Unknown customer'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span>{s.origin ? `${s.origin.city}, ${s.origin.state}` : '-'}</span>
                        <span className="material-icons" style={{ fontSize: 16 }}>east</span>
                        <span>{s.destination ? `${s.destination.city}, ${s.destination.state}` : '-'}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 100 }}>
                      {s.pickupDate && (
                        <div style={{ marginBottom: 4 }}>
                          <span className={`vn-chip vn-chip-${pickupUrgency(s.pickupDate)}`} style={{ fontSize: 11 }}>
                            {daysUntilPickup(s.pickupDate)}
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                        PU: {formatDate(s.pickupDate)}
                      </div>
                      {s.shipmentFinancialSummary?.expectedRevenueCents != null && (
                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: 'var(--primary)' }}>
                          {formatCents(s.shipmentFinancialSummary.expectedRevenueCents)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Carrier search panel */}
        {selectedId && (
          <div>
            <div className="vn-card" style={{ position: 'sticky', top: 80 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline-variant)' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                  Matching Carriers
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                  {selectedShipment?.reference} - {selectedShipment?.origin?.city} to {selectedShipment?.destination?.city}
                </p>
              </div>

              {carriersLoading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <div className="loading-spinner" />
                </div>
              ) : carriers.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <span className="material-icons" style={{ fontSize: 36, color: 'var(--on-surface-variant)' }}>group_off</span>
                  <p style={{ color: 'var(--on-surface-variant)', fontSize: 13, margin: '8px 0' }}>
                    No matching carriers found for this lane
                  </p>
                  <button
                    className="vn-btn vn-btn-outline vn-btn-sm"
                    onClick={() => navigate(`/carrier-bidding`)}
                  >
                    Create Tender
                  </button>
                </div>
              ) : (
                <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
                  {carriers.map(c => (
                    <div
                      key={c.id}
                      style={{
                        padding: '12px 20px',
                        borderBottom: '1px solid var(--outline-variant)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                            {c.mcNumber ? `MC-${c.mcNumber}` : ''}{c.scacCode ? ` / ${c.scacCode}` : ''}
                          </div>
                          {c.contactName && (
                            <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                              {c.contactName}{c.contactPhone ? ` - ${c.contactPhone}` : ''}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {c.laneRate?.priceCents != null && (
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--primary)' }}>
                              {formatCents(c.laneRate.priceCents)}
                              {c.laneRate.isContractRate && (
                                <span className="vn-chip vn-chip-success" style={{ fontSize: 10, marginLeft: 4 }}>Contract</span>
                              )}
                            </div>
                          )}
                          <span className={`vn-chip vn-chip-${c.matchSource === 'lane_rate' ? 'primary' : 'secondary'}`} style={{ fontSize: 10 }}>
                            {c.matchSource === 'lane_rate' ? 'Lane Rate' : 'Historical'}
                          </span>
                        </div>
                      </div>
                      {c.tenderStats && c.tenderStats.totalBids > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                          Acceptance: {c.tenderStats.acceptanceRate ?? 0}% ({c.tenderStats.acceptedBids}/{c.tenderStats.totalBids} bids)
                        </div>
                      )}
                      <div style={{ marginTop: 8 }}>
                        <button
                          className="vn-btn vn-btn-primary vn-btn-sm"
                          onClick={() => {
                            setAssignModal({ shipmentId: selectedId!, carrier: c });
                            setAssignRate(c.laneRate?.priceCents ? (c.laneRate.priceCents / 100).toFixed(2) : '');
                            setAssignNotes('');
                            setAssignError('');
                          }}
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--outline-variant)', display: 'flex', gap: 8 }}>
                <button
                  className="vn-btn vn-btn-outline vn-btn-sm"
                  onClick={() => navigate(`/shipments/${selectedId}`)}
                >
                  View Shipment
                </button>
                <button
                  className="vn-btn vn-btn-outline vn-btn-sm"
                  onClick={() => navigate(`/carrier-bidding`)}
                >
                  Create Tender
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div className="vn-modal-backdrop" onClick={() => setAssignModal(null)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="vn-modal-header">
              <h3>Assign Carrier</h3>
              <button className="vn-btn-icon" onClick={() => setAssignModal(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="vn-modal-body">
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Shipment</div>
                <div style={{ fontWeight: 600 }}>
                  {shipments.find(s => s.id === assignModal.shipmentId)?.reference || assignModal.shipmentId.slice(0, 8)}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Carrier</div>
                <div style={{ fontWeight: 600 }}>{assignModal.carrier.name}</div>
              </div>
              <div className="vn-field" style={{ marginBottom: 16 }}>
                <label className="vn-field-label">Cost Rate ($)</label>
                <input
                  className="vn-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={assignRate}
                  onChange={e => setAssignRate(e.target.value)}
                />
              </div>
              {assignModal.carrier.laneRate?.priceCents != null && (
                <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 12 }}>
                  Lane rate: {formatCents(assignModal.carrier.laneRate.priceCents)}
                  {assignModal.carrier.laneRate.isContractRate ? ' (contract)' : ''}
                </div>
              )}
              {selectedShipment?.shipmentFinancialSummary?.expectedRevenueCents != null && assignRate && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  background: 'var(--surface-container)',
                  marginBottom: 12,
                  fontSize: 13,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sell rate:</span>
                    <span style={{ fontWeight: 600 }}>{formatCents(selectedShipment.shipmentFinancialSummary.expectedRevenueCents)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Buy rate:</span>
                    <span style={{ fontWeight: 600 }}>{formatCents(Math.round(parseFloat(assignRate) * 100))}</span>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    borderTop: '1px solid var(--outline-variant)', paddingTop: 4, marginTop: 4,
                  }}>
                    <span>Margin:</span>
                    <span style={{
                      fontWeight: 700,
                      color: (selectedShipment.shipmentFinancialSummary.expectedRevenueCents - Math.round(parseFloat(assignRate) * 100)) > 0
                        ? 'var(--color-success)' : 'var(--color-error)',
                    }}>
                      {formatCents(selectedShipment.shipmentFinancialSummary.expectedRevenueCents - Math.round(parseFloat(assignRate) * 100))}
                    </span>
                  </div>
                </div>
              )}
              <div className="vn-field">
                <label className="vn-field-label">Notes (optional)</label>
                <textarea
                  className="vn-input"
                  rows={2}
                  value={assignNotes}
                  onChange={e => setAssignNotes(e.target.value)}
                  placeholder="Internal notes..."
                />
              </div>
              {assignError && <div className="vn-alert vn-alert-error" style={{ marginTop: 12 }}>{assignError}</div>}
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setAssignModal(null)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={handleAssign} disabled={assigning}>
                {assigning ? 'Assigning...' : 'Assign Carrier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
