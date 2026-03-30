import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import AppBar from './components/AppBar';
import './theme.css';

export function AdminLayout() {
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
        <div className="sidebar-brand" onClick={() => navigate('/admin')} style={{ cursor: 'pointer' }}>
          <span className="material-icons" style={{ fontSize: '24px' }}>admin_panel_settings</span>
          Admin
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/admin" end onClick={closeMobileMenu}>
            <span className="material-icons">dashboard</span>
            Dashboard
          </NavLink>

          <div className="sidebar-section-label">Organization</div>
          <NavLink to="/admin/settings" onClick={closeMobileMenu}>
            <span className="material-icons">settings</span>
            Settings
          </NavLink>
          <NavLink to="/admin/theme" onClick={closeMobileMenu}>
            <span className="material-icons">palette</span>
            Theme & Branding
          </NavLink>

          <div className="sidebar-section-label">Configuration</div>
          <NavLink to="/admin/document-templates" onClick={closeMobileMenu}>
            <span className="material-icons">article</span>
            Document Templates
          </NavLink>
          <NavLink to="/admin/custom-fields" onClick={closeMobileMenu}>
            <span className="material-icons">tune</span>
            Custom Fields
          </NavLink>
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={closeMobileMenu} />
      )}

      <AppBar title="Admin" icon="admin_panel_settings" onToggleMobileMenu={toggleMobileMenu} />
      <main className="main">
        <Outlet />
      </main>
    </>
  );
}
