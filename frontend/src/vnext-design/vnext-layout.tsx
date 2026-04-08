import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import './vnext.css';

export default function VNextLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="vn-shell">
      {/* Sidebar */}
      <aside className={`vn-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="vn-sidebar-brand">
          <span className="material-icons">hub</span>
          Open TMS
        </div>
        <nav className="vn-sidebar-nav">
          <div className="vn-sidebar-section">Operations</div>
          <NavLink to="/vnext" end onClick={() => setSidebarOpen(false)}>
            <span className="material-icons">space_dashboard</span>
            Dashboard
          </NavLink>
          <NavLink to="/vnext/shipments" onClick={() => setSidebarOpen(false)}>
            <span className="material-icons">local_shipping</span>
            Shipments
          </NavLink>
          <NavLink to="/vnext/orders" onClick={() => setSidebarOpen(false)}>
            <span className="material-icons">receipt_long</span>
            Orders
          </NavLink>
          <NavLink to="/vnext/issues" onClick={() => setSidebarOpen(false)}>
            <span className="material-icons">bug_report</span>
            Issues
            <span className="vn-badge">5</span>
          </NavLink>

          <div className="vn-sidebar-section">Network</div>
          <NavLink to="/vnext/carriers" onClick={() => setSidebarOpen(false)}>
            <span className="material-icons">airport_shuttle</span>
            Carriers
          </NavLink>
          <NavLink to="/vnext/carrier-bidding" onClick={() => setSidebarOpen(false)}>
            <span className="material-icons">gavel</span>
            Carrier Bidding
          </NavLink>
          <NavLink to="/vnext/locations" onClick={() => setSidebarOpen(false)}>
            <span className="material-icons">location_on</span>
            Locations
          </NavLink>
          <NavLink to="/vnext/lanes" onClick={() => setSidebarOpen(false)}>
            <span className="material-icons">route</span>
            Lanes
          </NavLink>

          <div className="vn-sidebar-section">Reports</div>
          <NavLink to="/vnext" end onClick={() => setSidebarOpen(false)}>
            <span className="material-icons">analytics</span>
            Analytics
          </NavLink>
          <NavLink to="/vnext" end onClick={() => setSidebarOpen(false)}>
            <span className="material-icons">assessment</span>
            Daily Report
          </NavLink>

          <div className="vn-sidebar-section">Development</div>
          <NavLink to="/vnext/style-guide" onClick={() => setSidebarOpen(false)}>
            <span className="material-icons">palette</span>
            Style Guide
          </NavLink>
        </nav>
      </aside>

      {/* Mobile overlay */}
      <div
        className={`vn-mobile-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Main */}
      <div className="vn-main">
        <header className="vn-topbar">
          <button
            className="vn-topbar-hamburger"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <span className="material-icons">menu</span>
          </button>

          <div className="vn-topbar-search">
            <span className="material-icons">search</span>
            <input placeholder="Search shipments, orders, carriers..." />
          </div>

          <div className="vn-topbar-actions">
            <button title="Notifications">
              <span className="material-icons">notifications_none</span>
              <span className="vn-notif-dot" />
            </button>
            <button title="Help">
              <span className="material-icons">help_outline</span>
            </button>
            <button title="Settings">
              <span className="material-icons">settings</span>
            </button>
            <div className="vn-topbar-avatar">JD</div>
          </div>
        </header>

        <div className="vn-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
