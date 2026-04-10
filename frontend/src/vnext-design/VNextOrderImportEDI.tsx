import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface EdiPartner {
  id: string;
  name: string;
  customer?: { name: string };
}

interface PreviewResult {
  transactions: number;
  orders: number;
  details?: string;
}

interface ImportResult {
  successCount: number;
  errorCount: number;
  errors?: Array<{ message: string }>;
}

export default function VNextOrderImportEDI() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [partners, setPartners] = useState<EdiPartner[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [partnersError, setPartnersError] = useState('');

  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState('');

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');

  // Load EDI partners
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPartnersLoading(true);
        const res = await fetch(`${API_URL}/api/v1/edi-partners?active=true`);
        if (!res.ok) throw new Error(`Failed to load EDI partners (${res.status})`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!cancelled) {
          setPartners(json.data || []);
          setPartnersError('');
        }
      } catch (err: any) {
        if (!cancelled) setPartnersError(err.message || 'Failed to load EDI partners');
      } finally {
        if (!cancelled) setPartnersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    if (dropped) {
      setFile(dropped);
      setPreviewResult(null);
      setImportResult(null);
      setPreviewError('');
      setImportError('');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewResult(null);
      setImportResult(null);
      setPreviewError('');
      setImportError('');
    }
  }

  function removeFile() {
    setFile(null);
    setPreviewResult(null);
    setImportResult(null);
    setPreviewError('');
    setImportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handlePreview() {
    if (!file || !selectedPartnerId) return;
    try {
      setPreviewing(true);
      setPreviewError('');
      setPreviewResult(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('partnerId', selectedPartnerId);

      const res = await fetch(`${API_URL}/api/v1/orders/import/edi/preview`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Preview failed (${res.status})`);
      }

      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setPreviewResult(json.data);
    } catch (err: any) {
      setPreviewError(err.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!file || !selectedPartnerId) return;
    try {
      setImporting(true);
      setImportError('');
      setImportResult(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('partnerId', selectedPartnerId);

      const res = await fetch(`${API_URL}/api/v1/orders/import/edi`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Import failed (${res.status})`);
      }

      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setImportResult(json.data);
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
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
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ Import EDI</span>
      </div>

      <div className="vn-page-header">
        <div>
          <h1>Import EDI File</h1>
          <p>Upload an EDI file to create orders from trading partner data</p>
        </div>
      </div>

      <div style={{ maxWidth: 720 }}>
        {/* EDI Partner Select */}
        <div className="vn-card" style={{ marginBottom: 24 }}>
          <div className="vn-card-header"><h2>EDI Partner</h2></div>
          <div className="vn-card-body">
            {partnersError && (
              <div className="vn-alert vn-alert-error" style={{ marginBottom: 12 }}>
                <span className="material-icons">error</span>
                <div className="vn-alert-content">{partnersError}</div>
              </div>
            )}
            <select
              className="vn-filter-select"
              value={selectedPartnerId}
              onChange={e => {
                setSelectedPartnerId(e.target.value);
                setPreviewResult(null);
                setImportResult(null);
              }}
              disabled={partnersLoading}
              style={{ width: '100%', padding: '10px 14px', fontSize: 14 }}
            >
              <option value="">
                {partnersLoading ? 'Loading partners...' : 'Select an EDI partner'}
              </option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.customer ? ` (${p.customer.name})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* File Upload */}
        <div className="vn-card" style={{ marginBottom: 24 }}>
          <div className="vn-card-header"><h2>Upload EDI File</h2></div>
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
                  Drop your EDI file here
                </div>
                <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                  or click to browse (EDI 204, 210, 214, etc.)
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".edi,.x12,.txt"
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
                className="vn-btn vn-btn-outline"
                disabled={!file || !selectedPartnerId || previewing}
                onClick={handlePreview}
              >
                <span className="material-icons">{previewing ? 'hourglass_empty' : 'preview'}</span>
                {previewing ? 'Previewing...' : 'Preview'}
              </button>
              <button
                className="vn-btn vn-btn-primary"
                disabled={!file || !selectedPartnerId || importing}
                onClick={handleImport}
              >
                <span className="material-icons">{importing ? 'hourglass_empty' : 'upload'}</span>
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>

        {/* Preview Error */}
        {previewError && (
          <div className="vn-alert vn-alert-error" style={{ marginBottom: 24 }}>
            <span className="material-icons">error</span>
            <div className="vn-alert-content">{previewError}</div>
          </div>
        )}

        {/* Preview Results */}
        {previewResult && (
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header"><h2>Preview Results</h2></div>
            <div className="vn-card-body">
              <div className="vn-stats">
                <div className="vn-stat">
                  <div className="vn-stat-icon info"><span className="material-icons">receipt_long</span></div>
                  <div>
                    <div className="vn-stat-value">{previewResult.transactions}</div>
                    <div className="vn-stat-label">Transactions</div>
                  </div>
                </div>
                <div className="vn-stat">
                  <div className="vn-stat-icon primary"><span className="material-icons">inventory_2</span></div>
                  <div>
                    <div className="vn-stat-value">{previewResult.orders}</div>
                    <div className="vn-stat-label">Orders to Create</div>
                  </div>
                </div>
              </div>
              {previewResult.details && (
                <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 12, marginBottom: 0 }}>
                  {previewResult.details}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Import Error */}
        {importError && (
          <div className="vn-alert vn-alert-error" style={{ marginBottom: 24 }}>
            <span className="material-icons">error</span>
            <div className="vn-alert-content">{importError}</div>
          </div>
        )}

        {/* Import Results */}
        {importResult && (
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header"><h2>Import Results</h2></div>
            <div className="vn-card-body">
              <div className="vn-stats" style={{ marginBottom: importResult.errors && importResult.errors.length > 0 ? 16 : 0 }}>
                <div className="vn-stat">
                  <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
                  <div>
                    <div className="vn-stat-value">{importResult.successCount}</div>
                    <div className="vn-stat-label">Imported</div>
                  </div>
                </div>
                <div className="vn-stat">
                  <div className="vn-stat-icon error"><span className="material-icons">error</span></div>
                  <div>
                    <div className="vn-stat-value">{importResult.errorCount}</div>
                    <div className="vn-stat-label">Errors</div>
                  </div>
                </div>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 8 }}>Error Details</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {importResult.errors.map((err, i) => (
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
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult.successCount > 0 && importResult.errorCount === 0 && (
                <div className="vn-alert vn-alert-success" style={{ marginTop: 16 }}>
                  <span className="material-icons">check_circle</span>
                  <div className="vn-alert-content">All orders imported successfully!</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
