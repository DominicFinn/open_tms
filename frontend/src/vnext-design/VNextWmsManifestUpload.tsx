import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface ManifestField {
  label: string;
  required: boolean;
}

interface UploadResult {
  uploadId: string;
  headers: string[];
  headerChecksum: string;
  totalRows: number;
  sampleRows: Record<string, string>[];
  matchedTemplate: { id: string; name: string; columnMapping: Record<string, string> } | null;
}

interface ProcessResult {
  uploadId: string;
  receivingTaskId: string;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

const REQUIRED_FIELDS = ['sku', 'quantity'];

export default function VNextWmsManifestUpload() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [fields, setFields] = useState<Record<string, ManifestField>>({});
  const [selectedLocation, setSelectedLocation] = useState('');

  // Upload state
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Mapping state
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saveTemplate, setSaveTemplate] = useState(true);
  const [templateName, setTemplateName] = useState('');

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState('');

  // Supplier info
  const [supplierName, setSupplierName] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json()).then(res => {
      const locs = (res.data || []).filter((l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType));
      setLocations(locs);
      if (locs.length === 1) setSelectedLocation(locs[0].id);
    });
    fetch(`${API_URL}/api/v1/manifest/fields`).then(r => r.json()).then(res => setFields(res.data || {}));
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => { setCsvContent(ev.target?.result as string || ''); };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!csvContent || !selectedLocation) return;
    setError('');
    setUploading(true);
    setUploadResult(null);
    setMapping({});

    try {
      const res = await fetch(`${API_URL}/api/v1/manifest/upload`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation, csvContent, fileName, supplierName: supplierName || null, reference: reference || null }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else {
        setUploadResult(data.data);
        // If template matched, pre-fill mapping
        if (data.data.matchedTemplate) {
          setMapping(data.data.matchedTemplate.columnMapping);
          setTemplateName(data.data.matchedTemplate.name);
        }
      }
    } catch { setError('Failed to upload'); }
    finally { setUploading(false); }
  };

  const handleProcess = async () => {
    if (!uploadResult) return;
    if (!mapping.sku || !mapping.quantity) { setError('SKU and Quantity mappings are required'); return; }
    setError('');
    setProcessing(true);
    setProcessResult(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/manifest/${uploadResult.uploadId}/process`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnMapping: mapping,
          csvContent,
          saveAsTemplate: saveTemplate,
          templateName: templateName || `${supplierName || fileName} format`,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setProcessResult(data.data); }
    } catch { setError('Failed to process'); }
    finally { setProcessing(false); }
  };

  const fieldKeys = Object.keys(fields);

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Manifest Upload</h1>
          <p className="vn-page-subtitle">Upload a CSV to create a receiving task with pre-populated expected items</p>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {processResult && (
        <div className="vn-alert vn-alert-success" style={{ marginBottom: '1rem' }}>
          Manifest processed: {processResult.processedRows} items imported into receiving task.
          {processResult.errorRows > 0 && ` ${processResult.errorRows} rows had errors.`}
          <button className="vn-btn vn-btn-outline" style={{ marginLeft: '1rem', fontSize: '0.85rem' }}
            onClick={() => navigate(`/wms/receiving/${processResult.receivingTaskId}`)}>
            View Receiving Task
          </button>
        </div>
      )}

      {/* Step 1: Upload */}
      {!uploadResult && !processResult && (
        <div className="vn-card" style={{ maxWidth: '700px' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Step 1: Upload File</h3>
          <div className="vn-form-grid">
            <div className="vn-field">
              <label className="vn-field-label">Location *</label>
              <select className="vn-input" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} required>
                <option value="">Select warehouse...</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Supplier Name</label>
              <input className="vn-input" value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Optional" />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Reference (PO/BOL)</label>
              <input className="vn-input" value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional" />
            </div>
            <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
              <label className="vn-field-label">CSV File *</label>
              <input type="file" accept=".csv,.txt,.tsv" onChange={handleFileSelect}
                style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', width: '100%' }} />
              {fileName && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>{fileName}</span>}
            </div>
          </div>
          <div className="vn-form-actions" style={{ marginTop: '1.5rem' }}>
            <button className="vn-btn vn-btn-outline" onClick={() => navigate('/wms/receiving')}>Cancel</button>
            <button className="vn-btn vn-btn-primary" onClick={handleUpload} disabled={uploading || !csvContent || !selectedLocation}>
              {uploading ? 'Uploading...' : 'Upload & Detect'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Map Columns */}
      {uploadResult && !processResult && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Mapping panel */}
          <div className="vn-card">
            <h3 style={{ margin: '0 0 0.5rem' }}>Step 2: Map Columns</h3>
            {uploadResult.matchedTemplate && (
              <div className="vn-alert vn-alert-info" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                Auto-matched template: <strong>{uploadResult.matchedTemplate.name}</strong>. Verify mapping below.
              </div>
            )}
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              Map your CSV columns to the system fields. SKU and Quantity are required.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {fieldKeys.map(key => {
                const field = fields[key];
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <label style={{ flex: '0 0 140px', fontSize: '0.85rem', fontWeight: field.required ? 600 : 400 }}>
                      {field.label} {field.required && <span style={{ color: 'var(--color-error)' }}>*</span>}
                    </label>
                    <select className="vn-input" style={{ flex: 1 }}
                      value={mapping[key] || ''}
                      onChange={e => setMapping({ ...mapping, [key]: e.target.value })}
                    >
                      <option value="">-- Not mapped --</option>
                      {uploadResult.headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Save as template */}
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface-secondary)', borderRadius: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                <input type="checkbox" checked={saveTemplate} onChange={e => setSaveTemplate(e.target.checked)} />
                Save as template for future uploads
              </label>
              {saveTemplate && (
                <input className="vn-input" value={templateName} onChange={e => setTemplateName(e.target.value)}
                  placeholder="Template name (e.g. Supplier X format)" style={{ marginTop: '0.5rem' }} />
              )}
            </div>

            <div className="vn-form-actions" style={{ marginTop: '1.5rem' }}>
              <button className="vn-btn vn-btn-outline" onClick={() => { setUploadResult(null); setMapping({}); }}>Back</button>
              <button className="vn-btn vn-btn-primary" onClick={handleProcess} disabled={processing || !mapping.sku || !mapping.quantity}>
                {processing ? 'Processing...' : `Process ${uploadResult.totalRows} Rows`}
              </button>
            </div>
          </div>

          {/* Preview panel */}
          <div className="vn-card">
            <h3 style={{ margin: '0 0 1rem' }}>Data Preview</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
              Showing first {Math.min(5, uploadResult.sampleRows.length)} of {uploadResult.totalRows} rows
            </p>
            <div style={{ overflow: 'auto', maxHeight: '500px' }}>
              <table className="vn-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    {uploadResult.headers.map(h => {
                      const mappedTo = Object.entries(mapping).find(([_, col]) => col === h)?.[0];
                      return (
                        <th key={h} style={{ whiteSpace: 'nowrap' }}>
                          {h}
                          {mappedTo && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 400 }}>
                              {'-> '}{fields[mappedTo]?.label || mappedTo}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {uploadResult.sampleRows.map((row, i) => (
                    <tr key={i}>
                      {uploadResult.headers.map(h => (
                        <td key={h} style={{ whiteSpace: 'nowrap', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row[h] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
