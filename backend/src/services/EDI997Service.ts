/**
 * EDI 997 (Functional Acknowledgment) Service
 *
 * Generates outbound 997 acknowledgments for inbound EDI transactions.
 * Per X12 standard, every inbound transaction should receive a 997 confirming receipt.
 */

import { X12EnvelopeBuilder } from './edi/X12EnvelopeBuilder.js';
import { X12EnvelopeParser } from './edi/X12EnvelopeParser.js';
import { TRANSACTION_TO_GS, GS_TO_TRANSACTION, EdiOperationResult } from './edi/types.js';

export interface EDI997Config {
  senderId?: string;
  receiverId?: string;
  originalTransactionType: string;
  originalControlNumber: string;
  accepted: boolean;
  errorCodes?: string[];
}

export interface EDI997ParseResult {
  success: boolean;
  /** AK9-01: A=Accepted, E=Accepted with Errors, R=Rejected */
  ackCode: string;
  accepted: boolean;
  /** AK1-01: Functional group identifier being acknowledged */
  functionalGroupId: string;
  /** AK1-02: Group control number being acknowledged */
  groupControlNumber: string;
  /** Resolved transaction type from AK1 functional group ID */
  acknowledgedTransactionType: string;
  /** AK9-02: Number of transaction sets included */
  setsIncluded: number;
  /** AK9-03: Number of sets received */
  setsReceived: number;
  /** AK9-04: Number of sets accepted */
  setsAccepted: number;
  errors: string[];
  warnings: string[];
}

export interface IEDI997Service {
  generate997(config: EDI997Config): string;
  validateAndGenerate(config: EDI997Config): EdiOperationResult<string>;
  parse997(content: string): EDI997ParseResult;
  extractControlInfo(ediContent: string): { gsControlNumber: string; stControlNumber: string; transactionType: string } | null;
}

export class EDI997Service implements IEDI997Service {
  private envelope = new X12EnvelopeBuilder();
  private envelopeParser = new X12EnvelopeParser();

  /**
   * Parse an inbound EDI 997 Functional Acknowledgment.
   * Extracts AK1 (what was acknowledged) and AK9 (accept/reject result).
   */
  parse997(content: string): EDI997ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let functionalGroupId = '';
    let groupControlNumber = '';
    let ackCode = '';
    let setsIncluded = 0;
    let setsReceived = 0;
    let setsAccepted = 0;

    try {
      const envelopeResult = this.envelopeParser.parse(content);
      warnings.push(...envelopeResult.warnings);

      if (!envelopeResult.success) {
        errors.push(...envelopeResult.errors);
        return { success: false, ackCode: '', accepted: false, functionalGroupId, groupControlNumber, acknowledgedTransactionType: '', setsIncluded, setsReceived, setsAccepted, errors, warnings };
      }

      const env = envelopeResult.envelope!;
      if (env.transactionType !== '997') {
        errors.push(`Transaction set is not 997 (got ${env.transactionType})`);
        return { success: false, ackCode: '', accepted: false, functionalGroupId, groupControlNumber, acknowledgedTransactionType: '', setsIncluded, setsReceived, setsAccepted, errors, warnings };
      }

      for (const seg of env.segments) {
        switch (seg.id) {
          case 'AK1':
            // AK1*functionalGroupId*groupControlNumber
            functionalGroupId = seg.elements[1] || '';
            groupControlNumber = seg.elements[2] || '';
            break;
          case 'AK9':
            // AK9*ackCode*setsIncluded*setsReceived*setsAccepted
            ackCode = seg.elements[1] || '';
            setsIncluded = parseInt(seg.elements[2] || '0', 10);
            setsReceived = parseInt(seg.elements[3] || '0', 10);
            setsAccepted = parseInt(seg.elements[4] || '0', 10);
            break;
        }
      }

      if (!functionalGroupId) {
        errors.push('Missing AK1 segment - cannot determine which group is being acknowledged');
      }
      if (!ackCode) {
        errors.push('Missing AK9 segment - cannot determine accept/reject status');
      }

    } catch (err: any) {
      errors.push(`Parse error: ${err.message}`);
    }

    const acknowledgedTransactionType = GS_TO_TRANSACTION[functionalGroupId] || '';
    const accepted = ackCode === 'A' || ackCode === 'E';

    return {
      success: errors.length === 0,
      ackCode,
      accepted,
      functionalGroupId,
      groupControlNumber,
      acknowledgedTransactionType,
      setsIncluded,
      setsReceived,
      setsAccepted,
      errors,
      warnings,
    };
  }

  /** Validate input and generate EDI 997, returning errors instead of crashing */
  validateAndGenerate(config: EDI997Config): EdiOperationResult<string> {
    const errors: string[] = [];
    if (!config.originalTransactionType) errors.push('originalTransactionType is required');
    if (!config.originalControlNumber) errors.push('originalControlNumber is required');

    if (errors.length > 0) {
      return { success: false, errors, warnings: [] };
    }

    try {
      const ediContent = this.generate997(config);
      return { success: true, data: ediContent, errors: [], warnings: [] };
    } catch (err: any) {
      return { success: false, errors: [`Generation failed: ${err.message}`], warnings: [] };
    }
  }

  /**
   * Generate an EDI 997 Functional Acknowledgment
   */
  generate997(config: EDI997Config): string {
    const e = this.envelope.e;
    const bodySegments: string[] = [];

    // AK1 — Functional Group Response Header
    const gsId = TRANSACTION_TO_GS[config.originalTransactionType] || 'FA';
    bodySegments.push(`AK1${e}${gsId}${e}${config.originalControlNumber}`);

    // AK9 — Functional Group Response Trailer
    const ackCode = config.accepted ? 'A' : 'R'; // A=Accepted, R=Rejected
    bodySegments.push(`AK9${e}${ackCode}${e}1${e}1${e}${config.accepted ? '1' : '0'}`);

    // Wrap in ISA/GS/ST/SE/GE/IEA envelope
    return this.envelope.wrap(bodySegments, {
      senderId: config.senderId || 'OPENTMS',
      receiverId: config.receiverId || '',
      functionalIdentifier: 'FA',
      transactionType: '997',
    });
  }

  /**
   * Extract GS/ST control numbers and transaction type from raw EDI content.
   * Used to correlate a 997 response with the original transaction.
   */
  extractControlInfo(ediContent: string): { gsControlNumber: string; stControlNumber: string; transactionType: string } | null {
    const normalized = ediContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const segments = normalized.split(/[~\n]/).map(s => s.trim()).filter(s => s.length > 0);

    let gsControlNumber = '';
    let stControlNumber = '';
    let transactionType = '';

    for (const seg of segments) {
      const elements = seg.split('*');
      if (elements[0] === 'GS' && elements.length > 6) {
        gsControlNumber = elements[6];
      }
      if (elements[0] === 'ST' && elements.length > 2) {
        transactionType = elements[1];
        stControlNumber = elements[2];
      }
    }

    if (!transactionType) return null;
    return { gsControlNumber, stControlNumber, transactionType };
  }
}
