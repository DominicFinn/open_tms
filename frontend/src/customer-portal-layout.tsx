import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import './vnext-design/vnext.css';
import './theme.css';

interface CpNavItem {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
}

interface CpAppDef {
  key: string;
  icon: string;
  label: string;
  basePath: string;
  sections: { title: string; items: CpNavItem[] }[];
}

const APPS: CpAppDef[] = [
  {
    key: 'portal', icon: 'business', label: 'Portal', basePath: '/customer-portal',
    sections: [
      { title: 'Overview', items: [
        { to: '/customer-portal', icon: 'space_dashboard', label: 'Dashboard', end: true },
      ]},
      { title: 'Operations', items: [
        { to: '/customer-portal/orders', icon: 'receipt_long', label: 'Orders' },
        { to: '/customer-portal/shipments', icon: 'local_shipping', label: 'Shipments' },
        { to: '/customer-portal/returns', icon: 'assignment_return', label: 'Returns' },
      ]},
      { title: 'Finance & Docs', items: [
        { to: '/customer-portal/invoices', icon: 'request_quote', label: 'Invoices' },
        { to: '/customer-portal/documents', icon: 'description', label: 'Documents' },
      ]},
      { title: 'Account', items: [
        { to: '/customer-portal/profile', icon: 'person', label: 'Profile' },
      ]},
    ],
  },
  {
    key: 'developer', icon: 'code', label: 'Developer', basePath: '/customer-portal/developer',
    sections: [
      { title: 'Overview', items: [
        { to: '/customer-portal/developer', icon: 'space_dashboard', label: 'Dashboard', end: true },
      ]},
      { title: 'Access', items: [
        { to: '/customer-portal/developer/api-keys', icon: 'vpn_key', label: 'API Keys' },
        { to: '/customer-portal/developer/webhooks', icon: 'webhook', label: 'Webhooks' },
      ]},
      { title: 'Integrations', items: [
        { to: '/customer-portal/developer/edi', icon: 'settings_ethernet', label: 'EDI Setup' },
        { to: '/customer-portal/developer/logs', icon: 'history', label: 'Integration Logs' },
      ]},
    ],
  },
];

function detectApp(pathname: string): string {
  if (pathname.startsWith('/customer-portal/developer')) return 'developer';
  return 'portal';
}

export function CustomerPortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appGridOpen, setAppGridOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('customer_user') || 'null');
      if (!u) { navigate('/customer-portal/login'); return; }
      setUser(u);
    } catch {
      navigate('/customer-portal/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (!appGridOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setAppGridOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [appGridOpen]);

  const activeAppKey = detectApp(location.pathname);
  const activeApp = APPS.find(a => a.key === activeAppKey) || APPS[0];

  const switchApp = (app: CpAppDef) => {
    setAppGridOpen(false);
    if (app.key !== activeAppKey) navigate(app.basePath);
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    navigate('/customer-portal/login');
  };

  if (!user) return null;

  const initials = (user.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="vn-shell">
      {/* Sidebar */}
      <aside className={`vn-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="vn-sidebar-brand">
          <span className="material-icons">{activeApp.icon}</span>
          {activeApp.label}
        </div>
        <nav className="vn-sidebar-nav">
          {activeApp.sections.map(section => (
            <React.Fragment key={section.title}>
              <div className="vn-sidebar-section">{section.title}</div>
              {section.items.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setSidebarOpen(false)}>
                  <span className="material-icons">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </React.Fragment>
          ))}
        </nav>
      </aside>

      <div className={`vn-mobile-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className="vn-main">
        <header className="vn-topbar">
          <button className="vn-topbar-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span className="material-icons">menu</span>
          </button>

          <div className="vn-topbar-search" style={{ visibility: 'hidden' }}>
            {/* Reserve space to match admin layout alignment */}
            <span className="material-icons">search</span>
            <input />
          </div>

          <div className="vn-topbar-actions">
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginRight: 8 }}>
              {user.customerName || user.email}
            </span>

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

            <button title="Logout" onClick={handleLogout}>
              <span className="material-icons">logout</span>
            </button>
            <div className="vn-topbar-avatar">{initials}</div>
          </div>
        </header>

        <div className="vn-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
