import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface EdiFile {
  id: string;
  fileName: string;
  fileSize?: number;
  source: string;
  status: string;
  transactionType?: string;
  transactionCount: number;
  ordersCreated: number;
  orderIds?: string[];
  errorMessage?: string;
  processedAt?: string;
  createdAt: string;
  partner?: { id: string; name: string } | null;
}

interface Stats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalFiles: number;
  totalOrdersCreated: number;
}

export default function EdiFiles() {
  const [files, setFiles] = useState<EdiFile[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedFile, setSelectedFile] = useState<EdiFile | null>(null);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    loadFiles();
    loadStats();
  }, [statusFilter, offset]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`${API_URL}/api/v1/edi-files?${params}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setFiles(result.data?.files || []);
      setTotal(result.data?.total || 0);
    } catch (err: any) {
      setError('Failed to load EDI files');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/edi-files/stats`);
      const result = await response.json();
      if (result.data) setStats(result.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleReprocess = async (fileId: string) => {
    if (!confirm('Reprocess this EDI file? This will attempt to create orders again.')) return;
    setReprocessing(fileId);
    try {
      const response = await fetch(`${API_URL}/api/v1/edi-files/${fileId}/reprocess`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await loadFiles();
      await loadStats();
    } catch (err: any) {
      setError(err.message || 'Reprocessing failed');
    } finally {
      setReprocessing(null);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'chip-success';
      case 'failed': return 'chip-error';
      case 'processing': return 'chip-warning';
      case 'duplicate': return 'chip-warning';
      default: return '';
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div>
      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--color-primary)' }}>{stats.totalFiles}</div>
            <div style={{ color: 'var(--color-grey)', fontSize: '13px' }}>Total Files</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--color-success)' }}>{stats.completed}</div>
            <div style={{ color: 'var(--color-grey)', fontSize: '13px' }}>Completed</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--color-error)' }}>{stats.failed}</div>
            <div style={{ color: 'var(--color-grey)', fontSize: '13px' }}>Failed</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--color-warning)' }}>{stats.pending + stats.processing}</div>
            <div style={{ color: 'var(--color-grey)', fontSize: '13px' }}>Pending</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--color-primary)' }}>{stats.totalOrdersCreated}</div>
            <div style={{ color: 'var(--color-grey)', fontSize: '13px' }}>Orders Created</div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <div>
            <h2>EDI Files</h2>
            <p style={{ color: 'var(--color-grey)', marginTop: 'var(--spacing-1)' }}>
              History of all EDI files imported via upload, API, or SFTP collection.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
            <Link to="/orders/import/edi" className="button">
              <span className="material-icons" style={{ fontSize: '18px' }}>upload</span>
              Import EDI
            </Link>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-2)' }}>
            <span className="material-icons">error</span>
            {error}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--spacing-1)', marginBottom: 'var(--spacing-2)', flexWrap: 'wrap' }}>
          {['', 'pending', 'processing', 'completed', 'failed', 'duplicate'].map(status => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setOffset(0); }}
              className={`button button-sm ${statusFilter === status ? 'button-primary' : 'button-outline'}`}
            >
              {status || 'All'}
            </button>
          ))}
        </div>

        {loading && files.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-4)' }}>
            <div className="loading-spinner"></div>
          </div>
        ) : files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4)', color: 'var(--color-grey)' }}>
            <span className="material-icons" style={{ fontSize: '48px', marginBottom: 'var(--spacing-1)' }}>description</span>
            <h3>No EDI files</h3>
            <p>Import your first EDI file to see it here.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(file => (
                    <tr key={file.id}>
                      <td style={{ fontWeight: '500', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.fileName}
                      </td>
                      <td>{file.partner?.name || <span style={{ color: 'var(--color-grey)' }}>—</span>}</td>
                      <td><span className="chip">{file.source}</span></td>
                      <td>{file.transactionType ? `X12 ${file.transactionType}` : '—'}</td>
                      <td>{formatBytes(file.fileSize)}</td>
                      <td><span className={`chip ${statusColor(file.status)}`}>{file.status}</span></td>
                      <td>
                        {file.ordersCreated > 0 ? (
                          <span style={{ fontWeight: '500', color: 'var(--color-success)' }}>{file.ordersCreated}</span>
                        ) : '0'}
                      </td>
                      <td style={{ fontSize: '13px' }}>{new Date(file.createdAt).toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                          <button onClick={() => setSelectedFile(file)} className="button button-outline button-sm">
                            <span className="material-icons" style={{ fontSize: '16px' }}>visibility</span>
                          </button>
                          {file.status === 'failed' && (
                            <button
                              onClick={() => handleReprocess(file.id)}
                              disabled={reprocessing === file.id}
                              className="button button-outline button-sm"
                            >
                              {reprocessing === file.id ? '...' : (
                                <span className="material-icons" style={{ fontSize: '16px' }}>refresh</span>
                              )}
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
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
                <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="button button-outline button-sm">
                  Previous
                </button>
                <span style={{ color: 'var(--color-grey)' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button onClick={() => setOffset(offset + limit)} disabled={currentPage >= totalPages} className="button button-outline button-sm">
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedFile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setSelectedFile(null)}>
          <div className="card" style={{
            maxWidth: '700px', width: '90%', maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
              <h3>EDI File Details</h3>
              <button onClick={() => setSelectedFile(null)} className="icon-btn">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
              <div>
                <div style={{ color: 'var(--color-grey)', fontSize: '12px' }}>File Name</div>
                <div style={{ fontWeight: '500' }}>{selectedFile.fileName}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-grey)', fontSize: '12px' }}>Status</div>
                <span className={`chip ${statusColor(selectedFile.status)}`}>{selectedFile.status}</span>
              </div>
              <div>
                <div style={{ color: 'var(--color-grey)', fontSize: '12px' }}>Source</div>
                <div>{selectedFile.source}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-grey)', fontSize: '12px' }}>Partner</div>
                <div>{selectedFile.partner?.name || '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-grey)', fontSize: '12px' }}>Transaction Type</div>
                <div>{selectedFile.transactionType ? `X12 ${selectedFile.transactionType}` : '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-grey)', fontSize: '12px' }}>Transactions</div>
                <div>{selectedFile.transactionCount}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-grey)', fontSize: '12px' }}>Orders Created</div>
                <div style={{ fontWeight: '500', color: selectedFile.ordersCreated > 0 ? 'var(--color-success)' : undefined }}>
                  {selectedFile.ordersCreated}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--color-grey)', fontSize: '12px' }}>File Size</div>
                <div>{formatBytes(selectedFile.fileSize)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-grey)', fontSize: '12px' }}>Imported</div>
                <div>{new Date(selectedFile.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-grey)', fontSize: '12px' }}>Processed</div>
                <div>{selectedFile.processedAt ? new Date(selectedFile.processedAt).toLocaleString() : '—'}</div>
              </div>
            </div>

            {selectedFile.errorMessage && (
              <div style={{
                backgroundColor: 'var(--color-error-light)',
                border: '1px solid var(--color-error)',
                borderRadius: 'var(--border-radius)',
                padding: 'var(--spacing-2)',
                marginBottom: 'var(--spacing-2)',
                fontSize: '13px'
              }}>
                <strong style={{ color: 'var(--color-error)' }}>Errors:</strong>
                <div style={{ marginTop: 'var(--spacing-1)', whiteSpace: 'pre-wrap' }}>{selectedFile.errorMessage}</div>
              </div>
            )}

            {selectedFile.orderIds && (selectedFile.orderIds as string[]).length > 0 && (
              <div>
                <div style={{ color: 'var(--color-grey)', fontSize: '12px', marginBottom: 'var(--spacing-1)' }}>Created Order IDs</div>
                <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap' }}>
                  {(selectedFile.orderIds as string[]).map(id => (
                    <Link key={id} to={`/orders/${id}`} className="chip" style={{ textDecoration: 'none' }}>
                      {id.substring(0, 8)}...
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
