/**
 * EDI 210 (Motor Carrier Freight Details and Invoice) Parse Service
 *
 * Parses inbound X12 210 documents from carriers to extract freight invoice data.
 * Uses X12EnvelopeParser for envelope validation, then processes body segments.
 *
 * Key segments:
 *   B3   — Invoice header (invoice #, shipment ref, net amount, delivery date)
 *   N1   — Party identification (carrier, shipper, consignee)
 *   N9   — Reference numbers (PRO, BOL, PO)
 *   LX   — Line item start (assigned number)
 *   L5   — Description (commodity, NMFC, freight class)
 *   L0   — Line item detail (billed weight, volume, lading qty)
 *   L1   — Rate and charges (freight rate, charge amount, rate basis)
 *   L3   — Total weight and charges summary
 */

import { X12EnvelopeParser } from './edi/X12EnvelopeParser.js';

export interface EDI210LineItem {
  lineNumber: number;
  description: string;
  nmfcCode: string;
  freightClass: string;
  billedWeight: number;
  weightUnit: string;
  ladingQuantity: number;
  chargeAmountCents: number;
  rateBasis: string;
  rate: number;
  chargeType: string;
}

export interface EDI210ParseResult {
  success: boolean;
  invoiceNumber: string;
  shipmentReference: string;
  netAmountCents: number;
  deliveryDate: string;
  paymentMethod: string;
  carrierScac: string;
  referenceNumbers: Array<{ qualifier: string; number: string }>;
  lineItems: EDI210LineItem[];
  totalWeight: number;
  totalChargesCents: number;
  rawContent: string;
  errors: string[];
  warnings: string[];
}

export interface IEDI210ParseService {
  parseEDI210(content: string): EDI210ParseResult;
}

export class EDI210ParseService implements IEDI210ParseService {
  private envelopeParser = new X12EnvelopeParser();

  parseEDI210(content: string): EDI210ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const referenceNumbers: Array<{ qualifier: string; number: string }> = [];
    const lineItems: EDI210LineItem[] = [];
    let invoiceNumber = '';
    let shipmentReference = '';
    let netAmountCents = 0;
    let deliveryDate = '';
    let paymentMethod = '';
    let carrierScac = '';
    let totalWeight = 0;
    let totalChargesCents = 0;

