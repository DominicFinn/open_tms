/**
 * Shared X12 Envelope Parser
 *
 * Parses ISA/GS/ST/SE/GE/IEA envelope from raw EDI content, validates
 * structure, and extracts the transaction body segments for service-specific
 * parsing.
 *
 * Used by all inbound EDI parsers (210, 214, 820, 990, 997) to replace the
 * manual split('~') + skip-ISA-GS pattern with proper envelope validation.
 *
 * Key behaviour:
 * - Detects element separator from ISA segment (char at position 3)
 * - Detects segment terminator from end of ISA (always 106 chars)
 * - Validates ISA has 16 elements with correct fixed widths
 * - Validates GS and ST presence
 * - Validates SE segment count matches actual count
 * - Returns body segments (between ST and SE) for service-specific parsing
 */

import { X12ParsedEnvelope, X12Segment, GS_TO_TRANSACTION } from './types.js';

export interface X12ParseResult {
  success: boolean;
  envelope?: X12ParsedEnvelope;
  errors: string[];
  warnings: string[];
}

export class X12EnvelopeParser {
  /**
   * Parse raw EDI content into a structured envelope + body segments.
   *
   * Tolerant of real-world EDI quirks:
   * - Handles CRLF, CR, or LF line endings
   * - Handles missing ISA/GS (falls back to segment-only parsing)
   * - Trims whitespace from segments
   */
  parse(content: string): X12ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content || content.trim().length === 0) {
      return { success: false, errors: ['EDI content is empty'], warnings };
    }

    // Normalize line endings
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Detect separators from ISA if present
    const { elementSep, segmentTerm } = this.detectSeparators(normalized);

    // Split into raw segments
    const rawSegments = normalized
      .split(segmentTerm)
      .map(s => s.replace(/^\n+/, '').replace(/\n+$/, '').trim())
      .filter(s => s.length > 0);

    if (rawSegments.length === 0) {
      return { success: false, errors: ['No segments found in EDI content'], warnings };
    }

    // Parse all segments into structured form
    const allSegments: X12Segment[] = rawSegments.map(raw => {
      const elements = raw.split(elementSep);
      return { id: (elements[0] || '').toUpperCase(), elements, raw };
    });

    // Extract envelope segments
    const isa = allSegments.find(s => s.id === 'ISA');
    const gs = allSegments.find(s => s.id === 'GS');
    const st = allSegments.find(s => s.id === 'ST');
    const se = allSegments.find(s => s.id === 'SE');
    const ge = allSegments.find(s => s.id === 'GE');
    const iea = allSegments.find(s => s.id === 'IEA');

    // Validate ISA
    if (isa) {
      const isaErrors = this.validateISA(isa);
      if (isaErrors.length > 0) {
        warnings.push(...isaErrors.map(e => `ISA: ${e}`));
      }
    } else {
      warnings.push('No ISA segment found - envelope validation skipped');
    }

    // Validate GS
    if (gs) {
      const gsErrors = this.validateGS(gs);
      if (gsErrors.length > 0) {
        warnings.push(...gsErrors.map(e => `GS: ${e}`));
      }
    } else {
      warnings.push('No GS segment found - functional group validation skipped');
    }

    // ST is required
    if (!st) {
      errors.push('No ST (Transaction Set Header) segment found');
      return { success: false, errors, warnings };
    }

    // Extract transaction type
    const transactionType = st.elements[1] || '';
    const transactionControlNumber = st.elements[2] || '0001';

    if (!transactionType) {
      errors.push('ST segment missing transaction type (element 1)');
      return { success: false, errors, warnings };
    }

    // Extract body segments: everything between ST and SE
    const stIndex = allSegments.indexOf(st);
    const seIndex = se ? allSegments.indexOf(se) : allSegments.length;
    const bodySegments = allSegments.slice(stIndex + 1, seIndex);

    // Validate SE segment count
    if (se) {
      const declaredCount = parseInt(se.elements[1] || '0', 10);
      const actualCount = bodySegments.length + 2; // ST + body + SE
      if (declaredCount !== actualCount) {
        warnings.push(`SE segment count mismatch: declared ${declaredCount}, actual ${actualCount}`);
      }
    }

    // Build envelope result
    const envelope: X12ParsedEnvelope = {
      // ISA fields (with safe defaults)
      senderQualifier: isa?.elements[5]?.trim() || '',
      senderId: isa?.elements[6]?.trim() || '',
      receiverQualifier: isa?.elements[7]?.trim() || '',
      receiverId: isa?.elements[8]?.trim() || '',
      interchangeDate: isa?.elements[9]?.trim() || '',
      interchangeTime: isa?.elements[10]?.trim() || '',
      interchangeControlNumber: isa?.elements[13]?.trim() || '',
      version: isa?.elements[12]?.trim() || '00401',
      usageIndicator: isa?.elements[15]?.trim() || 'P',

      // GS fields
      functionalIdentifier: gs?.elements[1] || '',
      applicationSenderId: gs?.elements[2] || '',
      applicationReceiverId: gs?.elements[3] || '',
      groupDate: gs?.elements[4] || '',
      groupTime: gs?.elements[5] || '',
      groupControlNumber: gs?.elements[6] || '',

      // ST fields
      transactionType,
      transactionControlNumber,

      // Body
      segments: bodySegments,

      // Control numbers for 997 generation
      controlNumbers: {
        isa: isa?.elements[13]?.trim() || '',
        gs: gs?.elements[6] || '',
        st: transactionControlNumber,
      },
    };

    return { success: true, envelope, errors, warnings };
  }

  /**
   * Detect element separator and segment terminator from ISA.
   *
   * ISA is always the first segment and always has exactly 106 characters
   * (including the segment terminator). The element separator is the character
   * at position 3 (right after "ISA"). The segment terminator is after the
   * last ISA element.
   *
   * Falls back to * and ~ if ISA is not detectable.
   */
  detectSeparators(content: string): { elementSep: string; segmentTerm: string } {
    // Default separators
    let elementSep = '*';
    let segmentTerm = '~';

    // Clean leading whitespace/newlines to find ISA
    const trimmed = content.replace(/^[\s\n\r]+/, '');

    if (trimmed.length >= 4 && trimmed.substring(0, 3) === 'ISA') {
      elementSep = trimmed[3];

      // ISA has exactly 16 element separators (for 16 data elements).
      // ISA structure: ISA*01*02*03*04*05*06*07*08*09*10*11*12*13*14*15*16
      // Element 16 is the sub-element separator (single char).
      // The segment terminator immediately follows element 16's value.
      //
      // Count 16 element separator occurrences to find the start of the 16th element.
      let sepCount = 0;
      let i = 3; // start at first separator (position 3)
      while (i < trimmed.length && sepCount < 16) {
        if (trimmed[i] === elementSep) {
          sepCount++;
        }
        i++;
      }

      // i now points to the first char of element 16 (the sub-element separator).
      // Element 16 is a single character. The segment terminator is the char after it.
      if (i + 1 < trimmed.length) {
        const candidate = trimmed[i + 1];
        // Skip newlines - the actual terminator might be before the newline
        // or the newline itself might be the terminator in some implementations
        if (candidate === '\n' || candidate === '\r') {
          // Check if the char right at i+1 is a non-alphanumeric before the newline
          // For standard EDI, the terminator is ~ before newlines
          // If we hit a newline, check if ~ is common in the content
          if (content.includes('~')) {
            segmentTerm = '~';
          } else {
            segmentTerm = '\n';
          }
        } else if (candidate && !/[a-zA-Z0-9 ]/.test(candidate)) {
          segmentTerm = candidate;
        }
      }
    }

    return { elementSep, segmentTerm };
  }

  /**
   * Validate ISA segment structure.
   * ISA must have 16 elements (ISA + 16 data elements = 17 total including segment ID).
   * Several fields have fixed widths.
   */
  validateISA(isa: X12Segment): string[] {
    const errors: string[] = [];

    // ISA should have 17 elements (including "ISA" at position 0)
    if (isa.elements.length < 17) {
      errors.push(`Expected 17 elements, found ${isa.elements.length}`);
      return errors; // Can't validate further
    }

    // ISA01: Auth Info Qualifier (2 chars)
    if (isa.elements[1]?.length !== 2) {
      errors.push(`ISA01 (Auth Qualifier) should be 2 chars, got "${isa.elements[1]}"`);
    }

    // ISA02: Auth Info (10 chars)
    if (isa.elements[2]?.length !== 10) {
      errors.push(`ISA02 (Auth Info) should be 10 chars, got length ${isa.elements[2]?.length}`);
    }

    // ISA03: Security Info Qualifier (2 chars)
    if (isa.elements[3]?.length !== 2) {
      errors.push(`ISA03 (Security Qualifier) should be 2 chars, got "${isa.elements[3]}"`);
    }

    // ISA04: Security Info (10 chars)
    if (isa.elements[4]?.length !== 10) {
      errors.push(`ISA04 (Security Info) should be 10 chars, got length ${isa.elements[4]?.length}`);
    }

    // ISA06: Sender ID (15 chars)
    if (isa.elements[6]?.length !== 15) {
      errors.push(`ISA06 (Sender ID) should be 15 chars, got length ${isa.elements[6]?.length}`);
    }

    // ISA08: Receiver ID (15 chars)
    if (isa.elements[8]?.length !== 15) {
      errors.push(`ISA08 (Receiver ID) should be 15 chars, got length ${isa.elements[8]?.length}`);
    }

    // ISA13: Control Number (9 chars)
    if (isa.elements[13]?.trim().length === 0) {
      errors.push('ISA13 (Control Number) is empty');
    }

    return errors;
  }

  /**
   * Validate GS segment structure.
   */
  validateGS(gs: X12Segment): string[] {
    const errors: string[] = [];

    if (gs.elements.length < 9) {
      errors.push(`Expected 9 elements, found ${gs.elements.length}`);
      return errors;
    }

    if (!gs.elements[1]) {
      errors.push('GS01 (Functional Identifier) is empty');
    }

    if (!gs.elements[6]) {
      errors.push('GS06 (Group Control Number) is empty');
    }

    return errors;
  }

  /**
   * Quick type detection without full parse.
   * Looks for ST segment first, falls back to GS functional identifier.
   */
  detectTransactionType(content: string): string | null {
    // Try ST segment first
    const stMatch = content.match(/ST\*(\d{3})\*/);
    if (stMatch) return stMatch[1];

    // Fallback to GS functional identifier
    const gsMatch = content.match(/GS\*([A-Z]{2})\*/);
    if (gsMatch) {
      return GS_TO_TRANSACTION[gsMatch[1]] || null;
    }

    return null;
  }
}
