import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import AppSwitcher from './components/AppSwitcher';
import './theme.css';

export function IntegrationsLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <>
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-brand" onClick={() => navigate('/integrations')} style={{ cursor: 'pointer' }}>
          <span className="material-icons" style={{ fontSize: '24px' }}>hub</span>
          Integrations
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/integrations" end onClick={closeMobileMenu}>
            <span className="material-icons">dashboard</span>
            Dashboard
          </NavLink>

          <div className="sidebar-section-label">Inbound</div>
          <NavLink to="/integrations/api-keys" onClick={closeMobileMenu}>
            <span className="material-icons">vpn_key</span>
            API Keys
          </NavLink>
          <NavLink to="/integrations/webhook-logs" onClick={closeMobileMenu}>
            <span className="material-icons">webhook</span>
            Webhook Logs
          </NavLink>

          <div className="sidebar-section-label">Outbound</div>
          <NavLink to="/integrations/outbound" onClick={closeMobileMenu}>
            <span className="material-icons">send</span>
            Integrations
          </NavLink>
          <NavLink to="/integrations/outbound-logs" onClick={closeMobileMenu}>
            <span className="material-icons">description</span>
            Outbound Logs
          </NavLink>

          <div className="sidebar-section-label">EDI</div>
          <NavLink to="/integrations/edi-partners" onClick={closeMobileMenu}>
            <span className="material-icons">swap_horiz</span>
            EDI Partners
          </NavLink>
          <NavLink to="/integrations/edi-files" onClick={closeMobileMenu}>
            <span className="material-icons">insert_drive_file</span>
            EDI Files
          </NavLink>
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={closeMobileMenu} />
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
            <span className="material-icons">hub</span>
            Integrations
          </div>
        </div>
        <div className="app-bar-actions">
          <button className="icon-btn">
            <span className="material-icons">notifications</span>
          </button>
          <button className="icon-btn">
            <span className="material-icons">account_circle</span>
          </button>
          <AppSwitcher />
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </>
  );
}
