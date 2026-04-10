import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface Carrier {
  id: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  country?: string;
  archived?: boolean;
  validationTier?: string;
  registrationChecked?: boolean;
  insuranceDocReceived?: boolean;
}

function carrierStatus(c: Carrier): { label: string; color: string } {
  if (c.archived) return { label: 'Inactive', color: 'error' };
  if (c.validationTier === 'probation') return { label: 'Probation', color: 'warning' };
  return { label: 'Active', color: 'success' };
}


export default function VNextCarriers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/carriers`);
        if (!res.ok) throw new Error(`Failed to load carriers (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setCarriers(json.data || []);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load carriers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = carriers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.mcNumber || '').toLowerCase().includes(q) || (c.contactName || '').toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="vn-empty"><span className="material-icons" style={{animation:'spin 1s linear infinite'}}>refresh</span><h3>Loading...</h3></div>
    );
  }

  if (error) {
    return (
      <div className="vn-alert vn-alert-error"><span className="material-icons">error</span><div className="vn-alert-content">{error}</div></div>
    );
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Carriers</h1>
          <p>{carriers.length} carriers in your network</p>
        </div>
        <div className="vn-page-actions">
          <div style={{ display: 'flex', border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
            <button className="vn-btn-icon" style={{ borderRadius: 0, background: viewMode === 'cards' ? 'var(--surface-container)' : 'transparent' }} onClick={() => setViewMode('cards')}>
              <span className="material-icons" style={{ fontSize: 20 }}>grid_view</span>
            </button>
            <button className="vn-btn-icon" style={{ borderRadius: 0, background: viewMode === 'table' ? 'var(--surface-container)' : 'transparent' }} onClick={() => setViewMode('table')}>
              <span className="material-icons" style={{ fontSize: 20 }}>view_list</span>
            </button>
          </div>
          <button className="vn-btn vn-btn-primary" onClick={() => navigate('/carriers/create')}>
            <span className="material-icons">add</span>
            Add Carrier
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{carriers.filter(c => !c.archived).length}</div>
            <div className="vn-stat-label">Active Carriers</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">star</span></div>
          <div>
            <div className="vn-stat-value">{carriers.filter(c => c.registrationChecked).length}</div>
            <div className="vn-stat-label">Registration Verified</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">local_shipping</span></div>
          <div>
            <div className="vn-stat-value">{carriers.filter(c => c.insuranceDocReceived).length}</div>
            <div className="vn-stat-label">Insurance on File</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">schedule</span></div>
          <div>
            <div className="vn-stat-value">{carriers.filter(c => c.archived).length}</div>
            <div className="vn-stat-label">Archived</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <div className="vn-filter-group">
          <span className="material-icons">search</span>
          <input
            className="vn-filter-input"
            placeholder="Search carriers by name, MC#, or contact..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ minWidth: 360 }}
          />
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {filtered.map(c => {
            const st = carrierStatus(c);
            return (
            <div key={c.id} className="vn-card" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
              <div className="vn-card-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, background: 'var(--primary)', color: 'var(--on-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span className="material-icons">local_shipping</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--on-surface)' }}>{c.name}</span>
                      <span className={`vn-chip vn-chip-${st.color}`}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                      {c.mcNumber ? `MC# ${c.mcNumber}` : ''}{c.mcNumber && c.dotNumber ? ' · ' : ''}{c.dotNumber ? `DOT# ${c.dotNumber}` : ''}
                    </div>
                  </div>
                </div>

                {c.city && c.state && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, fontSize: 13, color: 'var(--on-surface-variant)' }}>
                    <span className="material-icons" style={{ fontSize: 16 }}>location_on</span>
                    {c.city}, {c.state}{c.country && c.country !== 'US' ? `, ${c.country}` : ''}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Registration</div>
                    <span className={`vn-chip vn-chip-${c.registrationChecked ? 'success' : 'secondary'}`}>
                      {c.registrationChecked ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Insurance</div>
                    <span className={`vn-chip vn-chip-${c.insuranceDocReceived ? 'success' : 'warning'}`}>
                      {c.insuranceDocReceived ? 'On File' : 'Missing'}
                    </span>
                  </div>
                </div>

                {expandedId === c.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--outline-variant)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div className="vn-info-item"><label>Contact</label><span>{c.contactName || '—'}</span></div>
                      <div className="vn-info-item"><label>Phone</label><span>{c.contactPhone || '—'}</span></div>
                      <div className="vn-info-item" style={{ gridColumn: '1 / -1' }}><label>Email</label><span style={{ color: 'var(--info)' }}>{c.contactEmail || '—'}</span></div>
                    </div>
                    {c.validationTier && (
                      <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        Validation Tier: <strong>{c.validationTier}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="vn-card">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>MC / DOT</th>
                  <th>Location</th>
                  <th>Registration</th>
                  <th>Insurance</th>
                  <th>Validation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const st = carrierStatus(c);
                  return (
                  <tr key={c.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{c.name}</span>
                      <div className="vn-table-secondary">{c.contactName || ''}{c.contactPhone ? ` · ${c.contactPhone}` : ''}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{c.mcNumber ? `MC# ${c.mcNumber}` : '—'}</div>
                      <div className="vn-table-secondary">{c.dotNumber ? `DOT# ${c.dotNumber}` : ''}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{c.city && c.state ? `${c.city}, ${c.state}` : '—'}</td>
                    <td>
                      <span className={`vn-chip vn-chip-${c.registrationChecked ? 'success' : 'secondary'}`}>
                        {c.registrationChecked ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <span className={`vn-chip vn-chip-${c.insuranceDocReceived ? 'success' : 'warning'}`}>
                        {c.insuranceDocReceived ? 'On File' : 'Missing'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{c.validationTier || '—'}</td>
                    <td><span className={`vn-chip vn-chip-${st.color}`}>{st.label}</span></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
