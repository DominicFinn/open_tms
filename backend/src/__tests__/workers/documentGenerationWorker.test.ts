import { createDocumentGenerationWorker } from '../../workers/documentGenerationWorker';

function buildPrisma() {
  return {
    generatedDocument: {
      findUnique: jest.fn().mockResolvedValue({ metadata: null }),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

function buildDocService(overrides: any = {}) {
  return {
    generateBOL: jest.fn().mockResolvedValue({ id: 'doc-bol-1', fileName: 'BOL-001.pdf' }),
    generateLabels: jest.fn().mockResolvedValue({ id: 'doc-lbl-1', fileName: 'LBL-001.pdf' }),
    generateCustomsForm: jest.fn().mockResolvedValue({ id: 'doc-cus-1', fileName: 'CUS-001.pdf' }),
    generateRateConfirmation: jest.fn().mockResolvedValue({ id: 'doc-rc-1', fileName: 'RC-001.pdf' }),
    ...overrides,
  } as any;
}

describe('documentGenerationWorker', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('routes BOL jobs to generateBOL with the correct args', async () => {
    const prisma = buildPrisma();
    const docService = buildDocService();
    const worker = createDocumentGenerationWorker(docService, prisma);

    await worker({
      type: 'document.generation',
      payload: {
        kind: 'bol',
        entityId: 'ship-1',
        templateId: 'tpl-1',
        correlationId: 'corr-1',
        requestedBy: 'user-1',
      },
    });

    expect(docService.generateBOL).toHaveBeenCalledWith('ship-1', 'tpl-1', 'user-1');
  });

  it('routes labels/customs/rate_confirmation correctly', async () => {
    const prisma = buildPrisma();
    const docService = buildDocService();
    const worker = createDocumentGenerationWorker(docService, prisma);

    await worker({ type: 'x', payload: { kind: 'labels', entityId: 'ord-1', correlationId: 'c1' } });
    expect(docService.generateLabels).toHaveBeenCalledWith('ord-1', undefined, undefined);

    await worker({ type: 'x', payload: { kind: 'customs', entityId: 'ship-1', correlationId: 'c2' } });
    expect(docService.generateCustomsForm).toHaveBeenCalledWith('ship-1', undefined, undefined);

    await worker({ type: 'x', payload: { kind: 'rate_confirmation', entityId: 'ship-1', correlationId: 'c3' } });
    expect(docService.generateRateConfirmation).toHaveBeenCalledWith('ship-1', undefined);
  });

  it('stamps the correlationId onto GeneratedDocument metadata', async () => {
    const prisma = buildPrisma();
    prisma.generatedDocument.findUnique.mockResolvedValue({ metadata: { source: 'manual' } });
    const docService = buildDocService();
    const worker = createDocumentGenerationWorker(docService, prisma);

    await worker({
      type: 'x',
      payload: { kind: 'bol', entityId: 'ship-1', correlationId: 'corr-xyz' },
    });

    expect(prisma.generatedDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-bol-1' },
      // existing metadata is preserved, correlationId + kind are added
      data: { metadata: { source: 'manual', correlationId: 'corr-xyz', generationKind: 'bol' } },
    });
  });

  it('rejects payloads missing kind or entityId', async () => {
    const worker = createDocumentGenerationWorker(buildDocService(), buildPrisma());

    await expect(worker({ type: 'x', payload: { entityId: 'x' } as any })).rejects.toThrow(/Invalid/);
    await expect(worker({ type: 'x', payload: { kind: 'bol' } as any })).rejects.toThrow(/Invalid/);
  });

  it('re-throws service errors so pg-boss can retry the job', async () => {
    const docService = buildDocService({
      generateBOL: jest.fn().mockRejectedValue(new Error('PDF render crashed')),
    });
    const prisma = buildPrisma();
    const worker = createDocumentGenerationWorker(docService, prisma);

    await expect(worker({
      type: 'x',
      payload: { kind: 'bol', entityId: 'ship-1', correlationId: 'c1' },
    })).rejects.toThrow('PDF render crashed');

    expect(prisma.generatedDocument.update).not.toHaveBeenCalled();
  });
});
