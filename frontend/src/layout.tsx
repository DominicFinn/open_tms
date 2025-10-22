import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
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
          <NavLink to="/settings" onClick={closeMobileMenu}>
            <span className="material-icons">settings</span>
            Settings
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
      
      <header className="app-bar">
        <div className="app-bar-left">
          <button 
            className="icon-btn mobile-menu-btn" 
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <span className="material-icons">menu</span>
          </button>
          <div className="app-bar-title">
            <span className="material-icons">local_shipping</span>
            Open TMS
          </div>
        </div>
        <div className="app-bar-actions">
          <button className="icon-btn">
            <span className="material-icons">notifications</span>
          </button>
          <button className="icon-btn">
            <span className="material-icons">account_circle</span>
          </button>
          <button className="icon-btn">
            <span className="material-icons">apps</span>
          </button>
        </div>
      </header>
      <main className="main">{children}</main>
    </>
  );
}
