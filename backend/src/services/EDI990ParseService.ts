/**
 * EDI 990 (Response to Load Tender) Parse Service
 *
 * Parses inbound X12 990 documents to extract carrier responses.
 * The 990 is the carrier's response to an EDI 204 load tender.
 *
 * Key segments:
 *   B1 — Response header (carrier SCAC, shipment reference, response code)
 *   N9 — Reference numbers
 */

export interface EDI990ParseResult {
  success: boolean;
  responseCode: 'A' | 'D' | string;  // A=Accept, D=Decline
  shipmentReference: string;
  carrierScac: string;
  responseDate?: string;
  referenceNumbers: Array<{ qualifier: string; number: string }>;
  rawContent: string;
  errors: string[];
}

export interface IEDI990ParseService {
  parseEDI990(content: string): EDI990ParseResult;
}

export class EDI990ParseService implements IEDI990ParseService {
  parseEDI990(content: string): EDI990ParseResult {
    const errors: string[] = [];
    const referenceNumbers: Array<{ qualifier: string; number: string }> = [];
    let responseCode = '';
    let shipmentReference = '';
    let carrierScac = '';
    let responseDate = '';

    try {
      // Normalize content: handle both newline and tilde delimiters
      const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // Detect segment terminator
      let terminator = '~';
      if (normalized.includes('~')) {
        terminator = '~';
      }

      // Split into segments
      const rawSegments = normalized.split(terminator)
        .map(s => s.trim().replace(/^\n+/, ''))
        .filter(s => s.length > 0);

      // Detect element separator (usually *)
      const separator = '*';

      let foundST = false;
      let found990 = false;

      for (const rawSeg of rawSegments) {
        const elements = rawSeg.split(separator);
        const segId = elements[0]?.toUpperCase();

        if (segId === 'ST') {
          foundST = true;
          if (elements[1] === '990') {
            found990 = true;
          }
        }

        if (segId === 'B1') {
          // B1 segment: B1*SCAC*ShipmentRef*Date*ResponseCode
          carrierScac = elements[1] || '';
          shipmentReference = elements[2] || '';
          responseDate = elements[3] || '';

          // Response code may be in position 4 or in a separate segment
          // Some implementations put it in B1*SCAC*REF*DATE*CODE
          if (elements.length > 4) {
            responseCode = elements[4] || '';
          }
        }

        // Some implementations use N9 for additional reference numbers
        if (segId === 'N9') {
          const qualifier = elements[1] || '';
          const number = elements[2] || '';
          referenceNumbers.push({ qualifier, number });

          // Some carriers put the response in N9 with qualifier "AW" (acceptance)
          if (qualifier === 'AW' || qualifier === 'RD') {
            if (!responseCode) {
              responseCode = qualifier === 'AW' ? 'A' : 'D';
            }
          }
        }

        // L11 reference numbers (alternative format)
        if (segId === 'L11') {
          const number = elements[1] || '';
          const qualifier = elements[2] || '';
          referenceNumbers.push({ qualifier, number });
        }

        // Some implementations use SE2 or status segment for response
        if (segId === 'MS3') {
          // Interline info — may contain response indicator
          if (!carrierScac && elements[1]) {
            carrierScac = elements[1];
          }
        }
      }

      // Validate required fields
      if (!found990 && foundST) {
        errors.push('Transaction set is not 990');
      }

      if (!carrierScac) {
        errors.push('Missing carrier SCAC code in B1 segment');
      }

      if (!shipmentReference) {
        errors.push('Missing shipment reference in B1 segment');
      }

      if (!responseCode) {
        // Default interpretation: if we got a 990 with a B1 but no explicit code,
        // check if there's any indicator. Some older implementations are accept-only.
        errors.push('No response code found — could not determine accept/decline');
      }

      return {
        success: errors.length === 0,
        responseCode: responseCode.toUpperCase() as 'A' | 'D',
        shipmentReference,
        carrierScac,
        responseDate,
        referenceNumbers,
        rawContent: content,
        errors,
      };
    } catch (err: any) {
      return {
        success: false,
        responseCode: '',
        shipmentReference: '',
        carrierScac: '',
        referenceNumbers: [],
        rawContent: content,
        errors: [`Parse error: ${err.message}`],
      };
    }
  }
}
