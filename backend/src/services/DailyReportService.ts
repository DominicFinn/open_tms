import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

export interface IDailyReportService {
  generateExcel(date: string): Promise<Buffer>;
  getSummary(date: string): Promise<DailyReportSummary>;
}

export interface DailyReportSummary {
  date: string;
  generatedAt: string;
  shipmentsByStatus: Record<string, number>;
  ordersByDeliveryStatus: Record<string, number>;
  totalShipments: number;
  totalOrders: number;
  exceptionCount: number;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US');
}

export class DailyReportService implements IDailyReportService {
  constructor(private prisma: PrismaClient) {}

  async getSummary(date: string): Promise<DailyReportSummary> {
    const { dayStart, dayEnd } = this.parseDateRange(date);

    const shipments = await this.getShipments(dayStart, dayEnd);
    const orders = await this.getOrders(dayStart, dayEnd, shipments.map(s => s.id));

    const shipmentsByStatus: Record<string, number> = {};
    for (const s of shipments) {
      shipmentsByStatus[s.status] = (shipmentsByStatus[s.status] || 0) + 1;
    }

    const ordersByDeliveryStatus: Record<string, number> = {};
    let exceptionCount = 0;
    for (const o of orders) {
      ordersByDeliveryStatus[o.deliveryStatus] = (ordersByDeliveryStatus[o.deliveryStatus] || 0) + 1;
      if (o.deliveryStatus === 'exception') exceptionCount++;
    }

    return {
      date,
      generatedAt: new Date().toISOString(),
      shipmentsByStatus,
      ordersByDeliveryStatus,
      totalShipments: shipments.length,
      totalOrders: orders.length,
      exceptionCount,
    };
  }

