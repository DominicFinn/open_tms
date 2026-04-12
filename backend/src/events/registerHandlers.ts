/**
 * Registers all event handlers with the event bus.
 * Called by the worker process on startup.
 */

import { PrismaClient } from '@prisma/client';
import { IEventBus } from './IEventBus.js';
import { IEventHandler } from './IEventHandler.js';
import { IEmailService } from '../services/IEmailService.js';
import { AuditHandler } from './handlers/AuditHandler.js';
import { InAppNotificationHandler } from './handlers/InAppNotificationHandler.js';
import { EmailHandler } from './handlers/EmailHandler.js';
import { OrderProjection } from './projections/OrderProjection.js';
import { ShipmentProjection } from './projections/ShipmentProjection.js';
import { CarrierProjection } from './projections/CarrierProjection.js';
import { CustomerProjection } from './projections/CustomerProjection.js';
import { LaneProjection } from './projections/LaneProjection.js';
import { IssueProjection } from './projections/IssueProjection.js';
import { ColdChainComplianceHandler } from './handlers/ColdChainComplianceHandler.js';
import { AutoTenderHandler } from './handlers/AutoTenderHandler.js';
import { ShipmentCompletionHandler } from './handlers/ShipmentCompletionHandler.js';
import { SlaEvaluationHandler } from './handlers/SlaEvaluationHandler.js';
import { SlaEvaluationService } from '../services/SlaEvaluationService.js';
import { SlaRepository } from '../repositories/SlaRepository.js';
import { Edi214ForwardHandler } from './handlers/Edi214ForwardHandler.js';
import { EDI214Service } from '../services/EDI214Service.js';
import { OutboundEdiDeliveryService } from '../services/OutboundEdiDeliveryService.js';
import { TradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';
import { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';
import { AgentDecisionProjection } from './projections/AgentDecisionProjection.js';
import { TriageAgentHandler } from './handlers/TriageAgentHandler.js';
import { AutomationRuleHandler } from './handlers/AutomationRuleHandler.js';
import { ILlmProvider } from '../services/llm/ILlmProvider.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { SkillRegistry } from '../services/skills/SkillRegistry.js';

/** Read concurrency from env with a default */
function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

/**
 * Concurrency overrides via environment variables.
 * Set PROJECTION_CONCURRENCY, AUDIT_CONCURRENCY, or EMAIL_CONCURRENCY
 * to tune handler throughput per worker instance.
 */
const CONCURRENCY_OVERRIDES: Record<string, () => number> = {
  'audit': () => envInt('AUDIT_CONCURRENCY', 5),
  'projection.order': () => envInt('PROJECTION_CONCURRENCY', 3),
  'projection.shipment': () => envInt('PROJECTION_CONCURRENCY', 3),
  'projection.carrier': () => envInt('PROJECTION_CONCURRENCY', 3),
  'projection.customer': () => envInt('PROJECTION_CONCURRENCY', 3),
  'projection.lane': () => envInt('PROJECTION_CONCURRENCY', 3),
  'projection.issue': () => envInt('PROJECTION_CONCURRENCY', 3),
  'projection.agent_decision': () => envInt('PROJECTION_CONCURRENCY', 3),
  'notification.email': () => envInt('EMAIL_CONCURRENCY', 2),
  'agent.triage': () => envInt('AGENT_TRIAGE_CONCURRENCY', 2),
  'automation.rules': () => envInt('AUTOMATION_RULES_CONCURRENCY', 4),
};

export async function registerEventHandlers(
  eventBus: IEventBus,
  prisma: PrismaClient,
  emailService?: IEmailService,
  storageProvider?: IBinaryStorageProvider,
  llmProvider?: ILlmProvider,
  commandBus?: ICommandBus,
  skillRegistry?: SkillRegistry,
): Promise<void> {
  const handlers: IEventHandler[] = [
    new AuditHandler(prisma),
    new InAppNotificationHandler(prisma),
    // CQRS read model projections
    new OrderProjection(prisma),
    new ShipmentProjection(prisma),
    new CarrierProjection(prisma),
    new CustomerProjection(prisma),
    new LaneProjection(prisma),
    new IssueProjection(prisma),
    new AgentDecisionProjection(prisma),
  ];

  // Add email handler if email service is available
  if (emailService) {
    handlers.push(new EmailHandler(prisma, emailService));
  }

  // Add cold chain compliance handler if storage provider is available
  if (storageProvider) {
    handlers.push(new ColdChainComplianceHandler(prisma, storageProvider));
  }

  // Auto-tender handler: creates tenders for laneless shipments when autoTenderEnabled
  handlers.push(new AutoTenderHandler(prisma));

  // Shipment completion handler: auto-delivers when destination arrival criteria met
  handlers.push(new ShipmentCompletionHandler(prisma, eventBus));

  // Add SLA evaluation handler
  {
    const slaRepo = new SlaRepository(prisma);
    const slaService = new SlaEvaluationService(prisma, slaRepo, eventBus);
    handlers.push(new SlaEvaluationHandler(prisma, slaService));
  }

  // Add EDI 214 auto-forward handler
  const tradingPartnerRepo = new TradingPartnerRepository(prisma);
  const edi214GenerationService = new EDI214Service();
  const outboundDeliveryService = new OutboundEdiDeliveryService(tradingPartnerRepo);
  handlers.push(new Edi214ForwardHandler(prisma, edi214GenerationService, outboundDeliveryService));

  // Add automation rule handler (runs before triage agent — deterministic rules take priority)
  if (skillRegistry) {
    handlers.push(new AutomationRuleHandler(prisma, skillRegistry));
    console.log('[EventBus] Automation rule handler enabled');
  }

  // Add triage agent handler if LLM provider and command bus are available
  if (llmProvider && commandBus) {
    handlers.push(new TriageAgentHandler(prisma, llmProvider, commandBus));
    console.log('[EventBus] Triage agent enabled (LLM provider configured)');
  }

  for (const handler of handlers) {
    // Apply env-based concurrency overrides
    const options = { ...handler.options };
    const override = CONCURRENCY_OVERRIDES[handler.name];
    if (override) {
      options.concurrency = override();
    }

    await eventBus.subscribe(
      handler.name,
      handler.eventPatterns,
      (event) => handler.handle(event),
      options
    );
    console.log(`[EventBus] Registered handler: ${handler.name} (concurrency: ${options.concurrency ?? 'default'}, patterns: ${handler.eventPatterns.join(', ')})`);
  }
}
