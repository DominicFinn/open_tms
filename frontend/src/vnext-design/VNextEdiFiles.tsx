import React, { useState } from 'react';

const FILES = [
  { id: 1, name: 'ACME_PO_20260408_001.edi', partner: 'Acme Corp EDI', source: 'sftp', sourceColor: 'info', type: 'X12 850', size: '14.2 KB', status: 'Completed', statusColor: 'success', orders: 3, date: 'Apr 8, 10:42 AM' },
  { id: 2, name: 'GLOBAL_ASN_20260408_002.edi', partner: 'Global Logistics', source: 'sftp', sourceColor: 'info', type: 'X12 856', size: '8.7 KB', status: 'Completed', statusColor: 'success', orders: 1, date: 'Apr 8, 10:30 AM' },
  { id: 3, name: 'FRESH_PO_20260408_003.edi', partner: 'Fresh Foods Inc', source: 'api', sourceColor: 'primary', type: 'X12 850', size: '22.1 KB', status: 'Processing', statusColor: 'warning', orders: 0, date: 'Apr 8, 10:25 AM' },
  { id: 4, name: 'ACME_PO_20260408_004.edi', partner: 'Acme Corp EDI', source: 'sftp', sourceColor: 'info', type: 'X12 850', size: '6.3 KB', status: 'Pending', statusColor: 'warning', orders: 0, date: 'Apr 8, 10:20 AM' },
  { id: 5, name: 'AUTO_ASN_20260407_018.edi', partner: 'AutoParts Direct', source: 'manual', sourceColor: 'secondary', type: 'X12 856', size: '31.5 KB', status: 'Completed', statusColor: 'success', orders: 5, date: 'Apr 7, 04:15 PM' },
  { id: 6, name: 'GLOBAL_PO_20260407_017.edi', partner: 'Global Logistics', source: 'sftp', sourceColor: 'info', type: 'X12 850', size: '9.8 KB', status: 'Failed', statusColor: 'error', orders: 0, date: 'Apr 7, 03:40 PM' },
  { id: 7, name: 'FRESH_PO_20260407_016.edi', partner: 'Fresh Foods Inc', source: 'sftp', sourceColor: 'info', type: 'X12 850', size: '18.4 KB', status: 'Completed', statusColor: 'success', orders: 4, date: 'Apr 7, 02:10 PM' },
  { id: 8, name: 'ACME_ASN_20260407_015.edi', partner: 'Acme Corp EDI', source: 'sftp', sourceColor: 'info', type: 'X12 856', size: '12.0 KB', status: 'Duplicate', statusColor: 'secondary', orders: 0, date: 'Apr 7, 01:55 PM' },
  { id: 9, name: 'GLOBAL_PO_20260407_014.edi', partner: 'Global Logistics', source: 'api', sourceColor: 'primary', type: 'X12 850', size: '7.1 KB', status: 'Completed', statusColor: 'success', orders: 2, date: 'Apr 7, 11:30 AM' },
  { id: 10, name: 'AUTO_PO_20260407_013.edi', partner: 'AutoParts Direct', source: 'manual', sourceColor: 'secondary', type: 'X12 850', size: '45.6 KB', status: 'Failed', statusColor: 'error', orders: 0, date: 'Apr 7, 09:15 AM' },
];

export default function VNextEdiFiles() {
  const [activeFilter, setActiveFilter] = useState('all');

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'Pending', label: 'Pending' },
    { key: 'Processing', label: 'Processing' },
    { key: 'Completed', label: 'Completed' },
    { key: 'Failed', label: 'Failed' },
    { key: 'Duplicate', label: 'Duplicate' },
  ];

  const filtered = activeFilter === 'all' ? FILES : FILES.filter(f => f.status === activeFilter);

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>EDI Files</h1>
          <p>Browse and manage EDI file processing</p>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">folder</span></div>
          <div>
            <div className="vn-stat-value">892</div>
            <div className="vn-stat-label">Total Files</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">845</div>
            <div className="vn-stat-label">Completed</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">error</span></div>
          <div>
            <div className="vn-stat-value">12</div>
            <div className="vn-stat-label">Failed</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">hourglass_empty</span></div>
          <div>
            <div className="vn-stat-value">35</div>
            <div className="vn-stat-label">Pending</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">receipt_long</span></div>
          <div>
            <div className="vn-stat-value">2,104</div>
            <div className="vn-stat-label">Orders Created</div>
          </div>
        </div>
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {filters.map(f => (
          <button
            key={f.key}
            className={`vn-btn vn-btn-sm ${activeFilter === f.key ? 'vn-btn-primary' : 'vn-btn-outline'}`}
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="vn-card">
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Partner</th>
                <th>Source</th>
                <th>Type</th>
                <th>Size</th>
                <th>Status</th>
                <th>Orders</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id}>
                  <td>
                    <span style={{ fontSize: 13, maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>
                      {f.name}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{f.partner}</td>
                  <td><span className={`vn-chip vn-chip-${f.sourceColor}`}>{f.source}</span></td>
                  <td style={{ fontSize: 13 }}>{f.type}</td>
                  <td style={{ fontSize: 13 }}>{f.size}</td>
                  <td><span className={`vn-chip vn-chip-${f.statusColor}`}>{f.status}</span></td>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{f.orders || <span style={{ color: 'var(--on-surface-variant)' }}>&mdash;</span>}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--on-surface-variant)' }}>{f.date}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="vn-btn-icon" title="View">
                        <span className="material-icons" style={{ fontSize: 18 }}>visibility</span>
                      </button>
                      {f.status === 'Failed' && (
                        <button className="vn-btn-icon" title="Reprocess">
                          <span className="material-icons" style={{ fontSize: 18 }}>refresh</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-color)', fontSize: 13 }}>
          <button className="vn-btn vn-btn-outline vn-btn-sm" disabled>
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_left</span>
            Previous
          </button>
          <span style={{ color: 'var(--on-surface-variant)' }}>Page 1 of 18</span>
          <button className="vn-btn vn-btn-outline vn-btn-sm">
            Next
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>
    </>
  );
}
