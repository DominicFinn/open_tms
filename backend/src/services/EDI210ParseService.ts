/**
 * EDI 210 (Motor Carrier Freight Details and Invoice) Parse Service
 *
 * Parses inbound X12 210 documents from carriers to extract freight invoice data.
 * The 210 is the carrier's invoice for transportation services rendered.
 *
 * Key segments:
 *   B3   — Invoice header (invoice #, shipment ref, net amount, delivery date)
 *   N1   — Party identification (carrier, shipper, consignee)
 *   N9   — Reference numbers (PRO, BOL, PO)
 *   LX   — Line item start (assigned number)
 *   L5   — Description (commodity, NMFC, freight class)
 *   L0   — Line item detail (billed weight, volume, lading qty)
 *   L1   — Rate and charges (freight rate, charge amount, rate basis)
 *   L7   — Tariff reference (tariff number, rate basis code)
 *   L3   — Total weight and charges summary
 */

export interface EDI210LineItem {
  lineNumber: number;
  description: string;
  nmfcCode: string;
  freightClass: string;
  billedWeight: number;
  weightUnit: string;
  ladingQuantity: number;
  chargeAmountCents: number;
  rateBasis: string;
  rate: number;
  chargeType: string;
}

export interface EDI210ParseResult {
  success: boolean;
  /** B3-02: Invoice number */
  invoiceNumber: string;
  /** B3-03: Shipment identification / reference */
  shipmentReference: string;
  /** B3-04: Net amount in cents */
  netAmountCents: number;
  /** B3-06: Delivery date (CCYYMMDD) */
  deliveryDate: string;
  /** B3-05: Payment method code (PP=Prepaid, CC=Collect, TP=Third Party) */
  paymentMethod: string;
  /** Carrier SCAC from N1*CA segment */
  carrierScac: string;
  /** Reference numbers from N9 segments */
  referenceNumbers: Array<{ qualifier: string; number: string }>;
  /** Line items from LX/L5/L0/L1 groups */
  lineItems: EDI210LineItem[];
  /** L3 total summary */
  totalWeight: number;
  totalChargesCents: number;
  /** Original raw content */
  rawContent: string;
  /** Parse errors */
  errors: string[];
}

export interface IEDI210ParseService {
  parseEDI210(content: string): EDI210ParseResult;
}

