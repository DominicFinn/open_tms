/**
 * Mint a public share link for one shipment.
 *
 * Concurrency: nothing contends on creation. Each dispatch inserts one new row and the token is
 * 256 bits of randomness, so two concurrent creates cannot collide on the unique token hash. The
 * shipment is re-read inside the transaction so a shipment deleted or moved between the route's
 * permission check and the write cannot have a link minted against it.
 *
 * The plaintext token and access code are returned to the caller once, in the command result,
 * and are never persisted, logged, or put on the emitted event.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { IShipmentShareService } from '../../services/ShipmentShareService.js';
import { normaliseShareSections } from '@open-tms/shared';

export const CREATE_SHIPMENT_SHARE_LINK = 'shipment_share_link.create';

/** Route maps this onto 404 so a cross-tenant shipment id stays indistinguishable from a typo. */
export const SHARE_LINK_SHIPMENT_NOT_FOUND = 'SHIPMENT_NOT_FOUND';
export const SHARE_LINK_NO_SECTIONS = 'AT_LEAST_ONE_SECTION_REQUIRED';
export const SHARE_LINK_EXPIRY_IN_PAST = 'EXPIRY_MUST_BE_IN_THE_FUTURE';

export interface CreateShipmentShareLinkPayload {
  shipmentId: string;
  sections: string[];
  expiresAt: string | Date;
  label?: string | null;
}

export interface CreateShipmentShareLinkResult {
  id: string;
  shipmentId: string;
  sections: string[];
  expiresAt: Date;
  label: string | null;
  /** Shown to the operator once. Not recoverable afterwards. */
  token: string;
  accessCode: string;
}

export class CreateShipmentShareLinkCommandHandler extends BaseCommandHandler<
  CreateShipmentShareLinkPayload,
  CreateShipmentShareLinkResult
> {
  readonly commandType = CREATE_SHIPMENT_SHARE_LINK;

  constructor(
    prisma: PrismaClient,
    eventBus: PgBossEventBus,
    private shareService: IShipmentShareService
  ) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateShipmentShareLinkPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateShipmentShareLinkResult> {
    const { shipmentId, label } = command.payload;

    // Unknown section keys are dropped rather than rejected, so a stale client cannot widen
    // what it was granted and cannot fail a create by sending one extra key.
    const sections = normaliseShareSections(command.payload.sections ?? []);
    if (sections.length === 0) throw new Error(SHARE_LINK_NO_SECTIONS);

    const expiresAt = new Date(command.payload.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new Error(SHARE_LINK_EXPIRY_IN_PAST);
    }

    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, orgId: command.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!shipment) throw new Error(SHARE_LINK_SHIPMENT_NOT_FOUND);

    const credentials = this.shareService.mintCredentials();

    const link = await tx.shipmentShareLink.create({
      data: {
        orgId: command.orgId,
        shipmentId,
        tokenHash: credentials.tokenHash,
        accessCodeHash: credentials.accessCodeHash,
        label: label ?? null,
        sections,
        expiresAt,
        createdBy: command.actorId ?? 'system',
      },
      select: { id: true, label: true, sections: true, expiresAt: true },
    });

    emit(
      this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_SHARE_LINK_CREATED,
        entityType: 'shipment',
        entityId: shipmentId,
        payload: {
          shareLinkId: link.id,
          shipmentId,
          sections: link.sections,
          expiresAt: link.expiresAt.toISOString(),
        },
      })
    );

    return {
      id: link.id,
      shipmentId,
      sections: link.sections,
      expiresAt: link.expiresAt,
      label: link.label,
      token: credentials.token,
      accessCode: credentials.accessCode,
    };
  }
}
