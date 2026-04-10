export type { Command, CommandResult, ICommandHandler, CommandMetadata } from './types.js';
export type { ICommandBus } from './CommandBus.js';
export { CommandBus } from './CommandBus.js';
export { BaseCommandHandler } from './BaseCommandHandler.js';
export type { TransactionClient, EmitFn } from './BaseCommandHandler.js';

// Order commands
export { CreateOrderCommandHandler, CREATE_ORDER } from './orders/index.js';
export { UpdateOrderCommandHandler, UPDATE_ORDER } from './orders/index.js';
export { ArchiveOrderCommandHandler, ARCHIVE_ORDER } from './orders/index.js';

// Shipment commands
export { CreateShipmentCommandHandler, CREATE_SHIPMENT } from './shipments/index.js';
export { UpdateShipmentCommandHandler, UPDATE_SHIPMENT } from './shipments/index.js';
export { ArchiveShipmentCommandHandler, ARCHIVE_SHIPMENT } from './shipments/index.js';

// Carrier commands
export { CreateCarrierCommandHandler, CREATE_CARRIER } from './carriers/index.js';
export { UpdateCarrierCommandHandler, UPDATE_CARRIER } from './carriers/index.js';
export { ArchiveCarrierCommandHandler, ARCHIVE_CARRIER } from './carriers/index.js';

// Customer commands
export { CreateCustomerCommandHandler, CREATE_CUSTOMER } from './customers/index.js';
export { UpdateCustomerCommandHandler, UPDATE_CUSTOMER } from './customers/index.js';
export { ArchiveCustomerCommandHandler, ARCHIVE_CUSTOMER } from './customers/index.js';

// Location commands
export { CreateLocationCommandHandler, CREATE_LOCATION } from './locations/index.js';
export { UpdateLocationCommandHandler, UPDATE_LOCATION } from './locations/index.js';

// Lane commands
export { CreateLaneCommandHandler, CREATE_LANE } from './lanes/index.js';
export { UpdateLaneCommandHandler, UPDATE_LANE } from './lanes/index.js';
export { ArchiveLaneCommandHandler, ARCHIVE_LANE } from './lanes/index.js';
