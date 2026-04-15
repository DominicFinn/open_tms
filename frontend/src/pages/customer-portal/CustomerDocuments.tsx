import React, { useEffect, useState } from 'react';
import { API_URL } from '../../api';
import { customerFetch, getCustomerToken } from './CustomerDashboard';

interface Doc {
  id: string; documentType: string; fileName: string;
  mimeType: string; fileSize: number; createdAt: string; shipmentId?: string;
}

function docTypeLabel(t: string): string {
  const m: Record<string, string> = { bol: 'Bill of Lading', label: 'Label', customs: 'Customs Form', rate_confirmation: 'Rate Confirmation', issue_closure_report: 'Closure Report', daily_report: 'Daily Report' };
  return m[t] || t;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function CustomerDocuments() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerFetch(`${API_URL}/api/v1/customer-portal/documents`)
      .then(r => r.json())
      .then(json => setDocs(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (doc: Doc) => {
    const res = await fetch(`${API_URL}/api/v1/customer-portal/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${getCustomerToken()}` },
    });
    if (!res.ok) { alert('Download failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = doc.fileName; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Documents</h1>
      <div className="vn-card">
        <div className="vn-table-wrap">
          {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" /></div> : docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: 40, opacity: 0.4 }}>folder_open</span>
              <p>No documents available</p>
            </div>
          ) : (
            <table className="vn-table">
              <thead><tr><th>Document</th><th>Type</th><th>Size</th><th>Created</th><th>Action</th></tr></thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.id}>
                    <td><span style={{ fontWeight: 600, fontSize: 14 }}>{d.fileName}</span></td>
                    <td><span className="vn-chip vn-chip-secondary">{docTypeLabel(d.documentType)}</span></td>
                    <td style={{ fontSize: 13 }}>{formatSize(d.fileSize)}</td>
                    <td style={{ fontSize: 13 }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => handleDownload(d)}>
                        <span className="material-icons" style={{ fontSize: 16 }}>download</span> Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
