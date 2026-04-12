/**
 * Location Operations API — per-location operational view.
 *
 * Provides incoming/at-location/outgoing data for a specific location,
 * including shipment stops, dwell times, trackable units, and throughput stats.
 */

import { FastifyPluginAsync } from 'fastify';

export const locationOpsRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/v1/locations/:id/operations — full operational snapshot
  server.get<{ Params: { id: string } }>('/api/v1/locations/:id/operations', {
    schema: {
      tags: ['Location Operations'],
      summary: 'Get operational view for a location (incoming, at-location, outgoing)',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const location = await server.prisma.location.findUnique({
      where: { id },
      select: {
        id: true, name: true, address1: true, city: true, state: true, country: true,
        locationType: true, facilityCapabilities: true, operatingHours: true,
        appointmentRequired: true, dockCount: true, maxTrailerLengthFt: true,
        contactName: true, contactPhone: true, contactEmail: true,
        lat: true, lng: true,
      },
    });

    if (!location) {
      reply.status(404);
      return { data: null, error: 'Location not found' };
    }

    // All stops at this location
    const allStops = await server.prisma.shipmentStop.findMany({
      where: { locationId: id },
      select: {
        id: true,
        shipmentId: true,
        sequenceNumber: true,
        stopType: true,
        status: true,
        estimatedArrival: true,
        actualArrival: true,
        estimatedDeparture: true,
        actualDeparture: true,
        notes: true,
        shipment: {
          select: {
            id: true,
            reference: true,
            status: true,
            customer: { select: { name: true } },
            carrier: { select: { name: true } },
            origin: { select: { name: true, city: true } },
            destination: { select: { name: true, city: true } },
            pickupDate: true,
            deliveryDate: true,
          },
        },
      },
      orderBy: [
        { estimatedArrival: 'asc' },
        { sequenceNumber: 'asc' },
      ],
    });

    // Shipments with this location as origin
    const outboundShipments = await server.prisma.shipment.findMany({
      where: { originId: id, archived: false, status: { in: ['draft', 'dispatched', 'in_transit'] } },
      select: {
        id: true, reference: true, status: true, pickupDate: true,
        customer: { select: { name: true } },
        carrier: { select: { name: true } },
        destination: { select: { name: true, city: true } },
      },
      orderBy: { pickupDate: 'asc' },
      take: 50,
    });

    // Shipments with this location as destination
    const inboundShipments = await server.prisma.shipment.findMany({
      where: { destinationId: id, archived: false, status: { in: ['dispatched', 'in_transit'] } },
      select: {
        id: true, reference: true, status: true, deliveryDate: true,
        customer: { select: { name: true } },
        carrier: { select: { name: true } },
        origin: { select: { name: true, city: true } },
      },
      orderBy: { deliveryDate: 'asc' },
      take: 50,
    });

    // Trackable units currently at stops at this location
    const unitsHere = await server.prisma.trackableUnit.findMany({
      where: {
        currentStop: { locationId: id },
      },
      select: {
        id: true,
        identifier: true,
        unitType: true,
        condition: true,
        lastScannedAt: true,
        order: { select: { orderNumber: true } },
        currentStop: {
          select: {
            id: true,
            shipment: { select: { reference: true } },
            actualArrival: true,
          },
        },
      },
      take: 100,
    });

    // Categorise stops
    const incoming = allStops.filter((s) =>
      s.status === 'pending' && ['in_transit', 'dispatched'].includes(s.shipment.status)
    );
    const atLocation = allStops.filter((s) =>
      ['arrived', 'in_progress'].includes(s.status)
    );
    const completed = allStops.filter((s) => s.status === 'completed');

    // Calculate dwell times for stops currently at location
    const now = new Date();
    const dwellData = atLocation.map((s) => {
      const arrivalTime = s.actualArrival ? new Date(s.actualArrival) : null;
      const dwellMinutes = arrivalTime ? Math.round((now.getTime() - arrivalTime.getTime()) / 60_000) : null;
      return {
        ...s,
        dwellMinutes,
      };
    });

    // Compute stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayCompleted = completed.filter((s) =>
      s.actualDeparture && new Date(s.actualDeparture) >= todayStart
    );
    const todayArrived = allStops.filter((s) =>
      s.actualArrival && new Date(s.actualArrival) >= todayStart
    );

    // Average dwell for completed stops today
    const completedDwells = todayCompleted
      .filter((s) => s.actualArrival && s.actualDeparture)
      .map((s) => (new Date(s.actualDeparture!).getTime() - new Date(s.actualArrival!).getTime()) / 60_000);
    const avgDwellMinutes = completedDwells.length > 0
      ? Math.round(completedDwells.reduce((a, b) => a + b, 0) / completedDwells.length)
      : null;

    return {
      data: {
        location,
        stats: {
          incoming: incoming.length + inboundShipments.length,
          atLocation: atLocation.length,
          outgoing: outboundShipments.length,
          unitsHere: unitsHere.length,
          todayArrivals: todayArrived.length,
          todayDepartures: todayCompleted.length,
          avgDwellMinutes,
        },
        incoming: {
          stops: incoming.map((s) => ({
            stopId: s.id,
            shipmentId: s.shipment.id,
            shipmentReference: s.shipment.reference,
            shipmentStatus: s.shipment.status,
            customerName: s.shipment.customer?.name,
            carrierName: s.shipment.carrier?.name,
            originName: s.shipment.origin?.name,
            originCity: s.shipment.origin?.city,
            stopType: s.stopType,
            estimatedArrival: s.estimatedArrival,
          })),
          directShipments: inboundShipments,
        },
        atLocation: {
          stops: dwellData.map((s) => ({
            stopId: s.id,
            shipmentId: s.shipment.id,
            shipmentReference: s.shipment.reference,
            customerName: s.shipment.customer?.name,
            carrierName: s.shipment.carrier?.name,
            stopType: s.stopType,
            status: s.status,
            actualArrival: s.actualArrival,
            dwellMinutes: s.dwellMinutes,
            destinationName: s.shipment.destination?.name,
            destinationCity: s.shipment.destination?.city,
          })),
          units: unitsHere.map((u) => ({
            id: u.id,
            identifier: u.identifier,
            unitType: u.unitType,
            condition: u.condition,
            orderNumber: u.order?.orderNumber,
            shipmentReference: u.currentStop?.shipment?.reference,
            lastScannedAt: u.lastScannedAt,
            arrivedAt: u.currentStop?.actualArrival,
          })),
        },
        outgoing: {
          shipments: outboundShipments.map((s) => ({
            id: s.id,
            reference: s.reference,
            status: s.status,
            customerName: s.customer?.name,
            carrierName: s.carrier?.name,
            destinationName: s.destination?.name,
            destinationCity: s.destination?.city,
            pickupDate: s.pickupDate,
          })),
        },
      },
      error: null,
    };
  });
};
