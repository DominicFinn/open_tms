import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateTradingPartnerPayload {
  name: string;
  entityType?: string;
  sftpHost?: string;
  sftpPort?: number;
  sftpUsername?: string;
  sftpPassword?: string;
  sftpBasePath?: string;
  httpEndpoint?: string;
  httpAuthType?: string;
  httpAuthCredentials?: any;
  inboundEnabled?: boolean;
  outboundEnabled?: boolean;
  [key: string]: any;
}

export const CREATE_TRADING_PARTNER = 'trading_partner.create';

export class CreateTradingPartnerCommandHandler extends BaseCommandHandler<CreateTradingPartnerPayload, { id: string; name: string }> {
  readonly commandType = CREATE_TRADING_PARTNER;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<CreateTradingPartnerPayload>, tx: TransactionClient, emit: EmitFn) {
    const partner = await tx.tradingPartner.create({ data: command.payload as any });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRADING_PARTNER_CREATED,
      entityType: 'trading_partner',
      entityId: partner.id,
      payload: { name: partner.name, entityType: partner.entityType },
    }));

    return { id: partner.id, name: partner.name };
  }
}
