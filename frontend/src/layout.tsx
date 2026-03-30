import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import AppBar from './components/AppBar';
import './theme.css';

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <>
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="material-icons" style={{ fontSize: '24px' }}>local_shipping</span>
          Open TMS
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end onClick={closeMobileMenu}>
            <span className="material-icons">dashboard</span>
            Dashboard
          </NavLink>
          <NavLink to="/customers" onClick={closeMobileMenu}>
            <span className="material-icons">people</span>
            Customers
          </NavLink>
          <NavLink to="/carriers" onClick={closeMobileMenu}>
            <span className="material-icons">airport_shuttle</span>
            Carriers
          </NavLink>
          <NavLink to="/locations" onClick={closeMobileMenu}>
            <span className="material-icons">location_on</span>
            Locations
          </NavLink>
          <NavLink to="/lanes" onClick={closeMobileMenu}>
            <span className="material-icons">route</span>
            Lanes
          </NavLink>
          <NavLink to="/orders" onClick={closeMobileMenu}>
            <span className="material-icons">receipt_long</span>
            Orders
          </NavLink>
          <NavLink to="/shipments" onClick={closeMobileMenu}>
            <span className="material-icons">local_shipping</span>
            Shipments
          </NavLink>
          <NavLink to="/pending-lane-requests" onClick={closeMobileMenu}>
            <span className="material-icons">pending_actions</span>
            Pending Lane Requests
          </NavLink>
          <div style={{ borderTop: '1px solid var(--color-border)', margin: 'var(--spacing-1) 0' }}></div>
          <NavLink to="/documents" onClick={closeMobileMenu}>
            <span className="material-icons">description</span>
            Documents
          </NavLink>
          <NavLink to="/reports/daily" onClick={closeMobileMenu}>
            <span className="material-icons">assessment</span>
            Daily Report
          </NavLink>
          <div style={{ borderTop: '1px solid var(--color-border)', margin: 'var(--spacing-1) 0' }}></div>
          <NavLink to="/settings" onClick={closeMobileMenu}>
            <span className="material-icons">settings</span>
            Settings
          </NavLink>
          <NavLink to="/settings/document-templates" onClick={closeMobileMenu}>
            <span className="material-icons">article</span>
            Document Templates
          </NavLink>
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={closeMobileMenu}
        />
      )}

      <AppBar title="Open TMS" icon="local_shipping" onToggleMobileMenu={toggleMobileMenu} />
      <main className="main">{children}</main>
    </>
  );
}
