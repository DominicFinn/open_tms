import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface Document {
  id: string;
  documentType: string;
  documentNumber?: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  shipmentId?: string;
  orderId?: string;
  customerId?: string;
  generatedBy?: string;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  bol: 'Bill of Lading',
  label: 'Shipping Labels',
  customs: 'Customs Form',
  daily_report: 'Daily Report',
  attachment: 'Attachment',
};

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [typeFilter]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('documentType', typeFilter);

      const response = await fetch(`${API_URL}/api/v1/documents?${params}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setDocuments(result.data || []);
    } catch (err: any) {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    window.open(`${API_URL}/api/v1/documents/${doc.id}/download`, '_blank');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await fetch(`${API_URL}/api/v1/documents/${id}`, { method: 'DELETE' });
      setDocuments(documents.filter(d => d.id !== id));
    } catch (err) {
      setError('Failed to delete document');
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>Documents</h1>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <label>Type:</label>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--md-outline)' }}>
          <option value="">All Types</option>
          <option value="bol">Bill of Lading</option>
          <option value="label">Shipping Labels</option>
          <option value="customs">Customs Forms</option>
          <option value="daily_report">Daily Reports</option>
        </select>
      </div>

      {error && <div style={{ color: 'var(--md-error)', marginBottom: '16px' }}>{error}</div>}

      {loading ? (
        <p>Loading documents...</p>
      ) : documents.length === 0 ? (
        <p style={{ color: 'var(--md-on-surface-variant)' }}>
          No documents found. Generate documents from the Shipment or Order detail pages.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--md-outline-variant)' }}>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Document #</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>File Name</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Size</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Created</th>
              <th style={{ textAlign: 'right', padding: '12px 8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map(doc => (
              <tr key={doc.id} style={{ borderBottom: '1px solid var(--md-outline-variant)' }}>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    background: 'var(--md-secondary-container)',
                    color: 'var(--md-on-secondary-container)',
                  }}>
                    {typeLabels[doc.documentType] || doc.documentType}
                  </span>
                </td>
                <td style={{ padding: '10px 8px' }}>{doc.documentNumber || '-'}</td>
                <td style={{ padding: '10px 8px' }}>{doc.fileName}</td>
                <td style={{ padding: '10px 8px' }}>{formatSize(doc.fileSize)}</td>
                <td style={{ padding: '10px 8px' }}>{new Date(doc.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  <button onClick={() => handleDownload(doc)}
                    style={{ marginRight: '8px', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--md-outline)', background: 'var(--md-surface)', cursor: 'pointer' }}>
                    Download
                  </button>
                  <button onClick={() => handleDelete(doc.id)}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--md-error)', color: 'var(--md-error)', background: 'var(--md-surface)', cursor: 'pointer' }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
