/**
 * EDI 940 (Warehouse Shipping Order) Parse Service
 *
 * Parses inbound X12 940 documents from a depositor (brand / shipper) instructing
 * the 3PL warehouse to ship goods out of inventory on their behalf.
 *
 * Typical flow:
 *   Depositor ERP → our WMS: 940 "Ship these 5 SKUs to Acme by Friday"
 *   We respond with a 945 once the pick/pack/ship is done.
 *
 * Key segments:
 *   W05  - Warehouse shipping order header (purpose code, depositor order #, PO, custom ref)
 *   N1*  - Names loop (ST=ship-to, SF=ship-from / depositor, WH=warehouse)
 *   N3   - Address line
 *   N4   - City/state/postal/country
 *   G62  - Date/time qualifier (10=requested ship, 11=cancel by)
 *   NTE  - Free-form notes / special instructions
 *   W66  - Shipment method of payment, carrier info
 *   LX   - Assigned line number (group start)
 *   W01  - Line-item detail (qty ordered, UOM, item number qualifier, SKU)
 *   G69  - Line description
 *   N9   - Reference identifier (lot, serial, customer PO line)
 *   W76  - Total quantities and weight (trailer summary)
 */

import { X12EnvelopeParser } from './edi/X12EnvelopeParser.js';

export interface EDI940Line {
  lineNumber: number;
  sku: string;
  orderedQuantity: number;
  uomCode: string;
  description?: string;
  customerLineRef?: string;
  lotNumber?: string;
}

export interface EDI940Address {
  name: string;
  partyQualifier: string;      // ST | SF | WH | DE | BY | etc.
  idCode?: string;              // N1-04 identifier
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface EDI940ParseResult {
  success: boolean;
  /** W05-01 purpose code: N=New, C=Cancel, R=Replace */
  purposeCode: string;
  /** W05-02 Depositor Order Number (the one from the depositor's ERP) */
  depositorOrderNumber: string;
  /** W05-03 Purchase Order Number (may equal depositor order) */
  purchaseOrderNumber: string;
  /** W05-04 Shipper's Reference */
  shipperReference: string;

  /** Requested ship date (ISO yyyy-mm-dd) or null if not present */
  requestedShipDate: string | null;
  /** Cancel-by date */
  cancelIfLateDate: string | null;

  /** Addresses keyed by partyQualifier (ST, SF, WH, etc.) */
  addresses: EDI940Address[];

  /** Free-form NTE notes merged together */
  notes: string;

  /** W66 carrier / service hints */
  carrierScac: string | null;
  serviceLevel: string | null;

  lines: EDI940Line[];

  rawContent: string;
  errors: string[];
  warnings: string[];
}

export interface IEDI940ParseService {
  parseEDI940(content: string): EDI940ParseResult;
}

export class EDI940ParseService implements IEDI940ParseService {
  private parser = new X12EnvelopeParser();

