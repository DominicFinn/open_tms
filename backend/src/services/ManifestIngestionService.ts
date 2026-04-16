import { createHash } from 'crypto';

/**
 * Known fields that can be mapped from a manifest CSV to receiving lines.
 */
export const MANIFEST_FIELDS = {
  sku: { label: 'SKU / Product Code', required: true },
  quantity: { label: 'Quantity', required: true },
  description: { label: 'Description', required: false },
  lotNumber: { label: 'Lot Number', required: false },
  expiryDate: { label: 'Expiry Date', required: false },
  unitPrice: { label: 'Unit Price', required: false },
  weight: { label: 'Weight (kg)', required: false },
  uomCode: { label: 'Unit of Measure', required: false },
  barcode: { label: 'Barcode / GTIN', required: false },
  poNumber: { label: 'PO Number', required: false },
  supplierSku: { label: 'Supplier SKU', required: false },
} as const;

export type ManifestFieldKey = keyof typeof MANIFEST_FIELDS;

export interface ColumnMapping {
  [fieldKey: string]: string; // fieldKey -> CSV column header
}

export interface ParsedRow {
  sku: string;
  quantity: number;
  description?: string;
  lotNumber?: string;
  expiryDate?: string;
  unitPrice?: number;
  weight?: number;
  uomCode?: string;
  barcode?: string;
  poNumber?: string;
  supplierSku?: string;
}

export interface ParseResult {
  headers: string[];
  headerChecksum: string;
  rows: Record<string, string>[];
  totalRows: number;
}

export interface ProcessResult {
  lines: Array<{
    sku: string;
    expectedQuantity: number;
    uomCode: string;
    lotNumber: string | null;
    expiryDate: string | null;
  }>;
  errors: Array<{ row: number; field: string; message: string }>;
  totalRows: number;
  processedRows: number;
  errorRows: number;
}

/**
 * Compute a checksum from column headers for template auto-detection.
 * Headers are sorted, lowercased, and trimmed before hashing.
 */
export function computeHeaderChecksum(headers: string[]): string {
  const normalized = headers.map(h => h.trim().toLowerCase()).sort().join('|');
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Parse CSV content into headers and rows.
 */
export function parseCSV(content: string, delimiter: string = ','): ParseResult {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    return { headers: [], headerChecksum: '', rows: [], totalRows: 0 };
  }

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"(.*)"$/, '$1'));
  const headerChecksum = computeHeaderChecksum(headers);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"(.*)"$/, '$1'));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    rows.push(row);
  }

  return { headers, headerChecksum, rows, totalRows: rows.length };
}

/**
 * Apply column mapping to parsed rows, producing receiving lines.
 */
export function applyMapping(rows: Record<string, string>[], mapping: ColumnMapping): ProcessResult {
  const lines: ProcessResult['lines'] = [];
  const errors: ProcessResult['errors'] = [];
  let processedRows = 0;
  let errorRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is headers, data starts at 2

    // Extract SKU
    const skuCol = mapping.sku;
    const sku = skuCol ? row[skuCol]?.trim() : '';
    if (!sku) {
      errors.push({ row: rowNum, field: 'sku', message: 'SKU is empty' });
      errorRows++;
      continue;
    }

    // Extract quantity
    const qtyCol = mapping.quantity;
    const qtyStr = qtyCol ? row[qtyCol]?.trim() : '';
    const quantity = parseInt(qtyStr) || 0;
    if (quantity <= 0) {
      errors.push({ row: rowNum, field: 'quantity', message: `Invalid quantity: "${qtyStr}"` });
      errorRows++;
      continue;
    }

    // Optional fields
    const lotCol = mapping.lotNumber;
    const lotNumber = lotCol ? row[lotCol]?.trim() || null : null;

    const expiryCol = mapping.expiryDate;
    const expiryDate = expiryCol ? row[expiryCol]?.trim() || null : null;

    const uomCol = mapping.uomCode;
    const uomCode = uomCol ? row[uomCol]?.trim() || 'EA' : 'EA';

    lines.push({ sku, expectedQuantity: quantity, uomCode, lotNumber, expiryDate });
    processedRows++;
  }

  return { lines, errors, totalRows: rows.length, processedRows, errorRows };
}