    try {
      // Parse envelope for validation
      const envelopeResult = this.envelopeParser.parse(content);
      warnings.push(...envelopeResult.warnings);

      if (!envelopeResult.success) {
        errors.push(...envelopeResult.errors);
        return this.buildResult({ invoiceNumber, shipmentReference, netAmountCents, deliveryDate, paymentMethod, carrierScac, referenceNumbers, lineItems, totalWeight, totalChargesCents, content, errors, warnings });
      }

      const envelope = envelopeResult.envelope!;

      if (envelope.transactionType !== '210') {
        errors.push(`No ST*210 segment found - this does not appear to be an EDI 210 document`);
        return this.buildResult({ invoiceNumber, shipmentReference, netAmountCents, deliveryDate, paymentMethod, carrierScac, referenceNumbers, lineItems, totalWeight, totalChargesCents, content, errors, warnings });
      }

      // State for building line items across LX/L5/L0/L1 groups
      let currentLineNumber = 0;
      let currentDescription = '';
      let currentNmfc = '';
      let currentFreightClass = '';
      let currentWeight = 0;
      let currentWeightUnit = 'L';
      let currentLadingQty = 0;

      for (const seg of envelope.segments) {
        switch (seg.id) {
          case 'B3':
            invoiceNumber = seg.elements[2] || '';
            shipmentReference = seg.elements[3] || '';
            netAmountCents = Math.round(parseFloat(seg.elements[4] || '0') * 100);
            paymentMethod = seg.elements[5] || '';
            deliveryDate = seg.elements[6] || '';
            break;

          case 'N1':
            if (seg.elements[1] === 'CA') {
              carrierScac = seg.elements[4] || seg.elements[2] || '';
            }
            break;

          case 'N9':
            if (seg.elements[1] && seg.elements[2]) {
              referenceNumbers.push({ qualifier: seg.elements[1], number: seg.elements[2] });
            }
            break;

          case 'LX':
            currentLineNumber = parseInt(seg.elements[1] || '0', 10);
            currentDescription = '';
            currentNmfc = '';
            currentFreightClass = '';
            currentWeight = 0;
            currentWeightUnit = 'L';
            currentLadingQty = 0;
            break;

          case 'L5':
            currentDescription = seg.elements[2] || '';
            if (seg.elements[4] === 'NMFC' || seg.elements[4] === 'N') {
              currentNmfc = seg.elements[3] || seg.elements[5] || '';
            }
            currentFreightClass = seg.elements[5] || seg.elements[3] || '';
            break;

          case 'L0':
            currentWeight = parseFloat(seg.elements[4] || '0');
            currentWeightUnit = seg.elements[5] || 'L';
            currentLadingQty = parseInt(seg.elements[8] || '0', 10);
            break;

          case 'L1': {
            const chargeAmountCents = Math.round(parseFloat(seg.elements[4] || '0') * 100);
            const rate = parseFloat(seg.elements[2] || '0');
            const rateBasis = seg.elements[3] || '';
            const specialChargeCode = seg.elements[8] || '';

            let chargeType = 'linehaul';
            if (specialChargeCode) {
              const codeMap: Record<string, string> = {
                'FUE': 'fuel_surcharge', 'FSC': 'fuel_surcharge',
                'DET': 'detention', 'LUM': 'accessorial', 'LFT': 'accessorial',
                'RES': 'accessorial', 'INS': 'accessorial', 'MIN': 'linehaul',
              };
              chargeType = codeMap[specialChargeCode] || 'accessorial';
            }

            lineItems.push({
              lineNumber: currentLineNumber,
              description: currentDescription || `Line ${currentLineNumber}`,
              nmfcCode: currentNmfc, freightClass: currentFreightClass,
              billedWeight: currentWeight, weightUnit: currentWeightUnit,
              ladingQuantity: currentLadingQty,
              chargeAmountCents, rateBasis, rate, chargeType,
            });
            break;
          }

          case 'L3':
            totalWeight = parseFloat(seg.elements[1] || '0');
            totalChargesCents = Math.round(parseFloat(seg.elements[4] || seg.elements[3] || '0') * 100);
            break;
        }
      }

      if (!invoiceNumber) {
        errors.push('Missing B3 segment - no invoice number found');
      }

    } catch (err) {
      errors.push(`Parse error: ${(err as Error).message}`);
    }

    return this.buildResult({ invoiceNumber, shipmentReference, netAmountCents, deliveryDate, paymentMethod, carrierScac, referenceNumbers, lineItems, totalWeight, totalChargesCents: totalChargesCents || netAmountCents, content, errors, warnings });
  }

  private buildResult(data: {
    invoiceNumber: string; shipmentReference: string; netAmountCents: number;
    deliveryDate: string; paymentMethod: string; carrierScac: string;
    referenceNumbers: Array<{ qualifier: string; number: string }>;
    lineItems: EDI210LineItem[]; totalWeight: number; totalChargesCents: number;
    content: string; errors: string[]; warnings: string[];
  }): EDI210ParseResult {
    return {
      success: data.errors.length === 0,
      invoiceNumber: data.invoiceNumber, shipmentReference: data.shipmentReference,
      netAmountCents: data.netAmountCents, deliveryDate: data.deliveryDate,
      paymentMethod: data.paymentMethod, carrierScac: data.carrierScac,
      referenceNumbers: data.referenceNumbers, lineItems: data.lineItems,
      totalWeight: data.totalWeight, totalChargesCents: data.totalChargesCents,
      rawContent: data.content, errors: data.errors, warnings: data.warnings,
    };
  }
}
