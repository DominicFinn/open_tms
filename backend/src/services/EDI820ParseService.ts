/**
 * EDI 820 (Payment Order/Remittance Advice) Parse Service
 *
 * Parses inbound X12 820 documents from customers to record payments
 * against outstanding invoices. Uses X12EnvelopeParser for envelope validation.
 *
 * Key segments:
 *   BPR — Financial information (payment amount, method, date)
 *   TRN — Trace number (payment reference / check number)
 *   N1  — Party identification (payer = customer, payee = us)
 *   ENT — Entity (remittance detail group start)
 *   RMR — Remittance advice (invoice number, amount paid, balance)
 *   REF — Reference identification
 *   DTM — Date/time
 */

import { X12EnvelopeParser } from './edi/X12EnvelopeParser.js';

export interface EDI820RemittanceItem {
  invoiceNumber: string;
  amountPaidCents: number;
  balanceAfterCents: number | null;
  references: Array<{ qualifier: string; number: string }>;
}

export interface EDI820ParseResult {
  success: boolean;
  totalAmountCents: number;
  paymentMethod: string;
  paymentDate: string;
  paymentReference: string;
  payerName: string;
  payerId: string;
  remittanceItems: EDI820RemittanceItem[];
  rawContent: string;
  errors: string[];
  warnings: string[];
}

export interface IEDI820ParseService {
  parseEDI820(content: string): EDI820ParseResult;
}

export class EDI820ParseService implements IEDI820ParseService {
  private envelopeParser = new X12EnvelopeParser();

  parseEDI820(content: string): EDI820ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const remittanceItems: EDI820RemittanceItem[] = [];
    let totalAmountCents = 0;
    let paymentMethod = '';
    let paymentDate = '';
    let paymentReference = '';
    let payerName = '';
    let payerId = '';

    try {
      // Parse envelope for validation
      const envelopeResult = this.envelopeParser.parse(content);
      warnings.push(...envelopeResult.warnings);

      if (!envelopeResult.success) {
        errors.push(...envelopeResult.errors);
        return this.buildResult({ totalAmountCents, paymentMethod, paymentDate, paymentReference, payerName, payerId, remittanceItems, content, errors, warnings });
      }

      const envelope = envelopeResult.envelope!;

      if (envelope.transactionType !== '820') {
        errors.push('No ST*820 segment found - this does not appear to be an EDI 820 document');
        return this.buildResult({ totalAmountCents, paymentMethod, paymentDate, paymentReference, payerName, payerId, remittanceItems, content, errors, warnings });
      }

      // Track current remittance item being built
      let currentInvoiceNumber = '';
      let currentAmountPaid = 0;
      let currentBalance: number | null = null;
      let currentRefs: Array<{ qualifier: string; number: string }> = [];
      let inRemittanceGroup = false;

      for (const seg of envelope.segments) {
        switch (seg.id) {
          case 'BPR':
            totalAmountCents = Math.round(parseFloat(seg.elements[2] || '0') * 100);
            paymentMethod = this.mapPaymentMethod(seg.elements[4] || '');
            // Search backwards for a date-like element (8 digits starting with 20)
            for (let i = seg.elements.length - 1; i >= 5; i--) {
              if (seg.elements[i] && /^20\d{6}$/.test(seg.elements[i])) {
                paymentDate = seg.elements[i];
                break;
              }
            }
            break;

          case 'TRN':
            paymentReference = seg.elements[2] || '';
            break;

          case 'N1':
            if (seg.elements[1] === 'PR') {
              payerName = seg.elements[2] || '';
              payerId = seg.elements[4] || '';
            }
            break;

          case 'DTM':
            if (!paymentDate && seg.elements[2]) {
              paymentDate = seg.elements[2];
            }
            break;

          case 'ENT':
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
            currentInvoiceNumber = seg.elements[2] || '';
            currentAmountPaid = Math.round(parseFloat(seg.elements[4] || '0') * 100);
            if (seg.elements[5]) {
              currentBalance = Math.round(parseFloat(seg.elements[5]) * 100);
            }
            break;

          case 'REF':
            if (inRemittanceGroup && seg.elements[1] && seg.elements[2]) {
              currentRefs.push({ qualifier: seg.elements[1], number: seg.elements[2] });
            }
            break;
        }
      }

      // Save last remittance item
      if (inRemittanceGroup && currentInvoiceNumber) {
        remittanceItems.push({
          invoiceNumber: currentInvoiceNumber,
          amountPaidCents: currentAmountPaid,
          balanceAfterCents: currentBalance,
          references: currentRefs,
        });
      }

      // Fallback: if no ENT/RMR groups but we have RMR segments at top level
      if (remittanceItems.length === 0 && totalAmountCents > 0) {
        for (const seg of envelope.segments) {
          if (seg.id === 'RMR') {
            remittanceItems.push({
              invoiceNumber: seg.elements[2] || '',
              amountPaidCents: Math.round(parseFloat(seg.elements[4] || '0') * 100),
              balanceAfterCents: seg.elements[5] ? Math.round(parseFloat(seg.elements[5]) * 100) : null,
              references: [],
            });
          }
        }
      }

      if (totalAmountCents <= 0) {
        errors.push('Missing or zero payment amount in BPR segment');
      }
      if (remittanceItems.length === 0) {
        errors.push('No remittance items found - cannot determine which invoices were paid');
      }

    } catch (err) {
      errors.push(`Parse error: ${(err as Error).message}`);
    }

    return this.buildResult({ totalAmountCents, paymentMethod, paymentDate, paymentReference, payerName, payerId, remittanceItems, content, errors, warnings });
  }

  private buildResult(data: {
    totalAmountCents: number; paymentMethod: string; paymentDate: string;
    paymentReference: string; payerName: string; payerId: string;
    remittanceItems: EDI820RemittanceItem[]; content: string;
    errors: string[]; warnings: string[];
  }): EDI820ParseResult {
    return {
      success: data.errors.length === 0,
      totalAmountCents: data.totalAmountCents, paymentMethod: data.paymentMethod,
      paymentDate: data.paymentDate, paymentReference: data.paymentReference,
      payerName: data.payerName, payerId: data.payerId,
      remittanceItems: data.remittanceItems, rawContent: data.content,
      errors: data.errors, warnings: data.warnings,
    };
  }

  private mapPaymentMethod(code: string): string {
    const map: Record<string, string> = {
      'ACH': 'ach', 'CHK': 'check', 'FWT': 'wire',
      'BOP': 'wire', 'CCD': 'ach', 'CTX': 'ach',
    };
    return map[code] || code.toLowerCase() || 'ach';
  }
}
