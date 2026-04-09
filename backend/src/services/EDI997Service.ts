/**
 * EDI 997 (Functional Acknowledgment) Service
 *
 * Generates outbound 997 acknowledgments for inbound EDI transactions.
 * Per X12 standard, every inbound transaction should receive a 997 confirming receipt.
 */

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
  private e = '*';
  private t = '~';

  /**
   * Generate an EDI 997 Functional Acknowledgment
   */
  generate997(config: EDI997Config): string {
    const segments: string[] = [];
    const controlNumber = Math.floor(Math.random() * 999999999).toString().padStart(9, '0');
    const now = new Date();

    // ISA
    segments.push(this.buildISA(config.senderId || 'OPENTMS', config.receiverId || '', controlNumber, now));

    // GS — Functional Group (FA = Functional Acknowledgment)
    segments.push([
      'GS', 'FA',
      config.senderId || 'OPENTMS',
      config.receiverId || '',
      this.formatDate(now),
      this.formatTime(now),
      controlNumber.slice(0, 9),
      'X', '004010',
    ].join(this.e));

    // ST 997
    segments.push(`ST${this.e}997${this.e}0001`);

    // AK1 — Functional Group Response Header
    // AK1*{functionalId}*{gsControlNumber}
    const gsId = this.transactionTypeToGsId(config.originalTransactionType);
    segments.push(`AK1${this.e}${gsId}${this.e}${config.originalControlNumber}`);

    // AK9 — Functional Group Response Trailer
    // AK9*{ackCode}*{numberOfSetsIncluded}*{numberOfSetsReceived}*{numberOfSetsAccepted}
    const ackCode = config.accepted ? 'A' : 'R'; // A=Accepted, R=Rejected
    segments.push(`AK9${this.e}${ackCode}${this.e}1${this.e}1${this.e}${config.accepted ? '1' : '0'}`);

    // SE
    const segCount = segments.length - 2 + 1; // Exclude ISA/GS, include SE
    segments.push(`SE${this.e}${segCount}${this.e}0001`);

    // GE
    segments.push(`GE${this.e}1${this.e}${controlNumber.slice(0, 9)}`);

    // IEA
    segments.push(`IEA${this.e}1${this.e}${controlNumber}`);

    return segments.map(s => s + this.t).join('\n');
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

  // ── Private helpers ──

  private buildISA(senderId: string, receiverId: string, controlNumber: string, now: Date): string {
    return [
      'ISA', '00', '          ', '00', '          ',
      'ZZ', senderId.padEnd(15),
      'ZZ', receiverId.padEnd(15),
      this.formatDateISA(now), this.formatTime(now),
      'U', '00401', controlNumber, '0', 'P', ':',
    ].join(this.e);
  }

  private transactionTypeToGsId(txnType: string): string {
    const map: Record<string, string> = {
      '850': 'PO', '855': 'PR', '856': 'SH', '204': 'SM',
      '990': 'GF', '214': 'QM', '210': 'IM', '810': 'IN',
    };
    return map[txnType] || 'FA';
  }

  private formatDate(d: Date): string {
    return `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}`;
  }

  private formatDateISA(d: Date): string {
    return `${d.getFullYear().toString().slice(2)}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}`;
  }

  private formatTime(d: Date): string {
    return `${d.getHours().toString().padStart(2,'0')}${d.getMinutes().toString().padStart(2,'0')}`;
  }
}
