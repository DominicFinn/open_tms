/**
 * EDI 810 (Invoice) Generation Service
 *
 * Generates outbound X12 810 documents to send invoices to customers via EDI.
 * The 810 is the standard electronic invoice sent from seller (TMS/shipper)
 * to buyer (customer).
 *
 * Key segments:
 *   BIG  — Invoice header (date, invoice number, PO number)
 *   N1   — Party identification (seller, buyer, ship-from, ship-to)
 *   N3/N4 — Address details
 *   ITD  — Terms of sale (payment terms, due date)
 *   IT1  — Line item (quantity, unit price, product ID)
 *   TDS  — Total monetary value summary
 *   CAD  — Transport data (carrier, routing)
 *   CTT  — Transaction totals
 */

import { X12EnvelopeBuilder } from './edi/X12EnvelopeBuilder.js';

export interface EDI810InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  paymentTermsDays: number;
  currency: string;

  // Seller (us)
  seller: {
    name: string;
    id?: string;
    address1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  // Buyer (customer)
  buyer: {
    name: string;
    id?: string;
    address1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  // Line items
  lineItems: Array<{
    lineNumber: number;
    description: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    chargeType: string;
    shipmentReference?: string;
    freightClass?: string;
  }>;

  // Totals
  subtotalCents: number;
  taxCents: number;
  totalCents: number;

  // Carrier info (optional)
  carrier?: {
    name: string;
    scacCode?: string;
  };

  // References
  purchaseOrderNumber?: string;
  shipmentReferences?: string[];
}

export interface EDI810Config {
  senderId?: string;
  receiverId?: string;
  interchangeControlNumber?: string;
}

export interface IEDI810Service {
  generateEDI810(invoice: EDI810InvoiceData, config?: EDI810Config): string;
}

export class EDI810Service implements IEDI810Service {
  private envelope = new X12EnvelopeBuilder();

  generateEDI810(invoice: EDI810InvoiceData, config?: EDI810Config): string {
    const e = this.envelope.e;
    const senderId = config?.senderId || 'OPENTMS';
    const receiverId = config?.receiverId || 'CUSTOMER';
    const bodySegments: string[] = [];

    // BIG — Beginning Segment for Invoice
    const invoiceDate = this.envelope.formatDateLong(invoice.invoiceDate);
    bodySegments.push(
      `BIG${e}${invoiceDate}${e}${invoice.invoiceNumber}` +
      `${e}${e}${invoice.purchaseOrderNumber || ''}`
    );

    // N1 — Seller (SE = Selling Party)
    bodySegments.push(`N1${e}SE${e}${invoice.seller.name}${e}92${e}${invoice.seller.id || senderId}`);
    if (invoice.seller.address1) {
      bodySegments.push(`N3${e}${invoice.seller.address1}`);
    }
    if (invoice.seller.city) {
      bodySegments.push(
        `N4${e}${invoice.seller.city}${e}${invoice.seller.state || ''}` +
        `${e}${invoice.seller.postalCode || ''}${e}${invoice.seller.country || 'US'}`
      );
    }

    // N1 — Buyer (BY = Buying Party)
    bodySegments.push(`N1${e}BY${e}${invoice.buyer.name}${e}92${e}${invoice.buyer.id || receiverId}`);
    if (invoice.buyer.address1) {
      bodySegments.push(`N3${e}${invoice.buyer.address1}`);
    }
    if (invoice.buyer.city) {
      bodySegments.push(
        `N4${e}${invoice.buyer.city}${e}${invoice.buyer.state || ''}` +
        `${e}${invoice.buyer.postalCode || ''}${e}${invoice.buyer.country || 'US'}`
      );
    }

    // ITD — Terms of Sale/Deferred Payment
    bodySegments.push(`ITD${e}01${e}3${e}${e}${e}${invoice.paymentTermsDays}`);

    // Shipment references
    if (invoice.shipmentReferences) {
      for (const ref of invoice.shipmentReferences) {
        bodySegments.push(`REF${e}SI${e}${ref}`);
      }
    }

    // CAD — Transport/carrier info
    if (invoice.carrier) {
      bodySegments.push(
        `CAD${e}M${e}${e}${e}${e}${invoice.carrier.name}` +
        `${e}${e}${e}${e}${invoice.carrier.scacCode || ''}`
      );
    }

    // IT1 — Line items
    for (const item of invoice.lineItems) {
      const unitPriceDollars = (item.unitPriceCents / 100).toFixed(2);
      bodySegments.push(
        `IT1${e}${item.lineNumber}${e}${item.quantity}${e}EA` +
        `${e}${unitPriceDollars}${e}PE` +
        `${e}${e}${item.description}`
      );

      // PID — Free-form description
      if (item.shipmentReference) {
        bodySegments.push(`PID${e}F${e}${e}${e}${e}Shipment ${item.shipmentReference} - ${item.chargeType}`);
      }

      // L7 — freight class if LTL
      if (item.freightClass) {
        bodySegments.push(`L7${e}${item.lineNumber}${e}${e}${e}${e}${e}${e}${item.freightClass}`);
      }
    }

    // TDS — Total Monetary Value Summary
    const totalDollars = (invoice.totalCents / 100).toFixed(2);
    bodySegments.push(`TDS${e}${totalDollars}`);

    // CTT — Transaction Totals
    bodySegments.push(`CTT${e}${invoice.lineItems.length}`);

    // Wrap in ISA/GS/ST/SE/GE/IEA envelope
    return this.envelope.wrap(bodySegments, {
      senderId,
      receiverId,
      functionalIdentifier: 'IN',
      transactionType: '810',
      controlNumber: config?.interchangeControlNumber,
    });
  }
}
