/**
 * EDI 856 (Advance Ship Notice) Generation Service
 * Uses node-x12 library for ANSI X12 EDI 856 format documents
 */

import {
  X12Interchange,
  X12FunctionalGroup,
  X12Transaction,
  X12Generator
} from 'node-x12';

interface ShipmentData {
  id: string;
  reference: string;
  customer: {
    id: string;
    name: string;
  };
  origin: {
    id: string;
    name: string;
    address1: string;
    address2?: string | null;
    city: string;
    state?: string | null;
    postalCode?: string | null;
    country: string;
  };
  destination: {
    id: string;
    name: string;
    address1: string;
    address2?: string | null;
    city: string;
    state?: string | null;
    postalCode?: string | null;
    country: string;
  };
  carrier?: {
    id: string;
    name: string;
    mcNumber?: string | null;
    dotNumber?: string | null;
  } | null;
  pickupDate?: Date | null;
  deliveryDate?: Date | null;
  orderShipments?: Array<{
    order: {
      id: string;
      orderNumber: string;
      trackableUnits?: Array<{
        id: string;
        identifier: string;
        unitType: string;
        customTypeName?: string | null;
        sequenceNumber: number;
        lineItems: Array<{
          sku: string;
          description?: string | null;
          quantity: number;
          weight?: number | null;
        }>;
      }>;
      lineItems?: Array<{
        sku: string;
        description?: string | null;
        quantity: number;
        weight?: number | null;
      }>;
    };
  }>;
}

interface EDI856Config {
  senderId?: string;
  receiverId?: string;
  interchangeControlNumber?: string;
}

