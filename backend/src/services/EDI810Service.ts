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
  private t = '~';  // segment terminator
  private e = '*';  // element separator

  generateEDI810(invoice: EDI810InvoiceData, config?: EDI810Config): string {
    const segments: string[] = [];
    const controlNumber = config?.interchangeControlNumber || this.generateControlNumber();
    const senderId = config?.senderId || 'OPENTMS';
    const receiverId = config?.receiverId || 'CUSTOMER';

    // ISA — Interchange Control Header
    segments.push(this.buildISA(senderId, receiverId, controlNumber));

    // GS — Functional Group Header
    segments.push(this.buildGS(senderId, receiverId, controlNumber));

    // ST — Transaction Set Header (810)
    segments.push(`ST${this.e}810${this.e}0001`);

    // BIG — Beginning Segment for Invoice
    // BIG*invoice_date*invoice_number*po_date*po_number
    const invoiceDate = this.formatDate(invoice.invoiceDate);
    segments.push(
      `BIG${this.e}${invoiceDate}${this.e}${invoice.invoiceNumber}` +
      `${this.e}${this.e}${invoice.purchaseOrderNumber || ''}`
    );

    // N1 — Seller (SE = Selling Party)
    segments.push(`N1${this.e}SE${this.e}${invoice.seller.name}${this.e}92${this.e}${invoice.seller.id || senderId}`);
    if (invoice.seller.address1) {
      segments.push(`N3${this.e}${invoice.seller.address1}`);
    }
    if (invoice.seller.city) {
      segments.push(
        `N4${this.e}${invoice.seller.city}${this.e}${invoice.seller.state || ''}` +
        `${this.e}${invoice.seller.postalCode || ''}${this.e}${invoice.seller.country || 'US'}`
      );
    }

    // N1 — Buyer (BY = Buying Party)
    segments.push(`N1${this.e}BY${this.e}${invoice.buyer.name}${this.e}92${this.e}${invoice.buyer.id || receiverId}`);
    if (invoice.buyer.address1) {
      segments.push(`N3${this.e}${invoice.buyer.address1}`);
    }
    if (invoice.buyer.city) {
      segments.push(
        `N4${this.e}${invoice.buyer.city}${this.e}${invoice.buyer.state || ''}` +
        `${this.e}${invoice.buyer.postalCode || ''}${this.e}${invoice.buyer.country || 'US'}`
      );
    }

    // ITD — Terms of Sale/Deferred Payment
    // ITD*payment_type*terms_basis*terms_discount_percent*terms_discount_date*terms_net_days
    segments.push(`ITD${this.e}01${this.e}3${this.e}${this.e}${this.e}${invoice.paymentTermsDays}`);

    // Shipment references
    if (invoice.shipmentReferences) {
      for (const ref of invoice.shipmentReferences) {
        segments.push(`REF${this.e}SI${this.e}${ref}`);
      }
    }

    // CAD — Transport/carrier info
    if (invoice.carrier) {
      segments.push(
        `CAD${this.e}M${this.e}${this.e}${this.e}${this.e}${invoice.carrier.name}` +
        `${this.e}${this.e}${this.e}${this.e}${invoice.carrier.scacCode || ''}`
      );
    }

    // IT1 — Line items
    let segmentCount = 0;
    for (const item of invoice.lineItems) {
      // IT1*line_number*quantity_invoiced*unit*unit_price*basis*product_code*description
      const unitPriceDollars = (item.unitPriceCents / 100).toFixed(2);
      segments.push(
        `IT1${this.e}${item.lineNumber}${this.e}${item.quantity}${this.e}EA` +
        `${this.e}${unitPriceDollars}${this.e}PE` +
        `${this.e}${this.e}${item.description}`
      );

      // PID — Free-form description
      if (item.shipmentReference) {
        segments.push(`PID${this.e}F${this.e}${this.e}${this.e}${this.e}Shipment ${item.shipmentReference} - ${item.chargeType}`);
      }

      // L7 — freight class if LTL
      if (item.freightClass) {
        segments.push(`L7${this.e}${item.lineNumber}${this.e}${this.e}${this.e}${this.e}${this.e}${this.e}${item.freightClass}`);
      }

      segmentCount++;
    }

    // TDS — Total Monetary Value Summary
    // TDS*total_invoice_amount (in cents as X12 expects implied decimal)
    const totalDollars = (invoice.totalCents / 100).toFixed(2);
    segments.push(`TDS${this.e}${totalDollars}`);

    // CTT — Transaction Totals
    segments.push(`CTT${this.e}${invoice.lineItems.length}`);

    // SE — Transaction Set Trailer
    // Count segments from ST to SE inclusive
    const stIndex = segments.findIndex(s => s.startsWith('ST'));
    const seCount = segments.length - stIndex + 1; // +1 for SE itself
    segments.push(`SE${this.e}${seCount}${this.e}0001`);

    // GE — Functional Group Trailer
    segments.push(`GE${this.e}1${this.e}${controlNumber}`);

    // IEA — Interchange Control Trailer
    segments.push(`IEA${this.e}1${this.e}${controlNumber.padStart(9, '0')}`);

    return segments.map(s => s + this.t).join('\n');
  }

  private buildISA(senderId: string, receiverId: string, controlNumber: string): string {
    const now = new Date();
    const date = this.formatDateShort(now);
    const time = now.toISOString().slice(11, 13) + now.toISOString().slice(14, 16);

    return (
      `ISA${this.e}00${this.e}          ${this.e}00${this.e}          ` +
      `${this.e}ZZ${this.e}${senderId.padEnd(15)}` +
      `${this.e}ZZ${this.e}${receiverId.padEnd(15)}` +
      `${this.e}${date}${this.e}${time}` +
      `${this.e}U${this.e}00401${this.e}${controlNumber.padStart(9, '0')}` +
      `${this.e}0${this.e}P${this.e}>`
    );
  }

  private buildGS(senderId: string, receiverId: string, controlNumber: string): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toISOString().slice(11, 13) + now.toISOString().slice(14, 16);

    return (
      `GS${this.e}IN${this.e}${senderId}${this.e}${receiverId}` +
      `${this.e}${date}${this.e}${time}${this.e}${controlNumber}` +
      `${this.e}X${this.e}004010`
    );
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  private formatDateShort(d: Date): string {
    return d.toISOString().slice(2, 10).replace(/-/g, '');
  }

  private generateControlNumber(): string {
    return String(Math.floor(Math.random() * 999999999)).padStart(9, '0');
  }
}
