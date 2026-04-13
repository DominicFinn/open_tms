/**
 * EDI 997 (Functional Acknowledgment) Service
 *
 * Generates outbound 997 acknowledgments for inbound EDI transactions.
 * Per X12 standard, every inbound transaction should receive a 997 confirming receipt.
 */

import { X12EnvelopeBuilder } from './edi/X12EnvelopeBuilder.js';
import { TRANSACTION_TO_GS } from './edi/types.js';

export interface EDI997Config {
  senderId?: string;
  receiverId?: string;
  originalTransactionType: string;
  originalControlNumber: string;
  accepted: boolean;
  errorCodes?: string[];
}

export interface IEDI997Service {
  generate997(config: EDI997Config): string;
  extractControlInfo(ediContent: string): { gsControlNumber: string; stControlNumber: string; transactionType: string } | null;
}

export class EDI997Service implements IEDI997Service {
  private envelope = new X12EnvelopeBuilder();

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
