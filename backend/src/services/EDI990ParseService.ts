/**
 * EDI 990 (Response to Load Tender) Parse Service
 *
 * Parses inbound X12 990 documents to extract carrier responses.
 * Uses X12EnvelopeParser for envelope validation, then processes body segments.
 *
 * Key segments:
 *   B1 — Response header (carrier SCAC, shipment reference, response code)
 *   N9 — Reference numbers
 */

import { X12EnvelopeParser } from './edi/X12EnvelopeParser.js';

export interface EDI990ParseResult {
  success: boolean;
  responseCode: 'A' | 'D' | string;  // A=Accept, D=Decline
  shipmentReference: string;
  carrierScac: string;
  responseDate?: string;
  referenceNumbers: Array<{ qualifier: string; number: string }>;
  rawContent: string;
  errors: string[];
  warnings: string[];
}

export interface IEDI990ParseService {
  parseEDI990(content: string): EDI990ParseResult;
}

export class EDI990ParseService implements IEDI990ParseService {
  private envelopeParser = new X12EnvelopeParser();

  parseEDI990(content: string): EDI990ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const referenceNumbers: Array<{ qualifier: string; number: string }> = [];
    let responseCode = '';
    let shipmentReference = '';
    let carrierScac = '';
    let responseDate = '';

    try {
      // Parse envelope for validation
      const envelopeResult = this.envelopeParser.parse(content);
      warnings.push(...envelopeResult.warnings);

      if (!envelopeResult.success) {
        errors.push(...envelopeResult.errors);
        return this.buildResult({ responseCode, shipmentReference, carrierScac, responseDate, referenceNumbers, content, errors, warnings });
      }

      const envelope = envelopeResult.envelope!;

      if (envelope.transactionType !== '990') {
        errors.push(`Transaction set is not 990 (got ${envelope.transactionType})`);
        return this.buildResult({ responseCode, shipmentReference, carrierScac, responseDate, referenceNumbers, content, errors, warnings });
      }

      for (const seg of envelope.segments) {
        switch (seg.id) {
          case 'B1':
            // B1*SCAC*ShipmentRef*Date*ResponseCode
            carrierScac = seg.elements[1] || '';
            shipmentReference = seg.elements[2] || '';
            responseDate = seg.elements[3] || '';
            if (seg.elements.length > 4) {
              responseCode = seg.elements[4] || '';
            }
            break;

          case 'N9': {
            const qualifier = seg.elements[1] || '';
            const number = seg.elements[2] || '';
            referenceNumbers.push({ qualifier, number });
            // Some carriers put the response in N9 with qualifier "AW" (acceptance) or "RD" (rejection)
            if (qualifier === 'AW' || qualifier === 'RD') {
              if (!responseCode) {
                responseCode = qualifier === 'AW' ? 'A' : 'D';
              }
            }
            break;
          }

          case 'L11': {
            const number = seg.elements[1] || '';
            const qualifier = seg.elements[2] || '';
            referenceNumbers.push({ qualifier, number });
            break;
          }

          case 'MS3':
            if (!carrierScac && seg.elements[1]) {
              carrierScac = seg.elements[1];
            }
            break;
        }
      }

      // Validate required fields
      if (!carrierScac) {
        errors.push('Missing carrier SCAC code in B1 segment');
      }
      if (!shipmentReference) {
        errors.push('Missing shipment reference in B1 segment');
      }
      if (!responseCode) {
        errors.push('No response code found - could not determine accept/decline');
      }

      return this.buildResult({ responseCode, shipmentReference, carrierScac, responseDate, referenceNumbers, content, errors, warnings });
    } catch (err: any) {
      return this.buildResult({
        responseCode: '', shipmentReference: '', carrierScac: '',
        responseDate: '', referenceNumbers: [], content,
        errors: [`Parse error: ${err.message}`], warnings,
      });
    }
  }

  private buildResult(data: {
    responseCode: string; shipmentReference: string; carrierScac: string;
    responseDate?: string; referenceNumbers: Array<{ qualifier: string; number: string }>;
    content: string; errors: string[]; warnings: string[];
  }): EDI990ParseResult {
    return {
      success: data.errors.length === 0,
      responseCode: (data.responseCode.toUpperCase() || '') as 'A' | 'D',
      shipmentReference: data.shipmentReference,
      carrierScac: data.carrierScac,
      responseDate: data.responseDate,
      referenceNumbers: data.referenceNumbers,
      rawContent: data.content,
      errors: data.errors,
      warnings: data.warnings,
    };
  }
}
