import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface AppOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  basePath: string;
}

const apps: AppOption[] = [
  {
    id: 'operations',
    name: 'Operations',
    description: 'Shipments, orders, lanes & carriers',
    icon: 'local_shipping',
    basePath: '/',
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'API keys, webhooks, EDI & outbound',
    icon: 'hub',
    basePath: '/integrations',
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Settings, theme, templates & fields',
    icon: 'admin_panel_settings',
    basePath: '/admin',
  },
];

export default function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const currentApp = location.pathname.startsWith('/admin')
    ? 'admin'
    : location.pathname.startsWith('/integrations')
      ? 'integrations'
      : 'operations';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="app-switcher" ref={ref}>
      <button
        className="icon-btn"
        onClick={() => setOpen(!open)}
        aria-label="Switch app"
        title="Switch app"
      >
        <span className="material-icons">apps</span>
      </button>

      {open && (
        <div className="app-switcher-dropdown">
          <div className="app-switcher-header">Switch to</div>
          {apps.map((app) => (
            <button
              key={app.id}
              className={`app-switcher-option ${currentApp === app.id ? 'app-switcher-option-active' : ''}`}
              onClick={() => {
                navigate(app.basePath);
                setOpen(false);
              }}
            >
              <span className="material-icons app-switcher-icon">{app.icon}</span>
              <div className="app-switcher-text">
                <div className="app-switcher-name">{app.name}</div>
                <div className="app-switcher-desc">{app.description}</div>
              </div>
              {currentApp === app.id && (
                <span className="material-icons" style={{ fontSize: '18px', color: 'var(--primary)', marginLeft: 'auto' }}>check</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
