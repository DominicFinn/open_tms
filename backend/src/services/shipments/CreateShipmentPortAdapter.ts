/**
 * TMS side of the ICreateShipmentPort (backend/src/ports/createShipment.ts).
 * WMS resolves the port token and never imports this class or the command
 * bus directly — see .claude/rules/module-boundaries.md.
 */

import { ICommandBus } from '../../commands/CommandBus.js';
import { CREATE_SHIPMENT, CreateShipmentPayload, CreateShipmentResult } from '../../commands/shipments/CreateShipmentCommand.js';
import { IShipmentsRepository } from '../../repositories/ShipmentsRepository.js';
import { CreateShipmentPortInput, CreateShipmentPortResult, CreatedShipmentSnapshot, ICreateShipmentPort } from '../../ports/createShipment.js';

export class CreateShipmentPortAdapter implements ICreateShipmentPort {
  constructor(
    private commandBus: ICommandBus,
    private shipmentsRepository: IShipmentsRepository,
  ) {}

  async createShipment(input: CreateShipmentPortInput): Promise<CreateShipmentPortResult> {
    const result = await this.commandBus.dispatch<CreateShipmentPayload, CreateShipmentResult>({
      type: CREATE_SHIPMENT,
      orgId: input.orgId,
      actorId: input.actorId,
      payload: {
        reference: input.reference,
        customerId: input.customerId,
        originId: input.originId,
        destinationId: input.destinationId,
        pickupDate: input.pickupDate,
        deliveryDate: input.deliveryDate,
        carrierId: input.carrierId,
      },
      metadata: { correlationId: input.reference, source: 'wms-create-shipment-port' },
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create shipment' };
    }

    const shipment = await this.shipmentsRepository.findById(result.data.id, input.orgId);
    if (!shipment) {
      return { success: false, error: 'Shipment created but could not be re-read' };
    }

    const snapshot: CreatedShipmentSnapshot = {
      id: shipment.id,
      reference: shipment.reference,
      status: shipment.status,
      customerId: shipment.customerId,
      customerName: shipment.customer?.name ?? null,
      originId: shipment.originId,
      originName: shipment.origin?.name ?? null,
      originCity: shipment.origin?.city ?? null,
      originState: shipment.origin?.state ?? null,
      destinationId: shipment.destinationId,
      destinationName: shipment.destination?.name ?? null,
      destinationCity: shipment.destination?.city ?? null,
      destinationState: shipment.destination?.state ?? null,
      carrierId: shipment.carrierId,
      pickupDate: shipment.pickupDate,
      deliveryDate: shipment.deliveryDate,
    };

    return { success: true, shipment: snapshot };
  }
}
