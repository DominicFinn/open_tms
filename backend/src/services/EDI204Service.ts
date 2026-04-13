/**
 * EDI 204 (Motor Carrier Load Tender) Generation Service
 *
 * Generates outbound X12 204 documents from tender offers.
 * Follows the X12 004010 standard for Motor Carrier Load Tender.
 *
 * Key segments:
 *   B2/B2A — Shipment info and purpose code
 *   G62    — Dates (pickup, delivery, must-respond-by)
 *   N1/N3/N4 — Party identification (shipper, consignee)
 *   S5     — Stop details
 *   L5/AT8 — Commodity description and weight
 *   NTE    — Special instructions
 */

import { X12EnvelopeBuilder } from './edi/X12EnvelopeBuilder.js';
import { EdiOperationResult } from './edi/types.js';

export interface EDI204ShipmentData {
  // Shipment
  shipmentReference: string;
  pickupDate?: Date | null;
  deliveryDate?: Date | null;

  // Origin
  origin: {
    name: string;
    address1: string;
    address2?: string | null;
    city: string;
    state?: string | null;
    postalCode?: string | null;
    country: string;
  };

  // Destination
  destination: {
    name: string;
    address1: string;
    address2?: string | null;
    city: string;
    state?: string | null;
    postalCode?: string | null;
    country: string;
  };

  // Stops (optional intermediate stops)
  stops?: Array<{
    sequenceNumber: number;
    stopType: string; // pickup, delivery, both
    location: {
      name: string;
      address1: string;
      city: string;
      state?: string | null;
      postalCode?: string | null;
      country: string;
    };
  }>;

  // Carrier
  carrierScac: string;

  // Tender details
  mustRespondBy: Date;
  equipmentType?: string;
  specialInstructions?: string;
  totalWeight?: number;
  weightUnit?: string;

  // Customer/billing
  customerName?: string;
}

export interface EDI204Config {
  senderId?: string;
  receiverId?: string;
  interchangeControlNumber?: string;
  purposeCode?: '00' | '01' | '04' | '05'; // Original, Cancel, Change, Replace
}

export interface IEDI204Service {
  generateEDI204(shipment: EDI204ShipmentData, config?: EDI204Config): string;
  validateAndGenerate(shipment: EDI204ShipmentData, config?: EDI204Config): EdiOperationResult<string>;
}

export class EDI204Service implements IEDI204Service {
  private envelope = new X12EnvelopeBuilder();

