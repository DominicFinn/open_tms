import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import './theme.css';

export function CustomerPortalLayout() {
  const navigate = useNavigate();

  function getCustomerUser() {
    try {
      return JSON.parse(localStorage.getItem('customer_user') || '{}');
    } catch { return {}; }
  }

  function handleLogout() {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    navigate('/customer-portal/login');
  }

  const user = getCustomerUser();

  const navStyle = ({ isActive }: { isActive: boolean }) => ({
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    textDecoration: 'none' as const,
    fontSize: '14px',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? 'var(--primary)' : 'var(--on-surface)',
    background: isActive ? 'var(--primary-container)' : 'transparent',
  });

  return (
    <>
      <header style={{
        background: 'var(--surface-container)',
        borderBottom: '1px solid var(--outline-variant)',
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
          <span className="material-icons" style={{ color: 'var(--primary)', fontSize: '28px' }}>business</span>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>Customer Portal</span>
          <span style={{ color: 'var(--on-surface-variant)', fontSize: '14px' }}>
            {user.customerName ? `| ${user.customerName}` : ''}
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <NavLink to="/customer-portal" end style={navStyle}>Dashboard</NavLink>
          <NavLink to="/customer-portal/orders" style={navStyle}>Orders</NavLink>
          <NavLink to="/customer-portal/shipments" style={navStyle}>Shipments</NavLink>
          <NavLink to="/customer-portal/documents" style={navStyle}>Documents</NavLink>
          <NavLink to="/customer-portal/invoices" style={navStyle}>Invoices</NavLink>
          <NavLink to="/customer-portal/profile" style={navStyle}>Profile</NavLink>
          <div style={{ borderLeft: '1px solid var(--outline-variant)', height: '24px', margin: '0 8px' }} />
          <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>{user.email}</span>
          <button className="vn-btn vn-btn-outline" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={handleLogout}>
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
