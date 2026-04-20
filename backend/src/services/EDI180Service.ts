/**
 * EDI 180 (Return Merchandise Authorization and Notification) Generation Service
 *
 * Generates outbound X12 180 documents to authorize a customer return.
 * Sent from the warehouse/TMS back to the customer confirming:
 *  - The RMA is authorized (or rejected, or cancelled)
 *  - Our RMA number they should reference
 *  - Which items are authorized, in what quantity
 *  - Return shipping instructions (where to send the goods back)
 *
 * Key segments:
 *   BGN  - Beginning segment (transaction purpose: 00=original, 11=response)
 *   REF  - Reference identifiers (our RMA number, original PO, customer RMA number)
 *   DTM  - Date/time (authorization date, expected return date)
 *   N1   - Party identification (shipTo = us, shipFrom = customer)
 *   N3   - Address line
 *   N4   - City, state, postal, country
 *   LX   - Transaction set line number
 *   LQ   - Return reason code
 *   SLN  - Subline detail with SKU, quantity, price
 *   MSG  - Message text (special instructions)
 */

import { X12EnvelopeBuilder } from './edi/X12EnvelopeBuilder.js';
import { EdiOperationResult } from './edi/types.js';

export interface EDI180LineData {
  lineNumber: number;
  sku: string;
  /** Quantity authorized to return (may be less than customer requested) */
  authorizedQuantity: number;
  unitPriceCents?: number;
  /** Our reason code / disposition guidance */
  reasonCode?: string;
  /** Special instructions for this line */
  notes?: string;
}

export interface EDI180Data {
  /** Our RMA number (RMA-2026-04-19-001) */
  rmaNumber: string;
  /** Customer's reference to their original order */
  originalOrderNumber: string;
  /** Customer's RMA number if they provided one (we echo it back) */
  customerRmaNumber?: string;
  /** Authorization date */
  authorizationDate: Date;
  /** Expected date the return must arrive back by */
  expectedReturnDate?: Date;
  /** 00=Original (normal authorization), 11=Response to request, 05=Replace */
  transactionPurpose: '00' | '11' | '05' | '01';

  /** Us (return receiver) */
  receiver: { name: string; id?: string; address1?: string; city?: string; state?: string; postalCode?: string; country?: string };
  /** Customer (return sender) */
  sender: { name: string; id?: string };

  lines: EDI180LineData[];

  /** Free-text instructions for the customer */
  instructions?: string;
}

export interface EDI180Config {
  senderId?: string;
  receiverId?: string;
  interchangeControlNumber?: string;
}

export interface IEDI180Service {
  generateEDI180(data: EDI180Data, config?: EDI180Config): string;
  validateAndGenerate(data: EDI180Data, config?: EDI180Config): EdiOperationResult<string>;
}

export class EDI180Service implements IEDI180Service {
  private envelope = new X12EnvelopeBuilder();

  validateAndGenerate(data: EDI180Data, config?: EDI180Config): EdiOperationResult<string> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.rmaNumber) errors.push('rmaNumber is required');
    if (!data.originalOrderNumber) errors.push('originalOrderNumber is required');
    if (!data.authorizationDate) errors.push('authorizationDate is required');
    if (!data.receiver?.name) errors.push('receiver.name is required');
    if (!data.sender?.name) errors.push('sender.name is required');
    if (!data.lines || data.lines.length === 0) errors.push('At least one line is required');

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    try {
      const content = this.generateEDI180(data, config);
      return { success: true, data: content, errors: [], warnings };
    } catch (err) {
      return { success: false, errors: [`Generation failed: ${(err as Error).message}`], warnings };
    }
  }

  generateEDI180(data: EDI180Data, config?: EDI180Config): string {
    const e = this.envelope.e;
    const senderId = config?.senderId || 'OPENTMS';
    const receiverId = config?.receiverId || 'CUSTOMER';
    const body: string[] = [];

    // BGN - Beginning Segment
    // BGN*transactionPurpose*rmaNumber*date*time
    body.push(
      `BGN${e}${data.transactionPurpose}${e}${data.rmaNumber}${e}${this.envelope.formatDateLong(data.authorizationDate)}`
    );

    // REF - Original PO number
    body.push(`REF${e}PO${e}${data.originalOrderNumber}`);

    // REF - Customer's RMA number (echo back)
    if (data.customerRmaNumber) {
      body.push(`REF${e}RMA${e}${data.customerRmaNumber}`);
    }

    // DTM - Authorization date
    body.push(`DTM${e}050${e}${this.envelope.formatDateLong(data.authorizationDate)}`);

    // DTM - Expected return-by date
    if (data.expectedReturnDate) {
      body.push(`DTM${e}017${e}${this.envelope.formatDateLong(data.expectedReturnDate)}`);
    }

    // N1 - Ship From (customer = sender of the return)
    body.push(`N1${e}SF${e}${this.envelope.sanitize(data.sender.name)}${e}92${e}${data.sender.id || receiverId}`);

    // N1 - Ship To (us = receiver of the return)
    body.push(`N1${e}ST${e}${this.envelope.sanitize(data.receiver.name)}${e}92${e}${data.receiver.id || senderId}`);
    if (data.receiver.address1) {
      body.push(`N3${e}${this.envelope.sanitize(data.receiver.address1, 55)}`);
    }
    if (data.receiver.city) {
      const n4Parts = [
        data.receiver.city ? this.envelope.sanitize(data.receiver.city, 30) : '',
        data.receiver.state || '',
        data.receiver.postalCode || '',
        data.receiver.country || '',
      ];
      body.push(`N4${e}${n4Parts.join(e)}`);
    }

    // Lines
    for (const line of data.lines) {
      // LX - Line group start
      body.push(`LX${e}${line.lineNumber}`);

      // LQ - Reason code per line (if provided)
      if (line.reasonCode) {
        body.push(`LQ${e}10${e}${line.reasonCode}`);
      }

      // SLN - Subline detail with SKU, qty, price
      const unitPrice = line.unitPriceCents != null ? (line.unitPriceCents / 100).toFixed(2) : '';
      body.push(
        `SLN${e}${line.lineNumber}${e}${e}I${e}${line.authorizedQuantity}${e}EA${e}${unitPrice}${e}${e}VP${e}${line.sku}`
      );

      // MSG - Notes for this line
      if (line.notes) {
        body.push(`MSG${e}${this.envelope.sanitize(line.notes, 80)}`);
      }
    }

    // Header-level instructions
    if (data.instructions) {
      body.push(`MSG${e}${this.envelope.sanitize(data.instructions, 80)}`);
    }

    // CTT - Transaction totals
    body.push(`CTT${e}${data.lines.length}`);

    return this.envelope.wrap(body, {
      senderId,
      receiverId,
      functionalIdentifier: 'RZ', // RZ = Return Merchandise Authorization (X12 functional identifier)
      transactionType: '180',
      controlNumber: config?.interchangeControlNumber,
    });
  }
}