  async generateExcel(date: string): Promise<Buffer> {
    const { dayStart, dayEnd } = this.parseDateRange(date);

    const shipments = await this.getShipments(dayStart, dayEnd);
    const shipmentIds = shipments.map(s => s.id);
    const orders = await this.getOrders(dayStart, dayEnd, shipmentIds);
    const stops = await this.getStops(dayStart, dayEnd, shipmentIds);
    const exceptions = orders.filter(o => o.deliveryStatus === 'exception');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Open TMS';
    workbook.created = new Date();

    // --- Sheet 1: Summary ---
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    const shipmentsByStatus: Record<string, number> = {};
    for (const s of shipments) {
      shipmentsByStatus[s.status] = (shipmentsByStatus[s.status] || 0) + 1;
    }
    const ordersByStatus: Record<string, number> = {};
    for (const o of orders) {
      ordersByStatus[o.deliveryStatus] = (ordersByStatus[o.deliveryStatus] || 0) + 1;
    }

    summarySheet.addRow({ metric: 'Report Date', value: date });
    summarySheet.addRow({ metric: 'Generated', value: new Date().toISOString() });
    summarySheet.addRow({ metric: '', value: '' });
    summarySheet.addRow({ metric: 'Total Shipments', value: shipments.length });
    for (const [status, count] of Object.entries(shipmentsByStatus)) {
      summarySheet.addRow({ metric: `  Shipments - ${status}`, value: count });
    }
    summarySheet.addRow({ metric: '', value: '' });
    summarySheet.addRow({ metric: 'Total Orders', value: orders.length });
    for (const [status, count] of Object.entries(ordersByStatus)) {
      summarySheet.addRow({ metric: `  Orders - ${status}`, value: count });
    }
    summarySheet.addRow({ metric: '', value: '' });
    summarySheet.addRow({ metric: 'Exceptions', value: exceptions.length });

    this.styleHeaderRow(summarySheet);

    // --- Sheet 2: Shipments ---
    const shipmentsSheet = workbook.addWorksheet('Shipments');
    shipmentsSheet.columns = [
      { header: 'Reference', key: 'reference', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Customer', key: 'customer', width: 20 },
      { header: 'Origin', key: 'origin', width: 20 },
      { header: 'Destination', key: 'destination', width: 20 },
      { header: 'Pickup Date', key: 'pickupDate', width: 14 },
      { header: 'Delivery Date', key: 'deliveryDate', width: 14 },
      { header: 'Carrier', key: 'carrier', width: 18 },
      { header: 'Vehicle Plate', key: 'vehiclePlate', width: 14 },
      { header: 'Vehicle Type', key: 'vehicleType', width: 12 },
      { header: 'Driver', key: 'driver', width: 18 },
      { header: 'Driver Phone', key: 'driverPhone', width: 14 },
      { header: '# Orders', key: 'orderCount', width: 10 },
      { header: '# Stops', key: 'stopCount', width: 10 },
    ];

    for (const s of shipments) {
      const load = s.loads[0];
      shipmentsSheet.addRow({
        reference: s.reference,
        status: s.status,
        customer: s.customer.name,
        origin: `${s.origin.city}, ${s.origin.state || ''}`,
        destination: `${s.destination.city}, ${s.destination.state || ''}`,
        pickupDate: formatDate(s.pickupDate),
        deliveryDate: formatDate(s.deliveryDate),
        carrier: s.carrier?.name || '',
        vehiclePlate: load?.vehicle?.plate || '',
        vehicleType: load?.vehicle?.type || '',
        driver: load?.driver?.name || '',
        driverPhone: load?.driver?.phone || '',
        orderCount: s.orderShipments.length,
        stopCount: s.stops.length,
      });
    }

    this.styleHeaderRow(shipmentsSheet);

    // --- Sheet 3: Orders ---
    const ordersSheet = workbook.addWorksheet('Orders');
    ordersSheet.columns = [
      { header: 'Order #', key: 'orderNumber', width: 15 },
      { header: 'PO #', key: 'poNumber', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Delivery Status', key: 'deliveryStatus', width: 15 },
      { header: 'Customer', key: 'customer', width: 18 },
      { header: 'Origin', key: 'origin', width: 18 },
      { header: 'Destination', key: 'destination', width: 18 },
      { header: 'Service', key: 'serviceLevel', width: 8 },
      { header: 'Temp', key: 'temperatureControl', width: 12 },
      { header: 'Hazmat', key: 'hazmat', width: 8 },
      { header: 'Req. Pickup', key: 'requestedPickupDate', width: 14 },
      { header: 'Req. Delivery', key: 'requestedDeliveryDate', width: 14 },
      { header: 'Shipment Ref', key: 'shipmentRef', width: 15 },
      { header: 'Exception', key: 'exceptionType', width: 12 },
      { header: 'Instructions', key: 'specialInstructions', width: 25 },
    ];

    for (const o of orders) {
      const shipRef = o.orderShipments?.[0]?.shipment?.reference || '';
      ordersSheet.addRow({
        orderNumber: o.orderNumber,
        poNumber: o.poNumber || '',
        status: o.status,
        deliveryStatus: o.deliveryStatus,
        customer: o.customer.name,
        origin: o.origin ? `${o.origin.city}, ${o.origin.state || ''}` : '',
        destination: o.destination ? `${o.destination.city}, ${o.destination.state || ''}` : '',
        serviceLevel: o.serviceLevel,
        temperatureControl: o.temperatureControl,
        hazmat: o.requiresHazmat ? 'YES' : 'No',
        requestedPickupDate: formatDate(o.requestedPickupDate),
        requestedDeliveryDate: formatDate(o.requestedDeliveryDate),
        shipmentRef: shipRef,
        exceptionType: o.exceptionType || '',
        specialInstructions: o.specialInstructions || '',
      });
    }

    this.styleHeaderRow(ordersSheet);

    // --- Sheet 4: Stop Schedule ---
    const stopsSheet = workbook.addWorksheet('Stop Schedule');
    stopsSheet.columns = [
      { header: 'Shipment Ref', key: 'shipmentRef', width: 15 },
      { header: 'Stop #', key: 'sequence', width: 8 },
      { header: 'Type', key: 'stopType', width: 10 },
      { header: 'Location', key: 'locationName', width: 20 },
      { header: 'City/State', key: 'cityState', width: 18 },
      { header: 'Est. Arrival', key: 'estimatedArrival', width: 18 },
      { header: 'Est. Departure', key: 'estimatedDeparture', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Instructions', key: 'instructions', width: 30 },
    ];

    for (const stop of stops) {
      stopsSheet.addRow({
        shipmentRef: stop.shipment.reference,
        sequence: stop.sequenceNumber,
        stopType: stop.stopType,
        locationName: stop.location.name,
        cityState: `${stop.location.city}, ${stop.location.state || ''}`,
        estimatedArrival: stop.estimatedArrival ? new Date(stop.estimatedArrival).toLocaleString() : '',
        estimatedDeparture: stop.estimatedDeparture ? new Date(stop.estimatedDeparture).toLocaleString() : '',
        status: stop.status,
        instructions: stop.instructions || '',
      });
    }

    this.styleHeaderRow(stopsSheet);

    // --- Sheet 5: Exceptions ---
    const exceptionsSheet = workbook.addWorksheet('Exceptions');
    exceptionsSheet.columns = [
      { header: 'Order #', key: 'orderNumber', width: 15 },
      { header: 'Shipment Ref', key: 'shipmentRef', width: 15 },
      { header: 'Exception Type', key: 'exceptionType', width: 15 },
      { header: 'Exception Notes', key: 'exceptionNotes', width: 40 },
      { header: 'Customer', key: 'customer', width: 20 },
    ];

    for (const o of exceptions) {
      const shipRef = o.orderShipments?.[0]?.shipment?.reference || '';
      exceptionsSheet.addRow({
        orderNumber: o.orderNumber,
        shipmentRef: shipRef,
        exceptionType: o.exceptionType || '',
        exceptionNotes: o.exceptionNotes || '',
        customer: o.customer.name,
      });
    }

    this.styleHeaderRow(exceptionsSheet);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private parseDateRange(date: string) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    return { dayStart, dayEnd };
  }

  private async getShipments(dayStart: Date, dayEnd: Date) {
    return this.prisma.shipment.findMany({
      where: {
        archived: false,
        OR: [
          { pickupDate: { gte: dayStart, lte: dayEnd } },
          { deliveryDate: { gte: dayStart, lte: dayEnd } },
          { status: 'in_transit' },
        ],
      },
      include: {
        customer: true,
        origin: true,
        destination: true,
        carrier: true,
        loads: { include: { vehicle: true, driver: true } },
        orderShipments: true,
        stops: true,
      },
      orderBy: { pickupDate: 'asc' },
    });
  }

  private async getOrders(dayStart: Date, dayEnd: Date, shipmentIds: string[]) {
    return this.prisma.order.findMany({
      where: {
        archived: false,
        OR: [
          { orderShipments: { some: { shipmentId: { in: shipmentIds } } } },
          { requestedPickupDate: { gte: dayStart, lte: dayEnd } },
          { requestedDeliveryDate: { gte: dayStart, lte: dayEnd } },
        ],
      },
      include: {
        customer: true,
        origin: true,
        destination: true,
        orderShipments: { include: { shipment: true } },
      },
      orderBy: { orderNumber: 'asc' },
    });
  }

  private async getStops(dayStart: Date, dayEnd: Date, shipmentIds: string[]) {
    return this.prisma.shipmentStop.findMany({
      where: {
        OR: [
          { estimatedArrival: { gte: dayStart, lte: dayEnd } },
          { shipmentId: { in: shipmentIds } },
        ],
      },
      include: {
        shipment: true,
        location: true,
      },
      orderBy: [{ shipmentId: 'asc' }, { sequenceNumber: 'asc' }],
    });
  }

  private styleHeaderRow(sheet: ExcelJS.Worksheet) {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    headerRow.border = {
      bottom: { style: 'thin' },
    };
  }
}
