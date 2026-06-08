import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  Download,
  FileText,
  Loader2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ImportError {
  row: number;
  orderNumber?: string;
  message: string;
}

interface ImportResult {
  success: boolean;
  ordersCreated: number;
  errors: ImportError[];
  orders: Array<{ orderNumber: string; id: string }>;
}

type Stage = 'idle' | 'reading' | 'validating' | 'creating' | 'done';

export default function CustomerImportOrdersCSV() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const importing = stage !== 'idle' && stage !== 'done';

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setDragOver(true); }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setDragOver(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && (dropped.name.toLowerCase().endsWith('.csv') || dropped.type === 'text/csv')) {
      setFile(dropped); setResult(null); setError(''); setStage('idle');
    } else {
      setError('Please select a CSV file');
    }
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) { setFile(selected); setResult(null); setError(''); setStage('idle'); }
  }
  function removeFile() {
    setFile(null); setResult(null); setError(''); setStage('idle');
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
      setError('');
      setResult(null);
      setStage('reading');
      const csvContent = await file.text();
      setStage('validating');
      await new Promise(r => setTimeout(r, 60));
      setStage('creating');
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/orders/import/csv`, {
        method: 'POST',
        body: JSON.stringify({ csvContent }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Import failed (${res.status})`);
      if (json?.error) throw new Error(json.error);
      setResult(json.data as ImportResult);
      setStage('done');
      const created = json.data?.ordersCreated ?? 0;
      const failed = json.data?.errors?.length ?? 0;
      if (created > 0 && failed === 0) {
        toast.success(`${created} order${created === 1 ? '' : 's'} created`);
      } else if (created > 0) {
        toast.warning(`${created} created, ${failed} errors`);
      } else {
        toast.error(`Import failed: ${failed} errors`);
      }
    } catch (err: any) {
      setError(err.message || 'Import failed');
      toast.error('Failed to import CSV', { description: err?.message || 'Network error' });
      setStage('idle');
    }
  }

  async function downloadTemplate() {
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/orders/import/csv/template`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'order-import-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Failed to download template', { description: err?.message || 'Network error' });
    }
  }

  const stageLabel: Record<Stage, string> = {
    idle: '',
    reading: 'Reading file...',
    validating: 'Validating rows...',
    creating: 'Creating orders...',
    done: 'Done',
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/customer-portal/orders')}>
          <ArrowLeft className="h-4 w-4" />
          Orders
        </Button>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk upload orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV to create orders in bulk. Each line is validated against the active mode rules
          (LTL needs dimensions and class, hazmat needs UN/class/packing group/proper shipping name, etc.).
          Orders with any failing line are rejected with row-level errors; sibling orders still go through.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload file</CardTitle>
            </CardHeader>
            <CardContent>
              {!file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    'cursor-pointer rounded-md border-2 border-dashed p-12 text-center transition-colors',
                    dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/40',
                  )}
                >
                  <CloudUpload className="mx-auto h-12 w-12 text-muted-foreground/60" />
                  <div className="mt-3 text-base font-medium">Drop your CSV file here</div>
                  <div className="mt-1 text-sm text-muted-foreground">or click to browse</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-4">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{formatFileSize(file.size)}</div>
                  </div>
                  {!importing && (
                    <Button variant="ghost" size="sm" onClick={removeFile}>
                      <X className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <Button variant="gradient" disabled={!file || importing} onClick={handleImport}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importing ? 'Importing...' : 'Import orders'}
                </Button>
                {importing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {stageLabel[stage]}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <XCircle className="h-5 w-5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Import results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Card className="p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="mt-3 text-2xl font-bold tracking-tight">{result.ordersCreated}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Orders created</div>
                  </Card>
                  <Card className="p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <XCircle className="h-5 w-5" />
                    </div>
                    <div className="mt-3 text-2xl font-bold tracking-tight">{result.errors.length}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Errors</div>
                  </Card>
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-6">
                    <div className="mb-2 text-sm font-semibold">Error details</div>
                    <div className="max-h-96 space-y-1 overflow-auto">
                      {result.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                          <div className="flex-1">
                            <span className="font-semibold">Row {err.row}</span>
                            {err.orderNumber && <span className="ml-2 text-muted-foreground">({err.orderNumber})</span>}
                            <span className="ml-2">{err.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.ordersCreated > 0 && result.errors.length === 0 && (
                  <div className="mt-4 flex items-center gap-3 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
                    <CheckCircle2 className="h-5 w-5" />
                    All orders imported successfully.
                  </div>
                )}

                {result.orders.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-sm font-semibold">Created orders</div>
                    <div className="flex flex-wrap gap-2">
                      {result.orders.map(o => (
                        <Button key={o.id} variant="outline" size="sm" onClick={() => navigate(`/customer-portal/orders/${o.id}`)}>
                          {o.orderNumber}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>CSV format</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Download the template to see every column the importer accepts. Required fields depend on the mode and flags:
                LTL needs dimensions and class; hazmat needs UN/class/packing group/proper shipping name; international needs HS code and country of origin; temperature-controlled needs min/max degrees C.
              </p>
              <Button variant="outline" className="mt-4 w-full" onClick={downloadTemplate}>
                <Download className="h-4 w-4" />
                Download template
              </Button>
              <div className="mt-6 space-y-2 text-xs text-muted-foreground">
                <div><span className="font-semibold">Per row:</span> orderNumber, sku, quantity (required)</div>
                <div><span className="font-semibold">Per order:</span> always include weight + unitOfMeasure</div>
                <div><span className="font-semibold">Group rows for one order</span> by repeating the same orderNumber</div>
                <div><span className="font-semibold">customerId</span> is forced to your account, you can omit it</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
