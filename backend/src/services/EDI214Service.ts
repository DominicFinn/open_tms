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
  private segmentTerminator = '~';
  private elementSeparator = '*';
  private subElementSeparator = ':';

  generateEDI214(data: EDI214ShipmentData, config?: EDI214Config): string {
    const segments: string[] = [];
    const controlNumber = config?.interchangeControlNumber || this.generateControlNumber();

    // ISA — Interchange Control Header
    segments.push(this.buildISA(config?.senderId || 'OPENTMS', config?.receiverId || data.carrierScac, controlNumber));

    // GS — Functional Group Header (QM = Shipment Status)
    segments.push(this.buildGS(config?.senderId || 'OPENTMS', config?.receiverId || data.carrierScac, controlNumber));

    // ST — Transaction Set Header (214)
    segments.push(`ST${this.e}214${this.e}0001`);

    // B10 — Shipment Identification
    segments.push(`B10${this.e}${this.sanitize(data.shipmentReference)}${this.e}${data.carrierScac}${this.e}${this.sanitize(data.proNumber || data.shipmentReference)}`);

    // L11 — Reference Numbers
    segments.push(`L11${this.e}${this.sanitize(data.shipmentReference)}${this.e}SI`);

    if (data.referenceNumbers) {
      for (const ref of data.referenceNumbers) {
        segments.push(`L11${this.e}${this.sanitize(ref.number)}${this.e}${ref.qualifier}`);
      }
    }

    // AT7 — Shipment Status Detail
    let at7 = `AT7${this.e}${data.statusCode}`;
    at7 += `${this.e}${data.reasonCode || ''}`;
    at7 += `${this.e}`;  // AT7-03 unused
    at7 += `${this.e}`;  // AT7-04 unused
    at7 += `${this.e}${this.formatDate(data.statusDate)}`;
    at7 += `${this.e}${this.formatTime(data.statusDate)}`;
    at7 += `${this.e}LT`; // Local time
    segments.push(at7);

    // MS1 — Equipment Location
    segments.push(`MS1${this.e}${this.sanitize(data.city)}${this.e}${data.state || ''}${this.e}${data.country || 'US'}`);

    // AT8 — Shipment Weight
    if (data.weight) {
      const unit = (data.weightUnit || 'L').toUpperCase() === 'K' ? 'K' : 'L';
      let at8 = `AT8${this.e}G${this.e}${unit}${this.e}${data.weight}`;
      if (data.ladingQuantity) {
        at8 += `${this.e}${data.ladingQuantity}`;
      }
      segments.push(at8);
    }

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
      'QM',                                        // Functional ID (QM = Shipment Status)
      senderId,
      receiverId,
      this.formatDate(now),
      this.formatTime(now),
      controlNumber,
      'X',                                         // Responsible Agency
      '004010',                                    // Version
    ].join(this.elementSeparator);
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
    return str.replace(/[*~:]/g, ' ').trim();
  }

  private generateControlNumber(): string {
    return Math.floor(Math.random() * 999999999).toString().padStart(9, '0');
  }
}
