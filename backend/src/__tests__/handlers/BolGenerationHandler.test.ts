import { BolGenerationHandler } from '../../events/handlers/BolGenerationHandler';
import { LoadPlanBolLinkHandler } from '../../events/handlers/LoadPlanBolLinkHandler';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent, mockEventBus } from '../helpers/testUtils';

function build(alreadyGenerated = false) {
  const prisma = {
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(alreadyGenerated ? { id: 'evt-0' } : null) },
    loadPlan: { findFirst: jest.fn(), updateMany: jest.fn() },
  } as any;
  const documentService = {
    generateBOL: jest.fn().mockResolvedValue({ id: 'doc-1', fileName: 'BOL-001.pdf' }),
    generateLabels: jest.fn(),
    generateCustomsForm: jest.fn(),
    generateRateConfirmation: jest.fn(),
  };
  const { bus, fannedOut } = mockEventBus();

  return { handler: new BolGenerationHandler(prisma, documentService, bus), prisma, documentService, fannedOut };
}

const completedEvent = (payload: Record<string, unknown>, orgId = 'test-org') =>
  createTestEvent(EVENT_TYPES.LOAD_PLAN_COMPLETED, 'load_plan', 'lp-1', payload, { orgId });

describe('BolGenerationHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('subscribes to load plan completion only', () => {
    const { handler } = build();

    expect(handler.name).toBe('document.bol_generation');
    expect(handler.eventPatterns).toEqual([EVENT_TYPES.LOAD_PLAN_COMPLETED]);
  });

  it('generates the BOL and announces it, leaving the warehouse load plan alone (#359)', async () => {
    const { handler, prisma, documentService, fannedOut } = build();

    await handler.handle(completedEvent({ bolRequested: true, shipmentId: 'ship-1' }));

    expect(documentService.generateBOL).toHaveBeenCalledWith('test-org', 'ship-1', undefined, 'test-user');
    expect(prisma.loadPlan.findFirst).not.toHaveBeenCalled();
    expect(prisma.loadPlan.updateMany).not.toHaveBeenCalled();
    const published = fannedOut.find((e) => e.type === EVENT_TYPES.LOAD_PLAN_BOL_GENERATED);
    expect(published).toMatchObject({
      entityId: 'lp-1',
      orgId: 'test-org',
      payload: expect.objectContaining({ loadPlanId: 'lp-1', shipmentId: 'ship-1', documentId: 'doc-1' }),
    });
  });

  it('skips a load plan it already generated a BOL for, found in its own event log, so redelivery is safe', async () => {
    const { handler, prisma, documentService } = build(true);

    await handler.handle(completedEvent({ bolRequested: true, shipmentId: 'ship-1' }));

    expect(prisma.domainEventLog.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { orgId: 'test-org', type: EVENT_TYPES.LOAD_PLAN_BOL_GENERATED, entityType: 'load_plan', entityId: 'lp-1' },
    }));
    expect(documentService.generateBOL).not.toHaveBeenCalled();
  });

  it('does nothing when the warehouse did not ask for a BOL', async () => {
    const { handler, documentService } = build();

    await handler.handle(completedEvent({ bolRequested: false, shipmentId: 'ship-1' }));

    expect(documentService.generateBOL).not.toHaveBeenCalled();
  });

  it('does nothing when the load has no shipment to bill of lading against', async () => {
    const { handler, documentService } = build();

    await handler.handle(completedEvent({ bolRequested: true, shipmentId: null }));

    expect(documentService.generateBOL).not.toHaveBeenCalled();
  });
});

describe('LoadPlanBolLinkHandler', () => {
  const generated = (payload: Record<string, unknown>) =>
    createTestEvent(EVENT_TYPES.LOAD_PLAN_BOL_GENERATED, 'load_plan', 'lp-1', payload);

  it('records the document on the load plan, within the org, only if none is linked yet', async () => {
    const prisma = { loadPlan: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } } as any;

    await new LoadPlanBolLinkHandler(prisma).handle(generated({ loadPlanId: 'lp-1', documentId: 'doc-1' }));

    expect(prisma.loadPlan.updateMany).toHaveBeenCalledWith({
      where: { id: 'lp-1', orgId: 'test-org', bolDocumentId: null },
      data: { bolDocumentId: 'doc-1' },
    });
  });

  it('keeps the first document when a second arrives', async () => {
    const prisma = { loadPlan: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } } as any;

    await expect(new LoadPlanBolLinkHandler(prisma).handle(generated({ loadPlanId: 'lp-1', documentId: 'doc-2' }))).resolves.toBeUndefined();
  });

  it('ignores an event with no document', async () => {
    const prisma = { loadPlan: { updateMany: jest.fn() } } as any;

    await new LoadPlanBolLinkHandler(prisma).handle(generated({ loadPlanId: 'lp-1' }));

    expect(prisma.loadPlan.updateMany).not.toHaveBeenCalled();
  });
});
