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

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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

  const csvColumns = [
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
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" />
          Orders
        </Button>
        <span className="text-sm text-muted-foreground">/ Import CSV</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Orders from CSV</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload a CSV file to create orders in bulk</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Main */}
        <div className="space-y-6">
          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle>Upload File</CardTitle>
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
                  <Button variant="ghost" size="sm" onClick={removeFile}>
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  variant="gradient"
                  disabled={!file || importing}
                  onClick={handleImport}
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importing ? 'Importing...' : 'Import Orders'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <XCircle className="h-5 w-5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {/* Results */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Import Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Card className="p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="mt-3 text-2xl font-bold tracking-tight">{result.successCount}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Imported</div>
                  </Card>
                  <Card className="p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <XCircle className="h-5 w-5" />
                    </div>
                    <div className="mt-3 text-2xl font-bold tracking-tight">{result.errorCount}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Errors</div>
                  </Card>
                </div>

                {result.errors && result.errors.length > 0 && (
                  <div className="mt-6">
                    <div className="mb-2 text-sm font-semibold">Error Details</div>
                    <div className="space-y-1">
                      {result.errors.map((err, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm"
                        >
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          {err.row != null && <span className="font-semibold">Row {err.row}:</span>}
                          <span>{err.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.successCount > 0 && result.errorCount === 0 && (
                  <div className="mt-4 flex items-center gap-3 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
                    <CheckCircle2 className="h-5 w-5" />
                    All orders imported successfully!
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: Instructions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>CSV Format</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your CSV file should include the following columns:
              </p>
              <div className="mt-3 space-y-1.5">
                {csvColumns.map(col => (
                  <div
                    key={col}
                    className="rounded-md bg-muted/30 px-3 py-1.5 font-mono text-xs"
                  >
                    {col}
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-4 w-full">
                <Download className="h-4 w-4" />
                Download Template
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
