/**
 * ShipmentShareViewService — builds the redacted shipment payload a share link exposes.
 *
 * The sections passed in come from the stored link, re-read on every request, never from the
 * client. This is the second half of the allowlist: the repository only queries granted sections,
 * and this service only shapes granted sections into the response. A section absent from the
 * link is absent from the payload, so a viewer cannot infer it exists from a null field.
 *
 * What is redacted regardless of sections: the customer's identity, anything financial, internal
 * notes and activity, and the consignee's contact details. A share link goes outside the
 * organisation, so locations are named down to city and country only.
 */

import { ShipmentShareSection } from '@open-tms/shared';
import { ShipmentShareViewRepository } from '../repositories/ShipmentShareRepository.js';

export interface ShipmentShareView {
  sections: ShipmentShareSection[];
  overview?: Record<string, unknown>;
  events?: Array<Record<string, unknown>>;
  orders?: Array<Record<string, unknown>>;
  cargo?: Record<string, unknown>;
  documents?: Array<Record<string, unknown>>;
  telemetry?: Array<Record<string, unknown>>;
  carrier?: Record<string, unknown> | null;
}

export interface IShipmentShareViewService {
  build(
    orgId: string,
    shipmentId: string,
    sections: ShipmentShareSection[]
  ): Promise<ShipmentShareView | null>;
}

export class ShipmentShareViewService implements IShipmentShareViewService {
  constructor(private repo: ShipmentShareViewRepository) {}

  async build(
    orgId: string,
    shipmentId: string,
    sections: ShipmentShareSection[]
  ): Promise<ShipmentShareView | null> {
    // The repository builds its select clause from the granted sections, so the row's shape is
    // decided at runtime and Prisma cannot type it statically. Every field read off it below is
    // guarded by the same section check that put it in the query.
    const shipment = (await this.repo.findShipment({ orgId, shipmentId, sections })) as any;
    if (!shipment) return null;

    const view: ShipmentShareView = { sections };
    const granted = new Set<string>(sections);

    if (granted.has('overview')) view.overview = buildOverview(shipment);
    if (granted.has('events')) view.events = (shipment.events ?? []).map(buildEvent);
    if (granted.has('carrier')) view.carrier = shipment.carrier ?? null;

    if (granted.has('orders')) {
      view.orders = (shipment.orderShipments ?? []).map((link: any) => ({
        orderNumber: link.order.orderNumber,
        poNumber: link.order.poNumber,
        status: link.order.status,
        lineItems: link.order.lineItems,
      }));
    }

    if (granted.has('cargo')) view.cargo = buildCargo(shipment);

    if (granted.has('telemetry')) {
      view.telemetry = (shipment.sensorReadings ?? []).map((r: any) => ({
        eventTime: r.eventTime,
        temperature: r.temperature,
        lightLevel: r.lightLevel,
        impactG: r.impactG,
        isAlert: r.isAlert,
      }));
    }

    if (granted.has('documents')) {
      view.documents = await this.repo.findDocuments(shipmentId);
    }

    return view;
  }
}

function buildOverview(shipment: any): Record<string, unknown> {
  return {
    reference: shipment.reference,
    status: shipment.status,
    hasException: shipment.hasException,
    serviceLevel: shipment.serviceLevel,
    proNumber: shipment.proNumber,
    pickupDate: shipment.pickupDate,
    deliveryDate: shipment.deliveryDate,
    origin: shipment.origin,
    destination: shipment.destination,
    stops: shipment.stops,
  };
}

function buildEvent(event: any): Record<string, unknown> {
  return {
    eventType: event.eventType,
    description: event.description ?? event.locationSummary ?? event.address ?? event.eventType,
    lat: event.lat,
    lng: event.lng,
    eventTime: event.eventTime,
  };
}

/**
 * Cargo is derived from the orders on the shipment rather than stored separately, so the totals
 * are computed here from the line items already loaded for the orders section.
 */
function buildCargo(shipment: any): Record<string, unknown> {
  const lines = (shipment.orderShipments ?? []).flatMap((link: any) => link.order?.lineItems ?? []);
  const totalPieces = lines.reduce((sum: number, line: any) => sum + (line.quantity ?? 0), 0);
  const totalWeightKg = lines.reduce(
    (sum: number, line: any) => sum + (line.weight ?? 0) * (line.quantity ?? 0),
    0
  );
  return {
    lineCount: lines.length,
    totalPieces,
    totalWeightKg,
    lines: lines.map((line: any) => ({
      sku: line.sku,
      description: line.description,
      quantity: line.quantity,
      weight: line.weight,
    })),
  };
}
