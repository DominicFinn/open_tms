import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

function formatFileSize(bytes: number): string {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function docTypeLabel(documentType: string): { type: string; typeColor: string } {
  switch ((documentType || '').toLowerCase()) {
    case 'bol': return { type: 'BOL', typeColor: 'info' };
    case 'customs': return { type: 'Customs', typeColor: 'warning' };
    default: return { type: 'Attachment', typeColor: 'secondary' };
  }
}

function docIcon(mimeType: string): string {
  if (mimeType && mimeType.startsWith('image/')) return 'image';
  return 'description';
}

export default function VNextDocuments() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchDocs() {
      try {
        const res = await fetch(`${API_URL}/api/v1/documents`);
        if (!res.ok) throw new Error('Failed to load documents');
        const json = await res.json();
        if (!cancelled) setDocuments(json.data || []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load documents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDocs();
    return () => { cancelled = true; };
  }, []);

  const mappedDocs = documents.map((d: any) => {
    const { type, typeColor } = docTypeLabel(d.documentType);
    const icon = docIcon(d.mimeType);
    const entity = d.shipmentId ? `SHP-${d.shipmentId}` : d.orderId ? `ORD-${d.orderId}` : d.carrierId ? `Carrier-${d.carrierId}` : 'N/A';
    const size = formatFileSize(d.fileSize);
    const created = d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
    return { ...d, type, typeColor, icon, entity, size, created, name: d.fileName || d.documentNumber || 'Untitled' };
  });

  const typeCounts = {
    all: mappedDocs.length,
    bol: mappedDocs.filter((d: any) => d.type === 'BOL').length,
    customs: mappedDocs.filter((d: any) => d.type === 'Customs').length,
    attachment: mappedDocs.filter((d: any) => d.type === 'Attachment').length,
  };

  const filtered = mappedDocs.filter((d: any) => {
    if (typeFilter === 'bol' && d.type !== 'BOL') return false;
    if (typeFilter === 'customs' && d.type !== 'Customs') return false;
    if (typeFilter === 'attachment' && d.type !== 'Attachment') return false;
    if (search) {
      const q = search.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.entity.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ color: 'var(--error)' }}>error</span>
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

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
                    <td style={{ display: 'flex', gap: 4 }}>
                      {doc.documentType === 'bol' && (
                        <Link to={`/documents/${doc.id}/view`}>
                          <button className="vn-btn-icon" title="View BOL">
                            <span className="material-icons" style={{ fontSize: 18 }}>visibility</span>
                          </button>
                        </Link>
                      )}
                      <a href={`${API_URL}/api/v1/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                        <button className="vn-btn-icon" title="Download">
                          <span className="material-icons" style={{ fontSize: 18 }}>download</span>
                        </button>
                      </a>
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
