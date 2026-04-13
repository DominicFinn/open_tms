/**
 * EDI 214 (Shipment Status Message) Generation Service
 *
 * Generates outbound X12 214 documents to report shipment status
 * to customers or trading partners. Follows the X12 004010 standard.
 *
 * Key segments:
 *   B10  — Shipment identification (reference, SCAC, pro number)
 *   L11  — Reference numbers
 *   AT7  — Shipment status detail (status code, reason, date, time)
 *   MS1  — Equipment location (city, state, country)
 *   AT8  — Shipment weight and piece count
 */

import { X12EnvelopeBuilder } from './edi/X12EnvelopeBuilder.js';

export interface EDI214ShipmentData {
  shipmentReference: string;
  proNumber?: string;
  carrierScac: string;
  /** AT7 status code (AF, X1, D1, A7, etc.) */
  statusCode: string;
  /** AT7 reason code */
  reasonCode?: string;
  /** Location city */
  city: string;
  /** Location state */
  state: string;
  /** Location country */
  country?: string;
  /** When the status event occurred */
  statusDate: Date;
  /** Shipment weight */
  weight?: number;
  /** Weight unit (L=lbs, K=kg) */
  weightUnit?: string;
  /** Number of pieces */
  ladingQuantity?: number;
  /** Additional reference numbers */
  referenceNumbers?: Array<{ qualifier: string; number: string }>;
}

export interface EDI214Config {
  senderId?: string;
  receiverId?: string;
  interchangeControlNumber?: string;
}

export interface IEDI214Service {
  generateEDI214(data: EDI214ShipmentData, config?: EDI214Config): string;
}

export class EDI214Service implements IEDI214Service {
  private envelope = new X12EnvelopeBuilder();

  generateEDI214(data: EDI214ShipmentData, config?: EDI214Config): string {
    const e = this.envelope.e;
    const bodySegments: string[] = [];

    // B10 — Shipment Identification
    bodySegments.push(`B10${e}${this.envelope.sanitize(data.shipmentReference)}${e}${data.carrierScac}${e}${this.envelope.sanitize(data.proNumber || data.shipmentReference)}`);

    // L11 — Reference Numbers
    bodySegments.push(`L11${e}${this.envelope.sanitize(data.shipmentReference)}${e}SI`);

    if (data.referenceNumbers) {
      for (const ref of data.referenceNumbers) {
        bodySegments.push(`L11${e}${this.envelope.sanitize(ref.number)}${e}${ref.qualifier}`);
      }
    }

    // AT7 — Shipment Status Detail
    let at7 = `AT7${e}${data.statusCode}`;
    at7 += `${e}${data.reasonCode || ''}`;
    at7 += `${e}`;  // AT7-03 unused
    at7 += `${e}`;  // AT7-04 unused
    at7 += `${e}${this.envelope.formatDateLong(data.statusDate)}`;
    at7 += `${e}${this.envelope.formatTime(data.statusDate)}`;
    at7 += `${e}LT`; // Local time
    bodySegments.push(at7);

    // MS1 — Equipment Location
    bodySegments.push(`MS1${e}${this.envelope.sanitize(data.city)}${e}${data.state || ''}${e}${data.country || 'US'}`);

    // AT8 — Shipment Weight
    if (data.weight) {
      const unit = (data.weightUnit || 'L').toUpperCase() === 'K' ? 'K' : 'L';
      let at8 = `AT8${e}G${e}${unit}${e}${data.weight}`;
      if (data.ladingQuantity) {
        at8 += `${e}${data.ladingQuantity}`;
      }
      bodySegments.push(at8);
    }

    // Wrap in ISA/GS/ST/SE/GE/IEA envelope
    return this.envelope.wrap(bodySegments, {
      senderId: config?.senderId || 'OPENTMS',
      receiverId: config?.receiverId || data.carrierScac,
      functionalIdentifier: 'QM',
      transactionType: '214',
      controlNumber: config?.interchangeControlNumber,
    });
  }
}
