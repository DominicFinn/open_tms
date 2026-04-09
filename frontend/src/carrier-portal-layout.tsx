import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import './theme.css';

export function CarrierPortalLayout() {
  const navigate = useNavigate();

  function getCarrierUser() {
    try {
      return JSON.parse(localStorage.getItem('carrier_user') || '{}');
    } catch { return {}; }
  }

  function handleLogout() {
    localStorage.removeItem('carrier_token');
    localStorage.removeItem('carrier_user');
    navigate('/carrier-portal/login');
  }

  const user = getCarrierUser();

  return (
    <>
      {/* Carrier Portal Header */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 var(--spacing-3)',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <span className="material-icons" style={{ color: 'var(--color-primary)', fontSize: '28px' }}>local_shipping</span>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>Carrier Portal</span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            {user.carrierName ? `| ${user.carrierName}` : ''}
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <NavLink
            to="/carrier-portal"
            end
            style={({ isActive }) => ({
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
              background: isActive ? 'var(--color-primary-light)' : 'transparent',
            })}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/carrier-portal/history"
            style={({ isActive }) => ({
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
              background: isActive ? 'var(--color-primary-light)' : 'transparent',
            })}
          >
            Tender History
          </NavLink>
          <NavLink
            to="/carrier-portal/bids"
            style={({ isActive }) => ({
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
              background: isActive ? 'var(--color-primary-light)' : 'transparent',
            })}
          >
            Bid History
          </NavLink>
          <div style={{ borderLeft: '1px solid var(--color-border)', height: '24px', margin: '0 8px' }} />
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{user.email}</span>
          <button className="button-outline" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </header>

      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: 'var(--spacing-3)',
      }}>
        <Outlet />
      </main>
    </>
  );
}
