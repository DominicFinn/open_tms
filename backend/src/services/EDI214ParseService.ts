/**
 * EDI 214 (Shipment Status Message) Parse Service
 *
 * Parses inbound X12 214 documents to extract carrier shipment status updates.
 * Carriers send 214s to report pickup, in-transit, delivery, and exception statuses.
 *
 * Key segments:
 *   B10 — Shipment identification (reference, carrier SCAC, pro number)
 *   L11 — Business reference numbers
 *   AT7 — Shipment status detail (status code, reason, date, time)
 *   MS1 — Equipment location (city, state, country)
 *   AT8 — Shipment weight and piece count
 */

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
}

export interface IEDI214ParseService {
  parseEDI214(content: string): EDI214ParseResult;
}

export class EDI214ParseService implements IEDI214ParseService {
  parseEDI214(content: string): EDI214ParseResult {
    const errors: string[] = [];
    const referenceNumbers: Array<{ qualifier: string; number: string }> = [];
    const statusDetails: EDI214StatusDetail[] = [];
    let shipmentReference = '';
    let carrierScac = '';
    let proNumber = '';
    let weight: { weight: number; qualifier: string; ladingQuantity?: number } | undefined;

    try {
      // Normalize content: handle both newline and tilde delimiters
      const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // Split into segments by tilde terminator
      const rawSegments = normalized.split('~')
        .map(s => s.trim().replace(/^\n+/, ''))
        .filter(s => s.length > 0);

      const separator = '*';
      let foundST = false;
      let found214 = false;

      // Track current AT7 to pair with following MS1
      let pendingStatus: Partial<EDI214StatusDetail> | null = null;

      for (const rawSeg of rawSegments) {
        const elements = rawSeg.split(separator);
        const segId = elements[0]?.toUpperCase();

        // ST — Transaction Set Header
        if (segId === 'ST') {
          foundST = true;
          if (elements[1] === '214') {
            found214 = true;
          }
        }

        // B10 — Shipment identification
        if (segId === 'B10') {
          shipmentReference = elements[1] || '';
          carrierScac = elements[2] || '';
          proNumber = elements[3] || '';
        }

        // L11 — Reference numbers
        if (segId === 'L11') {
          const number = elements[1] || '';
          const qualifier = elements[2] || '';
          if (number || qualifier) {
            referenceNumbers.push({ qualifier, number });
          }
        }

        // AT7 — Shipment status detail
        if (segId === 'AT7') {
          // Flush any pending status without MS1
          if (pendingStatus) {
            statusDetails.push(this.finalizePendingStatus(pendingStatus));
          }

          pendingStatus = {
            statusCode: elements[1] || '',
            reasonCode: elements[2] || '',
            // AT7 can have date/time in positions 5/6/7
            date: elements[5] || '',
            time: elements[6] || '',
            timeZone: elements[7] || '',
            city: '',
            state: '',
            country: '',
          };
        }

        // MS1 — Equipment location (follows AT7)
        if (segId === 'MS1') {
          const city = elements[1] || '';
          const state = elements[2] || '';
          const country = elements[3] || '';

          if (pendingStatus) {
            pendingStatus.city = city;
            pendingStatus.state = state;
            pendingStatus.country = country;
            statusDetails.push(this.finalizePendingStatus(pendingStatus));
            pendingStatus = null;
          }
        }

        // AT8 — Shipment weight
        if (segId === 'AT8') {
          const weightQualifier = elements[1] || '';
          const weightValue = parseFloat(elements[3] || '0');
          const ladingQty = elements[4] ? parseInt(elements[4], 10) : undefined;
          if (weightValue > 0) {
            weight = { weight: weightValue, qualifier: weightQualifier, ladingQuantity: ladingQty };
          }
        }

        // MS3 — Interline carrier info (fallback for SCAC)
        if (segId === 'MS3') {
          if (!carrierScac && elements[1]) {
            carrierScac = elements[1];
          }
        }
      }

      // Flush any remaining pending status
      if (pendingStatus) {
        statusDetails.push(this.finalizePendingStatus(pendingStatus));
      }

      // Validation
      if (!found214 && foundST) {
        errors.push('Transaction set is not 214');
      }

      if (!carrierScac) {
        errors.push('Missing carrier SCAC code in B10 segment');
      }

      if (!shipmentReference && !proNumber) {
        errors.push('Missing shipment reference and pro number in B10 segment');
      }

      if (statusDetails.length === 0) {
        errors.push('No AT7 status details found');
      }

      return {
        success: errors.length === 0,
        shipmentReference,
        carrierScac,
        proNumber,
        statusDetails,
        referenceNumbers,
        weight,
        rawContent: content,
        errors,
      };
    } catch (err: any) {
      return {
        success: false,
        shipmentReference: '',
        carrierScac: '',
        proNumber: '',
        statusDetails: [],
        referenceNumbers: [],
        rawContent: content,
        errors: [`Parse error: ${err.message}`],
      };
    }
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
