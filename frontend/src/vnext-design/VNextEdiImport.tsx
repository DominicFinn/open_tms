import React, { useState, useRef } from 'react';
import { CheckCircle2, CircleAlert, Upload } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import EDI document</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload or paste any X12 EDI document. The system will auto-detect the transaction type and process it.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}
      {result && !error && (
        <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="h-5 w-5" />
          <div>
            Processed successfully. Type: {result.transactionType}, Action: {result.action || 'processed'}
            {result.ack997Sent && ' (997 acknowledgment sent)'}
            {result.logId && <span className="ml-2 text-xs text-muted-foreground">Log: {result.logId.slice(0, 8)}...</span>}
          </div>
        </div>
      )}

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Upload file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".edi,.x12,.txt,.850,.856,.214,.210,.997,.990,.810,.820"
            className="hidden"
            onChange={handleFileUpload}
          />
          <span className="text-sm text-muted-foreground">{fileName || 'No file selected'}</span>
          {detectedType && (
            <Badge variant="info">
              Detected: {detectedType} ({TYPE_NAMES[detectedType] || 'Unknown'})
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edi-content">Or paste EDI content</Label>
          <textarea
            id="edi-content"
            rows={10}
            value={content}
            onChange={e => handlePaste(e.target.value)}
            placeholder="ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px] space-y-2">
            <Label htmlFor="edi-partner">Trading partner (optional)</Label>
            <Select value={partnerId} onValueChange={setPartnerId} onOpenChange={open => { if (open) loadPartners(); }}>
              <SelectTrigger id="edi-partner">
                <SelectValue placeholder="None - manual import" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None - manual import</SelectItem>
                {partners.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="gradient" onClick={submit} disabled={loading || !content.trim()}>
            {loading ? 'Processing...' : 'Import'}
          </Button>
        </div>
      </Card>

      {result?.details && (
        <Card className="p-4">
          <h3 className="mb-3 text-base font-semibold">Processing result</h3>
          <pre className="max-h-[300px] overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
            {JSON.stringify(result.details, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
