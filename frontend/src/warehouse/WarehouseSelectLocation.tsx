import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import './warehouse.css';

export default function WarehouseSelectLocation() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('warehouse_user');
    if (!user) {
      navigate('/warehouse/login');
      return;
    }

    fetch(`${API_URL}/api/v1/warehouse/locations`)
      .then(r => r.json())
      .then(json => {
        setLocations(json.data || []);
        // Pre-select if only one location
        if (json.data?.length === 1) {
          setSelectedId(json.data[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function handleContinue() {
    if (!selectedId) return;
    setSaving(true);

    const loc = locations.find(l => l.id === selectedId);
    localStorage.setItem('warehouse_location', JSON.stringify(loc));

    // Save preference so user doesn't get asked again
    try {
      const user = JSON.parse(localStorage.getItem('warehouse_user') || '{}');
      await fetch(`${API_URL}/api/v1/warehouse/users/${user.id}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLocationId: selectedId }),
      });
      user.preferredLocationId = selectedId;
      localStorage.setItem('warehouse_user', JSON.stringify(user));
    } catch {
      // Non-critical — continue anyway
    }

    navigate('/warehouse');
  }

  if (loading) {
    return (
      <div className="wh-login">
        <div className="wh-loading"><div className="wh-spinner" /></div>
      </div>
    );
  }

  return (
    <div className="wh-login">
      <div style={{ width: '100%', maxWidth: '400px', padding: '24px 12px' }}>
        <div className="wh-location-select">
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--primary)', marginBottom: '12px' }}>
            my_location
          </span>
          <h2 className="wh-location-title">Select Your Location</h2>
          <p className="wh-location-subtitle">
            Choose the warehouse or origin you are working from today.
          </p>

          {locations.length === 0 ? (
            <div className="wh-empty">
              <span className="material-icons">location_off</span>
              <p className="wh-empty-title">No locations available</p>
              <p className="wh-empty-message">Ask your admin to set up locations first.</p>
            </div>
          ) : (
            <div className="wh-location-list">
              {locations.map(loc => (
                <div
                  key={loc.id}
                  className={`wh-location-item ${selectedId === loc.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(loc.id)}
                >
                  <span className="material-icons">warehouse</span>
                  <div className="wh-location-item-info">
                    <div className="wh-location-item-name">{loc.name}</div>
                    <div className="wh-location-item-detail">
                      {[loc.city, loc.state, loc.country].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  {selectedId === loc.id && (
                    <span className="material-icons" style={{ color: 'var(--primary)' }}>check_circle</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            className="wh-login-btn wh-login-btn-primary"
            style={{ marginTop: '20px', maxWidth: '400px', width: '100%' }}
            disabled={!selectedId || saving}
            onClick={handleContinue}
          >
            {saving ? 'Setting up...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
