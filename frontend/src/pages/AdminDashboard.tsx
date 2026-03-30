import React from 'react';
import { useNavigate } from 'react-router-dom';

const cards = [
  { title: 'Settings', description: 'Organization name, units of measure, and general configuration', icon: 'settings', path: '/admin/settings' },
  { title: 'Theme & Branding', description: 'Customize colors, upload logo, and brand your TMS', icon: 'palette', path: '/admin/theme' },
  { title: 'Document Templates', description: 'Manage BOL, invoice, and other document templates', icon: 'article', path: '/admin/document-templates' },
  { title: 'Custom Fields', description: 'Define custom fields for shipments, orders, and other entities', icon: 'tune', path: '/admin/custom-fields' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <h1>Admin</h1>
        <p style={{ color: 'var(--on-surface-variant)', marginTop: 'var(--spacing-1)' }}>
          Manage your organization settings, branding, and configuration.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-3)' }}>
        {cards.map((card) => (
          <div
            key={card.path}
            className="card"
            style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}
            onClick={() => navigate(card.path)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
              <span className="material-icons" style={{ fontSize: '32px', color: 'var(--primary)' }}>{card.icon}</span>
              <h3 style={{ margin: 0 }}>{card.title}</h3>
            </div>
            <p style={{ color: 'var(--on-surface-variant)', margin: 0 }}>{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
