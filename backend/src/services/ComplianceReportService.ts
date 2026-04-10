/**
 * ComplianceReportService
 *
 * Generates a Cold Chain Compliance Report PDF for a shipment.
 * The report includes shipment details, cold chain profile, device info,
 * temperature monitoring summary, excursion details, and disposition.
 *
 * Stored via IBinaryStorageProvider and recorded as a GeneratedDocument.
 */

import { PrismaClient } from '@prisma/client';
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import { randomUUID } from 'crypto';
import { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';
import { ColdChainService } from './ColdChainService.js';

interface ReportContext {
  shipment: any;
  customer: any;
  origin: any;
  destination: any;
  carrier: any;
  profile: any;
  devices: any[];
  calibrations: Map<string, any>;
  summary: any;
  excursions: any[];
  recentLogs: any[];
}

export class ComplianceReportService {
  constructor(
    private prisma: PrismaClient,
    private storageProvider: IBinaryStorageProvider,
  ) {}

  async generateComplianceReport(shipmentId: string): Promise<{ documentId: string; storageKey: string }> {
    // 1. Gather all data
    const ctx = await this.gatherReportData(shipmentId);

    // 2. Build PDF
    const pdfBytes = await this.buildPdf(ctx);

    // 3. Store via binary storage provider
    const storageKey = `files/${randomUUID()}`;
    await this.storageProvider.store(storageKey, Buffer.from(pdfBytes), { 'Content-Type': 'application/pdf' });

    // 4. Create GeneratedDocument record
    const retentionUntil = new Date();
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 10);

    const doc = await this.prisma.generatedDocument.create({
      data: {
        documentType: 'cold_chain_compliance',
        fileName: `Cold-Chain-Compliance-${ctx.shipment.reference}.pdf`,
        shipmentId,
        storageKey,
        storageBackend: 's3',
        mimeType: 'application/pdf',
        fileSize: pdfBytes.length,
        retentionExpiresAt: retentionUntil,
        metadata: {
          reportType: 'cold_chain_compliance',
          shipmentReference: ctx.shipment.reference,
          totalReadings: ctx.summary.totalReadings,
          excursionCount: ctx.summary.excursionCount,
          disposition: ctx.shipment.coldChainDisposition,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    return { documentId: doc.id, storageKey };
  }

  private async gatherReportData(shipmentId: string): Promise<ReportContext> {
    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: {
        customer: true,
        origin: true,
        destination: true,
        carrier: true,
        coldChainProfile: true,
      },
    });

    // Get devices assigned to this shipment
    const assignments = await this.prisma.deviceAssignment.findMany({
      where: { shipmentId },
      include: { device: true },
    });
    const devices = assignments.map(a => a.device);

    // Get latest calibrations for each device
    const calibrations = new Map<string, any>();
    for (const device of devices) {
      const cal = await this.prisma.deviceCalibration.findFirst({
        where: { deviceId: device.id, status: 'valid' },
        orderBy: { calibratedAt: 'desc' },
      });
      if (cal) calibrations.set(device.id, cal);
    }

    // Temperature summary
    const coldChainService = new ColdChainService(this.prisma);
    const summary = await coldChainService.getTemperatureSummary(shipmentId);

    // Excursions
    const excursions = await this.prisma.coldChainExcursion.findMany({
      where: { shipmentId },
      orderBy: { startedAt: 'asc' },
    });

    // Recent temperature logs (last 500 for the table)
    const recentLogs = await this.prisma.immutableTemperatureLog.findMany({
      where: { shipmentId },
      orderBy: { recordedAt: 'asc' },
      take: 500,
    });

    return {
      shipment,
      customer: shipment.customer,
      origin: shipment.origin,
      destination: shipment.destination,
      carrier: shipment.carrier,
      profile: shipment.coldChainProfile,
      devices,
      calibrations,
      summary,
      excursions,
      recentLogs,
    };
  }

  private async buildPdf(ctx: ReportContext): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28; // A4
    const pageHeight = 841.89;
    const margin = 50;
    const contentWidth = pageWidth - 2 * margin;

    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const drawText = (text: string, x: number, yPos: number, size: number, f: PDFFont = font, color = rgb(0.1, 0.1, 0.1)) => {
      page.drawText(text, { x, y: yPos, size, font: f, color });
    };

    const addNewPageIfNeeded = (needed: number) => {
      if (y - needed < margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    const drawLine = (yPos: number) => {
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: pageWidth - margin, y: yPos },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
    };

    const sectionHeader = (title: string) => {
      addNewPageIfNeeded(40);
      y -= 10;
      drawLine(y);
      y -= 20;
      drawText(title, margin, y, 14, fontBold, rgb(0.15, 0.3, 0.6));
      y -= 20;
    };

    const labelValue = (label: string, value: string, xOffset = 0) => {
      addNewPageIfNeeded(20);
      drawText(label + ':', margin + xOffset, y, 9, fontBold, rgb(0.4, 0.4, 0.4));
      drawText(value, margin + xOffset + 140, y, 9);
      y -= 16;
    };

    // ── Title ──
    drawText('COLD CHAIN COMPLIANCE REPORT', margin, y, 18, fontBold, rgb(0.15, 0.3, 0.6));
    y -= 14;
    drawText('Good Distribution Practice (GDP) — Temperature Monitoring Record', margin, y, 9, font, rgb(0.5, 0.5, 0.5));
    y -= 10;
    drawText(`Generated: ${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]}`, margin, y, 8, font, rgb(0.5, 0.5, 0.5));
    y -= 25;
    drawLine(y);
    y -= 20;

    // ── Shipment Details ──
    sectionHeader('1. Shipment Details');
    labelValue('Reference', ctx.shipment.reference);
    labelValue('Status', ctx.shipment.status);
    labelValue('Customer', ctx.customer?.name || 'N/A');
    labelValue('Origin', ctx.origin ? `${ctx.origin.name}, ${ctx.origin.city}, ${ctx.origin.country}` : 'N/A');
    labelValue('Destination', ctx.destination ? `${ctx.destination.name}, ${ctx.destination.city}, ${ctx.destination.country}` : 'N/A');
    labelValue('Carrier', ctx.carrier?.name || 'N/A');
    labelValue('Pickup Date', ctx.shipment.pickupDate ? new Date(ctx.shipment.pickupDate).toLocaleDateString() : 'N/A');
    labelValue('Delivery Date', ctx.shipment.deliveryDate ? new Date(ctx.shipment.deliveryDate).toLocaleDateString() : 'N/A');
    labelValue('Disposition', ctx.shipment.coldChainDisposition || 'N/A');
    if (ctx.shipment.dispositionSetBy) {
      labelValue('Disposition Set By', ctx.shipment.dispositionSetBy);
      labelValue('Disposition Date', ctx.shipment.dispositionSetAt ? new Date(ctx.shipment.dispositionSetAt).toLocaleDateString() : 'N/A');
    }
    if (ctx.shipment.dispositionNotes) {
      labelValue('Disposition Notes', ctx.shipment.dispositionNotes);
    }

    // ── Cold Chain Profile ──
    sectionHeader('2. Cold Chain Profile');
    if (ctx.profile) {
      labelValue('Profile Name', ctx.profile.name);
      labelValue('Acceptable Range', `${ctx.profile.minTemperature}°C to ${ctx.profile.maxTemperature}°C`);
      labelValue('Alert Range', `${ctx.profile.alertMinTemperature}°C to ${ctx.profile.alertMaxTemperature}°C`);
      if (ctx.profile.minHumidity != null) {
        labelValue('Humidity Range', `${ctx.profile.minHumidity}% to ${ctx.profile.maxHumidity}% RH`);
      }
    } else {
      labelValue('Effective Min Temp', ctx.shipment.effectiveMinTemp != null ? `${ctx.shipment.effectiveMinTemp}°C` : 'Not set');
      labelValue('Effective Max Temp', ctx.shipment.effectiveMaxTemp != null ? `${ctx.shipment.effectiveMaxTemp}°C` : 'Not set');
      labelValue('Alert Min Temp', ctx.shipment.effectiveAlertMinTemp != null ? `${ctx.shipment.effectiveAlertMinTemp}°C` : 'Not set');
      labelValue('Alert Max Temp', ctx.shipment.effectiveAlertMaxTemp != null ? `${ctx.shipment.effectiveAlertMaxTemp}°C` : 'Not set');
      drawText('(Derived from order temperature requirements)', margin, y, 8, font, rgb(0.5, 0.5, 0.5));
      y -= 16;
    }

    // ── Device Information ──
    sectionHeader('3. Monitoring Devices');
    if (ctx.devices.length === 0) {
      drawText('No devices assigned to this shipment.', margin, y, 9, font, rgb(0.5, 0.5, 0.5));
      y -= 16;
    } else {
      for (const device of ctx.devices) {
        addNewPageIfNeeded(100);
        drawText(`Device: ${device.name}`, margin, y, 10, fontBold);
        y -= 16;
        labelValue('Device ID', device.displayId || device.externalId, 10);
        labelValue('Model', device.model || 'N/A', 10);
        labelValue('Manufacturer', device.manufacturer || 'N/A', 10);
        labelValue('Provider', device.provider, 10);

        const cal = ctx.calibrations.get(device.id);
        if (cal) {
          labelValue('Calibration Status', 'VALID', 10);
          labelValue('Certificate #', cal.certificateNumber || 'N/A', 10);
          labelValue('Calibrated At', new Date(cal.calibratedAt).toLocaleDateString(), 10);
          labelValue('Calibrated By', cal.calibratedBy, 10);
          labelValue('Accuracy', cal.accuracy != null ? `±${cal.accuracy}°C` : 'N/A', 10);
          labelValue('Expires', new Date(cal.expiresAt).toLocaleDateString(), 10);
        } else {
          drawText('  ⚠ No valid calibration record found', margin + 10, y, 9, font, rgb(0.8, 0.2, 0.2));
          y -= 16;
        }
        y -= 5;
      }
    }

    // ── Temperature Summary ──
    sectionHeader('4. Temperature Monitoring Summary');
    if (ctx.summary.totalReadings === 0) {
      drawText('No temperature readings recorded for this shipment.', margin, y, 9, font, rgb(0.5, 0.5, 0.5));
      y -= 16;
    } else {
      labelValue('Total Readings', String(ctx.summary.totalReadings));
      labelValue('Monitoring Duration', ctx.summary.monitoringDurationMinutes != null
        ? `${Math.floor(ctx.summary.monitoringDurationMinutes / 60)}h ${ctx.summary.monitoringDurationMinutes % 60}m`
        : 'N/A');
      labelValue('First Reading', ctx.summary.firstReading ? new Date(ctx.summary.firstReading).toLocaleString() : 'N/A');
      labelValue('Last Reading', ctx.summary.lastReading ? new Date(ctx.summary.lastReading).toLocaleString() : 'N/A');
      labelValue('Min Temperature', ctx.summary.minTemperature != null ? `${ctx.summary.minTemperature}°C` : 'N/A');
      labelValue('Max Temperature', ctx.summary.maxTemperature != null ? `${ctx.summary.maxTemperature}°C` : 'N/A');
      labelValue('Avg Temperature', ctx.summary.avgTemperature != null ? `${ctx.summary.avgTemperature}°C` : 'N/A');
      labelValue('Time in Range', ctx.summary.timeInRangePercent != null ? `${ctx.summary.timeInRangePercent}%` : 'N/A');
      labelValue('Excursion Count', String(ctx.summary.excursionCount));
      labelValue('Alert Count', String(ctx.summary.alertCount));
    }

    // ── Excursion Details ──
    if (ctx.excursions.length > 0) {
      sectionHeader('5. Excursion Details');

      // Table header
      addNewPageIfNeeded(30);
      const cols = [margin, margin + 50, margin + 140, margin + 210, margin + 280, margin + 360];
      drawText('#', cols[0], y, 8, fontBold, rgb(0.3, 0.3, 0.3));
      drawText('Type', cols[1], y, 8, fontBold, rgb(0.3, 0.3, 0.3));
      drawText('Severity', cols[2], y, 8, fontBold, rgb(0.3, 0.3, 0.3));
      drawText('Peak', cols[3], y, 8, fontBold, rgb(0.3, 0.3, 0.3));
      drawText('Duration', cols[4], y, 8, fontBold, rgb(0.3, 0.3, 0.3));
      drawText('Disposition', cols[5], y, 8, fontBold, rgb(0.3, 0.3, 0.3));
      y -= 4;
      drawLine(y);
      y -= 12;

      for (let i = 0; i < ctx.excursions.length; i++) {
        const exc = ctx.excursions[i];
        addNewPageIfNeeded(16);
        const color = exc.severity === 'critical' ? rgb(0.8, 0.1, 0.1) : rgb(0.8, 0.5, 0.0);
        drawText(String(i + 1), cols[0], y, 8);
        drawText(exc.excursionType.replace('_', ' '), cols[1], y, 8);
        drawText(exc.severity, cols[2], y, 8, font, color);
        drawText(`${exc.peakValue}°C`, cols[3], y, 8);
        drawText(exc.durationMinutes != null ? `${exc.durationMinutes} min` : 'ongoing', cols[4], y, 8);
        drawText(exc.dispositionDecision || exc.status, cols[5], y, 8);
        y -= 14;
      }
    }

    // ── Temperature Data Table ──
    if (ctx.recentLogs.length > 0) {
      sectionHeader(ctx.excursions.length > 0 ? '6. Temperature Log (Recent)' : '5. Temperature Log (Recent)');

      // Table header
      addNewPageIfNeeded(30);
      const tcols = [margin, margin + 120, margin + 190, margin + 260, margin + 340];
      drawText('Time', tcols[0], y, 8, fontBold, rgb(0.3, 0.3, 0.3));
      drawText('Temp (°C)', tcols[1], y, 8, fontBold, rgb(0.3, 0.3, 0.3));
      drawText('Humidity (%)', tcols[2], y, 8, fontBold, rgb(0.3, 0.3, 0.3));
      drawText('Status', tcols[3], y, 8, fontBold, rgb(0.3, 0.3, 0.3));
      drawText('Hash (first 8)', tcols[4], y, 8, fontBold, rgb(0.3, 0.3, 0.3));
      y -= 4;
      drawLine(y);
      y -= 12;

      // Show up to 100 rows per page section to keep it manageable
      const logsToShow = ctx.recentLogs.slice(0, 200);
      for (const log of logsToShow) {
        addNewPageIfNeeded(14);
        const timeStr = new Date(log.recordedAt).toLocaleString('en-GB', {
          day: '2-digit', month: '2-digit', year: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        const status = log.isExcursion ? 'EXCURSION' : log.isAlert ? 'ALERT' : 'OK';
        const statusColor = log.isExcursion ? rgb(0.8, 0.1, 0.1) : log.isAlert ? rgb(0.8, 0.5, 0.0) : rgb(0.1, 0.6, 0.1);

        drawText(timeStr, tcols[0], y, 7);
        drawText(log.temperature.toFixed(1), tcols[1], y, 7);
        drawText(log.humidity != null ? log.humidity.toFixed(1) : '-', tcols[2], y, 7);
        drawText(status, tcols[3], y, 7, font, statusColor);
        drawText(log.integrityHash.substring(0, 8), tcols[4], y, 6, font, rgb(0.5, 0.5, 0.5));
        y -= 12;
      }

      if (ctx.recentLogs.length > 200) {
        addNewPageIfNeeded(20);
        drawText(`... ${ctx.recentLogs.length - 200} additional readings not shown (full data available via API)`, margin, y, 8, font, rgb(0.5, 0.5, 0.5));
        y -= 16;
      }
    }

    // ── Sign-off Section ──
    const signoffSection = ctx.excursions.length > 0 ? '7' : '6';
    sectionHeader(`${signoffSection}. Compliance Sign-off`);
    addNewPageIfNeeded(120);

    drawText('This report confirms that temperature monitoring was conducted throughout the', margin, y, 9);
    y -= 14;
    drawText('shipment in accordance with Good Distribution Practice (GDP) requirements.', margin, y, 9);
    y -= 30;

    // Signature lines
    const sigY = y;
    drawLine(sigY);
    drawText('Quality Manager Signature', margin, sigY - 14, 8, font, rgb(0.5, 0.5, 0.5));
    drawText('Date', margin + 350, sigY - 14, 8, font, rgb(0.5, 0.5, 0.5));
    y -= 50;

    drawLine(y);
    drawText('Logistics Manager Signature', margin, y - 14, 8, font, rgb(0.5, 0.5, 0.5));
    drawText('Date', margin + 350, y - 14, 8, font, rgb(0.5, 0.5, 0.5));
    y -= 50;

    // Footer note
    addNewPageIfNeeded(40);
    drawText('This document is generated by Open TMS and contains tamper-evident integrity hashes', margin, y, 7, font, rgb(0.5, 0.5, 0.5));
    y -= 10;
    drawText('for each temperature reading (SHA-256). Verify data integrity via the API.', margin, y, 7, font, rgb(0.5, 0.5, 0.5));

    return pdf.save();
  }
}
