import React, { useState, useRef } from 'react';
import { API_URL } from '../api';

export default function VNextEdiImport() {
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [partners, setPartners] = useState<Array<{ id: string; name: string }>>([]);
  const [detectedType, setDetectedType] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [partnersLoaded, setPartnersLoaded] = useState(false);

  const loadPartners = async () => {
    if (partnersLoaded) return;
    const res = await fetch(`${API_URL}/api/v1/trading-partners?active=true`);
    const json = await res.json();
    setPartners((json.data || []).map((p: any) => ({ id: p.id, name: p.name })));
    setPartnersLoaded(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setContent(text);
      detectType(text);
    };
    reader.readAsText(file);
  };

  const handlePaste = (text: string) => {
    setContent(text);
    if (text.length > 10) detectType(text);
  };

  const detectType = (text: string) => {
    const stMatch = text.match(/ST\*(\d{3})\*/);
    if (stMatch) {
      setDetectedType(stMatch[1]);
      return;
    }
    const gsMap: Record<string, string> = { PO: '850', SH: '856', SM: '204', GF: '990', QM: '214', IM: '210', FA: '997', IN: '810', RA: '820' };
    const gsMatch = text.match(/GS\*([A-Z]{2})\*/);
    if (gsMatch && gsMap[gsMatch[1]]) {
      setDetectedType(gsMap[gsMatch[1]]);
      return;
    }
    setDetectedType('');
  };

  const TYPE_NAMES: Record<string, string> = {
    '850': 'Purchase Order', '856': 'Ship Notice', '204': 'Load Tender',
    '990': 'Tender Response', '997': 'Func. Acknowledgment', '214': 'Shipment Status',
    '210': 'Freight Invoice', '810': 'Invoice', '820': 'Payment/Remittance',
  };

  const submit = async () => {
    if (!content.trim()) { setError('No EDI content provided'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/edi/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          partnerId: partnerId || undefined,
          fileName: fileName || undefined,
          source: 'manual',
        }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        setResult(json.data);
      } else {
        setResult(json.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '800px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Import EDI Document</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Upload or paste any X12 EDI document. The system will auto-detect the transaction type and process it.
      </p>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {result && !error && (
        <div className="vn-alert vn-alert-success" style={{ marginBottom: '1rem' }}>
          Processed successfully! Type: {result.transactionType}, Action: {result.action || 'processed'}
          {result.ack997Sent && ' (997 acknowledgment sent)'}
          {result.logId && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Log: {result.logId.slice(0, 8)}...</span>}
        </div>
      )}

      {/* File upload */}
      <div className="vn-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <button className="vn-btn vn-btn-primary" onClick={() => fileInputRef.current?.click()}>
            Upload File
          </button>
          <input ref={fileInputRef} type="file" accept=".edi,.x12,.txt,.850,.856,.214,.210,.997,.990,.810,.820" style={{ display: 'none' }} onChange={handleFileUpload} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {fileName || 'No file selected'}
          </span>
          {detectedType && (
            <span className="vn-chip vn-chip-info">
              Detected: {detectedType} ({TYPE_NAMES[detectedType] || 'Unknown'})
            </span>
          )}
        </div>

        <div className="vn-field">
          <label className="vn-field-label">Or paste EDI content</label>
          <textarea
            className="vn-input"
            rows={10}
            value={content}
            onChange={e => handlePaste(e.target.value)}
            placeholder="ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *..."
            style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'flex-end' }}>
          <div className="vn-field" style={{ flex: 1 }}>
            <label className="vn-field-label">Trading Partner (optional)</label>
            <select className="vn-input" value={partnerId} onChange={e => setPartnerId(e.target.value)} onFocus={loadPartners}>
              <option value="">None - manual import</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="vn-btn vn-btn-primary" onClick={submit} disabled={loading || !content.trim()}>
            {loading ? 'Processing...' : 'Import'}
          </button>
        </div>
      </div>

      {/* Result details */}
      {result?.details && (
        <div className="vn-card" style={{ padding: '1rem' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Processing Result</h3>
          <pre style={{
            background: 'var(--surface-secondary)',
            padding: '0.75rem',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '300px',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
          }}>
            {JSON.stringify(result.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
