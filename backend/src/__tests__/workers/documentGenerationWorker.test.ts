import { createDocumentGenerationWorker } from '../../workers/documentGenerationWorker';

function buildDocRepo() {
  return {
    mergeMetadata: jest.fn().mockResolvedValue(undefined),
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

  it('routes BOL jobs to generateBOL with the job org and the correct args', async () => {
    const docService = buildDocService();
    const worker = createDocumentGenerationWorker(docService, buildDocRepo());

    await worker({
      type: 'document.generation',
      payload: {
        kind: 'bol',
        entityId: 'ship-1',
        templateId: 'tpl-1',
        correlationId: 'corr-1',
        requestedBy: 'user-1',
        orgId: 'org-a',
      },
    });

    expect(docService.generateBOL).toHaveBeenCalledWith('org-a', 'ship-1', 'tpl-1', 'user-1');
  });

  it('routes labels/customs/rate_confirmation correctly', async () => {
    const docService = buildDocService();
    const worker = createDocumentGenerationWorker(docService, buildDocRepo());

    await worker({ type: 'x', payload: { kind: 'labels', entityId: 'ord-1', correlationId: 'c1', orgId: 'org-a' } });
    expect(docService.generateLabels).toHaveBeenCalledWith('org-a', 'ord-1', undefined, undefined);

    await worker({ type: 'x', payload: { kind: 'customs', entityId: 'ship-1', correlationId: 'c2', orgId: 'org-a' } });
    expect(docService.generateCustomsForm).toHaveBeenCalledWith('org-a', 'ship-1', undefined, undefined);

    await worker({ type: 'x', payload: { kind: 'rate_confirmation', entityId: 'ship-1', correlationId: 'c3', orgId: 'org-a' } });
    expect(docService.generateRateConfirmation).toHaveBeenCalledWith('org-a', 'ship-1', undefined);
  });

  it('stamps the correlationId onto the document metadata, scoped to the job org', async () => {
    const docRepo = buildDocRepo();
    const worker = createDocumentGenerationWorker(buildDocService(), docRepo);

    await worker({
      type: 'x',
      payload: { kind: 'bol', entityId: 'ship-1', correlationId: 'corr-xyz', orgId: 'org-a' },
    });

    expect(docRepo.mergeMetadata).toHaveBeenCalledWith('org-a', 'doc-bol-1', {
      correlationId: 'corr-xyz',
      generationKind: 'bol',
    });
  });

  it('rejects payloads missing kind, entityId or orgId', async () => {
    const docService = buildDocService();
    const worker = createDocumentGenerationWorker(docService, buildDocRepo());

    await expect(worker({ type: 'x', payload: { entityId: 'x', orgId: 'org-a' } as any })).rejects.toThrow(/Invalid/);
    await expect(worker({ type: 'x', payload: { kind: 'bol', orgId: 'org-a' } as any })).rejects.toThrow(/Invalid/);
    await expect(worker({ type: 'x', payload: { kind: 'bol', entityId: 'ship-1', correlationId: 'c' } as any })).rejects.toThrow(/Invalid/);
    expect(docService.generateBOL).not.toHaveBeenCalled();
  });

  it('re-throws service errors so pg-boss can retry the job', async () => {
    const docService = buildDocService({
      generateBOL: jest.fn().mockRejectedValue(new Error('PDF render crashed')),
    });
    const docRepo = buildDocRepo();
    const worker = createDocumentGenerationWorker(docService, docRepo);

    await expect(worker({
      type: 'x',
      payload: { kind: 'bol', entityId: 'ship-1', correlationId: 'c1', orgId: 'org-a' },
    })).rejects.toThrow('PDF render crashed');

    expect(docRepo.mergeMetadata).not.toHaveBeenCalled();
  });
});
