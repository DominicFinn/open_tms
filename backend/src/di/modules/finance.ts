/**
 * Finance: charges, invoices, payments, commissions.
 *
 * Module: finance. Registered by di/registry.ts, which is the composition root.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import { PrismaClient } from '@prisma/client';
import { container } from '../container.js';
import { TOKENS } from '../tokens.js';
import { CommandBus } from '../../commands/CommandBus.js';
import type { CommandHandlerDeps } from '../moduleRegistration.js';
import { ChargeRepository } from '../../repositories/ChargeRepository.js';
import { ChargeService } from '../../services/ChargeService.js';
import { CreateChargeCommandHandler } from '../../commands/charges/CreateChargeCommand.js';
import { ApproveChargeCommandHandler } from '../../commands/charges/ApproveChargeCommand.js';
import { InvoiceRepository, PaymentRepository } from '../../repositories/InvoiceRepository.js';
import { InvoicingService } from '../../services/InvoicingService.js';
import { CreateInvoiceCommandHandler } from '../../commands/invoices/CreateInvoiceCommand.js';
import { CarrierInvoiceRepository } from '../../repositories/CarrierInvoiceRepository.js';
import { FreightAuditService } from '../../services/FreightAuditService.js';
import { ReceiveCarrierInvoiceCommandHandler } from '../../commands/carrierInvoices/ReceiveCarrierInvoiceCommand.js';
import { FinancialQueryRepository, CreditNoteRepository } from '../../repositories/FinancialQueryRepository.js';
import { RaiseQueryCommandHandler } from '../../commands/queries/RaiseQueryCommand.js';
import { ResolveQueryCommandHandler } from '../../commands/queries/ResolveQueryCommand.js';
import { ReweighAdjustmentCommandHandler } from '../../commands/charges/ReweighAdjustmentCommand.js';
import { ApproveCarrierInvoiceCommandHandler } from '../../commands/carrierInvoices/ApproveCarrierInvoiceCommand.js';
import { RecordCarrierPaymentCommandHandler } from '../../commands/carrierInvoices/RecordCarrierPaymentCommand.js';
import { ApproveInvoiceCommandHandler } from '../../commands/invoices/ApproveInvoiceCommand.js';
import { SendInvoiceCommandHandler } from '../../commands/invoices/SendInvoiceCommand.js';
import { RecordPaymentCommandHandler } from '../../commands/invoices/RecordPaymentCommand.js';
import { VoidInvoiceCommandHandler } from '../../commands/invoices/VoidInvoiceCommand.js';

export function registerFinanceDependencies(prisma: PrismaClient): void {
  container.singleton(TOKENS.IChargeRepository).toFactory(() => {
    return new ChargeRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IChargeService).toFactory(() => {
    return new ChargeService(
      container.resolve(TOKENS.IChargeRepository),
      container.resolve(TOKENS.PrismaClient),
    );
  });

  container.singleton(TOKENS.IInvoiceRepository).toFactory(() => {
    return new InvoiceRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IPaymentRepository).toFactory(() => {
    return new PaymentRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IInvoicingService).toFactory(() => {
    return new InvoicingService(
      container.resolve(TOKENS.IInvoiceRepository),
      container.resolve(TOKENS.IChargeRepository),
      container.resolve(TOKENS.PrismaClient),
    );
  });

  container.singleton(TOKENS.ICarrierInvoiceRepository).toFactory(() => {
    return new CarrierInvoiceRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IFreightAuditService).toFactory(() => {
    return new FreightAuditService(
      container.resolve(TOKENS.IChargeRepository),
      container.resolve(TOKENS.PrismaClient),
    );
  });

  container.singleton(TOKENS.IFinancialQueryRepository).toFactory(() => {
    return new FinancialQueryRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICreditNoteRepository).toFactory(() => {
    return new CreditNoteRepository(container.resolve(TOKENS.PrismaClient));
  });
}

export function registerFinanceCommandHandlers(bus: CommandBus, deps: CommandHandlerDeps): void {
  const { prisma, eventBus } = deps;
  bus.register(new CreateChargeCommandHandler(prisma, eventBus));
  bus.register(new ApproveChargeCommandHandler(prisma, eventBus));

  // Invoice commands
  bus.register(new CreateInvoiceCommandHandler(prisma, eventBus));
  bus.register(new ApproveInvoiceCommandHandler(prisma, eventBus));
  bus.register(new SendInvoiceCommandHandler(prisma, eventBus));
  bus.register(new RecordPaymentCommandHandler(prisma, eventBus));
  bus.register(new VoidInvoiceCommandHandler(prisma, eventBus));

  // Carrier invoice commands
  bus.register(new ReceiveCarrierInvoiceCommandHandler(prisma, eventBus));
  bus.register(new ApproveCarrierInvoiceCommandHandler(prisma, eventBus));
  bus.register(new RecordCarrierPaymentCommandHandler(prisma, eventBus));

  // Billing query commands
  bus.register(new RaiseQueryCommandHandler(prisma, eventBus));
  bus.register(new ResolveQueryCommandHandler(prisma, eventBus));
  bus.register(new ReweighAdjustmentCommandHandler(prisma, eventBus));
}
