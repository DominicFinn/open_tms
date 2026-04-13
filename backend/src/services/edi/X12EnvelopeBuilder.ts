/**
 * Shared X12 Envelope Builder
 *
 * Generates ISA/GS/ST/SE/GE/IEA envelope segments around transaction content.
 * Used by all outbound EDI generators (204, 214, 810, 856, 997) to produce
 * consistent, valid X12 envelopes without each service duplicating the logic.
 *
 * ISA is fixed-width: every field must be padded to exact lengths.
 * GS, ST, SE, GE, IEA use standard element separators.
 */

import { X12EnvelopeConfig, TRANSACTION_TO_GS } from './types.js';

export class X12EnvelopeBuilder {
  private elementSep: string;
  private segmentTerm: string;
  private subElementSep: string;

  constructor(
    elementSeparator = '*',
    segmentTerminator = '~',
    subElementSeparator = ':',
  ) {
    this.elementSep = elementSeparator;
    this.segmentTerm = segmentTerminator;
    this.subElementSep = subElementSeparator;
  }

  /**
   * Wrap transaction body segments in a full ISA/GS/ST...SE/GE/IEA envelope.
   * @param bodySegments - Array of segment strings (WITHOUT terminators), e.g. ["B2*...", "L11*..."]
   * @param config - Envelope configuration
   * @returns Complete X12 document as a string with segment terminators
   */
  wrap(bodySegments: string[], config: X12EnvelopeConfig): string {
    const controlNumber = config.controlNumber || this.generateControlNumber();
    const date = config.date || new Date();
    const e = this.elementSep;

    const segments: string[] = [];

    // ISA
    segments.push(this.buildISA(config, controlNumber, date));

    // GS
    segments.push(this.buildGS(config, controlNumber, date));

    // ST
    const stControlNumber = '0001';
    segments.push(`ST${e}${config.transactionType}${e}${stControlNumber}`);

    // Body
    segments.push(...bodySegments);

    // SE - segment count includes ST and SE themselves
    const transactionSegmentCount = bodySegments.length + 2; // ST + body + SE
    segments.push(`SE${e}${transactionSegmentCount}${e}${stControlNumber}`);

    // GE
    segments.push(`GE${e}1${e}${controlNumber}`);

    // IEA
    segments.push(`IEA${e}1${e}${controlNumber.padStart(9, '0')}`);

    return segments.map(s => s + this.segmentTerm).join('\n');
  }

  /**
   * Build only the ISA segment (fixed-width fields).
   */
  buildISA(config: X12EnvelopeConfig, controlNumber: string, date?: Date): string {
    const d = date || new Date();
    const e = this.elementSep;
    const senderQual = config.senderQualifier || 'ZZ';
    const receiverQual = config.receiverQualifier || 'ZZ';
    const version = config.version || '00401';
    const usage = config.usageIndicator || 'P';

    return [
      'ISA',
      '00',                                                // ISA01: Auth Info Qualifier
      ' '.repeat(10),                                      // ISA02: Auth Info (10 chars)
      '00',                                                // ISA03: Security Info Qualifier
      ' '.repeat(10),                                      // ISA04: Security Info (10 chars)
      senderQual.padEnd(2),                                // ISA05: Sender Qualifier (2 chars)
      this.sanitize(config.senderId).padEnd(15),           // ISA06: Sender ID (15 chars)
      receiverQual.padEnd(2),                              // ISA07: Receiver Qualifier (2 chars)
      this.sanitize(config.receiverId).padEnd(15),         // ISA08: Receiver ID (15 chars)
      this.formatDateShort(d),                             // ISA09: Date YYMMDD
      this.formatTime(d),                                  // ISA10: Time HHMM
      'U',                                                 // ISA11: Repetition Separator
      version,                                             // ISA12: Version
      controlNumber.padStart(9, '0'),                      // ISA13: Control Number (9 digits)
      '0',                                                 // ISA14: Ack Requested
      usage,                                               // ISA15: Usage (P/T)
      this.subElementSep,                                  // ISA16: Sub-element separator
    ].join(e);
  }

  /**
   * Build only the GS segment.
   */
  buildGS(config: X12EnvelopeConfig, controlNumber: string, date?: Date): string {
    const d = date || new Date();
    const e = this.elementSep;
    const funcId = config.functionalIdentifier
      || TRANSACTION_TO_GS[config.transactionType]
      || 'ZZ';

    return [
      'GS',
      funcId,                          // GS01: Functional Identifier Code
      config.senderId,                 // GS02: Application Sender Code
      config.receiverId,               // GS03: Application Receiver Code
      this.formatDateLong(d),          // GS04: Date CCYYMMDD
      this.formatTime(d),              // GS05: Time HHMM
      controlNumber,                   // GS06: Group Control Number
      'X',                             // GS07: Responsible Agency Code
      '004010',                        // GS08: Version
    ].join(e);
  }

  // ── Formatting utilities (public so services can use them directly) ──

  /** Format date as YYMMDD (for ISA) */
  formatDateShort(date: Date): string {
    const y = date.getFullYear().toString().slice(2);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}${m}${d}`;
  }

  /** Format date as CCYYMMDD (for GS and transaction segments) */
  formatDateLong(date: Date): string {
    const y = date.getFullYear().toString();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}${m}${d}`;
  }

  /** Format time as HHMM */
  formatTime(date: Date): string {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}${m}`;
  }

  /** Remove X12 delimiter characters from a value and optionally truncate */
  sanitize(value: string | null | undefined, maxLength?: number): string {
    if (!value) return '';
    let clean = value.replace(/[*~:]/g, ' ').trim();
    if (maxLength && clean.length > maxLength) {
      clean = clean.substring(0, maxLength);
    }
    return clean;
  }

  /** Generate a control number from timestamp (avoids collisions better than Math.random) */
  generateControlNumber(): string {
    // Use last 9 digits of timestamp + random suffix for uniqueness
    const ts = Date.now().toString();
    return ts.slice(-9).padStart(9, '0');
  }

  /** Get the element separator */
  get e(): string {
    return this.elementSep;
  }

  /** Get the segment terminator */
  get t(): string {
    return this.segmentTerm;
  }
}
