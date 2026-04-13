/**
 * EDI 214 (Shipment Status Message) Parse Service
 *
 * Parses inbound X12 214 documents to extract carrier shipment status updates.
 * Carriers send 214s to report pickup, in-transit, delivery, and exception statuses.
 *
 * Uses X12EnvelopeParser for envelope validation, then processes body segments.
 *
 * Key segments:
 *   B10 — Shipment identification (reference, carrier SCAC, pro number)
 *   L11 — Business reference numbers
 *   AT7 — Shipment status detail (status code, reason, date, time)
 *   MS1 — Equipment location (city, state, country)
 *   AT8 — Shipment weight and piece count
 */

import { X12EnvelopeParser } from './edi/X12EnvelopeParser.js';
import type { X12Segment } from './edi/types.js';

export interface EDI214StatusDetail {
  /** AT7-01: Status code (AF, X1, D1, A7, etc.) */
  statusCode: string;
  /** AT7-02: Reason code */
  reasonCode: string;
  /** Location city (from AT7 or MS1) */
  city: string;
  /** Location state (from AT7 or MS1) */
  state: string;
  /** Location country */
  country: string;
  /** Date from AT7 (CCYYMMDD) */
  date: string;
  /** Time from AT7 (HHMM) */
  time: string;
  /** Time zone code from AT7 */
  timeZone: string;
}

export interface EDI214ParseResult {
  success: boolean;
  /** B10-01: Reference identification */
  shipmentReference: string;
  /** B10-02: Standard Carrier Alpha Code */
  carrierScac: string;
  /** B10-03: Pro number / shipment identifier */
  proNumber: string;
  /** Status updates (one or more AT7+MS1 pairs) */
  statusDetails: EDI214StatusDetail[];
  /** L11 reference numbers */
  referenceNumbers: Array<{ qualifier: string; number: string }>;
  /** AT8 weight info */
  weight?: { weight: number; qualifier: string; ladingQuantity?: number };
  /** Original raw content for audit */
  rawContent: string;
  /** Parse errors */
  errors: string[];
  /** Envelope validation warnings */
  warnings: string[];
}

export interface IEDI214ParseService {
  parseEDI214(content: string): EDI214ParseResult;
}

export class EDI214ParseService implements IEDI214ParseService {
  private envelopeParser = new X12EnvelopeParser();

  parseEDI214(content: string): EDI214ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const referenceNumbers: Array<{ qualifier: string; number: string }> = [];
    const statusDetails: EDI214StatusDetail[] = [];
    let shipmentReference = '';
    let carrierScac = '';
    let proNumber = '';
    let weight: { weight: number; qualifier: string; ladingQuantity?: number } | undefined;

    try {
      // Parse envelope first for validation
      const envelopeResult = this.envelopeParser.parse(content);
      warnings.push(...envelopeResult.warnings);

      if (!envelopeResult.success) {
        errors.push(...envelopeResult.errors);
        return this.buildResult(false, { shipmentReference, carrierScac, proNumber, statusDetails, referenceNumbers, weight, content, errors, warnings });
      }

      const envelope = envelopeResult.envelope!;

      // Validate transaction type
      if (envelope.transactionType !== '214') {
        errors.push(`Transaction set is not 214 (got ${envelope.transactionType})`);
        return this.buildResult(false, { shipmentReference, carrierScac, proNumber, statusDetails, referenceNumbers, weight, content, errors, warnings });
      }

      // Track current AT7 to pair with following MS1
      let pendingStatus: Partial<EDI214StatusDetail> | null = null;

      for (const seg of envelope.segments) {
        switch (seg.id) {
          case 'B10':
            shipmentReference = seg.elements[1] || '';
            carrierScac = seg.elements[2] || '';
            proNumber = seg.elements[3] || '';
            break;

          case 'L11': {
            const number = seg.elements[1] || '';
            const qualifier = seg.elements[2] || '';
            if (number || qualifier) {
              referenceNumbers.push({ qualifier, number });
            }
            break;
          }

          case 'AT7':
            // Flush any pending status without MS1
            if (pendingStatus) {
              statusDetails.push(this.finalizePendingStatus(pendingStatus));
            }
            pendingStatus = {
              statusCode: seg.elements[1] || '',
              reasonCode: seg.elements[2] || '',
              date: seg.elements[5] || '',
              time: seg.elements[6] || '',
              timeZone: seg.elements[7] || '',
              city: '',
              state: '',
              country: '',
            };
            break;

          case 'MS1':
            if (pendingStatus) {
              pendingStatus.city = seg.elements[1] || '';
              pendingStatus.state = seg.elements[2] || '';
              pendingStatus.country = seg.elements[3] || '';
              statusDetails.push(this.finalizePendingStatus(pendingStatus));
              pendingStatus = null;
            }
            break;

          case 'AT8': {
            const weightQualifier = seg.elements[1] || '';
            const weightValue = parseFloat(seg.elements[3] || '0');
            const ladingQty = seg.elements[4] ? parseInt(seg.elements[4], 10) : undefined;
            if (weightValue > 0) {
              weight = { weight: weightValue, qualifier: weightQualifier, ladingQuantity: ladingQty };
            }
            break;
          }

          case 'MS3':
            if (!carrierScac && seg.elements[1]) {
              carrierScac = seg.elements[1];
            }
            break;
        }
      }

      // Flush any remaining pending status
      if (pendingStatus) {
        statusDetails.push(this.finalizePendingStatus(pendingStatus));
      }

      // Validation
      if (!carrierScac) {
        errors.push('Missing carrier SCAC code in B10 segment');
      }
      if (!shipmentReference && !proNumber) {
        errors.push('Missing shipment reference and pro number in B10 segment');
      }
      if (statusDetails.length === 0) {
        errors.push('No AT7 status details found');
      }

      return this.buildResult(errors.length === 0, { shipmentReference, carrierScac, proNumber, statusDetails, referenceNumbers, weight, content, errors, warnings });
    } catch (err: any) {
      return this.buildResult(false, {
        shipmentReference: '', carrierScac: '', proNumber: '',
        statusDetails: [], referenceNumbers: [], weight: undefined,
        content, errors: [`Parse error: ${err.message}`], warnings,
      });
    }
  }

  private buildResult(success: boolean, data: {
    shipmentReference: string; carrierScac: string; proNumber: string;
    statusDetails: EDI214StatusDetail[]; referenceNumbers: Array<{ qualifier: string; number: string }>;
    weight?: { weight: number; qualifier: string; ladingQuantity?: number };
    content: string; errors: string[]; warnings: string[];
  }): EDI214ParseResult {
    return {
      success,
      shipmentReference: data.shipmentReference,
      carrierScac: data.carrierScac,
      proNumber: data.proNumber,
      statusDetails: data.statusDetails,
      referenceNumbers: data.referenceNumbers,
      weight: data.weight,
      rawContent: data.content,
      errors: data.errors,
      warnings: data.warnings,
    };
  }

  private finalizePendingStatus(pending: Partial<EDI214StatusDetail>): EDI214StatusDetail {
    return {
      statusCode: pending.statusCode || '',
      reasonCode: pending.reasonCode || '',
      city: pending.city || '',
      state: pending.state || '',
      country: pending.country || '',
      date: pending.date || '',
      time: pending.time || '',
      timeZone: pending.timeZone || '',
    };
  }
}
