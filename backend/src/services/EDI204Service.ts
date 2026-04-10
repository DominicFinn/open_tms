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
}

export class EDI204Service implements IEDI204Service {
  private segmentTerminator = '~';
  private elementSeparator = '*';
  private subElementSeparator = ':';

  generateEDI204(shipment: EDI204ShipmentData, config?: EDI204Config): string {
    const segments: string[] = [];
    const controlNumber = config?.interchangeControlNumber || this.generateControlNumber();
    const purposeCode = config?.purposeCode || '00';

    // ISA — Interchange Control Header
    segments.push(this.buildISA(config?.senderId || 'OPENTMS', config?.receiverId || shipment.carrierScac, controlNumber));

    // GS — Functional Group Header
    segments.push(this.buildGS(config?.senderId || 'OPENTMS', config?.receiverId || shipment.carrierScac, controlNumber));

    // ST — Transaction Set Header (204)
    segments.push(`ST${this.e}204${this.e}0001`);

    // B2 — Beginning Segment for Shipment Information
    segments.push(`B2${this.e}${this.e}${shipment.carrierScac}${this.e}${shipment.shipmentReference}${this.e}${this.e}PP`);

    // B2A — Set Purpose
    segments.push(`B2A${this.e}${purposeCode}`);

    // L11 — Reference Number
    segments.push(`L11${this.e}${shipment.shipmentReference}${this.e}SI`);

    // G62 — Pickup Date
    if (shipment.pickupDate) {
      segments.push(`G62${this.e}10${this.e}${this.formatDate(shipment.pickupDate)}`);
    }

    // G62 — Delivery Date
    if (shipment.deliveryDate) {
      segments.push(`G62${this.e}02${this.e}${this.formatDate(shipment.deliveryDate)}`);
    }

    // G62 — Must Respond By
    segments.push(`G62${this.e}64${this.e}${this.formatDate(shipment.mustRespondBy)}${this.e}${this.formatTime(shipment.mustRespondBy)}`);

    // AT8 — Shipment Weight
    if (shipment.totalWeight) {
      const unit = (shipment.weightUnit || 'lb').toUpperCase() === 'KG' ? 'K' : 'L';
      segments.push(`AT8${this.e}G${this.e}${unit}${this.e}${shipment.totalWeight}`);
    }

    // NTE — Special Instructions
    if (shipment.specialInstructions) {
      segments.push(`NTE${this.e}OTH${this.e}${this.sanitize(shipment.specialInstructions).substring(0, 264)}`);
    }

    // Equipment type
    if (shipment.equipmentType) {
      const eqCode = this.mapEquipmentCode(shipment.equipmentType);
      segments.push(`N7${this.e}${this.e}${this.e}${this.e}${this.e}${this.e}${this.e}${this.e}${this.e}${this.e}${this.e}${eqCode}`);
    }

    // ── Stop Details ──

    // S5 — Stop 1: Pickup (Origin)
    segments.push(`S5${this.e}1${this.e}CL`); // CL = Complete Load pickup
    this.addPartySegments(segments, 'SH', shipment.origin);

    // Intermediate stops
    if (shipment.stops && shipment.stops.length > 0) {
      for (const stop of shipment.stops) {
        const reasonCode = stop.stopType === 'pickup' ? 'CL' : 'CU';
        segments.push(`S5${this.e}${stop.sequenceNumber + 1}${this.e}${reasonCode}`);
        this.addPartySegments(segments, stop.stopType === 'pickup' ? 'SH' : 'CN', stop.location);
      }
    }

    // S5 — Last Stop: Delivery (Destination)
    const lastStopNum = (shipment.stops?.length || 0) + 2;
    segments.push(`S5${this.e}${lastStopNum}${this.e}CU`); // CU = Complete Unload delivery
    this.addPartySegments(segments, 'CN', shipment.destination);

    // SE — Transaction Set Trailer
    const segmentCount = segments.length - 2 + 1; // Exclude ISA/GS, include SE
    segments.push(`SE${this.e}${segmentCount}${this.e}0001`);

    // GE — Functional Group Trailer
    segments.push(`GE${this.e}1${this.e}${controlNumber}`);

    // IEA — Interchange Control Trailer
    segments.push(`IEA${this.e}1${this.e}${controlNumber.padStart(9, '0')}`);

    return segments.map(s => s + this.segmentTerminator).join('\n');
  }

  // ── Private helpers ──

  private get e(): string {
    return this.elementSeparator;
  }

  private buildISA(senderId: string, receiverId: string, controlNumber: string): string {
    const now = new Date();
    return [
      'ISA',
      '00',                                        // Auth Info Qualifier
      '          ',                                 // Auth Info (10 chars)
      '00',                                        // Security Info Qualifier
      '          ',                                 // Security Info (10 chars)
      'ZZ',                                        // Sender Qualifier
      senderId.padEnd(15),                         // Sender ID (15 chars)
      'ZZ',                                        // Receiver Qualifier
      receiverId.padEnd(15),                       // Receiver ID (15 chars)
      this.formatDateISA(now),                     // Date YYMMDD
      this.formatTimeISA(now),                     // Time HHMM
      'U',                                         // Repetition Separator
      '00401',                                     // Version
      controlNumber.padStart(9, '0'),              // Control Number
      '0',                                         // Ack Requested
      'P',                                         // Usage (P=Production)
      this.subElementSeparator,                    // Sub-element separator
    ].join(this.elementSeparator);
  }

  private buildGS(senderId: string, receiverId: string, controlNumber: string): string {
    const now = new Date();
    return [
      'GS',
      'SM',                                        // Functional ID (SM = Motor Carrier Load Tender)
      senderId,
      receiverId,
      this.formatDate(now),
      this.formatTime(now),
      controlNumber,
      'X',                                         // Responsible Agency
      '004010',                                    // Version
    ].join(this.elementSeparator);
  }

  private addPartySegments(
    segments: string[],
    entityCode: string,
    location: { name: string; address1: string; address2?: string | null; city: string; state?: string | null; postalCode?: string | null; country: string },
  ): void {
    // N1 — Party name
    segments.push(`N1${this.e}${entityCode}${this.e}${this.sanitize(location.name)}`);

    // N3 — Address
    let n3 = `N3${this.e}${this.sanitize(location.address1)}`;
    if (location.address2) {
      n3 += `${this.e}${this.sanitize(location.address2)}`;
    }
    segments.push(n3);

    // N4 — City, State, Zip
    segments.push(
      `N4${this.e}${this.sanitize(location.city)}${this.e}${location.state || ''}${this.e}${location.postalCode || ''}${this.e}${location.country || 'US'}`
    );
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear().toString();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private formatDateISA(date: Date): string {
    const y = date.getFullYear().toString().slice(2);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private formatTime(date: Date): string {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}${m}`;
  }

  private formatTimeISA(date: Date): string {
    return this.formatTime(date);
  }

  private sanitize(str: string): string {
    // Remove characters that conflict with X12 delimiters
    return str.replace(/[*~:]/g, ' ').trim();
  }

  private mapEquipmentCode(equipmentType: string): string {
    const lower = equipmentType.toLowerCase();
    if (lower.includes('reefer') || lower.includes('refrigerat')) return 'RT';
    if (lower.includes('flatbed')) return 'FB';
    if (lower.includes('tanker')) return 'TK';
    if (lower.includes('van') || lower.includes('dry')) return 'TF';
    return 'TL'; // Trailer unspecified
  }

  private generateControlNumber(): string {
    return Math.floor(Math.random() * 999999999).toString().padStart(9, '0');
  }
}
