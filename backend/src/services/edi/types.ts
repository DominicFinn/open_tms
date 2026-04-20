/**
 * Shared EDI X12 types used across all EDI services.
 */

/** Standard result type for all EDI parse and generate operations */
export interface EdiOperationResult<T = string> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
}

/** Configuration for building an X12 envelope */
export interface X12EnvelopeConfig {
  /** ISA06: Interchange Sender ID (will be padded to 15 chars) */
  senderId: string;
  /** ISA08: Interchange Receiver ID (will be padded to 15 chars) */
  receiverId: string;
  /** ISA05: Sender ID Qualifier (default 'ZZ') */
  senderQualifier?: string;
  /** ISA07: Receiver ID Qualifier (default 'ZZ') */
  receiverQualifier?: string;
  /** ISA12: Version/Release code (default '00401') */
  version?: string;
  /** ISA15: Usage indicator - P=Production, T=Test (default 'P') */
  usageIndicator?: string;
  /** GS01: Functional Identifier Code (PO, SH, SM, GF, QM, IM, FA, IN, RA) */
  functionalIdentifier: string;
  /** ST01: Transaction Set Identifier Code (850, 856, 204, etc.) */
  transactionType: string;
  /** Override control number (default: timestamp-based) */
  controlNumber?: string;
  /** Override date for envelope timestamps (default: now) */
  date?: Date;
}

/** Parsed X12 segment: segment ID + elements array */
export interface X12Segment {
  /** Segment identifier (ISA, GS, ST, B10, AT7, etc.) */
  id: string;
  /** All elements including segment ID at index 0 */
  elements: string[];
  /** Original raw segment text */
  raw: string;
}

/** Result of parsing an X12 envelope */
export interface X12ParsedEnvelope {
  // ISA fields
  senderQualifier: string;
  senderId: string;
  receiverQualifier: string;
  receiverId: string;
  interchangeDate: string;
  interchangeTime: string;
  interchangeControlNumber: string;
  version: string;
  usageIndicator: string;

  // GS fields
  functionalIdentifier: string;
  applicationSenderId: string;
  applicationReceiverId: string;
  groupDate: string;
  groupTime: string;
  groupControlNumber: string;

  // ST fields
  transactionType: string;
  transactionControlNumber: string;

  // Transaction body segments (between ST and SE, exclusive)
  segments: X12Segment[];

  // For 997 generation - original control numbers
  controlNumbers: {
    isa: string;
    gs: string;
    st: string;
  };
}

/** Map of transaction type to GS functional identifier code */
export const TRANSACTION_TO_GS: Record<string, string> = {
  '850': 'PO',  // Purchase Order
  '855': 'PR',  // Purchase Order Acknowledgment
  '856': 'SH',  // Ship Notice / Manifest
  '204': 'SM',  // Motor Carrier Load Tender
  '990': 'GF',  // Response to Load Tender
  '214': 'QM',  // Transportation Carrier Shipment Status Message
  '210': 'IM',  // Motor Carrier Freight Details and Invoice
  '997': 'FA',  // Functional Acknowledgment
  '810': 'IN',  // Invoice
  '820': 'RA',  // Payment Order / Remittance Advice
  '180': 'RZ',  // Return Merchandise Authorization and Notification
  '940': 'OW',  // Warehouse Shipping Order (shipper -> 3PL warehouse)
  '945': 'SW',  // Warehouse Shipping Advice (3PL warehouse -> shipper)
};

/** Reverse map: GS functional identifier to transaction type */
export const GS_TO_TRANSACTION: Record<string, string> = Object.fromEntries(
  Object.entries(TRANSACTION_TO_GS).map(([k, v]) => [v, k])
);
