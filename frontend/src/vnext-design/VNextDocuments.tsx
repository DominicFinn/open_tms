import React, { useState } from 'react';

const DOCUMENTS = [
  { name: 'BOL-SHP4821.pdf', type: 'BOL', typeColor: 'info', icon: 'description', entity: 'SHP-4821', size: '245 KB', created: 'Apr 6, 2026' },
  { name: 'Customs-MX-20260405.pdf', type: 'Customs', typeColor: 'warning', icon: 'description', entity: 'SHP-4819', size: '1.2 MB', created: 'Apr 5, 2026' },
  { name: 'Rate-Confirmation-4821.pdf', type: 'Attachment', typeColor: 'secondary', icon: 'attach_file', entity: 'SHP-4821', size: '128 KB', created: 'Apr 5, 2026' },
  { name: 'POD-SHP4820.jpg', type: 'Attachment', typeColor: 'secondary', icon: 'image', entity: 'SHP-4820', size: '3.8 MB', created: 'Apr 6, 2026' },
  { name: 'BOL-SHP4818.pdf', type: 'BOL', typeColor: 'info', icon: 'description', entity: 'SHP-4818', size: '210 KB', created: 'Apr 4, 2026' },
  { name: 'Customs-CA-20260402.pdf', type: 'Customs', typeColor: 'warning', icon: 'description', entity: 'SHP-4815', size: '980 KB', created: 'Apr 2, 2026' },
  { name: 'Insurance-Certificate.pdf', type: 'Attachment', typeColor: 'secondary', icon: 'attach_file', entity: 'Swift Transport', size: '340 KB', created: 'Mar 30, 2026' },
  { name: 'BOL-SHP4812.pdf', type: 'BOL', typeColor: 'info', icon: 'description', entity: 'SHP-4812', size: '198 KB', created: 'Mar 28, 2026' },
  { name: 'Packing-List-4819.xlsx', type: 'Attachment', typeColor: 'secondary', icon: 'attach_file', entity: 'SHP-4819', size: '56 KB', created: 'Apr 5, 2026' },
  { name: 'Customs-EU-20260325.pdf', type: 'Customs', typeColor: 'warning', icon: 'description', entity: 'SHP-4808', size: '1.5 MB', created: 'Mar 25, 2026' },
];

const typeCounts = {
  all: DOCUMENTS.length,
  bol: DOCUMENTS.filter(d => d.type === 'BOL').length,
  customs: DOCUMENTS.filter(d => d.type === 'Customs').length,
  attachment: DOCUMENTS.filter(d => d.type === 'Attachment').length,
};

export default function VNextDocuments() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = DOCUMENTS.filter(d => {
    if (typeFilter === 'bol' && d.type !== 'BOL') return false;
    if (typeFilter === 'customs' && d.type !== 'Customs') return false;
    if (typeFilter === 'attachment' && d.type !== 'Attachment') return false;
    if (search) {
      const q = search.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.entity.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      {/* Page Header */}
      <div className="vn-page-header">
        <h1>Documents</h1>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">upload_file</span>
            Upload
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => setTypeFilter('all')}>
          <div className="vn-stat-icon primary">
            <span className="material-icons">folder</span>
          </div>
          <div>
            <div className="vn-stat-value">{typeCounts.all}</div>
            <div className="vn-stat-label">Total Documents</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => setTypeFilter('bol')}>
          <div className="vn-stat-icon info">
            <span className="material-icons">description</span>
          </div>
          <div>
            <div className="vn-stat-value">{typeCounts.bol}</div>
            <div className="vn-stat-label">Bills of Lading</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => setTypeFilter('customs')}>
          <div className="vn-stat-icon warning">
            <span className="material-icons">gavel</span>
          </div>
          <div>
            <div className="vn-stat-value">{typeCounts.customs}</div>
            <div className="vn-stat-label">Customs Forms</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => setTypeFilter('attachment')}>
          <div className="vn-stat-icon secondary">
            <span className="material-icons">attach_file</span>
          </div>
          <div>
            <div className="vn-stat-value">{typeCounts.attachment}</div>
            <div className="vn-stat-label">Attachments</div>
          </div>
        </div>
      </div>

      {/* Filter Bar + Table */}
      <div className="vn-card">
        <div className="vn-card-header">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="vn-search" style={{ minWidth: 220 }}>
              <span className="material-icons">search</span>
              <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="vn-select"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="bol">BOL</option>
              <option value="customs">Customs</option>
              <option value="attachment">Attachment</option>
            </select>
            <select className="vn-select">
              <option value="all">All Dates</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
          <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{filtered.length} documents</span>
        </div>
        <div className="vn-card-body vn-card-flush">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Document Name</th>
                  <th>Type</th>
                  <th>Entity</th>
                  <th>Size</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-icons" style={{
                          fontSize: 20,
                          color: doc.icon === 'description' ? 'var(--error)' : doc.icon === 'image' ? 'var(--info)' : 'var(--on-surface-variant)',
                        }}>{doc.icon}</span>
                        <span style={{ fontWeight: 500 }}>{doc.name}</span>
                      </div>
                    </td>
                    <td><span className={`vn-chip vn-chip-${doc.typeColor}`}>{doc.type}</span></td>
                    <td>
                      <span style={{ color: 'var(--primary)', fontWeight: 500, cursor: 'pointer' }}>{doc.entity}</span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{doc.size}</td>
                    <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{doc.created}</td>
                    <td>
                      <button className="vn-btn-icon" title="Download">
                        <span className="material-icons" style={{ fontSize: 18 }}>download</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