export class EDI210ParseService implements IEDI210ParseService {
  parseEDI210(content: string): EDI210ParseResult {
    const errors: string[] = [];
    const referenceNumbers: Array<{ qualifier: string; number: string }> = [];
    const lineItems: EDI210LineItem[] = [];
    let invoiceNumber = '';
    let shipmentReference = '';
    let netAmountCents = 0;
    let deliveryDate = '';
    let paymentMethod = '';
    let carrierScac = '';
    let totalWeight = 0;
    let totalChargesCents = 0;

    try {
      const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const rawSegments = normalized.split('~')
        .map(s => s.trim().replace(/^\n+/, ''))
        .filter(s => s.length > 0);

      const sep = '*';
      let foundST = false;
      let found210 = false;
      let currentLineNumber = 0;
      let currentDescription = '';
      let currentNmfc = '';
      let currentFreightClass = '';
      let currentWeight = 0;
      let currentWeightUnit = 'L'; // L=lbs
      let currentLadingQty = 0;

      for (const rawSeg of rawSegments) {
        const elements = rawSeg.split(sep);
        const segId = elements[0]?.toUpperCase();

        switch (segId) {
          case 'ST':
            foundST = true;
            if (elements[1] === '210') found210 = true;
            break;

          case 'B3':
            // B3*invoice_type*invoice_number*shipment_ref*net_amount*payment_method*delivery_date
            invoiceNumber = elements[2] || '';
            shipmentReference = elements[3] || '';
            netAmountCents = Math.round(parseFloat(elements[4] || '0') * 100);
            paymentMethod = elements[5] || '';
            deliveryDate = elements[6] || '';
            break;

          case 'N1':
            // N1*entity_code*name*id_code_qualifier*id_code
            if (elements[1] === 'CA') {
              // Carrier
              carrierScac = elements[4] || elements[2] || '';
            }
            break;

          case 'N9':
            // N9*reference_qualifier*reference_number
            if (elements[1] && elements[2]) {
              referenceNumbers.push({
                qualifier: elements[1],
                number: elements[2],
              });
            }
            break;

          case 'LX':
            // LX*assigned_number — start of line item group
            // Save previous line item if exists
            if (currentLineNumber > 0 && (currentDescription || currentWeight > 0)) {
              // Will be completed when we hit L1
            }
            currentLineNumber = parseInt(elements[1] || '0', 10);
            currentDescription = '';
            currentNmfc = '';
            currentFreightClass = '';
            currentWeight = 0;
            currentWeightUnit = 'L';
            currentLadingQty = 0;
            break;

          case 'L5':
            // L5*lading_line_number*description*commodity_code*commodity_code_qualifier*nmfc_code
            currentDescription = elements[2] || '';
            if (elements[4] === 'NMFC' || elements[4] === 'N') {
              currentNmfc = elements[3] || elements[5] || '';
            }
            // Freight class might be in L5-05 or L5-03
            currentFreightClass = elements[5] || elements[3] || '';
            break;

          case 'L0':
            // L0*lading_line*billed_qty*billed_unit*weight*weight_qualifier*volume*volume_unit*lading_qty
            currentWeight = parseFloat(elements[4] || '0');
            currentWeightUnit = elements[5] || 'L';
            currentLadingQty = parseInt(elements[8] || '0', 10);
            break;

          case 'L1':
            // L1*lading_line*freight_rate*rate_basis*charge*advances*prepaid_amount*rate_combination_point*special_charge_code
            {
              const chargeAmountCents = Math.round(parseFloat(elements[4] || '0') * 100);
              const rate = parseFloat(elements[2] || '0');
              const rateBasis = elements[3] || '';
              const specialChargeCode = elements[8] || '';

              let chargeType = 'linehaul';
              if (specialChargeCode) {
                // Common special charge codes
                const codeMap: Record<string, string> = {
                  'FUE': 'fuel_surcharge',
                  'FSC': 'fuel_surcharge',
                  'DET': 'detention',
                  'LUM': 'accessorial',
                  'LFT': 'accessorial',
                  'RES': 'accessorial',
                  'INS': 'accessorial',
                  'MIN': 'linehaul', // minimum charge
                };
                chargeType = codeMap[specialChargeCode] || 'accessorial';
              }

              lineItems.push({
                lineNumber: currentLineNumber,
                description: currentDescription || `Line ${currentLineNumber}`,
                nmfcCode: currentNmfc,
                freightClass: currentFreightClass,
                billedWeight: currentWeight,
                weightUnit: currentWeightUnit,
                ladingQuantity: currentLadingQty,
                chargeAmountCents,
                rateBasis,
                rate,
                chargeType,
              });
            }
            break;

          case 'L3':
            // L3*total_weight*weight_qualifier**total_charges
            totalWeight = parseFloat(elements[1] || '0');
            totalChargesCents = Math.round(parseFloat(elements[4] || elements[3] || '0') * 100);
            break;
        }
      }

      if (!foundST || !found210) {
        errors.push('No ST*210 segment found — this does not appear to be an EDI 210 document');
      }

      if (!invoiceNumber) {
        errors.push('Missing B3 segment — no invoice number found');
      }

    } catch (err) {
      errors.push(`Parse error: ${(err as Error).message}`);
    }

    return {
      success: errors.length === 0,
      invoiceNumber,
      shipmentReference,
      netAmountCents,
      deliveryDate,
      paymentMethod,
      carrierScac,
      referenceNumbers,
      lineItems,
      totalWeight,
      totalChargesCents: totalChargesCents || netAmountCents,
      rawContent: content,
      errors,
    };
  }
}
