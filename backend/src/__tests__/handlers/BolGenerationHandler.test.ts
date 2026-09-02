import { BolGenerationHandler } from '../../events/handlers/BolGenerationHandler';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent, mockEventBus } from '../helpers/testUtils';

function build(loadPlan: { id: string; bolDocumentId: string | null } | null = { id: 'lp-1', bolDocumentId: null }) {
  const prisma = {
    loadPlan: {
      findFirst: jest.fn().mockResolvedValue(loadPlan),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
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

const completedEvent = (payload: Record<string, unknown>) =>
  createTestEvent(EVENT_TYPES.LOAD_PLAN_COMPLETED, 'load_plan', 'lp-1', payload);

describe('BolGenerationHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('subscribes to load plan completion only', () => {
    const { handler } = build();

    expect(handler.name).toBe('document.bol_generation');
    expect(handler.eventPatterns).toEqual([EVENT_TYPES.LOAD_PLAN_COMPLETED]);
  });

  it('generates the BOL and links it to the load plan', async () => {
    const { handler, prisma, documentService } = build();

    await handler.handle(completedEvent({ bolRequested: true, shipmentId: 'ship-1' }));

    expect(documentService.generateBOL).toHaveBeenCalledWith('ship-1', undefined, expect.anything());
    expect(prisma.loadPlan.updateMany).toHaveBeenCalledWith({
      where: { id: 'lp-1', orgId: 'test-org', bolDocumentId: null },
      data: { bolDocumentId: 'doc-1' },
    });
  });

  it('emits load_plan.bol_generated once the document exists', async () => {
    const { handler, fannedOut } = build();

    await handler.handle(completedEvent({ bolRequested: true, shipmentId: 'ship-1' }));

    const emitted = fannedOut.find((e) => e.type === EVENT_TYPES.LOAD_PLAN_BOL_GENERATED);
    expect(emitted?.payload).toEqual(
      expect.objectContaining({ loadPlanId: 'lp-1', shipmentId: 'ship-1', documentId: 'doc-1' })
    );
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

  it('skips a load plan that already has a BOL, so redelivery is safe', async () => {
    const { handler, documentService } = build({ id: 'lp-1', bolDocumentId: 'doc-existing' });

    await handler.handle(completedEvent({ bolRequested: true, shipmentId: 'ship-1' }));

    expect(documentService.generateBOL).not.toHaveBeenCalled();
  });

  it('discards its document when a concurrent delivery won the claim', async () => {
    const { handler, prisma, fannedOut } = build();
    prisma.loadPlan.updateMany.mockResolvedValue({ count: 0 });

    await handler.handle(completedEvent({ bolRequested: true, shipmentId: 'ship-1' }));

    expect(fannedOut.find((e) => e.type === EVENT_TYPES.LOAD_PLAN_BOL_GENERATED)).toBeUndefined();
  });

  it('ignores a load plan from another org', async () => {
    const { handler, prisma, documentService } = build(null);

    await handler.handle(completedEvent({ bolRequested: true, shipmentId: 'ship-1' }));

    expect(prisma.loadPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lp-1', orgId: 'test-org' } })
    );
    expect(documentService.generateBOL).not.toHaveBeenCalled();
  });
});
