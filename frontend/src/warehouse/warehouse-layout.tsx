import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import './warehouse.css';

export function WarehouseLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('warehouse_user');
    if (!stored) {
      navigate('/warehouse/login');
      return;
    }
    try {
      setUser(JSON.parse(stored));
    } catch {
      navigate('/warehouse/login');
    }
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('warehouse_user');
    localStorage.removeItem('warehouse_location');
    navigate('/warehouse/login');
  }

  if (!user) return null;

  const isAdmin = user.roles?.includes('admin');
  const locationName = (() => {
    try {
      const loc = JSON.parse(localStorage.getItem('warehouse_location') || '{}');
      return loc.name || '';
    } catch { return ''; }
  })();

  return (
    <div className="wh-shell">
      <header className="wh-topbar">
        <div className="wh-topbar-title">
          <span className="material-icons">warehouse</span>
          <span>Warehouse</span>
          {locationName && (
            <span style={{ fontSize: '12px', opacity: 0.8, fontWeight: 400 }}>
              | {locationName}
            </span>
          )}
        </div>
        <div className="wh-topbar-actions">
          <button className="wh-topbar-btn" onClick={handleLogout} title="Logout">
            <span className="material-icons">logout</span>
          </button>
        </div>
      </header>

      <main className="wh-content">
        <Outlet />
      </main>

      <nav className="wh-bottom-nav">
        <NavLink to="/warehouse" end className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="material-icons">list_alt</span>
          Shipments
        </NavLink>
        <NavLink to="/warehouse/tasks" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="material-icons">assignment</span>
          Tasks
        </NavLink>
        <NavLink to="/warehouse/archive" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="material-icons">inventory_2</span>
          Archive
        </NavLink>
        {isAdmin && (
          <NavLink to="/warehouse/create" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="material-icons">add_box</span>
            Create
          </NavLink>
        )}
        <button
          className={location.pathname === '/warehouse/settings' ? 'active' : ''}
          onClick={() => navigate('/warehouse/settings')}
        >
          <span className="material-icons">settings</span>
          Settings
        </button>
      </nav>
    </div>
  );
}
