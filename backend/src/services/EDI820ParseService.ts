/**
 * EDI 820 (Payment Order/Remittance Advice) Parse Service
 *
 * Parses inbound X12 820 documents from customers to record payments
 * against outstanding invoices. The 820 tells us what the customer paid,
 * when, and which invoices the payment applies to.
 *
 * Key segments:
 *   BPR — Financial information (payment amount, method, date, bank details)
 *   TRN — Trace number (payment reference / check number)
 *   N1  — Party identification (payer = customer, payee = us)
 *   ENT — Entity (remittance detail group start)
 *   RMR — Remittance advice (invoice number, amount paid, amount due)
 *   REF — Reference identification (additional invoice/PO references)
 *   DTM — Date/time (payment date, invoice date)
 */

export interface EDI820RemittanceItem {
  /** RMR-02: Invoice number being paid */
  invoiceNumber: string;
  /** RMR-04: Amount paid against this invoice (in cents) */
  amountPaidCents: number;
  /** RMR-05: Outstanding balance after payment (in cents, if provided) */
  balanceAfterCents: number | null;
  /** REF references associated with this remittance */
  references: Array<{ qualifier: string; number: string }>;
}

export interface EDI820ParseResult {
  success: boolean;
  /** BPR-02: Total payment amount in cents */
  totalAmountCents: number;
  /** BPR-04: Payment method (ACH, CHK, FWT=wire, etc.) */
  paymentMethod: string;
  /** BPR-16: Payment date (CCYYMMDD) */
  paymentDate: string;
  /** TRN-02: Payment reference / trace number */
  paymentReference: string;
  /** Payer name from N1*PR */
  payerName: string;
  /** Payer ID from N1*PR */
  payerId: string;
  /** Individual remittance items (which invoices are being paid) */
  remittanceItems: EDI820RemittanceItem[];
  /** Raw content for audit */
  rawContent: string;
  /** Parse errors */
  errors: string[];
}

export interface IEDI820ParseService {
  parseEDI820(content: string): EDI820ParseResult;
}

export class EDI820ParseService implements IEDI820ParseService {
  parseEDI820(content: string): EDI820ParseResult {
    const errors: string[] = [];
    const remittanceItems: EDI820RemittanceItem[] = [];
    let totalAmountCents = 0;
    let paymentMethod = '';
    let paymentDate = '';
    let paymentReference = '';
    let payerName = '';
    let payerId = '';

    try {
      const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const rawSegments = normalized.split('~')
        .map(s => s.trim().replace(/^\n+/, ''))
        .filter(s => s.length > 0);

      const sep = '*';
      let foundST = false;
      let found820 = false;

      // Track current remittance item being built
      let currentInvoiceNumber = '';
      let currentAmountPaid = 0;
      let currentBalance: number | null = null;
      let currentRefs: Array<{ qualifier: string; number: string }> = [];
      let inRemittanceGroup = false;

      for (const rawSeg of rawSegments) {
        const elements = rawSeg.split(sep);
        const segId = elements[0]?.toUpperCase();

        switch (segId) {
          case 'ST':
            foundST = true;
            if (elements[1] === '820') found820 = true;
            break;

          case 'BPR':
            // BPR*C*amount*C*method*...*date
            // Payment date is typically the last non-empty element (position varies)
            totalAmountCents = Math.round(parseFloat(elements[2] || '0') * 100);
            paymentMethod = this.mapPaymentMethod(elements[4] || '');
            // Search backwards for a date-like element (8 digits, starts with 20)
            for (let i = elements.length - 1; i >= 5; i--) {
              if (elements[i] && /^20\d{6}$/.test(elements[i])) {
                paymentDate = elements[i];
                break;
              }
            }
            break;

          case 'TRN':
            // TRN*trace_type*reference_number*originating_company_id
            paymentReference = elements[2] || '';
            break;

          case 'N1':
            // N1*entity_code*name*id_code_qualifier*id_code
            if (elements[1] === 'PR') {
              // Payer (customer)
              payerName = elements[2] || '';
              payerId = elements[4] || '';
            }
            break;

          case 'DTM':
            // DTM*date_qualifier*date
            // 007 = effective date, 009 = process date
            if (!paymentDate && elements[2]) {
              paymentDate = elements[2];
            }
            break;

          case 'ENT':
            // ENT signals start of a remittance detail group
            // Save previous item if exists
            if (inRemittanceGroup && currentInvoiceNumber) {
              remittanceItems.push({
                invoiceNumber: currentInvoiceNumber,
                amountPaidCents: currentAmountPaid,
                balanceAfterCents: currentBalance,
                references: currentRefs,
              });
            }
            inRemittanceGroup = true;
            currentInvoiceNumber = '';
            currentAmountPaid = 0;
            currentBalance = null;
            currentRefs = [];
            break;

          case 'RMR':
            // RMR*reference_qualifier*invoice_number*payment_action*amount_paid*balance
            // RMR*IV*INV-20260401-0001*PO*1500.00*0.00
            currentInvoiceNumber = elements[2] || '';
            currentAmountPaid = Math.round(parseFloat(elements[4] || '0') * 100);
            if (elements[5]) {
              currentBalance = Math.round(parseFloat(elements[5]) * 100);
            }
            break;

          case 'REF':
            // REF*qualifier*number (within remittance group)
            if (inRemittanceGroup && elements[1] && elements[2]) {
              currentRefs.push({ qualifier: elements[1], number: elements[2] });
            }
            break;

          case 'SE':
            // End of transaction — save last remittance item
            if (inRemittanceGroup && currentInvoiceNumber) {
              remittanceItems.push({
                invoiceNumber: currentInvoiceNumber,
                amountPaidCents: currentAmountPaid,
                balanceAfterCents: currentBalance,
                references: currentRefs,
              });
            }
            break;
        }
      }

      // If no ENT/RMR groups found but we have a total, try to extract
      // invoice numbers from REF segments at the header level
      if (remittanceItems.length === 0 && totalAmountCents > 0) {
        // Check for a simple single-invoice payment
        for (const rawSeg of rawSegments) {
          const elements = rawSeg.split(sep);
          if (elements[0]?.toUpperCase() === 'RMR') {
            remittanceItems.push({
              invoiceNumber: elements[2] || '',
              amountPaidCents: Math.round(parseFloat(elements[4] || '0') * 100),
              balanceAfterCents: elements[5] ? Math.round(parseFloat(elements[5]) * 100) : null,
              references: [],
            });
          }
        }
      }

      if (!foundST || !found820) {
        errors.push('No ST*820 segment found — this does not appear to be an EDI 820 document');
      }

      if (totalAmountCents <= 0) {
        errors.push('Missing or zero payment amount in BPR segment');
      }

      if (remittanceItems.length === 0) {
        errors.push('No remittance items found — cannot determine which invoices were paid');
      }

    } catch (err) {
      errors.push(`Parse error: ${(err as Error).message}`);
    }

    return {
      success: errors.length === 0,
      totalAmountCents,
      paymentMethod,
      paymentDate,
      paymentReference,
      payerName,
      payerId,
      remittanceItems,
      rawContent: content,
      errors,
    };
  }

  private mapPaymentMethod(code: string): string {
    const map: Record<string, string> = {
      'ACH': 'ach',
      'CHK': 'check',
      'FWT': 'wire',
      'BOP': 'wire',
      'CCD': 'ach',
      'CTX': 'ach',
    };
    return map[code] || code.toLowerCase() || 'ach';
  }
}
