import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import type { IBinaryStorageProvider } from '../../storage/IBinaryStorageProvider.js';
import type {
  IReturnLabelProviderRegistry,
  ReturnLabelAddress,
  ReturnLabelParcel,
} from '../../services/returnLabel/IReturnLabelProvider.js';

export interface GenerateReturnLabelPayload {
  rmaId: string;
  carrierId?: string;
  providerOverride?: string;      // admin can force a provider (e.g. "manual")
  serviceLevel?: string;
  from: ReturnLabelAddress;       // origin = customer returning the goods
  to: ReturnLabelAddress;         // destination = our receiving warehouse
  parcels: ReturnLabelParcel[];
  reference?: string;
}

export const GENERATE_RETURN_LABEL = 'rma.generate_return_label';

export class GenerateReturnLabelCommandHandler extends BaseCommandHandler<
  GenerateReturnLabelPayload,
  {
    rmaId: string;
    trackingNumber: string;
    labelStorageKey: string;
    labelFormat: string;
    provider: string;
  }
> {
  readonly commandType = GENERATE_RETURN_LABEL;

  constructor(
    prisma: PrismaClient,
    eventBus: PgBossEventBus,
    private providerRegistry: IReturnLabelProviderRegistry,
    private binaryStorage: IBinaryStorageProvider,
  ) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<GenerateReturnLabelPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ) {
    const p = command.payload;
    const rma = await tx.rma.findUnique({ where: { id: p.rmaId } });
    if (!rma) throw new Error(`RMA ${p.rmaId} not found`);
    if (rma.status === 'rejected') throw new Error('Cannot generate return label for a rejected RMA');
    if (rma.status === 'completed') throw new Error('Cannot generate return label for a completed RMA');

    let providerName = p.providerOverride ?? null;
    let carrierAccountNumber: string | undefined;
    let defaultService: string | undefined;
    const carrierId = p.carrierId ?? rma.returnCarrierId ?? null;

    if (!providerName && carrierId) {
      const carrier = await tx.carrier.findUnique({ where: { id: carrierId } });
      if (carrier) {
        providerName = carrier.returnLabelProvider ?? null;
        carrierAccountNumber = carrier.returnLabelAccountNumber ?? undefined;
        defaultService = carrier.returnLabelDefaultService ?? undefined;
      }
    }
    if (!providerName) providerName = 'manual';

    const provider = this.providerRegistry.get(providerName);
    const serviceLevel = p.serviceLevel ?? defaultService ?? 'ground';

    const labelResult = await provider.generateLabel({
      rmaId: rma.id,
      rmaNumber: rma.rmaNumber,
      serviceLevel,
      from: p.from,
      to: p.to,
      parcels: p.parcels,
      carrierAccountNumber,
      reference: p.reference ?? rma.rmaNumber,
    });

    const storageKey = `files/${randomUUID()}`;
    await this.binaryStorage.store(storageKey, labelResult.labelContent, {
      entityType: 'rma_return_label',
      entityId: rma.id,
      format: labelResult.labelFormat,
      tracking: labelResult.trackingNumber,
    });

    await tx.rma.update({
      where: { id: rma.id },
      data: {
        returnCarrierId: carrierId,
        returnServiceLevel: serviceLevel,
        returnTrackingNumber: labelResult.trackingNumber,
        returnLabelStorageKey: storageKey,
        returnLabelFormat: labelResult.labelFormat,
        returnLabelGeneratedAt: new Date(),
        returnLabelProvider: providerName,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RMA_RETURN_LABEL_GENERATED,
      entityType: 'rma',
      entityId: rma.id,
      payload: {
        rmaNumber: rma.rmaNumber,
        customerId: rma.customerId,
        provider: providerName,
        carrierId,
        serviceLevel,
        trackingNumber: labelResult.trackingNumber,
        labelStorageKey: storageKey,
        labelFormat: labelResult.labelFormat,
      },
    }));

    return {
      rmaId: rma.id,
      trackingNumber: labelResult.trackingNumber,
      labelStorageKey: storageKey,
      labelFormat: labelResult.labelFormat,
      provider: providerName,
    };
  }
}

