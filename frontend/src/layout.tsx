import React from 'react';
import { NavLink } from 'react-router-dom';
import './theme.css';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="material-icons" style={{ fontSize: '24px' }}>local_shipping</span>
          Open TMS
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>
            <span className="material-icons">dashboard</span>
            Dashboard
          </NavLink>
          <NavLink to="/customers">
            <span className="material-icons">people</span>
            Customers
          </NavLink>
          <NavLink to="/locations">
            <span className="material-icons">location_on</span>
            Locations
          </NavLink>
          <NavLink to="/shipments">
            <span className="material-icons">local_shipping</span>
            Shipments
          </NavLink>
        </nav>
      </aside>
      <header className="app-bar">
        <div className="app-bar-title">
          <span className="material-icons">local_shipping</span>
          Open TMS
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
