import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import './vnext.css';

/* ── Theme Mode Hook ─────────────────────────────────────── */
function useThemeMode() {
  const [mode, setMode] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme-mode') as 'light' | 'dark' | 'system') || 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem('theme-mode');
    } else {
      root.setAttribute('data-theme', mode);
      localStorage.setItem('theme-mode', mode);
    }
  }, [mode]);

  const cycle = () => {
    setMode(prev => prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light');
  };

  const icon = mode === 'light' ? 'light_mode' : mode === 'dark' ? 'dark_mode' : 'brightness_auto';
  const label = mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System';

  return { cycle, icon, label };
}

/* ── App Definitions ─────────────────────────────────────── */
interface NavItem {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
  badge?: string;
}

interface AppDef {
  key: string;
  icon: string;
  label: string;
  basePath: string;
  sections: { title: string; items: NavItem[] }[];
}

const APPS: AppDef[] = [
  {
    key: 'operations', icon: 'local_shipping', label: 'Operations', basePath: '/',
    sections: [
      { title: 'Operations', items: [
        { to: '/', icon: 'space_dashboard', label: 'Dashboard', end: true },
        { to: '/map', icon: 'map', label: 'Map View' },
        { to: '/shipments', icon: 'local_shipping', label: 'Shipments' },
        { to: '/orders', icon: 'receipt_long', label: 'Orders' },
        { to: '/issues', icon: 'bug_report', label: 'Issues' },
        { to: '/devices', icon: 'sensors', label: 'Devices' },
      ]},
      { title: 'Network', items: [
        { to: '/carriers', icon: 'airport_shuttle', label: 'Carriers' },
        { to: '/carrier-bidding', icon: 'gavel', label: 'Carrier Bidding' },
        { to: '/customers', icon: 'people', label: 'Customers' },
        { to: '/locations', icon: 'location_on', label: 'Locations' },
        { to: '/lanes', icon: 'route', label: 'Lanes' },
      ]},
      { title: 'Cold Chain', items: [
        { to: '/cold-chain/profiles', icon: 'thermostat', label: 'Profiles' },
        { to: '/cold-chain/capa', icon: 'assignment_late', label: 'CAPA Reports' },
      ]},
    ],
  },
  {
    key: 'reports', icon: 'assessment', label: 'Reports', basePath: '/documents',
    sections: [
      { title: 'Reports', items: [
        { to: '/documents', icon: 'description', label: 'Documents' },
        { to: '/reports/daily', icon: 'assessment', label: 'Daily Report' },
        { to: '/reports/locations', icon: 'location_on', label: 'Location Activity' },
      ]},
    ],
  },
  {
    key: 'integrations', icon: 'hub', label: 'Integrations', basePath: '/integrations',
    sections: [
      { title: 'Integrations', items: [
        { to: '/integrations', icon: 'space_dashboard', label: 'Overview', end: true },
        { to: '/integrations/api-keys', icon: 'vpn_key', label: 'API Keys' },
        { to: '/integrations/webhook-logs', icon: 'webhook', label: 'Webhook Logs' },
        { to: '/integrations/outbound', icon: 'send', label: 'Outbound' },
        { to: '/integrations/outbound-logs', icon: 'list_alt', label: 'Outbound Logs' },
        { to: '/integrations/edi-partners', icon: 'swap_horiz', label: 'EDI Partners' },
        { to: '/integrations/edi-files', icon: 'description', label: 'EDI Files' },
      ]},
    ],
  },
  {
    key: 'admin', icon: 'admin_panel_settings', label: 'Admin', basePath: '/settings',
    sections: [
      { title: 'Settings', items: [
        { to: '/settings', icon: 'settings', label: 'General', end: true },
        { to: '/settings/theme', icon: 'palette', label: 'Theme & Branding' },
        { to: '/settings/email', icon: 'email', label: 'Email' },
        { to: '/settings/email-templates', icon: 'mark_email_read', label: 'Email Templates' },
        { to: '/settings/document-templates', icon: 'article', label: 'Doc Templates' },
        { to: '/settings/custom-fields', icon: 'tune', label: 'Custom Fields' },
        { to: '/settings/maps', icon: 'map', label: 'Maps & Geocoding' },
      ]},
      { title: 'Apps', items: [
        { to: '/warehouse', icon: 'warehouse', label: 'Warehouse App' },
      ]},
      { title: 'Development', items: [
        { to: '/style-guide', icon: 'palette', label: 'Style Guide' },
      ]},
    ],
  },
];

function detectApp(pathname: string): string {
  if (pathname.startsWith('/integrations')) return 'integrations';
  if (pathname.startsWith('/settings') || pathname === '/style-guide') return 'admin';
  if (pathname.startsWith('/documents') || pathname.startsWith('/reports')) return 'reports';
  // cold-chain routes live under operations
  return 'operations';
}

/* ── Layout Component ────────────────────────────────────── */
export default function VNextLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appGridOpen, setAppGridOpen] = useState(false);
  const theme = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement>(null);

  const activeAppKey = detectApp(location.pathname);
  const activeApp = APPS.find(a => a.key === activeAppKey) || APPS[0];

  // Close app grid on Escape
  useEffect(() => {
    if (!appGridOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setAppGridOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [appGridOpen]);

  const switchApp = (app: AppDef) => {
    setAppGridOpen(false);
    if (app.key !== activeAppKey) {
      navigate(app.basePath);
    }
  };

  return (
    <div className="vn-shell">
      {/* Sidebar */}
      <aside className={`vn-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="vn-sidebar-brand">
          <span className="material-icons">hub</span>
          Open TMS
        </div>
        <nav className="vn-sidebar-nav">
          {activeApp.sections.map(section => (
            <React.Fragment key={section.title}>
              <div className="vn-sidebar-section">{section.title}</div>
              {section.items.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setSidebarOpen(false)}>
                  <span className="material-icons">{item.icon}</span>
                  {item.label}
                  {item.badge && <span className="vn-badge">{item.badge}</span>}
                </NavLink>
              ))}
            </React.Fragment>
          ))}
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

            {/* App Switcher */}
            <div className="vn-app-grid-wrapper" ref={gridRef}>
              <button title="Switch App" onClick={() => setAppGridOpen(!appGridOpen)}>
                <span className="material-icons">apps</span>
              </button>
              {appGridOpen && (
                <>
                  <div className="vn-app-grid-backdrop" onClick={() => setAppGridOpen(false)} />
                  <div className="vn-app-grid-panel">
                    <h3>Switch App</h3>
                    <div className="vn-app-grid">
                      {APPS.map(app => (
                        <button
                          key={app.key}
                          className={`vn-app-grid-tile ${app.key === activeAppKey ? 'active' : ''}`}
                          onClick={() => switchApp(app)}
                        >
                          <div className="vn-app-grid-icon">
                            <span className="material-icons">{app.icon}</span>
                          </div>
                          <span className="vn-app-grid-label">{app.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button title={`Theme: ${theme.label}`} onClick={theme.cycle}>
              <span className="material-icons">{theme.icon}</span>
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