export class EDI856Service {
  /**
   * Generate EDI 856 document from shipment data using node-x12
   */
  generateEDI856(shipment: ShipmentData, config: EDI856Config = {}): string {
    const senderId = config.senderId || 'OPEN_TMS';
    const receiverId = config.receiverId || 'TRADING_PARTNER';
    const interchangeControlNumber = config.interchangeControlNumber || this.generateControlNumber();
    const groupControlNumber = this.generateControlNumber();
    const transactionControlNumber = this.generateControlNumber();

    // Create interchange
    const interchange = new X12Interchange({
      segmentTerminator: '~'
    });

    // Set ISA header
    const date = new Date();
    const dateStr = this.formatDateShort(date); // YYMMDD format (6 chars)
    const timeStr = this.formatTimeShort(date); // HHMM format (4 chars)
    
    interchange.setHeader([
      '00', // Authorization Information Qualifier
      '          ', // Authorization Information
      '00', // Security Information Qualifier
      '          ', // Security Information
      'ZZ', // Sender ID Qualifier
      this.padRight(senderId, 15), // Sender ID
      'ZZ', // Receiver ID Qualifier
      this.padRight(receiverId, 15), // Receiver ID
      dateStr, // Interchange Date (YYMMDD)
      timeStr, // Interchange Time (HHMM)
      '^', // Interchange Control Standards Identifier
      '00501', // Interchange Control Version Number
      this.padLeft(interchangeControlNumber, 9), // Interchange Control Number
      '0', // Acknowledgment Requested
      'P', // Usage Indicator
      '>' // Component Element Separator
    ]);

    // Create functional group
    const functionalGroup = interchange.addFunctionalGroup();

    // Set GS header
    const gsDate = new Date();
    functionalGroup.setHeader([
      'SH', // Functional Identifier Code
      this.padRight('SENDER_ID', 15), // Application Sender's Code
      this.padRight('RECEIVER_ID', 15), // Application Receiver's Code
      this.formatDate(gsDate), // Date (CCYYMMDD)
      this.formatTimeShort(gsDate), // Time (HHMM)
      this.padLeft(groupControlNumber, 9), // Group Control Number
      'X', // Responsible Agency Code
      '005010' // Version/Release/Industry Identifier
    ]);

    // Create transaction set (856)
    const transaction = functionalGroup.addTransaction();

    // Set ST header
    transaction.setHeader([
      '856', // Transaction Set Identifier Code
      this.padLeft(transactionControlNumber, 4) // Transaction Set Control Number
    ]);

    // BSN - Beginning Segment for Ship Notice
    const shipDate = shipment.pickupDate || new Date();
    transaction.addSegment('BSN', [
      '00', // Transaction Set Purpose Code
      shipment.reference, // Shipment Identification
      this.formatDate(shipDate), // Ship Date (CCYYMMDD)
      this.formatTimeShort(new Date()) // Ship Time (HHMM)
    ]);

    // DTM - Ship Date
    if (shipment.pickupDate) {
      transaction.addSegment('DTM', [
        '011', // Date Qualifier - Ship Date
        this.formatDate(shipment.pickupDate),
        '102' // Date Format - CCYYMMDD
      ]);
    }

    // DTM - Delivery Date
    if (shipment.deliveryDate) {
      transaction.addSegment('DTM', [
        '002', // Date Qualifier - Delivery Date Requested
        this.formatDate(shipment.deliveryDate),
        '102' // Date Format - CCYYMMDD
      ]);
    }

    // HL - Shipment Level
    transaction.addSegment('HL', [
      '1', // Hierarchical ID Number
      '', // Parent Hierarchical ID (none for shipment)
      'S', // Hierarchical Level Code - Shipment
      '1' // Hierarchical Child Code (has children)
    ]);

    // TD1 - Carrier Details
    if (shipment.carrier) {
      transaction.addSegment('TD1', [
        'CN', // Packaging Code
        shipment.carrier.mcNumber || shipment.carrier.name, // Lading Quantity
        shipment.carrier.name // Carrier Name
      ]);
    }

    // TD5 - Carrier Details (Routing Sequence/Transit Time)
    if (shipment.carrier) {
      transaction.addSegment('TD5', [
        'B', // Routing Sequence Code
        '2', // Identification Code Qualifier
        this.truncate(shipment.carrier.name, 30), // Carrier Name
        shipment.carrier.mcNumber || '', // Motor Carrier Number
        shipment.carrier.dotNumber || '' // DOT Number
      ]);
    }

    // N1 - Ship From (Origin)
    transaction.addSegment('N1', [
      'SF', // Entity Identifier Code - Ship From
      this.truncate(shipment.origin.name, 60) // Name
    ]);

    // N3 - Origin Address
    transaction.addSegment('N3', [
      this.truncate(shipment.origin.address1, 55),
      shipment.origin.address2 ? this.truncate(shipment.origin.address2, 55) : ''
    ]);

    // N4 - Origin Geographic Location
    transaction.addSegment('N4', [
      this.truncate(shipment.origin.city, 30),
      shipment.origin.state || '',
      this.truncate(shipment.origin.postalCode || '', 15),
      shipment.origin.country
    ]);

    // N1 - Ship To (Destination)
    transaction.addSegment('N1', [
      'ST', // Entity Identifier Code - Ship To
      this.truncate(shipment.destination.name, 60) // Name
    ]);

    // N3 - Destination Address
    transaction.addSegment('N3', [
      this.truncate(shipment.destination.address1, 55),
      shipment.destination.address2 ? this.truncate(shipment.destination.address2, 55) : ''
    ]);

    // N4 - Destination Geographic Location
    transaction.addSegment('N4', [
      this.truncate(shipment.destination.city, 30),
      shipment.destination.state || '',
      this.truncate(shipment.destination.postalCode || '', 15),
      shipment.destination.country
    ]);

    // REF - Shipment Reference
    transaction.addSegment('REF', [
      'BM', // Reference Identification Qualifier - Bill of Lading Number
      this.truncate(shipment.reference, 30)
    ]);

    // Process orders and trackable units
    let itemSequence = 1;
    let hlSequence = 2;

    if (shipment.orderShipments) {
      for (const orderShipment of shipment.orderShipments) {
        const order = orderShipment.order;

        // HL - Order Level
        transaction.addSegment('HL', [
          hlSequence.toString(), // Hierarchical ID
          '1', // Parent Hierarchical ID (shipment)
          'O', // Hierarchical Level Code - Order
          '1' // Has children
        ]);

        const orderHLSequence = hlSequence;
        hlSequence++;

        // REF - Purchase Order Number
        transaction.addSegment('REF', [
          'PO', // Reference Identification Qualifier - Purchase Order Number
          this.truncate(order.orderNumber, 30)
        ]);

        // Process trackable units
        if (order.trackableUnits && order.trackableUnits.length > 0) {
          for (const unit of order.trackableUnits) {
            // HL - Package Level
            transaction.addSegment('HL', [
              hlSequence.toString(), // Hierarchical ID
              orderHLSequence.toString(), // Parent Hierarchical ID (order)
              'P', // Hierarchical Level Code - Package
              '1' // Has children
            ]);

            const packageHLSequence = hlSequence;
            hlSequence++;

            // MAN - Marking and Packaging
            const unitType = unit.customTypeName || unit.unitType.toUpperCase();
            transaction.addSegment('MAN', [
              'GM', // Marks and Numbers Qualifier - EAN.UCC Serial Shipping Container Code
              this.truncate(unit.identifier, 48),
              this.truncate(unitType, 2)
            ]);

            // Process line items in this unit
            for (const lineItem of unit.lineItems) {
              // HL - Item Level
              transaction.addSegment('HL', [
                hlSequence.toString(), // Hierarchical ID
                packageHLSequence.toString(), // Parent Hierarchical ID (package)
                'I', // Hierarchical Level Code - Item
                '0' // No children
              ]);

              hlSequence++;

              // LIN - Item Identification
              transaction.addSegment('LIN', [
                itemSequence.toString(), // Assigned Identification
                'VP', // Product/Service ID Qualifier - Vendor's Part Number
                this.truncate(lineItem.sku, 48)
              ]);

              // SN1 - Item Detail (Ship Notice Detail)
              transaction.addSegment('SN1', [
                '', // Assigned Identification
                this.padLeft(lineItem.quantity.toString(), 10), // Number of Units Shipped
                'EA', // Unit or Basis for Measurement Code - Each
                lineItem.weight ? this.padLeft(lineItem.weight.toFixed(2), 10) : '' // Weight
              ]);

              // PID - Product/Item Description
              if (lineItem.description) {
                transaction.addSegment('PID', [
                  'F', // Item Description Type - Free-form
                  '08', // Product/Process Characteristic Code
                  this.truncate(lineItem.description, 80)
                ]);
              }

              itemSequence++;
            }
          }
        } else if (order.lineItems && order.lineItems.length > 0) {
          // Legacy line items without trackable units
          for (const lineItem of order.lineItems) {
            // HL - Item Level
            transaction.addSegment('HL', [
              hlSequence.toString(), // Hierarchical ID
              orderHLSequence.toString(), // Parent Hierarchical ID (order)
              'I', // Hierarchical Level Code - Item
              '0' // No children
            ]);

            hlSequence++;

            // LIN - Item Identification
            transaction.addSegment('LIN', [
              itemSequence.toString(), // Assigned Identification
              'VP', // Product/Service ID Qualifier
              this.truncate(lineItem.sku, 48)
            ]);

            // SN1 - Item Detail
            transaction.addSegment('SN1', [
              '', // Assigned Identification
              this.padLeft(lineItem.quantity.toString(), 10), // Number of Units Shipped
              'EA', // Unit or Basis for Measurement Code
              lineItem.weight ? this.padLeft(lineItem.weight.toFixed(2), 10) : '' // Weight
            ]);

            // PID - Product Description
            if (lineItem.description) {
              transaction.addSegment('PID', [
                'F', // Item Description Type
                '08', // Product/Process Characteristic Code
                this.truncate(lineItem.description, 80)
              ]);
            }

            itemSequence++;
          }
        }
      }
    }

    // CTT - Transaction Totals
    transaction.addSegment('CTT', [
      this.padLeft((itemSequence - 1).toString(), 6) // Number of Line Items
    ]);

    // Generate the EDI document using X12Generator
    // Note: Transaction and functional group are already added via addTransaction/addFunctionalGroup
    const generator = new X12Generator();
    (generator as any).interchange = interchange;
    return generator.toString();
  }

  // Helper methods
  private generateControlNumber(): string {
    return Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  }

  private padLeft(str: string, length: number): string {
    return str.padStart(length, '0');
  }

  private padRight(str: string, length: number): string {
    return str.padEnd(length, ' ');
  }

  private truncate(str: string, length: number): string {
    return str.substring(0, length);
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, ''); // CCYYMMDD
  }

  private formatDateShort(date: Date): string {
    return date.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
  }

  private formatTime(date: Date): string {
    return date.toISOString().slice(11, 17).replace(/:/g, ''); // HHMMSS
  }

  private formatTimeShort(date: Date): string {
    return date.toISOString().slice(11, 15).replace(/:/g, ''); // HHMM
  }
}