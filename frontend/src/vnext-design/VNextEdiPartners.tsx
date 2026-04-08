import React, { useState } from 'react';

const PARTNERS = [
  { id: 1, name: 'Acme Corp EDI', customer: 'Acme Corp', sftpHost: 'sftp.acmecorp.com', sftpPort: 22, pollingEnabled: true, pollingInterval: 'Every 15m', files: 312, status: 'Active', statusColor: 'success', autoCreate: true },
  { id: 2, name: 'Global Logistics', customer: 'Global Widgets', sftpHost: 'ftp.globallogistics.net', sftpPort: 2222, pollingEnabled: true, pollingInterval: 'Every 15m', files: 245, status: 'Active', statusColor: 'success', autoCreate: true },
  { id: 3, name: 'Fresh Foods Inc', customer: 'FreshFoods LLC', sftpHost: 'sftp.freshfoods.com', sftpPort: 22, pollingEnabled: true, pollingInterval: 'Every 30m', files: 189, status: 'Active', statusColor: 'success', autoCreate: true },
  { id: 4, name: 'AutoParts Direct', customer: 'AutoParts Plus', sftpHost: 'edi.autopartsdirect.com', sftpPort: 22, pollingEnabled: false, pollingInterval: 'Off', files: 146, status: 'Active', statusColor: 'success', autoCreate: false },
  { id: 5, name: 'Legacy System', customer: 'Industrial Co', sftpHost: null, sftpPort: null, pollingEnabled: false, pollingInterval: 'Off', files: 0, status: 'Inactive', statusColor: 'secondary', autoCreate: false },
];

export default function VNextEdiPartners() {
  const [search, setSearch] = useState('');

  const filtered = PARTNERS.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.customer.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>EDI Partners</h1>
          <p>Manage EDI trading partners and SFTP connections</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            Add EDI Partner
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">handshake</span></div>
          <div>
            <div className="vn-stat-value">5</div>
            <div className="vn-stat-label">Total Partners</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">4</div>
            <div className="vn-stat-label">Active</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">description</span></div>
          <div>
            <div className="vn-stat-value">892</div>
            <div className="vn-stat-label">Files Processed</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">auto_fix_high</span></div>
          <div>
            <div className="vn-stat-value">3</div>
            <div className="vn-stat-label">Auto-Create Orders</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group" style={{ flex: 1 }}>
            <span className="material-icons">search</span>
            <input
              className="vn-filter-input"
              placeholder="Search partners..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Customer</th>
                <th>SFTP</th>
                <th>Polling</th>
                <th>Files</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ fontSize: 13 }}>{p.customer}</td>
                  <td>
                    {p.sftpHost ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.sftpHost}:{p.sftpPort}</span>
                    ) : (
                      <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>Not configured</span>
                    )}
                  </td>
                  <td>
                    <span className={`vn-chip ${p.pollingEnabled ? 'vn-chip-success' : 'vn-chip-secondary'}`}>
                      {p.pollingInterval}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{p.files}</td>
                  <td><span className={`vn-chip vn-chip-${p.statusColor}`}>{p.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="vn-btn-icon" title="Edit">
                        <span className="material-icons" style={{ fontSize: 18 }}>edit</span>
                      </button>
                      <button className="vn-btn-icon" title="Delete">
                        <span className="material-icons" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
