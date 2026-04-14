import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import Handlebars from 'handlebars';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { IDocumentTemplateRepository } from '../repositories/DocumentTemplateRepository.js';
import { IGeneratedDocumentRepository, CreateGeneratedDocumentDTO } from '../repositories/GeneratedDocumentRepository.js';
import { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';
import { defaultBolTemplate } from './templates/bolTemplate.js';
import { defaultLabelTemplate } from './templates/labelTemplate.js';
import { defaultCustomsTemplate } from './templates/customsTemplate.js';
import { defaultRateConfirmationTemplate } from './templates/rateConfirmationTemplate.js';

export interface IDocumentGenerationService {
  generateBOL(shipmentId: string, templateId?: string, userId?: string): Promise<{ id: string; fileName: string }>;
  generateLabels(orderId: string, templateId?: string, userId?: string): Promise<{ id: string; fileName: string }>;
  generateCustomsForm(shipmentId: string, templateId?: string, userId?: string): Promise<{ id: string; fileName: string }>;
  generateRateConfirmation(shipmentId: string, userId?: string): Promise<{ id: string; fileName: string }>;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * Renders HTML template content using Handlebars and converts to a simple PDF
 * using pdf-lib (pure JS, no browser dependency).
 *
 * The PDF generation uses a text-based approach: the Handlebars template is rendered
 * to plain text (HTML tags stripped), then laid out line-by-line onto PDF pages.
 * This is lightweight and works in any environment without Chrome/puppeteer.
 */
export class DocumentGenerationService implements IDocumentGenerationService {
  private storageBackend: string;

  constructor(
    private prisma: PrismaClient,
    private templateRepo: IDocumentTemplateRepository,
    private docRepo: IGeneratedDocumentRepository,
    private storageProvider?: IBinaryStorageProvider,
  ) {
    this.storageBackend = process.env.S3_ENDPOINT && process.env.S3_BUCKET ? 's3' : 'database';
    // Register Handlebars helpers
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
  }

  /**
   * Load organization branding for document templates.
   * Returns org name, primary color, and logo URL (if available).
   */
  private async loadBranding(): Promise<{
    orgName: string;
    primaryColor: string;
    logoUrl: string | null;
  }> {
    const org = await this.prisma.organization.findFirst({
      select: { name: true, themeConfig: true, logoStorageKey: true },
    });
    const themeConfig = org?.themeConfig as Record<string, string> | null;
    return {
      orgName: org?.name || 'Open TMS',
      primaryColor: themeConfig?.['primary'] || '#1976d2',
      logoUrl: org?.logoStorageKey ? '/api/v1/theme/logo' : null,
    };
  }

  async generateBOL(shipmentId: string, templateId?: string, userId?: string) {
    // Load shipment with all relations
    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: {
        origin: true,
        destination: true,
        customer: true,
        carrier: true,
        loads: { include: { vehicle: true, driver: true } },
        stops: { include: { location: true }, orderBy: { sequenceNumber: 'asc' } },
        orderShipments: {
          include: {
            order: {
              include: {
                trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
                lineItems: true,
              },
            },
          },
        },
      },
    });

    // Generate BOL number
    const org = await this.prisma.organization.findFirst();
    const seqNum = (org?.bolSequenceNumber ?? 0) + 1;
    if (org) {
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { bolSequenceNumber: seqNum },
      });
    }
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const bolNumber = `BOL-${dateStr}-${String(seqNum).padStart(4, '0')}`;

    // Build template data
    const orders = shipment.orderShipments.map(os => os.order);
    const allLineItems = orders.flatMap(o => o.lineItems);
    const allUnits = orders.flatMap(o => o.trackableUnits);
    const totalWeight = allLineItems.reduce((sum, li) => sum + (li.weight ?? 0), 0);
    const branding = await this.loadBranding();

    const data = {
      branding,
      bolNumber,
      date: formatDate(today),
      shipment: {
        reference: shipment.reference,
        status: shipment.status,
        pickupDate: formatDate(shipment.pickupDate),
        deliveryDate: formatDate(shipment.deliveryDate),
        origin: shipment.origin,
        destination: shipment.destination,
      },
      customer: shipment.customer,
      carrier: shipment.carrier || {},
      vehicle: shipment.loads[0]?.vehicle || null,
      driver: shipment.loads[0]?.driver || null,
      stops: shipment.stops.map(s => ({
        ...s,
        estimatedArrival: formatDate(s.estimatedArrival),
      })),
      orders: orders.map(o => ({
        orderNumber: o.orderNumber,
        poNumber: o.poNumber,
        serviceLevel: o.serviceLevel,
        temperatureControl: o.temperatureControl,
        requiresHazmat: o.requiresHazmat,
        specialInstructions: o.specialInstructions,
        trackableUnits: o.trackableUnits,
        lineItems: o.lineItems,
      })),
      totals: {
        orderCount: orders.length,
        unitCount: allUnits.length,
        itemCount: allLineItems.reduce((sum, li) => sum + li.quantity, 0),
        totalWeight: Math.round(totalWeight * 100) / 100,
      },
      specialInstructions: orders.map(o => o.specialInstructions).filter(Boolean).join('; '),
    };

    // Render template
    const htmlTemplate = await this.getTemplateHtml('bol', templateId);
    const html = Handlebars.compile(htmlTemplate)(data);

    // Generate PDF
    const pdfBytes = await this.htmlToPdf(html, `Bill of Lading - ${bolNumber}`);

    const fileName = `${bolNumber}.pdf`;
    const buffer = Buffer.from(pdfBytes);
    // Opaque key — no entity info or filenames in storage path
    const storageKey = `files/${randomUUID()}`;

    const doc = await this.storeDocument({
      documentType: 'bol',
      documentNumber: bolNumber,
      fileName,
      mimeType: 'application/pdf',
      fileSize: pdfBytes.length,
      fileContent: buffer,
      templateId,
      shipmentId,
      customerId: shipment.customerId,
      generatedBy: userId,
      metadata: data,
    }, storageKey);

    return { id: doc.id, fileName };
  }

  async generateLabels(orderId: string, templateId?: string, userId?: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        customer: true,
        origin: true,
        destination: true,
        trackableUnits: { orderBy: { sequenceNumber: 'asc' } },
        orderShipments: { include: { shipment: { include: { carrier: true } } } },
      },
    });

    const shipment = order.orderShipments[0]?.shipment;
    const branding = await this.loadBranding();

    const data = {
      branding,
      orderNumber: order.orderNumber,
      poNumber: order.poNumber || '',
      shipmentReference: shipment?.reference || '',
      carrierName: shipment?.carrier?.name || '',
      origin: order.origin || {},
      destination: order.destination || {},
      temperatureControl: order.temperatureControl,
      requiresHazmat: order.requiresHazmat,
      specialInstructions: order.specialInstructions || '',
      unitTotal: order.trackableUnits.length,
      units: order.trackableUnits,
    };

    const htmlTemplate = await this.getTemplateHtml('label', templateId);
    const html = Handlebars.compile(htmlTemplate)(data);

    const pdfBytes = await this.htmlToPdf(html, `Labels - ${order.orderNumber}`);

    const fileName = `Labels-${order.orderNumber}.pdf`;
    const buffer = Buffer.from(pdfBytes);
    const storageKey = `files/${randomUUID()}`;

    const doc = await this.storeDocument({
      documentType: 'label',
      fileName,
      mimeType: 'application/pdf',
      fileSize: pdfBytes.length,
      fileContent: buffer,
      templateId,
      orderId,
      customerId: order.customerId,
      generatedBy: userId,
      metadata: data,
    }, storageKey);

    return { id: doc.id, fileName };
  }

  async generateCustomsForm(shipmentId: string, templateId?: string, userId?: string) {
    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: {
        origin: true,
        destination: true,
        customer: true,
        carrier: true,
        orderShipments: {
          include: { order: { include: { lineItems: true } } },
        },
      },
    });

    const orders = shipment.orderShipments.map(os => os.order);
    const allLineItems = orders.flatMap(o => o.lineItems);
    const totalWeight = allLineItems.reduce((sum, li) => sum + (li.weight ?? 0), 0);
    const branding = await this.loadBranding();

    const data = {
      branding,
      date: formatDate(new Date()),
      invoiceNumber: `CI-${shipment.reference}`,
      shipment: {
        reference: shipment.reference,
        pickupDate: formatDate(shipment.pickupDate),
        deliveryDate: formatDate(shipment.deliveryDate),
        origin: shipment.origin,
        destination: shipment.destination,
      },
      customer: shipment.customer,
      carrier: shipment.carrier || {},
      lineItems: allLineItems,
      totals: {
        itemCount: allLineItems.reduce((sum, li) => sum + li.quantity, 0),
        totalWeight: Math.round(totalWeight * 100) / 100,
      },
    };

    const htmlTemplate = await this.getTemplateHtml('customs', templateId);
    const html = Handlebars.compile(htmlTemplate)(data);

    const pdfBytes = await this.htmlToPdf(html, `Customs Form - ${shipment.reference}`);

    const fileName = `Customs-${shipment.reference}.pdf`;
    const buffer = Buffer.from(pdfBytes);
    const storageKey = `files/${randomUUID()}`;

    const doc = await this.storeDocument({
      documentType: 'customs',
      fileName,
      mimeType: 'application/pdf',
      fileSize: pdfBytes.length,
      fileContent: buffer,
      templateId,
      shipmentId,
      customerId: shipment.customerId,
      generatedBy: userId,
      metadata: data,
    }, storageKey);

    return { id: doc.id, fileName };
  }

  async generateRateConfirmation(shipmentId: string, userId?: string) {
    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: {
        origin: true,
        destination: true,
        customer: true,
        carrier: true,
        charges: {
          where: { chargeCategory: 'cost', status: { not: 'written_off' } },
        },
        shipmentFinancialSummary: true,
      },
    });

    if (!shipment.carrier) throw new Error('Shipment has no carrier assigned');

    const branding = await this.loadBranding();
    const org = await this.prisma.organization.findFirst({
      select: { mcNumber: true },
    });

    const costCharges = shipment.charges.map(c => ({
      description: c.description,
      amount: (c.amountCents / 100).toFixed(2),
    }));

    const totalCostCents = shipment.charges.reduce((sum, c) => sum + c.amountCents, 0);

    const data = {
      branding,
      org: { mcNumber: (org as any)?.mcNumber },
      confirmationNumber: `RC-${shipment.reference}`,
      date: formatDate(new Date()),
      shipment: {
        reference: shipment.reference,
        origin: shipment.origin,
        destination: shipment.destination,
      },
      customer: shipment.customer,
      carrier: shipment.carrier,
      serviceLevel: 'FTL',
      equipmentType: '',
      pickupDate: formatDate(shipment.pickupDate),
      deliveryDate: formatDate(shipment.deliveryDate),
      charges: costCharges,
      totalRate: (totalCostCents / 100).toFixed(2),
      paymentTermsDays: shipment.carrier ? 30 : 30,
      specialInstructions: '',
    };

    const html = Handlebars.compile(defaultRateConfirmationTemplate)(data);
    const pdfBytes = await this.htmlToPdf(html, `Rate Confirmation - ${shipment.reference}`);

    const fileName = `RateConfirmation-${shipment.reference}.pdf`;
    const buffer = Buffer.from(pdfBytes);
    const storageKey = `files/${randomUUID()}`;

    const doc = await this.storeDocument({
      documentType: 'rate_confirmation',
      fileName,
      mimeType: 'application/pdf',
      fileSize: pdfBytes.length,
      fileContent: buffer,
      shipmentId,
      customerId: shipment.customerId,
      generatedBy: userId,
      metadata: data,
    }, storageKey);

    return { id: doc.id, fileName };
  }

  /**
   * Store document content via IBinaryStorageProvider (if available) or inline in DB.
   * When a storage provider is configured, fileContent is not stored in the DB row.
   */
  private async storeDocument(
    dto: CreateGeneratedDocumentDTO,
    storageKey: string,
  ) {
    // Default retention: 10 years
    const retentionExpiresAt = new Date();
    retentionExpiresAt.setFullYear(retentionExpiresAt.getFullYear() + 10);

    if (this.storageProvider && dto.fileContent) {
      // Store binary in external storage, keep only metadata in DB
      await this.storageProvider.store(storageKey, dto.fileContent);
      return this.docRepo.create({
        ...dto,
        fileContent: undefined as any, // Don't store binary in DB
        storageKey,
        storageBackend: this.storageBackend,
        retentionExpiresAt,
      });
    }
    // Fallback: store binary inline in DB (original behavior)
    return this.docRepo.create({
      ...dto,
      storageBackend: 'database',
      retentionExpiresAt,
    });
  }

  private async getTemplateHtml(documentType: string, templateId?: string): Promise<string> {
    if (templateId) {
      const template = await this.templateRepo.findById(templateId);
      if (template) return template.htmlTemplate;
    }

    // Try default template from DB
    const defaultTemplate = await this.templateRepo.findDefault(documentType);
    if (defaultTemplate) return defaultTemplate.htmlTemplate;

    // Fall back to built-in templates
    switch (documentType) {
      case 'bol': return defaultBolTemplate;
      case 'label': return defaultLabelTemplate;
      case 'customs': return defaultCustomsTemplate;
      case 'rate_confirmation': return defaultRateConfirmationTemplate;
      default: return '<p>No template available for document type: {{documentType}}</p>';
    }
  }

  /**
   * Convert rendered HTML to PDF using pdf-lib.
   * Parses block-level HTML (headings, tables, paragraphs) and renders with
   * proper column-aligned tables, inline bold, <br/> line breaks, and word wrapping.
   */
  async htmlToPdf(html: string, title: string): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(title);
    // Use org name for document creator metadata
    let creatorName = 'Open TMS';
    try {
      const org = await this.prisma.organization.findFirst({ select: { name: true } });
      if (org?.name && org.name !== 'Default Organization') creatorName = org.name;
    } catch { /* use fallback */ }
    pdfDoc.setCreator(creatorName);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const PW = 612; // US Letter
    const PH = 792;
    const M = 50;   // margin
    const CW = PW - 2 * M; // content width

    let page = pdfDoc.addPage([PW, PH]);
    let y = PH - M;

    // ── Utilities ──────────────────────────────────────────────────────────

    // Replace characters outside WinAnsi encoding that would crash drawText
    const sanitize = (t: string) => t
      .replace(/[\u2018\u2019\u2032]/g, "'")
      .replace(/[\u201C\u201D\u2033]/g, '"')
      .replace(/\u2013/g, '-')
      .replace(/\u2014/g, '--')
      .replace(/\u2026/g, '...')
      .replace(/[^\t\n\x20-\x7E\xA0-\xFF]/g, '');

    const stripHtml = (s: string) => sanitize(
      s.replace(/<[^>]+>/g, '')
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&nbsp;/g, ' ')
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'")
       .replace(/\s+/g, ' ')
       .trim()
    );

    const fontFor = (bold: boolean) => bold ? boldFont : font;

    const wrapLines = (text: string, size: number, bold: boolean, maxW: number): string[] => {
      if (!text) return [''];
      const f = fontFor(bold);
      const words = text.split(' ');
      const result: string[] = [];
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(test, size) > maxW && line) {
          result.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) result.push(line);
      return result.length ? result : [''];
    };

    // ── Drawing primitives ─────────────────────────────────────────────────

    const ensureSpace = (needed: number) => {
      if (y - needed < M) {
        page = pdfDoc.addPage([PW, PH]);
        y = PH - M;
      }
    };

    const drawTextAt = (text: string, x: number, yy: number, size: number, bold: boolean) => {
      if (text) {
        page.drawText(sanitize(text), {
          x, y: yy, size,
          font: fontFor(bold),
          color: rgb(0, 0, 0),
        });
      }
    };

    // Draw word-wrapped text block at current y; returns total height consumed
    const drawBlock = (text: string, x: number, size: number, bold: boolean, maxW: number): number => {
      const lh = size + 4;
      const lines = wrapLines(text, size, bold, maxW);
      const totalH = lines.length * lh;
      ensureSpace(totalH);
      for (const l of lines) {
        drawTextAt(l, x, y, size, bold);
        y -= lh;
      }
      return totalH;
    };

    const drawHRule = (grey = 0.7, thickness = 0.5) => {
      ensureSpace(8);
      page.drawLine({
        start: { x: M, y },
        end: { x: PW - M, y },
        thickness,
        color: rgb(grey, grey, grey),
      });
      y -= 8;
    };

    // ── Inline bold/regular segments ───────────────────────────────────────

    type Seg = { text: string; bold: boolean };

    const parseInline = (raw: string): Seg[] => {
      const segs: Seg[] = [];
      const parts = raw.split(/(<(?:strong|b)>[\s\S]*?<\/(?:strong|b)>)/gi);
      for (const p of parts) {
        const isBold = /^<(?:strong|b)>/i.test(p);
        const text = stripHtml(p);
        if (text) segs.push({ text, bold: isBold });
      }
      return segs;
    };

    // Draw inline segments left-to-right; returns width used
    const drawInline = (segs: Seg[], x: number, yy: number, size: number, maxW: number): number => {
      let xOff = 0;
      const spaceW = font.widthOfTextAtSize(' ', size);
      for (let i = 0; i < segs.length; i++) {
        if (!segs[i].text) continue;
        if (i > 0 && xOff > 0) xOff += spaceW;
        const f = fontFor(segs[i].bold);
        const w = f.widthOfTextAtSize(segs[i].text, size);
        if (xOff + w > maxW) {
          // Truncate last segment to fit
          let truncated = segs[i].text;
          while (truncated.length > 1 && f.widthOfTextAtSize(truncated, size) > maxW - xOff) {
            truncated = truncated.slice(0, -1);
          }
          drawTextAt(truncated, x + xOff, yy, size, segs[i].bold);
          xOff += f.widthOfTextAtSize(truncated, size);
          break;
        }
        drawTextAt(segs[i].text, x + xOff, yy, size, segs[i].bold);
        xOff += w;
      }
      return xOff;
    };

    // ── Table rendering ────────────────────────────────────────────────────

    type CellData = { lines: Seg[][] };

    const parseCell = (cellHtml: string): CellData => {
      const parts = cellHtml.split(/<br\s*\/?>/gi);
      const lines = parts
        .map(p => parseInline(p))
        .filter(segs => segs.length > 0);
      return { lines: lines.length ? lines : [[{ text: '', bold: false }]] };
    };

    const renderTable = (tableHtml: string) => {
      const rows: { cells: CellData[]; isHeader: boolean }[] = [];
      const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch;
      while ((trMatch = trRe.exec(tableHtml)) !== null) {
        const rowHtml = trMatch[1];
        const isHeader = /<th/i.test(rowHtml);
        const cellRe = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
        const cells: CellData[] = [];
        let cellMatch;
        while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
          cells.push(parseCell(cellMatch[1]));
        }
        if (cells.length > 0) rows.push({ cells, isHeader });
      }
      if (rows.length === 0) return;

      const colCount = Math.max(...rows.map(r => r.cells.length));
      const colW = CW / colCount;
      const cellPad = 4;
      const fontSize = 9;
      const cellLH = fontSize + 3;

      for (const row of rows) {
        // Row height = tallest cell
        const maxLines = Math.max(...row.cells.map(c => c.lines.length));
        const rowH = maxLines * cellLH + 6;

        ensureSpace(rowH);

        // Header row background
        if (row.isHeader) {
          page.drawRectangle({
            x: M,
            y: y - rowH + cellLH,
            width: CW,
            height: rowH,
            color: rgb(0.93, 0.93, 0.93),
          });
        }

        // Draw cells
        for (let c = 0; c < row.cells.length; c++) {
          const cell = row.cells[c];
          const cellX = M + c * colW + cellPad;
          const cellMaxW = colW - 2 * cellPad;
          let lineY = y;
          for (const segs of cell.lines) {
            drawInline(segs, cellX, lineY, fontSize, cellMaxW);
            lineY -= cellLH;
          }
        }

        y -= rowH;

        // Light row border
        page.drawLine({
          start: { x: M, y: y + 4 },
          end: { x: PW - M, y: y + 4 },
          thickness: 0.25,
          color: rgb(0.85, 0.85, 0.85),
        });
      }
      y -= 4;
    };

    // ── Paragraph rendering ────────────────────────────────────────────────

    const renderParagraph = (pHtml: string) => {
      const inner = pHtml.replace(/<\/?p[^>]*>/gi, '');
      const brLines = inner.split(/<br\s*\/?>/gi);
      const lh = 14;

      for (const raw of brLines) {
        const segs = parseInline(raw);
        if (segs.length === 0) continue;
        const totalText = segs.map(s => s.text).join('');
        if (!totalText.trim()) continue;

        if (segs.length === 1) {
          // Single segment — use word wrapping
          drawBlock(segs[0].text, M, 10, segs[0].bold, CW);
        } else {
          // Mixed bold/regular — render inline
          ensureSpace(lh);
          drawInline(segs, M, y, 10, CW);
          y -= lh;
        }
      }
      y -= 2;
    };

    // ── Main HTML → block parsing ──────────────────────────────────────────

    // Normalize: collapse newlines so multiline tags are matched as one block
    const norm = html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ');

    // Match top-level block elements in document order
    const blockRe = /<(h[1-3]|table|p|div)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
    let blockMatch;
    while ((blockMatch = blockRe.exec(norm)) !== null) {
      const tag = blockMatch[1].toLowerCase();
      const blockHtml = blockMatch[0];

      if (tag === 'h1') {
        const text = stripHtml(blockHtml);
        if (!text) continue;
        y -= 12;
        drawBlock(text, M, 18, true, CW);
        drawHRule();
      } else if (tag === 'h2') {
        const text = stripHtml(blockHtml);
        if (!text) continue;
        y -= 10;
        drawBlock(text, M, 14, true, CW);
        y -= 2;
      } else if (tag === 'h3') {
        const text = stripHtml(blockHtml);
        if (!text) continue;
        y -= 6;
        drawBlock(text, M, 12, true, CW);
      } else if (tag === 'table') {
        renderTable(blockHtml);
      } else if (tag === 'p') {
        renderParagraph(blockHtml);
      } else if (tag === 'div') {
        const text = stripHtml(blockHtml);
        if (text) drawBlock(text, M, 10, false, CW);
      }
    }

    return pdfDoc.save();
  }
}
