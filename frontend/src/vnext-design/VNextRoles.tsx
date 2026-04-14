import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  _count?: { users: number };
  createdAt: string;
}

function permissionBadge(name: string): string {
  if (name === 'admin' || name === 'broker_admin') return 'primary';
  if (name.includes('broker')) return 'info';
  if (name === 'finance') return 'success';
  if (name === 'readonly') return 'secondary';
  if (name === 'warehouse') return 'warning';
  return 'secondary';
}

export default function VNextRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');

  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/roles`);
      const json = await res.json();
      setRoles(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRoles(); }, []);

  const handleSeedRoles = async () => {
    setSeeding(true);
    setSeedMessage('');
    try {
      const res = await fetch(`${API_URL}/api/v1/roles/seed`, { method: 'POST' });
      const json = await res.json();
      if (json.data) {
        setSeedMessage(`Created ${json.data.created} roles, updated ${json.data.updated} existing roles`);
        loadRoles();
      }
    } catch {
      setSeedMessage('Failed to seed roles');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      <div className="vn-page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Roles & Permissions</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--on-surface-variant)', fontSize: 14 }}>
            Manage user roles and their associated permissions
          </p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={handleSeedRoles} disabled={seeding}>
            <span className="material-icons">sync</span>
            {seeding ? 'Seeding...' : 'Seed System Roles'}
          </button>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {seedMessage && <div className="vn-alert vn-alert-success" style={{ marginBottom: 16 }}>{seedMessage}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" /></div>
      ) : roles.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: 40 }}>
          <span className="material-icons" style={{ fontSize: 48, color: 'var(--on-surface-variant)' }}>admin_panel_settings</span>
          <h3 style={{ margin: '12px 0 4px' }}>No roles defined</h3>
          <p style={{ color: 'var(--on-surface-variant)', marginBottom: 16 }}>Click "Seed System Roles" to create the default roles.</p>
          <button className="vn-btn vn-btn-primary" onClick={handleSeedRoles} disabled={seeding}>
            Seed System Roles
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {roles.map(role => (
            <div key={role.id} className="vn-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{role.name}</span>
                    <span className={`vn-chip vn-chip-${permissionBadge(role.name)}`} style={{ fontSize: 10 }}>
                      {role.isSystem ? 'System' : 'Custom'}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', margin: '4px 0 0' }}>
                    {role.description || 'No description'}
                  </p>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--on-surface-variant)' }}>
                  {role._count?.users ?? 0} user{(role._count?.users ?? 0) !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(role.permissions as string[]).slice(0, 8).map((p, i) => (
                  <span key={i} className="vn-chip vn-chip-secondary" style={{ fontSize: 10 }}>{p}</span>
                ))}
                {(role.permissions as string[]).length > 8 && (
                  <span className="vn-chip vn-chip-secondary" style={{ fontSize: 10 }}>
                    +{(role.permissions as string[]).length - 8} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
