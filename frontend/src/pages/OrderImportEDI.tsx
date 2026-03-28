import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface ParsedOrder {
  orderNumber: string;
  poNumber?: string;
  orderDate?: string;
  origin?: { name: string; city: string; state?: string; country: string };
  destination?: { name: string; city: string; state?: string; country: string };
  lineItems: Array<{ sku: string; description?: string; quantity: number }>;
}

interface PreviewResult {
  success: boolean;
  transactionType: string;
  transactionCount: number;
  orders: ParsedOrder[];
  errors: string[];
}

interface ImportResult {
  success: boolean;
  fileId: string;
  transactionType: string;
  transactionCount: number;
  ordersCreated: number;
  orders: Array<{ orderNumber: string; id: string }>;
  errors: string[];
}

interface EdiPartner {
  id: string;
  name: string;
  customer?: { id: string; name: string };
}

export default function OrderImportEDI() {
  const [ediContent, setEdiContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [partners, setPartners] = useState<EdiPartner[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/edi-partners?active=true`);
      const data = await response.json();
      setPartners(data.data || []);
    } catch (err) {
      console.error('Failed to load EDI partners:', err);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.edi') && !ext.endsWith('.x12') && !ext.endsWith('.850') && !ext.endsWith('.txt')) {
      alert('Please upload an EDI file (.edi, .x12, .850, .txt)');
      return;
    }
    readFile(file);
  };

  const readFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setEdiContent(content);
      setPreview(null);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!ediContent) return;
    setPreviewing(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/orders/import/edi/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ediContent,
          partnerId: partnerId || undefined
        })
      });
      const data = await response.json();
      if (data.data) {
        setPreview(data.data);
      } else {
        alert(`Preview failed: ${data.error}`);
      }
    } catch (err) {
      alert('Preview failed. Check console for details.');
      console.error(err);
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!ediContent) return;
    setImporting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/orders/import/edi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ediContent,
          partnerId: partnerId || undefined,
          fileName,
          source: 'manual',
          autoAssign: false
        })
      });
      const data = await response.json();
      if (data.data) {
        setResult(data.data);
      } else {
        alert(`Import failed: ${data.error}`);
      }
    } catch (err) {
      alert('Import failed. Check console for details.');
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setEdiContent('');
    setFileName('');
    setPartnerId('');
    setPreview(null);
    setResult(null);
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <div>
            <h2>Import Orders from EDI</h2>
            <p style={{ color: 'var(--color-grey)', marginTop: 'var(--spacing-1)' }}>
              Upload an X12 850 (Purchase Order) EDI file to create orders. Preview parsed data before importing.
            </p>
          </div>
          <Link to="/orders" className="button button-outline">
            <span className="material-icons" style={{ fontSize: '18px' }}>arrow_back</span>
            Back to Orders
          </Link>
        </div>

        {!result && (
          <>
            {/* Info Banner */}
            <div style={{
              backgroundColor: 'var(--color-info-light)',
              borderLeft: '4px solid var(--color-info)',
              padding: 'var(--spacing-2)',
              marginBottom: 'var(--spacing-2)',
              borderRadius: 'var(--border-radius)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                <span className="material-icons" style={{ color: 'var(--color-info)' }}>info</span>
                <div style={{ flex: 1 }}>
                  <strong>Supported format:</strong> ANSI X12 850 (Purchase Order). Standard segment mapping (BEG, N1, PO1) is applied automatically.
                  Optionally select a trading partner to apply custom field mappings.
                </div>
              </div>
            </div>

            {/* Partner Selection */}
            {partners.length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <div className="input-wrapper" style={{ maxWidth: '400px' }}>
                  <select className="input" value={partnerId} onChange={e => { setPartnerId(e.target.value); setPreview(null); }}>
                    <option value="">No partner (use default mapping)</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.customer?.name})</option>
                    ))}
                  </select>
                  <label>EDI Trading Partner</label>
                </div>
              </div>
            )}

            {/* File Upload */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--border-radius)',
                padding: 'var(--spacing-4)',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface)',
                marginBottom: 'var(--spacing-2)'
              }}
            >
              <span className="material-icons" style={{ fontSize: '48px', color: 'var(--color-grey)', marginBottom: 'var(--spacing-1)' }}>
                cloud_upload
              </span>
              <h3>Drop EDI file here or click to upload</h3>
              <p style={{ color: 'var(--color-grey)', marginBottom: 'var(--spacing-2)' }}>
                Supported formats: .edi, .x12, .850, .txt
              </p>
              <input
                type="file"
                accept=".edi,.x12,.850,.txt"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="edi-file-input"
              />
              <label htmlFor="edi-file-input" className="button">
                <span className="material-icons" style={{ fontSize: '18px' }}>folder_open</span>
                Choose File
              </label>

              {fileName && (
                <div style={{
                  marginTop: 'var(--spacing-2)',
                  padding: 'var(--spacing-2)',
                  backgroundColor: 'var(--color-success-light)',
                  borderRadius: 'var(--border-radius)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-1)'
                }}>
                  <span className="material-icons" style={{ color: 'var(--color-success)' }}>check_circle</span>
                  <span style={{ fontWeight: '500' }}>{fileName}</span>
                  <button onClick={resetForm} className="icon-btn" style={{ marginLeft: 'var(--spacing-1)' }}>
                    <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
              )}
            </div>

            {/* Raw EDI Preview */}
            {ediContent && !preview && (
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-1)' }}>Raw EDI Content</h3>
                <div style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius)',
                  padding: 'var(--spacing-2)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {ediContent.substring(0, 2000)}
                  {ediContent.length > 2000 && '\n... (truncated)'}
                </div>
              </div>
            )}

            {/* Preview Button */}
            {ediContent && !preview && (
              <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end' }}>
                <button onClick={resetForm} className="button button-outline">Cancel</button>
                <button onClick={handlePreview} disabled={previewing} className="button">
                  {previewing ? (
                    <><span className="loading-spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></span>Parsing...</>
                  ) : (
                    <><span className="material-icons" style={{ fontSize: '18px' }}>preview</span>Preview Parsed Data</>
                  )}
                </button>
              </div>
            )}

            {/* Parsed Preview */}
            {preview && (
              <div>
                {/* Preview Header */}
                <div style={{
                  backgroundColor: preview.success ? 'var(--color-success-light)' : 'var(--color-warning-light)',
                  borderLeft: `4px solid ${preview.success ? 'var(--color-success)' : 'var(--color-warning)'}`,
                  padding: 'var(--spacing-2)',
                  marginBottom: 'var(--spacing-2)',
                  borderRadius: 'var(--border-radius)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                    <span className="material-icons" style={{ color: preview.success ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {preview.success ? 'check_circle' : 'warning'}
                    </span>
                    <strong>
                      Parsed {preview.transactionCount} transaction(s) — {preview.orders.length} order(s) found
                    </strong>
                    {preview.transactionType && (
                      <span className="chip" style={{ marginLeft: 'var(--spacing-1)' }}>
                        X12 {preview.transactionType}
                      </span>
                    )}
                  </div>
                </div>

                {/* Parse Errors */}
                {preview.errors.length > 0 && (
                  <div style={{
                    backgroundColor: 'var(--color-error-light)',
                    border: '1px solid var(--color-error)',
                    borderRadius: 'var(--border-radius)',
                    padding: 'var(--spacing-2)',
                    marginBottom: 'var(--spacing-2)'
                  }}>
                    <strong style={{ color: 'var(--color-error)' }}>Warnings ({preview.errors.length})</strong>
                    {preview.errors.map((err, i) => (
                      <div key={i} style={{ marginTop: 'var(--spacing-1)' }}>{err}</div>
                    ))}
                  </div>
                )}

                {/* Parsed Orders Table */}
                {preview.orders.length > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-2)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-1)' }}>Mapped Orders</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Order #</th>
                            <th>PO #</th>
                            <th>Order Date</th>
                            <th>Origin</th>
                            <th>Destination</th>
                            <th>Line Items</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.orders.map((order, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: '500' }}>{order.orderNumber}</td>
                              <td>{order.poNumber || '—'}</td>
                              <td>{order.orderDate ? new Date(order.orderDate).toLocaleDateString() : '—'}</td>
                              <td>
                                {order.origin ? (
                                  <span title={`${order.origin.name}, ${order.origin.city}`}>
                                    {order.origin.name}, {order.origin.city}
                                    {order.origin.state && `, ${order.origin.state}`}
                                  </span>
                                ) : <span style={{ color: 'var(--color-grey)' }}>Not specified</span>}
                              </td>
                              <td>
                                {order.destination ? (
                                  <span title={`${order.destination.name}, ${order.destination.city}`}>
                                    {order.destination.name}, {order.destination.city}
                                    {order.destination.state && `, ${order.destination.state}`}
                                  </span>
                                ) : <span style={{ color: 'var(--color-grey)' }}>Not specified</span>}
                              </td>
                              <td>
                                {order.lineItems.length} item(s)
                                <div style={{ fontSize: '12px', color: 'var(--color-grey)' }}>
                                  {order.lineItems.slice(0, 3).map(li => li.sku).join(', ')}
                                  {order.lineItems.length > 3 && '...'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Import Actions */}
                <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end' }}>
                  <button onClick={resetForm} className="button button-outline">Cancel</button>
                  <button onClick={() => setPreview(null)} className="button button-outline">
                    <span className="material-icons" style={{ fontSize: '18px' }}>edit</span>
                    Back to Raw
                  </button>
                  {preview.success && (
                    <button onClick={handleImport} disabled={importing} className="button button-primary">
                      {importing ? (
                        <><span className="loading-spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></span>Importing...</>
                      ) : (
                        <><span className="material-icons" style={{ fontSize: '18px' }}>upload</span>Import {preview.orders.length} Order(s)</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Import Results */}
        {result && (
          <div>
            <div style={{
              backgroundColor: result.success ? 'var(--color-success-light)' : 'var(--color-warning-light)',
              borderLeft: `4px solid ${result.success ? 'var(--color-success)' : 'var(--color-warning)'}`,
              padding: 'var(--spacing-2)',
              marginBottom: 'var(--spacing-2)',
              borderRadius: 'var(--border-radius)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                <span className="material-icons" style={{ color: result.success ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {result.success ? 'check_circle' : 'warning'}
                </span>
                <strong>Import Complete</strong>
              </div>
              <p style={{ marginTop: 'var(--spacing-1)', marginBottom: 0 }}>
                Created {result.ordersCreated} order(s) from {result.transactionCount} EDI transaction(s)
                {result.errors.length > 0 && ` with ${result.errors.length} error(s)`}
              </p>
            </div>

            {/* Created Orders */}
            {result.orders.length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-1)' }}>Created Orders</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Order Number</th><th>Actions</th></tr></thead>
                    <tbody>
                      {result.orders.map(order => (
                        <tr key={order.id}>
                          <td>
                            <Link to={`/orders/${order.id}`} style={{ fontWeight: '500', color: 'var(--color-primary)' }}>
                              {order.orderNumber}
                            </Link>
                          </td>
                          <td>
                            <Link to={`/orders/${order.id}`} className="button button-sm button-outline">
                              <span className="material-icons" style={{ fontSize: '16px' }}>visibility</span>
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-1)', color: 'var(--color-error)' }}>Errors ({result.errors.length})</h3>
                <div style={{
                  backgroundColor: 'var(--color-error-light)',
                  border: '1px solid var(--color-error)',
                  borderRadius: 'var(--border-radius)',
                  padding: 'var(--spacing-2)',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {result.errors.map((err, i) => (
                    <div key={i} style={{ marginBottom: i < result.errors.length - 1 ? 'var(--spacing-1)' : 0 }}>{err}</div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end' }}>
              <button onClick={resetForm} className="button button-outline">Import Another File</button>
              <Link to="/orders" className="button button-primary">
                <span className="material-icons" style={{ fontSize: '18px' }}>list</span>
                View All Orders
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
