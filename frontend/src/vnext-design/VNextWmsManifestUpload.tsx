import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Info } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

export default function VNextWmsManifestUpload() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [fields, setFields] = useState<Record<string, ManifestField>>({});
  const [selectedLocation, setSelectedLocation] = useState('');

  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saveTemplate, setSaveTemplate] = useState(true);
  const [templateName, setTemplateName] = useState('');

  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState('');

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manifest Upload</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload a CSV to create a receiving task with pre-populated expected items</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      {processResult && (
        <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="h-5 w-5" />
          <span className="flex-1">
            Manifest processed: {processResult.processedRows} items imported into receiving task.
            {processResult.errorRows > 0 && ` ${processResult.errorRows} rows had errors.`}
          </span>
          <Button variant="outline" size="sm" onClick={() => navigate(`/wms/receiving/${processResult.receivingTaskId}`)}>
            View Receiving Task
          </Button>
        </div>
      )}

      {!uploadResult && !processResult && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Step 1: Upload File</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Location *</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Supplier Name</Label>
              <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Reference (PO/BOL)</Label>
              <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>CSV File *</Label>
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileSelect}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              {fileName && <p className="text-sm text-muted-foreground">{fileName}</p>}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-2">
              <Button variant="outline" onClick={() => navigate('/wms/receiving')}>Cancel</Button>
              <Button variant="gradient" onClick={handleUpload} disabled={uploading || !csvContent || !selectedLocation}>
                {uploading ? 'Uploading...' : 'Upload & Detect'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadResult && !processResult && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Map Columns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploadResult.matchedTemplate && (
                <div className="flex items-center gap-3 rounded-md border border-info/30 bg-info/10 p-3 text-sm text-info">
                  <Info className="h-4 w-4" />
                  Auto-matched template: <strong>{uploadResult.matchedTemplate.name}</strong>. Verify mapping below.
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Map your CSV columns to the system fields. SKU and Quantity are required.
              </p>

              <div className="flex flex-col gap-3">
                {fieldKeys.map(key => {
                  const field = fields[key];
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <label className={`w-36 text-sm ${field.required ? 'font-semibold' : ''}`}>
                        {field.label} {field.required && <span className="text-destructive">*</span>}
                      </label>
                      <Select value={mapping[key] || 'unmapped'} onValueChange={v => setMapping({ ...mapping, [key]: v === 'unmapped' ? '' : v })}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unmapped">-- Not mapped --</SelectItem>
                          {uploadResult.headers.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-md bg-muted p-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={saveTemplate}
                    onChange={e => setSaveTemplate(e.target.checked)}
                    className="h-4 w-4 rounded border border-input bg-background accent-primary"
                  />
                  Save as template for future uploads
                </label>
                {saveTemplate && (
                  <Input
                    className="mt-2"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="Template name (e.g. Supplier X format)"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={() => { setUploadResult(null); setMapping({}); }}>Back</Button>
                <Button variant="gradient" onClick={handleProcess} disabled={processing || !mapping.sku || !mapping.quantity}>
                  {processing ? 'Processing...' : `Process ${uploadResult.totalRows} Rows`}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                Showing first {Math.min(5, uploadResult.sampleRows.length)} of {uploadResult.totalRows} rows
              </p>
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {uploadResult.headers.map(h => {
                        const mappedTo = Object.entries(mapping).find(([_, col]) => col === h)?.[0];
                        return (
                          <TableHead key={h} className="whitespace-nowrap">
                            {h}
                            {mappedTo && (
                              <div className="text-xs font-normal text-primary">
                                {'-> '}{fields[mappedTo]?.label || mappedTo}
                              </div>
                            )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadResult.sampleRows.map((row, i) => (
                      <TableRow key={i}>
                        {uploadResult.headers.map(h => (
                          <TableCell key={h} className="max-w-[150px] truncate whitespace-nowrap text-xs">
                            {row[h] || ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
