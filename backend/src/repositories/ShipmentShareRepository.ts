/**
 * ShipmentShareRepository — reads and writes for shipment share links and their access ledger.
 *
 * The link and its access rows are one aggregate: a link is only ever read alongside the record
 * of who opened it, and the ledger has no meaning without its link. They share a repository.
 *
 * Every tenant-scoped method takes orgId and filters on it. `findByTokenHash` is the exception
 * and deliberately so: the public surface has no authenticated principal to derive a scope from,
 * so the token itself is the scope, and the row it resolves to carries the orgId everything
 * downstream is filtered by.
 */

import { PrismaClient } from '@prisma/client';

export interface ShipmentShareLinkDto {
  id: string;
  orgId: string;
  shipmentId: string;
  label: string | null;
  sections: string[];
  expiresAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
  createdBy: string;
  accessCount: number;
  lastAccessedAt: Date | null;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The link plus the two hashes. Never leaves the service layer. */
export interface ShipmentShareLinkSecretDto extends ShipmentShareLinkDto {
  accessCodeHash: string;
  failedAttempts: number;
}

export interface ShipmentShareAccessDto {
  id: string;
  shareLinkId: string;
  email: string;
  outcome: string;
  createdAt: Date;
}

export interface RecordShareAccessInput {
  orgId: string;
  shareLinkId: string;
  shipmentId: string;
  email: string;
  ipHash: string | null;
  outcome: string;
}

export interface IShipmentShareRepository {
  listForShipment(orgId: string, shipmentId: string): Promise<ShipmentShareLinkDto[]>;
  findById(orgId: string, id: string): Promise<ShipmentShareLinkDto | null>;
  findByTokenHash(tokenHash: string): Promise<ShipmentShareLinkSecretDto | null>;
  listAccesses(
    orgId: string,
    shareLinkId: string,
    page: number,
    perPage: number
  ): Promise<{ items: ShipmentShareAccessDto[]; total: number }>;
}

/** Columns safe to hand outside the service layer. Excludes both hashes. */
const PUBLIC_LINK_FIELDS = {
  id: true,
  orgId: true,
  shipmentId: true,
  label: true,
  sections: true,
  expiresAt: true,
  revokedAt: true,
  revokedBy: true,
  createdBy: true,
  accessCount: true,
  lastAccessedAt: true,
  lockedUntil: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class ShipmentShareRepository implements IShipmentShareRepository {
  constructor(private prisma: PrismaClient) {}

  async listForShipment(orgId: string, shipmentId: string): Promise<ShipmentShareLinkDto[]> {
    return this.prisma.shipmentShareLink.findMany({
      where: { orgId, shipmentId },
      select: PUBLIC_LINK_FIELDS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(orgId: string, id: string): Promise<ShipmentShareLinkDto | null> {
    return this.prisma.shipmentShareLink.findFirst({
      where: { id, orgId },
      select: PUBLIC_LINK_FIELDS,
    });
  }

  async findByTokenHash(tokenHash: string): Promise<ShipmentShareLinkSecretDto | null> {
    return this.prisma.shipmentShareLink.findUnique({
      where: { tokenHash },
      select: { ...PUBLIC_LINK_FIELDS, accessCodeHash: true, failedAttempts: true },
    });
  }

  async listAccesses(
    orgId: string,
    shareLinkId: string,
    page: number,
    perPage: number
  ): Promise<{ items: ShipmentShareAccessDto[]; total: number }> {
    const where = { orgId, shareLinkId };
    const [items, total] = await Promise.all([
      this.prisma.shipmentShareAccess.findMany({
        where,
        select: { id: true, shareLinkId: true, email: true, outcome: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.shipmentShareAccess.count({ where }),
    ]);
    return { items, total };
  }
}

/**
 * The shipment data a share link may expose, loaded section by section.
 *
 * Only the granted sections are queried. A viewer granted `overview` alone never causes an
 * orders or telemetry read, so an unshared section cannot leak through an over-eager include
 * and cannot be paid for in query time either.
 */
export interface ShareableShipmentQuery {
  orgId: string;
  shipmentId: string;
  sections: readonly string[];
}

export class ShipmentShareViewRepository {
  constructor(private prisma: PrismaClient) {}

  async findShipment(query: ShareableShipmentQuery) {
    const { orgId, shipmentId, sections } = query;
    const wants = (section: string) => sections.includes(section);

    return this.prisma.shipment.findFirst({
      where: { id: shipmentId, orgId, deletedAt: null },
      select: {
        id: true,
        reference: true,
        status: true,
        hasException: true,
        serviceLevel: true,
        proNumber: true,
        pickupDate: true,
        deliveryDate: true,
        origin: { select: { name: true, city: true, state: true, country: true } },
        destination: { select: { name: true, city: true, state: true, country: true } },
        stops: {
          select: {
            sequenceNumber: true,
            stopType: true,
            status: true,
            actualArrival: true,
            actualDeparture: true,
            location: { select: { name: true, city: true, state: true, country: true } },
          },
          orderBy: { sequenceNumber: 'asc' },
        },
        carrier: wants('carrier') ? { select: { name: true, scacCode: true } } : false,
        events: wants('events')
          ? {
              select: {
                eventType: true,
                description: true,
                address: true,
                locationSummary: true,
                lat: true,
                lng: true,
                eventTime: true,
              },
              orderBy: { eventTime: 'desc' },
              take: 50,
            }
          : false,
        // Cargo totals are derived from the same order line items, so either section pulls them.
        orderShipments: wants('orders') || wants('cargo')
          ? {
              select: {
                order: {
                  select: {
                    orderNumber: true,
                    poNumber: true,
                    status: true,
                    lineItems: {
                      select: { sku: true, description: true, quantity: true, weight: true },
                    },
                  },
                },
              },
            }
          : false,
        sensorReadings: wants('telemetry')
          ? {
              select: {
                eventTime: true,
                temperature: true,
                lightLevel: true,
                impactG: true,
                isAlert: true,
              },
              orderBy: { eventTime: 'desc' },
              take: 200,
            }
          : false,
      },
    });
  }

  /**
   * Documents attach to a shipment by a plain id rather than a relation, so they are read
   * separately. Binary content is deliberately not selected: a share view lists what exists and
   * links to the permission-checked download route, it does not hand out file bytes inline.
   *
   * GeneratedDocument carries no orgId of its own, so tenancy is enforced one step earlier: the
   * caller must have already resolved the shipment through `findShipment`, which is org-scoped.
   * Never call this with a shipment id that has not been through that check.
   */
  async findDocuments(shipmentId: string) {
    return this.prisma.generatedDocument.findMany({
      where: { shipmentId, documentType: { in: SHAREABLE_DOCUMENT_TYPES } },
      select: {
        id: true,
        documentType: true,
        documentNumber: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

/**
 * BUSINESS RULE: only transport paperwork is shareable. Customs declarations and rate
 * confirmations carry commercial and regulatory detail that belongs between the organisation,
 * its carrier and the authorities, never on a link sent to a consignee.
 */
export const SHAREABLE_DOCUMENT_TYPES = ['bol', 'label', 'attachment'];
