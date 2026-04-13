import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import AppBar from './components/AppBar';
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

          <div className="sidebar-section-label">EDI</div>
          <NavLink to="/integrations/edi" onClick={closeMobileMenu}>
            <span className="material-icons">hub</span>
            EDI Dashboard
          </NavLink>
          <NavLink to="/integrations/edi/partners" onClick={closeMobileMenu}>
            <span className="material-icons">handshake</span>
            Trading Partners
          </NavLink>
          <NavLink to="/integrations/edi/logs" onClick={closeMobileMenu}>
            <span className="material-icons">receipt_long</span>
            Transaction Log
          </NavLink>
          <NavLink to="/integrations/edi/import" onClick={closeMobileMenu}>
            <span className="material-icons">upload_file</span>
            EDI Import
          </NavLink>
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={closeMobileMenu} />
      )}

      <AppBar title="Integrations" icon="hub" onToggleMobileMenu={toggleMobileMenu} />
      <main className="main">
        <Outlet />
      </main>
    </>
  );
}