  parseEDI940(content: string): EDI940ParseResult {
    const result: EDI940ParseResult = {
      success: false,
      purposeCode: '',
      depositorOrderNumber: '',
      purchaseOrderNumber: '',
      shipperReference: '',
      requestedShipDate: null,
      cancelIfLateDate: null,
      addresses: [],
      notes: '',
      carrierScac: null,
      serviceLevel: null,
      lines: [],
      rawContent: content,
      errors: [],
      warnings: [],
    };

    const parsed = this.parser.parse(content);
    if (!parsed.envelope) {
      result.errors.push(...(parsed.errors.length > 0 ? parsed.errors : ['Invalid X12 envelope (missing ISA/GS/ST structure)']));
      return result;
    }
    const envelope = parsed.envelope;
    if (envelope.transactionType !== '940') {
      result.errors.push(`Expected ST*940 transaction, got ST*${envelope.transactionType}`);
      return result;
    }

    const notes: string[] = [];
    let currentAddress: EDI940Address | null = null;
    let currentLine: EDI940Line | null = null;

    const toIsoDate = (yyyymmdd: string): string | null => {
      if (!yyyymmdd || yyyymmdd.length !== 8) return null;
      return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
    };

    for (const seg of envelope.segments) {
      switch (seg.id) {
        case 'W05': {
          result.purposeCode = seg.elements[1] ?? '';
          result.depositorOrderNumber = seg.elements[2] ?? '';
          result.purchaseOrderNumber = seg.elements[3] ?? '';
          result.shipperReference = seg.elements[4] ?? '';
          break;
        }
        case 'G62': {
          // G62*dateQualifier*yyyymmdd
          const qualifier = seg.elements[1] ?? '';
          const dateStr = toIsoDate(seg.elements[2] ?? '');
          if (qualifier === '10' && dateStr) result.requestedShipDate = dateStr;
          if (qualifier === '11' && dateStr) result.cancelIfLateDate = dateStr;
          break;
        }
        case 'NTE': {
          // NTE*codeQualifier*noteText (we keep the text)
          const text = (seg.elements[2] ?? '').trim();
          if (text) notes.push(text);
          break;
        }
        case 'W66': {
          // W66*routingInstructionCode*tariffDescription*routingSequenceCode*transportationMethodCode*SCAC*...
          // SCAC is typically position 5
          result.carrierScac = seg.elements[5] ?? null;
          result.serviceLevel = seg.elements[1] ?? null;
          break;
        }
        case 'N1': {
          if (currentAddress) result.addresses.push(currentAddress);
          currentAddress = {
            partyQualifier: seg.elements[1] ?? '',
            name: seg.elements[2] ?? '',
            idCode: seg.elements[4] || undefined,
          };
          break;
        }
        case 'N3': {
          if (currentAddress) {
            currentAddress.address1 = seg.elements[1] ?? undefined;
            currentAddress.address2 = seg.elements[2] ?? undefined;
          }
          break;
        }
        case 'N4': {
          if (currentAddress) {
            currentAddress.city = seg.elements[1] || undefined;
            currentAddress.state = seg.elements[2] || undefined;
            currentAddress.postalCode = seg.elements[3] || undefined;
            currentAddress.country = seg.elements[4] || undefined;
          }
          break;
        }
        case 'LX': {
          // Flush any current line, start a new one
          if (currentLine) result.lines.push(currentLine);
          currentLine = {
            lineNumber: Number(seg.elements[1] ?? result.lines.length + 1),
            sku: '',
            orderedQuantity: 0,
            uomCode: 'EA',
          };
          break;
        }
        case 'W01': {
          // W01*qty*uom*idQualifier*itemNumber
          if (!currentLine) {
            currentLine = { lineNumber: result.lines.length + 1, sku: '', orderedQuantity: 0, uomCode: 'EA' };
          }
          currentLine.orderedQuantity = Number(seg.elements[1] ?? 0);
          currentLine.uomCode = seg.elements[2] || 'EA';
          currentLine.sku = seg.elements[4] ?? '';
          break;
        }
        case 'G69': {
          if (currentLine) currentLine.description = seg.elements[1] ?? undefined;
          break;
        }
        case 'N9': {
          // N9*qualifier*referenceId - at line level this is typically lot / customer line ref
          if (currentLine) {
            const qualifier = seg.elements[1] ?? '';
            const value = seg.elements[2] ?? '';
            if (qualifier === 'LT') currentLine.lotNumber = value;
            else if (qualifier === 'PD' || qualifier === 'CO') currentLine.customerLineRef = value;
          }
          break;
        }
        case 'W76': {
          // Trailer totals - we ignore for now; could cross-check line count
          break;
        }
      }
    }

    if (currentLine) result.lines.push(currentLine);
    if (currentAddress) result.addresses.push(currentAddress);

    result.notes = notes.join('\n');

    // Validation
    if (!result.depositorOrderNumber) result.errors.push('W05 depositor order number is missing');
    if (result.lines.length === 0) result.errors.push('No W01 line items found');
    for (const line of result.lines) {
      if (!line.sku) result.errors.push(`Line ${line.lineNumber} is missing SKU`);
      if (!line.orderedQuantity || line.orderedQuantity < 1) {
        result.errors.push(`Line ${line.lineNumber} has invalid quantity`);
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
