/**
 * EDI 855 (Purchase Order Acknowledgment) Generation Service
 *
 * Generates outbound X12 855 documents to acknowledge receipt of a purchase order.
 * Sent from TMS to the customer/ERP to confirm the order was received and accepted,
 * accepted with changes, or rejected.
 *
 * Key segments:
 *   BAK   - Beginning segment (ack type, PO number, date)
 *   DTM   - Date/time reference (scheduled ship date, delivery date)
 *   N1    - Party identification (seller, buyer)
 *   PO1   - Line item acknowledgment (quantity, price, status)
 *   ACK   - Line item acknowledgment detail (accepted/backordered/rejected)
 *   CTT   - Transaction totals
 */

import { X12EnvelopeBuilder } from './edi/X12EnvelopeBuilder.js';
import { EdiOperationResult } from './edi/types.js';

export interface EDI855LineItem {
  lineNumber: number;
  quantityOrdered: number;
  quantityAcknowledged: number;
  unitPrice: number; // dollars
  sku: string;
  description?: string;
  /** IA=Item Accepted, IB=Item Backordered, IR=Item Rejected, IC=Item Accepted with Changes */
  ackStatus: 'IA' | 'IB' | 'IR' | 'IC';
  scheduledShipDate?: Date;
}

export interface EDI855Data {
  /** Original PO number being acknowledged */
  poNumber: string;
  /** Date the PO was received */
  poDate: Date;
  /** Date the acknowledgment is being sent */
  ackDate: Date;
  /** AC=Acknowledge with Detail, AD=Acknowledge with Detail and Change, RD=Reject with Detail */
  ackType: 'AC' | 'AD' | 'RD';

  seller: { name: string; id?: string };
  buyer: { name: string; id?: string };

  lineItems: EDI855LineItem[];

  scheduledShipDate?: Date;
  scheduledDeliveryDate?: Date;
}

export interface EDI855Config {
  senderId?: string;
  receiverId?: string;
  interchangeControlNumber?: string;
}

export interface IEDI855Service {
  generateEDI855(data: EDI855Data, config?: EDI855Config): string;
  validateAndGenerate(data: EDI855Data, config?: EDI855Config): EdiOperationResult<string>;
}

export class EDI855Service implements IEDI855Service {
  private envelope = new X12EnvelopeBuilder();

  validateAndGenerate(data: EDI855Data, config?: EDI855Config): EdiOperationResult<string> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.poNumber) errors.push('poNumber is required');
    if (!data.poDate) errors.push('poDate is required');
    if (!data.ackDate) errors.push('ackDate is required');
    if (!data.buyer?.name) errors.push('buyer.name is required');
    if (!data.lineItems || data.lineItems.length === 0) errors.push('At least one line item is required');

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    try {
      const ediContent = this.generateEDI855(data, config);
      return { success: true, data: ediContent, errors: [], warnings };
    } catch (err: any) {
      return { success: false, errors: [`Generation failed: ${err.message}`], warnings };
    }
  }

  generateEDI855(data: EDI855Data, config?: EDI855Config): string {
    const e = this.envelope.e;
    const senderId = config?.senderId || 'OPENTMS';
    const receiverId = config?.receiverId || 'CUSTOMER';
    const bodySegments: string[] = [];

    // BAK - Beginning Segment for PO Acknowledgment
    // BAK*ackType**poNumber*poDate
    bodySegments.push(
      `BAK${e}${data.ackType}${e}${e}${data.poNumber}${e}${this.envelope.formatDateLong(data.poDate)}`
    );

    // DTM - Acknowledgment date
    bodySegments.push(`DTM${e}004${e}${this.envelope.formatDateLong(data.ackDate)}`);

    // DTM - Scheduled ship date
    if (data.scheduledShipDate) {
      bodySegments.push(`DTM${e}010${e}${this.envelope.formatDateLong(data.scheduledShipDate)}`);
    }

    // DTM - Scheduled delivery date
    if (data.scheduledDeliveryDate) {
      bodySegments.push(`DTM${e}002${e}${this.envelope.formatDateLong(data.scheduledDeliveryDate)}`);
    }

    // N1 - Seller
    bodySegments.push(`N1${e}SE${e}${this.envelope.sanitize(data.seller.name)}${e}92${e}${data.seller.id || senderId}`);

    // N1 - Buyer
    bodySegments.push(`N1${e}BY${e}${this.envelope.sanitize(data.buyer.name)}${e}92${e}${data.buyer.id || receiverId}`);

    // PO1 + ACK line items
    for (const item of data.lineItems) {
      const unitPriceDollars = item.unitPrice.toFixed(2);

      // PO1 - Line item detail (mirrors the original PO's PO1)
      bodySegments.push(
        `PO1${e}${item.lineNumber}${e}${item.quantityOrdered}${e}EA${e}${unitPriceDollars}${e}PE${e}VN${e}${item.sku}`
      );

      // PID - Description
      if (item.description) {
        bodySegments.push(`PID${e}F${e}${e}${e}${e}${this.envelope.sanitize(item.description, 80)}`);
      }

      // ACK - Line item acknowledgment
      // ACK*ackStatus*quantityAcknowledged*EA*scheduledShipDate
      let ack = `ACK${e}${item.ackStatus}${e}${item.quantityAcknowledged}${e}EA`;
      if (item.scheduledShipDate) {
        ack += `${e}${e}${e}${e}068${e}${this.envelope.formatDateLong(item.scheduledShipDate)}`;
      }
      bodySegments.push(ack);
    }

    // CTT - Transaction totals
    bodySegments.push(`CTT${e}${data.lineItems.length}`);

    return this.envelope.wrap(bodySegments, {
      senderId,
      receiverId,
      functionalIdentifier: 'PR', // PR = Purchase Order Acknowledgment
      transactionType: '855',
      controlNumber: config?.interchangeControlNumber,
    });
  }
}
