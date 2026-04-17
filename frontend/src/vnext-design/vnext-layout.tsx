import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
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
        { to: '/sla', icon: 'timer', label: 'SLA Dashboard' },
        { to: '/shipments', icon: 'local_shipping', label: 'Shipments' },
        { to: '/orders', icon: 'receipt_long', label: 'Orders' },
        { to: '/issues', icon: 'bug_report', label: 'Issues' },
        { to: '/agent-decisions', icon: 'smart_toy', label: 'Agent Decisions' },
        { to: '/automation-rules', icon: 'bolt', label: 'Automation Rules' },
        { to: '/devices', icon: 'sensors', label: 'Devices' },
      ]},
      { title: 'Network', items: [
        { to: '/loadboard', icon: 'dashboard_customize', label: 'Load Board' },
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
    key: 'reports', icon: 'assessment', label: 'Reports', basePath: '/reports',
    sections: [
      { title: 'Overview', items: [
        { to: '/reports', icon: 'space_dashboard', label: 'Dashboard', end: true },
      ]},
      { title: 'Operational', items: [
        { to: '/reports/daily', icon: 'today', label: 'Daily Report' },
        { to: '/reports/locations', icon: 'location_on', label: 'Location Activity' },
        { to: '/sla', icon: 'timer', label: 'SLA Compliance' },
      ]},
      { title: 'Financial', items: [
        { to: '/finance/margin-reports', icon: 'trending_up', label: 'Margin Reports' },
        { to: '/finance/aging', icon: 'hourglass_top', label: 'AR Aging' },
        { to: '/finance/exports', icon: 'download', label: 'Export to CSV' },
      ]},
      { title: 'Documents', items: [
        { to: '/documents', icon: 'description', label: 'Documents' },
      ]},
    ],
  },
  {
    key: 'finance', icon: 'account_balance', label: 'Finance', basePath: '/finance',
    sections: [
      { title: 'Finance', items: [
        { to: '/finance', icon: 'space_dashboard', label: 'Dashboard', end: true },
        { to: '/finance/quotes', icon: 'request_quote', label: 'Quotes' },
        { to: '/finance/invoices', icon: 'receipt', label: 'Invoices' },
        { to: '/finance/carrier-invoices', icon: 'local_shipping', label: 'Carrier Invoices' },
        { to: '/finance/payments', icon: 'payment', label: 'Record Payments' },
      ]},
      { title: 'Brokerage', items: [
        { to: '/finance/commissions', icon: 'payments', label: 'Commissions' },
        { to: '/finance/margin-reports', icon: 'trending_up', label: 'Margin Reports' },
      ]},
      { title: 'Disputes', items: [
        { to: '/finance/queries', icon: 'help_outline', label: 'Queries & Disputes' },
        { to: '/finance/credit-notes', icon: 'note', label: 'Credit Notes' },
      ]},
      { title: 'Reports', items: [
        { to: '/finance/aging', icon: 'assessment', label: 'AR Aging' },
        { to: '/finance/exports', icon: 'download', label: 'Export to CSV' },
      ]},
    ],
  },
  {
    key: 'quality', icon: 'verified', label: 'Quality', basePath: '/quality',
    sections: [
      { title: 'Quality Centre', items: [
        { to: '/quality', icon: 'space_dashboard', label: 'Dashboard', end: true },
        { to: '/quality/summaries', icon: 'analytics', label: 'Issue Analysis' },
        { to: '/quality/capa', icon: 'assignment_late', label: 'CAPA Management' },
        { to: '/quality/sop-checklists', icon: 'checklist', label: 'SOP Checklists' },
        { to: '/quality/sop-audits', icon: 'fact_check', label: 'GDP Audits' },
      ]},
      { title: 'Reports', items: [
        { to: '/quality/carrier-scorecard', icon: 'airport_shuttle', label: 'Carrier Scorecard' },
        { to: '/quality/lane-analysis', icon: 'route', label: 'Lane Analysis' },
        { to: '/quality/capa-effectiveness', icon: 'trending_up', label: 'CAPA Effectiveness' },
      ]},
    ],
  },
  {
    key: 'warehouse', icon: 'warehouse', label: 'Warehouse', basePath: '/wms',
    sections: [
      { title: 'Warehouse', items: [
        { to: '/wms', icon: 'space_dashboard', label: 'Dashboard', end: true },
        { to: '/wms/zones', icon: 'grid_view', label: 'Zones & Bins' },
        { to: '/wms/inventory', icon: 'inventory_2', label: 'Inventory' },
        { to: '/wms/product-dimensions', icon: 'straighten', label: 'Product Dimensions' },
        { to: '/wms/carton-catalogue', icon: 'package_2', label: 'Carton Catalogue' },
        { to: '/wms/cycle-counts', icon: 'fact_check', label: 'Cycle Counts' },
        { to: '/wms/replenishment', icon: 'sync', label: 'Replenishment' },
      ]},
      { title: 'Inbound', items: [
        { to: '/wms/receiving', icon: 'move_to_inbox', label: 'Receiving' },
        { to: '/wms/manifest', icon: 'upload_file', label: 'Manifest Upload' },
        { to: '/wms/putaway', icon: 'system_update_alt', label: 'Putaway' },
      ]},
      { title: 'Outbound', items: [
        { to: '/wms/waves', icon: 'waves', label: 'Waves' },
        { to: '/wms/picking', icon: 'shopping_cart', label: 'Picking' },
        { to: '/wms/packing', icon: 'package_2', label: 'Packing' },
        { to: '/wms/loading', icon: 'local_shipping', label: 'Staging' },
        { to: '/wms/load-plans', icon: 'assignment_turned_in', label: 'Load Plans' },
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
        { to: '/integrations/edi', icon: 'hub', label: 'EDI Dashboard' },
        { to: '/integrations/edi/partners', icon: 'handshake', label: 'Trading Partners' },
        { to: '/integrations/edi/logs', icon: 'receipt_long', label: 'Transaction Log' },
        { to: '/integrations/edi/import', icon: 'upload_file', label: 'EDI Import' },
        { to: '/integrations/carrier-tracking', icon: 'gps_fixed', label: 'Carrier Tracking' },
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
        { to: '/settings/sla', icon: 'timer', label: 'SLA Policies' },
        { to: '/settings/llm', icon: 'smart_toy', label: 'AI / LLM' },
        { to: '/settings/agents', icon: 'psychology', label: 'Agent Config' },
        { to: '/settings/skills', icon: 'build', label: 'Skills' },
        { to: '/settings/skill-chains', icon: 'account_tree', label: 'Skill Chains' },
        { to: '/settings/roles', icon: 'admin_panel_settings', label: 'Roles & Permissions' },
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
  if (pathname.startsWith('/wms')) return 'warehouse';
  if (pathname.startsWith('/quality')) return 'quality';
  if (pathname.startsWith('/finance')) return 'finance';
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
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
