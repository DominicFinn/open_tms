/**
 * EDI 180 (Return Merchandise Authorization and Notification) Parse Service
 *
 * Parses inbound X12 180 documents from customers requesting to return goods.
 * Uses X12EnvelopeParser for envelope validation.
 *
 * Two common uses of EDI 180:
 *   1. Customer sends 180 to request an RMA (direction: customer -> us)
 *   2. We send 180 back to authorize the return (direction: us -> customer, use EDI180Service)
 *
 * Key segments:
 *   BGN  - Beginning segment (transaction purpose: 00=original, 01=cancellation, 05=replace)
 *   REF  - Reference identifiers (RMA number, original PO, order number)
 *   DTM  - Date/time (request date, expected return date)
 *   N1   - Party identification (shipper = customer, consignee = us)
 *   LX   - Transaction set line number (group of items)
 *   LM   - Code source info (reason code qualifier)
 *   LQ   - Industry code (return reason code)
 *   SLN  - Subline detail (SKU, quantity, condition)
 *   PO1  - Line item detail (some implementations use this instead of LX/SLN)
 *   MSG  - Message text (customer notes, condition description)
 */

import { X12EnvelopeParser } from './edi/X12EnvelopeParser.js';

export interface EDI180Line {
  lineNumber: number;
  sku: string;
  quantity: number;
  /** X12 reason code (e.g. 001=Damaged, 002=Wrong Item) mapped to our internal reason */
  reasonCode?: string;
  conditionNotes?: string;
  unitPriceCents?: number;
  /** Disposition hint from customer (if provided) */
  requestedDisposition?: string;
}

export interface EDI180ParseResult {
  success: boolean;
  /** 00=Original request, 01=Cancellation, 05=Replace */
  transactionPurpose: string;
  customerRmaNumber: string;
  originalOrderNumber: string;
  requestDate: string;
  expectedReturnDate: string | null;
  customerName: string;
  customerId: string;
  /** Overall reason for the return, if provided at header level */
  returnReason: string;
  customerNotes: string;
  lines: EDI180Line[];
  rawContent: string;
  errors: string[];
  warnings: string[];
}

export interface IEDI180ParseService {
  parseEDI180(content: string): EDI180ParseResult;
  /** Map X12 reason codes to our internal return reasons */
  mapReasonCode(code: string): string;
}

/**
 * X12 return reason codes (subset of commonly used codes).
 * See X12 code list for full reference.
 */
const REASON_CODE_MAP: Record<string, string> = {
  '001': 'damaged',
  '002': 'wrong_item',
  '003': 'defective',
  '004': 'not_as_described',
  '005': 'no_longer_needed',
  '006': 'ordered_extra',
  // Extended codes
  'DAM': 'damaged',
  'WRG': 'wrong_item',
  'DEF': 'defective',
  'NAD': 'not_as_described',
  'NLN': 'no_longer_needed',
  'OVR': 'ordered_extra',
};

export class EDI180ParseService implements IEDI180ParseService {
  private envelopeParser = new X12EnvelopeParser();

  mapReasonCode(code: string): string {
    return REASON_CODE_MAP[code.toUpperCase()] ?? 'other';
  }

  parseEDI180(content: string): EDI180ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lines: EDI180Line[] = [];
    let transactionPurpose = '';
    let customerRmaNumber = '';
    let originalOrderNumber = '';
    let requestDate = '';
    let expectedReturnDate: string | null = null;
    let customerName = '';
    let customerId = '';
    let returnReason = '';
    let customerNotes = '';

