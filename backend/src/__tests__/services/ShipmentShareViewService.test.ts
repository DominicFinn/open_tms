import { ShipmentShareViewService } from '../../services/ShipmentShareViewService';
import { ShipmentShareService } from '../../services/ShipmentShareService';

const shipmentRow = {
  id: 'ship-1',
  reference: 'SHP-0001',
  status: 'in_progress',
  hasException: false,
  serviceLevel: 'LTL',
  proNumber: 'PRO-77',
  pickupDate: new Date('2026-09-01T09:00:00Z'),
  deliveryDate: new Date('2026-09-04T17:00:00Z'),
  origin: { name: 'Leeds DC', city: 'Leeds', state: null, country: 'GB' },
  destination: { name: 'Cork Store', city: 'Cork', state: null, country: 'IE' },
  stops: [],
  carrier: { name: 'Northern Haulage', scacCode: 'NHAU' },
  events: [{ eventType: 'departed', description: 'Left Leeds', lat: 1, lng: 2, eventTime: new Date() }],
  orderShipments: [
    {
      order: {
        orderNumber: 'ORD-1',
        poNumber: 'PO-1',
        status: 'assigned',
        lineItems: [
          { sku: 'A', description: 'Widget', quantity: 3, weight: 2 },
          { sku: 'B', description: 'Gadget', quantity: 1, weight: 5 },
        ],
      },
    },
  ],
  sensorReadings: [{ eventTime: new Date(), temperature: 4.1, lightLevel: 0, impactG: null, isAlert: false }],
};

function buildRepo() {
  return {
    findShipment: jest.fn().mockResolvedValue(shipmentRow),
    findDocuments: jest.fn().mockResolvedValue([{ id: 'doc-1', documentType: 'bol' }]),
  } as any;
}

describe('ShipmentShareViewService', () => {
  it('returns only the granted sections', async () => {
    const repo = buildRepo();
    const view = (await new ShipmentShareViewService(repo).build('org-1', 'ship-1', [
      'overview',
    ]))!;

    expect(Object.keys(view).sort()).toEqual(['overview', 'sections']);
    expect(view.events).toBeUndefined();
    expect(view.orders).toBeUndefined();
    expect(view.telemetry).toBeUndefined();
    expect(view.carrier).toBeUndefined();
  });

  it('never exposes the customer or anything financial, whatever is granted', async () => {
    const repo = buildRepo();
    const view = (await new ShipmentShareViewService(repo).build('org-1', 'ship-1', [
      'overview',
      'events',
      'orders',
      'cargo',
      'documents',
      'telemetry',
      'carrier',
    ]))!;

    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain('customer');
    expect(serialised).not.toContain('Cents');
    expect(serialised).not.toContain('margin');
  });

  it('passes the granted sections through to the query so ungranted relations are never read', async () => {
    const repo = buildRepo();
    await new ShipmentShareViewService(repo).build('org-1', 'ship-1', ['overview']);

    expect(repo.findShipment).toHaveBeenCalledWith({
      orgId: 'org-1',
      shipmentId: 'ship-1',
      sections: ['overview'],
    });
    expect(repo.findDocuments).not.toHaveBeenCalled();
  });

  it('totals cargo weight per piece across every order line', async () => {
    const repo = buildRepo();
    const view = (await new ShipmentShareViewService(repo).build('org-1', 'ship-1', ['cargo']))!;

    expect(view.cargo).toMatchObject({ lineCount: 2, totalPieces: 4, totalWeightKg: 11 });
  });

  it('reads as missing when the shipment is not in the caller org', async () => {
    const repo = buildRepo();
    repo.findShipment.mockResolvedValue(null);

    expect(await new ShipmentShareViewService(repo).build('other-org', 'ship-1', ['overview'])).toBeNull();
  });
});

describe('ShipmentShareService', () => {
  const service = new ShipmentShareService();

  it('mints a distinct token and access code every time', () => {
    const a = service.mintCredentials();
    const b = service.mintCredentials();

    expect(a.token).not.toBe(b.token);
    expect(a.accessCode).not.toBe(b.accessCode);
    expect(a.accessCodeHash).not.toBe(b.accessCodeHash);
  });

  it('generates access codes free of characters that are easy to misread', () => {
    for (let i = 0; i < 50; i++) {
      expect(service.mintCredentials().accessCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    }
  });

  it('verifies its own code and rejects a near miss', () => {
    const { accessCode, accessCodeHash } = service.mintCredentials();

    // The code alphabet contains X, so pick a last character that differs from
    // the real one — otherwise the "near miss" is the code itself 1 time in 32.
    const lastChar = accessCode.slice(-1);
    const nearMiss = accessCode.slice(0, -1) + (lastChar === 'X' ? 'Y' : 'X');

    expect(service.verifyAccessCode(accessCode, accessCodeHash)).toBe(true);
    expect(service.verifyAccessCode(nearMiss, accessCodeHash)).toBe(false);
    expect(service.verifyAccessCode('', accessCodeHash)).toBe(false);
  });

  it('caps a viewer session at the link expiry', () => {
    const linkExpiresAt = new Date(Date.now() + 10 * 60_000);
    const session = service.signViewerToken({
      shareLinkId: 'link-1',
      shipmentId: 'ship-1',
      orgId: 'org-1',
      sections: ['overview'],
      linkExpiresAt,
    });

    expect(session.expiresAt).toEqual(linkExpiresAt);
  });

  it('strips disallowed sections out of the viewer token', () => {
    const session = service.signViewerToken({
      shareLinkId: 'link-1',
      shipmentId: 'ship-1',
      orgId: 'org-1',
      sections: ['overview', 'financials'],
      linkExpiresAt: new Date(Date.now() + 86_400_000),
    });

    const payload = JSON.parse(
      Buffer.from(session.token.split('.')[1], 'base64url').toString()
    );
    expect(payload.sections).toEqual(['overview']);
    expect(payload.iss).toBe('open-tms-share');
  });
});
