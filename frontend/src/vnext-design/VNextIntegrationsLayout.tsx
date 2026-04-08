import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/vnext/integrations', label: 'Dashboard', icon: 'space_dashboard', end: true },
  { to: '/vnext/integrations/api-keys', label: 'API Keys', icon: 'vpn_key', end: false },
  { to: '/vnext/integrations/webhooks', label: 'Webhooks', icon: 'webhook', end: false },
  { to: '/vnext/integrations/outbound', label: 'Outbound', icon: 'send', end: false },
  { to: '/vnext/integrations/outbound-logs', label: 'Outbound Logs', icon: 'list_alt', end: false },
  { to: '/vnext/integrations/edi-partners', label: 'EDI Partners', icon: 'handshake', end: false },
  { to: '/vnext/integrations/edi-files', label: 'EDI Files', icon: 'description', end: false },
];

export default function VNextIntegrationsLayout() {
  return (
    <>
      <div className="vn-tabs" style={{ marginBottom: 24 }}>
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `vn-tab ${isActive ? 'active' : ''}`}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </>
  );
}
