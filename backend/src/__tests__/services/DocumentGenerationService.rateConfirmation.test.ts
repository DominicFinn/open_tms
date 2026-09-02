import { DocumentGenerationService } from '../../services/DocumentGenerationService';

const mockShipment = {
  id: 'ship-1',
  reference: 'SH-001',
  customerId: 'cust-1',
  pickupDate: new Date('2026-01-01'),
  deliveryDate: new Date('2026-01-03'),
  origin: { city: 'Atlanta', state: 'GA' },
  destination: { city: 'Miami', state: 'FL' },
  customer: { id: 'cust-1', name: 'Titan Auto Parts' },
  carrier: { id: 'carrier-1', name: 'Atlantic Coastal Express' },
  charges: [] as any[],
  shipmentFinancialSummary: null,
};

function makePrisma(shipmentOverrides: Partial<typeof mockShipment> = {}) {
  const shipment = { ...mockShipment, ...shipmentOverrides };
  return {
    shipment: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(shipment),
    },
    organization: {
      findFirst: jest.fn().mockResolvedValue({ name: 'Open TMS', mcNumber: 'MC-123', themeConfig: null, logoStorageKey: null }),
    },
  } as any;
}

const templateRepo = { findById: jest.fn(), findDefault: jest.fn().mockResolvedValue(null) } as any;
const docRepo = { create: jest.fn().mockResolvedValue({ id: 'doc-1' }) } as any;

describe('DocumentGenerationService.generateRateConfirmation', () => {
  beforeEach(() => {
    docRepo.create.mockClear();
  });

  it('throws when the shipment has no carrier assigned', async () => {
    const prisma = makePrisma({ carrier: null as any });
    const service = new DocumentGenerationService(prisma, templateRepo, docRepo);

    await expect(service.generateRateConfirmation('ship-1')).rejects.toThrow('Shipment has no carrier assigned');
  });

  it('throws when there is no approved cost charge, even if a pending one exists', async () => {
    const prisma = makePrisma({
      charges: [{ id: 'c1', description: 'Linehaul', amountCents: 50000, chargeCategory: 'cost', status: 'pending' }],
    });
    // The pending charge is filtered out by the query itself in production; simulate that
    // by having findUniqueOrThrow return it pre-filtered, matching the real `where` clause.
    prisma.shipment.findUniqueOrThrow.mockResolvedValueOnce({ ...mockShipment, charges: [] });
    const service = new DocumentGenerationService(prisma, templateRepo, docRepo);

    await expect(service.generateRateConfirmation('ship-1')).rejects.toThrow(
      'Shipment has no approved cost charge — award a tender or approve a cost charge before generating a rate confirmation',
    );
  });

  it('generates the document when an approved cost charge exists', async () => {
    const prisma = makePrisma({
      charges: [
        { id: 'c1', description: 'Linehaul — Atlantic Coastal Express (tender award)', amountCents: 50000, chargeCategory: 'cost', status: 'approved' },
      ],
    });
    const service = new DocumentGenerationService(prisma, templateRepo, docRepo);

    const result = await service.generateRateConfirmation('ship-1');

    expect(result).toEqual({ id: 'doc-1', fileName: 'RateConfirmation-SH-001.pdf' });
    expect(docRepo.create).toHaveBeenCalledTimes(1);
    const dto = docRepo.create.mock.calls[0][0];
    expect(dto.documentType).toBe('rate_confirmation');
    expect(dto.metadata.totalRate).toBe('500.00');
  });

  it('queries only approved/invoiced cost charges, excluding pending and written_off', async () => {
    const prisma = makePrisma({
      charges: [{ id: 'c1', description: 'Linehaul', amountCents: 50000, chargeCategory: 'cost', status: 'approved' }],
    });
    const service = new DocumentGenerationService(prisma, templateRepo, docRepo);

    await service.generateRateConfirmation('ship-1');

    const call = prisma.shipment.findUniqueOrThrow.mock.calls[0][0];
    expect(call.include.charges.where).toEqual({
      chargeCategory: 'cost',
      status: { in: ['approved', 'invoiced'] },
    });
  });
});