  /** Validate input and generate EDI 204, returning errors instead of crashing */
  validateAndGenerate(shipment: EDI204ShipmentData, config?: EDI204Config): EdiOperationResult<string> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!shipment.shipmentReference) errors.push('shipmentReference is required');
    if (!shipment.carrierScac) errors.push('carrierScac is required');
    if (shipment.carrierScac && (shipment.carrierScac.length < 2 || shipment.carrierScac.length > 4)) {
      warnings.push(`carrierScac "${shipment.carrierScac}" should be 2-4 characters`);
    }
    if (!shipment.origin?.city) errors.push('origin.city is required');
    if (!shipment.destination?.city) errors.push('destination.city is required');
    if (!shipment.mustRespondBy) errors.push('mustRespondBy date is required');

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    try {
      const ediContent = this.generateEDI204(shipment, config);
      return { success: true, data: ediContent, errors: [], warnings };
    } catch (err: any) {
      return { success: false, errors: [`Generation failed: ${err.message}`], warnings };
    }
  }

  generateEDI204(shipment: EDI204ShipmentData, config?: EDI204Config): string {
    const e = this.envelope.e;
    const purposeCode = config?.purposeCode || '00';
    const bodySegments: string[] = [];

    // B2 — Beginning Segment for Shipment Information
    bodySegments.push(`B2${e}${e}${shipment.carrierScac}${e}${shipment.shipmentReference}${e}${e}PP`);

    // B2A — Set Purpose
    bodySegments.push(`B2A${e}${purposeCode}`);

    // L11 — Reference Number
    bodySegments.push(`L11${e}${shipment.shipmentReference}${e}SI`);

    // G62 — Pickup Date
    if (shipment.pickupDate) {
      bodySegments.push(`G62${e}10${e}${this.envelope.formatDateLong(shipment.pickupDate)}`);
    }

    // G62 — Delivery Date
    if (shipment.deliveryDate) {
      bodySegments.push(`G62${e}02${e}${this.envelope.formatDateLong(shipment.deliveryDate)}`);
    }

    // G62 — Must Respond By
    bodySegments.push(`G62${e}64${e}${this.envelope.formatDateLong(shipment.mustRespondBy)}${e}${this.envelope.formatTime(shipment.mustRespondBy)}`);

    // AT8 — Shipment Weight
    if (shipment.totalWeight) {
      const unit = (shipment.weightUnit || 'lb').toUpperCase() === 'KG' ? 'K' : 'L';
      bodySegments.push(`AT8${e}G${e}${unit}${e}${shipment.totalWeight}`);
    }

    // NTE — Special Instructions
    if (shipment.specialInstructions) {
      bodySegments.push(`NTE${e}OTH${e}${this.envelope.sanitize(shipment.specialInstructions, 264)}`);
    }

    // Equipment type
    if (shipment.equipmentType) {
      const eqCode = this.mapEquipmentCode(shipment.equipmentType);
      bodySegments.push(`N7${e}${e}${e}${e}${e}${e}${e}${e}${e}${e}${e}${eqCode}`);
    }

    // ── Stop Details ──

    // S5 — Stop 1: Pickup (Origin)
    bodySegments.push(`S5${e}1${e}CL`); // CL = Complete Load pickup
    this.addPartySegments(bodySegments, 'SH', shipment.origin);

    // Intermediate stops
    if (shipment.stops && shipment.stops.length > 0) {
      for (const stop of shipment.stops) {
        const reasonCode = stop.stopType === 'pickup' ? 'CL' : 'CU';
        bodySegments.push(`S5${e}${stop.sequenceNumber + 1}${e}${reasonCode}`);
        this.addPartySegments(bodySegments, stop.stopType === 'pickup' ? 'SH' : 'CN', stop.location);
      }
    }

    // S5 — Last Stop: Delivery (Destination)
    const lastStopNum = (shipment.stops?.length || 0) + 2;
    bodySegments.push(`S5${e}${lastStopNum}${e}CU`); // CU = Complete Unload delivery
    this.addPartySegments(bodySegments, 'CN', shipment.destination);

    // Wrap in ISA/GS/ST/SE/GE/IEA envelope
    return this.envelope.wrap(bodySegments, {
      senderId: config?.senderId || 'OPENTMS',
      receiverId: config?.receiverId || shipment.carrierScac,
      functionalIdentifier: 'SM',
      transactionType: '204',
      controlNumber: config?.interchangeControlNumber,
    });
  }

  // ── Private helpers ──

  private addPartySegments(
    segments: string[],
    entityCode: string,
    location: { name: string; address1: string; address2?: string | null; city: string; state?: string | null; postalCode?: string | null; country: string },
  ): void {
    const e = this.envelope.e;

    // N1 — Party name
    segments.push(`N1${e}${entityCode}${e}${this.envelope.sanitize(location.name)}`);

    // N3 — Address
    let n3 = `N3${e}${this.envelope.sanitize(location.address1)}`;
    if (location.address2) {
      n3 += `${e}${this.envelope.sanitize(location.address2)}`;
    }
    segments.push(n3);

    // N4 — City, State, Zip
    segments.push(
      `N4${e}${this.envelope.sanitize(location.city)}${e}${location.state || ''}${e}${location.postalCode || ''}${e}${location.country || 'US'}`
    );
  }

  private mapEquipmentCode(equipmentType: string): string {
    const lower = equipmentType.toLowerCase();
    if (lower.includes('reefer') || lower.includes('refrigerat')) return 'RT';
    if (lower.includes('flatbed')) return 'FB';
    if (lower.includes('tanker')) return 'TK';
    if (lower.includes('van') || lower.includes('dry')) return 'TF';
    return 'TL'; // Trailer unspecified
  }
}
