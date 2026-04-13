/**
 * Shared EDI X12 Infrastructure
 *
 * Barrel export for envelope builder, parser, and types.
 */

export { X12EnvelopeBuilder } from './X12EnvelopeBuilder.js';
export { X12EnvelopeParser } from './X12EnvelopeParser.js';
export type { X12ParseResult } from './X12EnvelopeParser.js';
export type {
  EdiOperationResult,
  X12EnvelopeConfig,
  X12Segment,
  X12ParsedEnvelope,
} from './types.js';
export { TRANSACTION_TO_GS, GS_TO_TRANSACTION } from './types.js';
