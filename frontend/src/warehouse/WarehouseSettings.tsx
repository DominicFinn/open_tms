import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './warehouse.css';

export default function WarehouseSettings() {
  const navigate = useNavigate();
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('warehouse_user') || '{}'); }
    catch { return {}; }
  });
  const [location] = useState(() => {
    try { return JSON.parse(localStorage.getItem('warehouse_location') || '{}'); }
    catch { return {}; }
  });

  function changeLocation() {
    localStorage.removeItem('warehouse_location');
    navigate('/warehouse/select-location');
  }

  function handleLogout() {
    localStorage.removeItem('warehouse_user');
    localStorage.removeItem('warehouse_location');
    navigate('/warehouse/login');
  }

  return (
    <>
      <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>Settings</h2>

      <div className="wh-detail-section">
        <h3 className="wh-detail-section-title">Account</h3>
        <div className="wh-detail-row">
          <span className="wh-detail-label">Name</span>
          <span className="wh-detail-value">{user.firstName} {user.lastName}</span>
        </div>
        <div className="wh-detail-row">
          <span className="wh-detail-label">Email</span>
          <span className="wh-detail-value">{user.email}</span>
        </div>
        <div className="wh-detail-row">
          <span className="wh-detail-label">Role</span>
          <span className="wh-detail-value">{user.roles?.join(', ') || '—'}</span>
        </div>
      </div>

      <div className="wh-detail-section">
        <h3 className="wh-detail-section-title">Location</h3>
        <div className="wh-detail-row">
          <span className="wh-detail-label">Current</span>
          <span className="wh-detail-value">{location.name || '—'}</span>
        </div>
        <div className="wh-detail-row">
          <span className="wh-detail-label">City</span>
          <span className="wh-detail-value">{[location.city, location.state].filter(Boolean).join(', ') || '—'}</span>
        </div>
        <button
          className="wh-action-btn wh-action-btn-outline"
          style={{ width: '100%', marginTop: '8px' }}
          onClick={changeLocation}
        >
          <span className="material-icons">swap_horiz</span>
          Change Location
        </button>
      </div>

      <div className="wh-detail-section">
        <h3 className="wh-detail-section-title">App Info</h3>
        <div className="wh-detail-row">
          <span className="wh-detail-label">Version</span>
          <span className="wh-detail-value">1.0.0</span>
        </div>
        <div className="wh-detail-row">
          <span className="wh-detail-label">Scanner</span>
          <span className="wh-detail-value">HID (built-in)</span>
        </div>
      </div>

      <button
        className="wh-action-btn wh-action-btn-danger"
        style={{ width: '100%', marginTop: '16px' }}
        onClick={handleLogout}
      >
        <span className="material-icons">logout</span>
        Sign Out
      </button>
    </>
  );
}