    try {
      const envelopeResult = this.envelopeParser.parse(content);
      warnings.push(...envelopeResult.warnings);

      if (!envelopeResult.success) {
        errors.push(...envelopeResult.errors);
        return this.build({ transactionPurpose, customerRmaNumber, originalOrderNumber, requestDate, expectedReturnDate, customerName, customerId, returnReason, customerNotes, lines, content, errors, warnings });
      }

      const envelope = envelopeResult.envelope!;
      if (envelope.transactionType !== '180') {
        errors.push('No ST*180 segment found - this does not appear to be an EDI 180 document');
        return this.build({ transactionPurpose, customerRmaNumber, originalOrderNumber, requestDate, expectedReturnDate, customerName, customerId, returnReason, customerNotes, lines, content, errors, warnings });
      }

      // Parse body segments (envelope.segments is X12Segment[] with elements already split)
      const segments = envelope.segments;

      let currentLine: EDI180Line | null = null;
      let lineNumberCounter = 0;

      for (const seg of segments) {
        const elements = seg.elements;
        const tag = seg.id;

        if (tag === 'BGN') {
          // BGN*purpose*referenceId*date*time
          transactionPurpose = elements[1] || '';
          customerRmaNumber = elements[2] || '';
          requestDate = elements[3] || '';
        } else if (tag === 'REF') {
          // REF*qualifier*referenceNumber
          const qual = elements[1] || '';
          const refNum = elements[2] || '';
          if (qual === 'PO' || qual === 'IV' || qual === 'CO') {
            originalOrderNumber = refNum;
          } else if (qual === 'RMA' && !customerRmaNumber) {
            customerRmaNumber = refNum;
          }
        } else if (tag === 'DTM') {
          // DTM*qualifier*date
          const qual = elements[1] || '';
          const date = elements[2] || '';
          if (qual === '002' || qual === '017') {
            // 002 = delivery requested, 017 = estimated delivery
            expectedReturnDate = date;
          } else if (qual === '007' || qual === '050' || qual === '097') {
            requestDate = date;
          }
        } else if (tag === 'N1') {
          // N1*entityCode*name*idQualifier*id
          const entityCode = elements[1] || '';
          if (entityCode === 'SH' || entityCode === 'VN' || entityCode === 'RI') {
            // SH=Shipper (customer), VN=Vendor, RI=Remit To
            customerName = elements[2] || '';
            customerId = elements[4] || '';
          }
        } else if (tag === 'LX') {
          // LX starts a new line group
          if (currentLine) lines.push(currentLine);
          lineNumberCounter++;
          currentLine = {
            lineNumber: parseInt(elements[1] || String(lineNumberCounter)) || lineNumberCounter,
            sku: '',
            quantity: 0,
          };
        } else if (tag === 'LQ' && currentLine) {
          // LQ*codeSource*industryCode - reason code per line
          const code = elements[2] || '';
          currentLine.reasonCode = this.mapReasonCode(code);
          if (!returnReason) returnReason = this.mapReasonCode(code);
        } else if (tag === 'SLN' && currentLine) {
          // SLN*lineNumber*subLineNumber*indicator*qty*uom*unitPrice*basis*sku*...
          const qty = parseFloat(elements[4] || '0');
          const unitPrice = parseFloat(elements[6] || '0');
          currentLine.quantity = qty;
          if (unitPrice > 0) currentLine.unitPriceCents = Math.round(unitPrice * 100);
          // SKU comes in as product-service-id
          const skuIdx = elements.findIndex((v: string) => v === 'VP' || v === 'SK' || v === 'UP');
          if (skuIdx > 0 && elements[skuIdx + 1]) {
            currentLine.sku = elements[skuIdx + 1];
          }
        } else if (tag === 'PO1') {
          // Alternative: PO1*lineNumber*qty*uom*unitPrice*basis*idQualifier*sku
          if (currentLine) lines.push(currentLine);
          lineNumberCounter++;
          const qty = parseFloat(elements[2] || '0');
          const unitPrice = parseFloat(elements[4] || '0');
          const skuIdx = elements.findIndex((v: string) => v === 'VP' || v === 'VN' || v === 'UP');
          const sku = skuIdx > 0 && elements[skuIdx + 1] ? elements[skuIdx + 1] : (elements[7] || '');
          currentLine = {
            lineNumber: parseInt(elements[1] || String(lineNumberCounter)) || lineNumberCounter,
            sku,
            quantity: qty,
            ...(unitPrice > 0 ? { unitPriceCents: Math.round(unitPrice * 100) } : {}),
          };
        } else if (tag === 'MSG') {
          // MSG*text - free text, treated as customer notes or line condition notes
          const text = elements[1] || '';
          if (currentLine) {
            currentLine.conditionNotes = (currentLine.conditionNotes ? currentLine.conditionNotes + '; ' : '') + text;
          } else {
            customerNotes = customerNotes ? customerNotes + '; ' + text : text;
          }
        }
      }

      if (currentLine) lines.push(currentLine);

      if (lines.length === 0) {
        warnings.push('No line items found in EDI 180 document');
      }

      // Validate required fields
      if (!customerRmaNumber) {
        warnings.push('No customer RMA number provided - we will generate one');
      }
      if (!originalOrderNumber) {
        errors.push('Original order number (REF*PO or REF*IV) is required');
      }

      for (const line of lines) {
        if (!line.sku) {
          errors.push(`Line ${line.lineNumber} is missing SKU`);
        }
        if (line.quantity <= 0) {
          errors.push(`Line ${line.lineNumber} has invalid quantity ${line.quantity}`);
        }
      }
    } catch (err) {
      errors.push(`Parse error: ${(err as Error).message}`);
    }

    return this.build({ transactionPurpose, customerRmaNumber, originalOrderNumber, requestDate, expectedReturnDate, customerName, customerId, returnReason, customerNotes, lines, content, errors, warnings });
  }

  private build(p: any): EDI180ParseResult {
    return {
      success: p.errors.length === 0,
      transactionPurpose: p.transactionPurpose,
      customerRmaNumber: p.customerRmaNumber,
      originalOrderNumber: p.originalOrderNumber,
      requestDate: p.requestDate,
      expectedReturnDate: p.expectedReturnDate,
      customerName: p.customerName,
      customerId: p.customerId,
      returnReason: p.returnReason || 'other',
      customerNotes: p.customerNotes,
      lines: p.lines,
      rawContent: p.content,
      errors: p.errors,
      warnings: p.warnings,
    };
  }
}
