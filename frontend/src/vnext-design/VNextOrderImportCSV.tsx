import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface ImportResult {
  successCount: number;
  errorCount: number;
  errors?: Array<{ row?: number; message: string }>;
}

export default function VNextOrderImportCSV() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && (dropped.name.endsWith('.csv') || dropped.type === 'text/csv')) {
      setFile(dropped);
      setResult(null);
      setError('');
    } else {
      setError('Please select a CSV file');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      setError('');
    }
  }

  function removeFile() {
    setFile(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleImport() {
    if (!file) return;
    try {
      setImporting(true);
      setError('');
      setResult(null);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/api/v1/orders/import/csv`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Import failed (${res.status})`);
      }

      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json.data);
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/orders')}>
          <span className="material-icons">arrow_back</span>
          Orders
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ Import CSV</span>
      </div>

      <div className="vn-page-header">
        <div>
          <h1>Import Orders from CSV</h1>
          <p>Upload a CSV file to create orders in bulk</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Main */}
        <div>
          {/* Upload Card */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header"><h2>Upload File</h2></div>
            <div className="vn-card-body">
              {!file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--outline-variant)'}`,
                    borderRadius: 'var(--border-radius)',
                    padding: 48,
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: dragOver ? 'var(--primary-container)' : 'var(--surface-container)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 48, color: 'var(--on-surface-variant)', opacity: 0.5 }}>
                    cloud_upload
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--on-surface)', marginTop: 12 }}>
                    Drop your CSV file here
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                    or click to browse
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  background: 'var(--surface-container)',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--outline-variant)',
                }}>
                  <span className="material-icons" style={{ fontSize: 32, color: 'var(--primary)' }}>description</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--on-surface)' }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{formatFileSize(file.size)}</div>
                  </div>
                  <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={removeFile}>
                    <span className="material-icons">close</span>
                    Remove
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  className="vn-btn vn-btn-primary"
                  disabled={!file || importing}
                  onClick={handleImport}
                >
                  <span className="material-icons">{importing ? 'hourglass_empty' : 'upload'}</span>
                  {importing ? 'Importing...' : 'Import Orders'}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="vn-alert vn-alert-error" style={{ marginBottom: 24 }}>
              <span className="material-icons">error</span>
              <div className="vn-alert-content">{error}</div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="vn-card" style={{ marginBottom: 24 }}>
              <div className="vn-card-header"><h2>Import Results</h2></div>
              <div className="vn-card-body">
                <div className="vn-stats" style={{ marginBottom: result.errors && result.errors.length > 0 ? 16 : 0 }}>
                  <div className="vn-stat">
                    <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
                    <div>
                      <div className="vn-stat-value">{result.successCount}</div>
                      <div className="vn-stat-label">Imported</div>
                    </div>
                  </div>
                  <div className="vn-stat">
                    <div className="vn-stat-icon error"><span className="material-icons">error</span></div>
                    <div>
                      <div className="vn-stat-value">{result.errorCount}</div>
                      <div className="vn-stat-label">Errors</div>
                    </div>
                  </div>
                </div>

                {result.errors && result.errors.length > 0 && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 8 }}>Error Details</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {result.errors.map((err, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            background: 'var(--error-container, var(--surface-container))',
                            borderRadius: 'var(--border-radius-sm)',
                            fontSize: 13,
                            color: 'var(--on-surface)',
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: 16, color: 'var(--error)' }}>warning</span>
                          {err.row != null && <span style={{ fontWeight: 600 }}>Row {err.row}:</span>}
                          <span>{err.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.successCount > 0 && result.errorCount === 0 && (
                  <div className="vn-alert vn-alert-success" style={{ marginTop: 16 }}>
                    <span className="material-icons">check_circle</span>
                    <div className="vn-alert-content">All orders imported successfully!</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Instructions */}
        <div>
          <div className="vn-card">
            <div className="vn-card-header"><h2>CSV Format</h2></div>
            <div className="vn-card-body">
              <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', margin: '0 0 12px 0' }}>
                Your CSV file should include the following columns:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'orderNumber',
                  'poNumber',
                  'customerName',
                  'originName',
                  'destinationName',
                  'serviceLevel',
                  'requestedPickupDate',
                  'requestedDeliveryDate',
                  'temperatureControl',
                  'requiresHazmat',
                  'specialInstructions',
                ].map(col => (
                  <div
                    key={col}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      padding: '4px 8px',
                      background: 'var(--surface-container)',
                      borderRadius: 'var(--border-radius-sm)',
                      color: 'var(--on-surface)',
                    }}
                  >
                    {col}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ width: '100%' }}>
                  <span className="material-icons">download</span>
                  Download Template
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
