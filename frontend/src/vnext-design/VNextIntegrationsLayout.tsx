import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/integrations', label: 'Dashboard', icon: 'space_dashboard', end: true },
  { to: '/integrations/api-keys', label: 'API Keys', icon: 'vpn_key', end: false },
  { to: '/integrations/webhook-logs', label: 'Webhooks', icon: 'webhook', end: false },
  { to: '/integrations/outbound', label: 'Outbound', icon: 'send', end: false },
  { to: '/integrations/outbound-logs', label: 'Outbound Logs', icon: 'list_alt', end: false },
  { to: '/integrations/edi', label: 'EDI Dashboard', icon: 'hub', end: true },
  { to: '/integrations/edi/partners', label: 'Trading Partners', icon: 'handshake', end: false },
  { to: '/integrations/edi/logs', label: 'Transaction Log', icon: 'receipt_long', end: false },
  { to: '/integrations/edi/import', label: 'EDI Import', icon: 'upload_file', end: false },
  { to: '/integrations/edi-partners', label: 'EDI Partners (Legacy)', icon: 'history', end: false },
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
