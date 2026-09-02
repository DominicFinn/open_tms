import {
  CreateShipmentShareLinkCommandHandler,
  CREATE_SHIPMENT_SHARE_LINK,
  SHARE_LINK_SHIPMENT_NOT_FOUND,
  SHARE_LINK_NO_SECTIONS,
  SHARE_LINK_EXPIRY_IN_PAST,
} from '../../commands/shipmentShare/CreateShipmentShareLinkCommand';
import {
  UpdateShipmentShareLinkCommandHandler,
  UPDATE_SHIPMENT_SHARE_LINK,
  SHARE_LINK_NOT_FOUND,
  SHARE_LINK_ALREADY_REVOKED,
} from '../../commands/shipmentShare/UpdateShipmentShareLinkCommand';
import {
  RevokeShipmentShareLinkCommandHandler,
  REVOKE_SHIPMENT_SHARE_LINK,
} from '../../commands/shipmentShare/RevokeShipmentShareLinkCommand';
import {
  RecordShipmentShareAccessCommandHandler,
  RECORD_SHIPMENT_SHARE_ACCESS,
} from '../../commands/shipmentShare/RecordShipmentShareAccessCommand';
import { ShipmentShareService } from '../../services/ShipmentShareService';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const FUTURE = new Date(Date.now() + 7 * 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);

const service = new ShipmentShareService();

/** Hashed for real in `hashFor`, so verification is exercised rather than stubbed. */
const KNOWN_CODE = 'ABCD2345';

function buildLink(overrides: Record<string, any> = {}) {
  return {
    id: 'link-1',
    orgId: 'test-org',
    shipmentId: 'ship-1',
    sections: ['overview', 'events'],
    accessCodeHash: overrides.accessCodeHash ?? hashFor(KNOWN_CODE),
    expiresAt: FUTURE,
    revokedAt: null,
    lockedUntil: null,
    failedAttempts: 0,
    label: null,
    ...overrides,
  };
}

/** Mirrors the service's storage format so tests can build a link with a known code. */
function hashFor(code: string): string {
  const { scryptSync, randomBytes } = require('crypto');
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(code, salt, 32).toString('hex')}`;
}

function buildPrisma(overrides: Record<string, any> = {}) {
  const tx = {
    shipment: {
      findFirst: jest
        .fn()
        .mockResolvedValue('shipment' in overrides ? overrides.shipment : { id: 'ship-1' }),
    },
    shipmentShareLink: {
      create: jest.fn().mockResolvedValue({
        id: 'link-1',
        label: null,
        sections: ['overview', 'events'],
        expiresAt: FUTURE,
      }),
      findFirst: jest
        .fn()
        .mockResolvedValue('link' in overrides ? overrides.link : buildLink()),
      update: jest.fn().mockResolvedValue(
        overrides.updateReturn ?? {
          id: 'link-1',
          shipmentId: 'ship-1',
          sections: ['overview'],
          expiresAt: FUTURE,
          label: null,
          failedAttempts: overrides.bumpedAttempts ?? 1,
        }
      ),
      updateMany: jest.fn().mockResolvedValue({ count: overrides.updatedCount ?? 1 }),
    },
    shipmentShareAccess: { create: jest.fn().mockResolvedValue({}) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;

  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;

  return { prisma, tx };
}

describe('Shipment share link command handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateShipmentShareLinkCommandHandler', () => {
    it('creates the link, emits SHIPMENT_SHARE_LINK_CREATED, and returns both secrets once', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus, persisted } = mockEventBus();
      const handler = new CreateShipmentShareLinkCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(CREATE_SHIPMENT_SHARE_LINK, {
          shipmentId: 'ship-1',
          sections: ['overview', 'events'],
          expiresAt: FUTURE.toISOString(),
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.token).toEqual(expect.any(String));
      expect(data.accessCode).toHaveLength(8);

      // The row stores hashes, never the plaintext credentials.
      const written = tx.shipmentShareLink.create.mock.calls[0][0].data;
      expect(written.tokenHash).not.toEqual(data.token);
      expect(written.accessCodeHash).toContain(':');
      expect(JSON.stringify(written)).not.toContain(data.accessCode);

      expect(persisted).toHaveLength(1);
      expect(persisted[0].type).toBe(EVENT_TYPES.SHIPMENT_SHARE_LINK_CREATED);
    });

    it('carries command metadata onto the event', async () => {
      const { prisma } = buildPrisma();
      const { bus, persisted } = mockEventBus();
      const handler = new CreateShipmentShareLinkCommandHandler(prisma, bus, service);

      await handler.execute(
        createTestCommand(
          CREATE_SHIPMENT_SHARE_LINK,
          { shipmentId: 'ship-1', sections: ['overview'], expiresAt: FUTURE.toISOString() },
          { orgId: 'org-9', actorId: 'user-7' }
        )
      );

      expect(persisted[0].orgId).toBe('org-9');
      expect(persisted[0].actorId).toBe('user-7');
    });

    it('never puts a credential on the emitted event', async () => {
      const { prisma } = buildPrisma();
      const { bus, persisted } = mockEventBus();
      const handler = new CreateShipmentShareLinkCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(CREATE_SHIPMENT_SHARE_LINK, {
          shipmentId: 'ship-1',
          sections: ['overview'],
          expiresAt: FUTURE.toISOString(),
        })
      );

      const data = result.data as any;
      const serialised = JSON.stringify(persisted[0]);
      expect(serialised).not.toContain(data.token);
      expect(serialised).not.toContain(data.accessCode);
    });

    it('drops section keys that are not on the allowlist', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateShipmentShareLinkCommandHandler(prisma, bus, service);

      await handler.execute(
        createTestCommand(CREATE_SHIPMENT_SHARE_LINK, {
          shipmentId: 'ship-1',
          sections: ['overview', 'financials', 'customs', 'sla'],
          expiresAt: FUTURE.toISOString(),
        })
      );

      expect(tx.shipmentShareLink.create.mock.calls[0][0].data.sections).toEqual(['overview']);
    });

    it('rejects a create where every requested section was disallowed', async () => {
      const { prisma } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateShipmentShareLinkCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(CREATE_SHIPMENT_SHARE_LINK, {
          shipmentId: 'ship-1',
          sections: ['financials'],
          expiresAt: FUTURE.toISOString(),
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(SHARE_LINK_NO_SECTIONS);
    });

    it('rejects an expiry in the past', async () => {
      const { prisma } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateShipmentShareLinkCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(CREATE_SHIPMENT_SHARE_LINK, {
          shipmentId: 'ship-1',
          sections: ['overview'],
          expiresAt: PAST.toISOString(),
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(SHARE_LINK_EXPIRY_IN_PAST);
    });

    it('treats a shipment in another org as missing', async () => {
      const { prisma } = buildPrisma({ shipment: null });
      const { bus } = mockEventBus();
      const handler = new CreateShipmentShareLinkCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(CREATE_SHIPMENT_SHARE_LINK, {
          shipmentId: 'ship-from-another-org',
          sections: ['overview'],
          expiresAt: FUTURE.toISOString(),
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(SHARE_LINK_SHIPMENT_NOT_FOUND);
    });
  });

  describe('UpdateShipmentShareLinkCommandHandler', () => {
    it('narrows the sections and emits SHIPMENT_SHARE_LINK_UPDATED', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus, persisted } = mockEventBus();
      const handler = new UpdateShipmentShareLinkCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_SHIPMENT_SHARE_LINK, {
          shareLinkId: 'link-1',
          sections: ['overview'],
        })
      );

      expect(result.success).toBe(true);
      expect(tx.shipmentShareLink.update.mock.calls[0][0].data.sections).toEqual(['overview']);
      expect(persisted[0].type).toBe(EVENT_TYPES.SHIPMENT_SHARE_LINK_UPDATED);
    });

    it('refuses to edit a revoked link', async () => {
      const { prisma } = buildPrisma({ link: buildLink({ revokedAt: new Date() }) });
      const { bus } = mockEventBus();
      const handler = new UpdateShipmentShareLinkCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_SHIPMENT_SHARE_LINK, {
          shareLinkId: 'link-1',
          sections: ['overview'],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(SHARE_LINK_ALREADY_REVOKED);
    });

    it('treats a link in another org as missing', async () => {
      const { prisma } = buildPrisma({ link: null });
      const { bus } = mockEventBus();
      const handler = new UpdateShipmentShareLinkCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_SHIPMENT_SHARE_LINK, { shareLinkId: 'link-1', label: 'x' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(SHARE_LINK_NOT_FOUND);
    });
  });

  describe('RevokeShipmentShareLinkCommandHandler', () => {
    it('revokes and emits SHIPMENT_SHARE_LINK_REVOKED', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus, persisted } = mockEventBus();
      const handler = new RevokeShipmentShareLinkCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(REVOKE_SHIPMENT_SHARE_LINK, { shareLinkId: 'link-1' })
      );

      expect(result.success).toBe(true);
      expect(tx.shipmentShareLink.updateMany.mock.calls[0][0].where.revokedAt).toBeNull();
      expect(persisted[0].type).toBe(EVENT_TYPES.SHIPMENT_SHARE_LINK_REVOKED);
    });

    it('lets the first of two concurrent revokes win', async () => {
      const { prisma } = buildPrisma({ updatedCount: 0 });
      const { bus } = mockEventBus();
      const handler = new RevokeShipmentShareLinkCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(REVOKE_SHIPMENT_SHARE_LINK, { shareLinkId: 'link-1' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(SHARE_LINK_ALREADY_REVOKED);
    });
  });

  describe('RecordShipmentShareAccessCommandHandler', () => {
    it('grants access on the right code and logs it', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus, persisted } = mockEventBus();
      const handler = new RecordShipmentShareAccessCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(RECORD_SHIPMENT_SHARE_ACCESS, {
          shareLinkId: 'link-1',
          accessCode: KNOWN_CODE,
          email: 'receiving@example.com',
          ip: '203.0.113.7',
        })
      );

      expect((result.data as any).granted).toBe(true);
      expect(tx.shipmentShareAccess.create.mock.calls[0][0].data.outcome).toBe('granted');
      expect(persisted[0].type).toBe(EVENT_TYPES.SHIPMENT_SHARE_LINK_ACCESSED);
    });

    it('accepts the code with different case and spacing', async () => {
      const { prisma } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new RecordShipmentShareAccessCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(RECORD_SHIPMENT_SHARE_ACCESS, {
          shareLinkId: 'link-1',
          accessCode: ' abcd 2345 ',
          email: 'receiving@example.com',
        })
      );

      expect((result.data as any).granted).toBe(true);
    });

    it('keeps the viewer email off the event and the raw ip out of the ledger', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus, persisted } = mockEventBus();
      const handler = new RecordShipmentShareAccessCommandHandler(prisma, bus, service);

      await handler.execute(
        createTestCommand(RECORD_SHIPMENT_SHARE_ACCESS, {
          shareLinkId: 'link-1',
          accessCode: KNOWN_CODE,
          email: 'receiving@example.com',
          ip: '203.0.113.7',
        })
      );

      expect(JSON.stringify(persisted[0])).not.toContain('receiving@example.com');
      const logged = tx.shipmentShareAccess.create.mock.calls[0][0].data;
      expect(logged.ipHash).not.toBe('203.0.113.7');
      expect(logged.ipHash).toEqual(expect.any(String));
    });

    it('denies a wrong code, counts the attempt, and logs the denial', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new RecordShipmentShareAccessCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(RECORD_SHIPMENT_SHARE_ACCESS, {
          shareLinkId: 'link-1',
          accessCode: 'WRONGCDE',
          email: 'receiving@example.com',
        })
      );

      expect((result.data as any).granted).toBe(false);
      expect((result.data as any).reason).toBe('denied_bad_code');
      expect(tx.shipmentShareLink.update.mock.calls[0][0].data.failedAttempts).toEqual({
        increment: 1,
      });
      expect(tx.shipmentShareAccess.create.mock.calls[0][0].data.outcome).toBe('denied_bad_code');
    });

    it('locks the link on the fifth wrong code', async () => {
      const { prisma, tx } = buildPrisma({ bumpedAttempts: 5 });
      const { bus } = mockEventBus();
      const handler = new RecordShipmentShareAccessCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(RECORD_SHIPMENT_SHARE_ACCESS, {
          shareLinkId: 'link-1',
          accessCode: 'WRONGCDE',
          email: 'receiving@example.com',
        })
      );

      expect((result.data as any).lockedUntil).toBeInstanceOf(Date);
      expect(tx.shipmentShareLink.update).toHaveBeenCalledTimes(2);
      expect(tx.shipmentShareLink.update.mock.calls[1][0].data.lockedUntil).toBeInstanceOf(Date);
    });

    it('clears the failure count when the right code finally arrives', async () => {
      const { prisma, tx } = buildPrisma({ link: buildLink({ failedAttempts: 3 }) });
      const { bus } = mockEventBus();
      const handler = new RecordShipmentShareAccessCommandHandler(prisma, bus, service);

      await handler.execute(
        createTestCommand(RECORD_SHIPMENT_SHARE_ACCESS, {
          shareLinkId: 'link-1',
          accessCode: KNOWN_CODE,
          email: 'receiving@example.com',
        })
      );

      expect(tx.shipmentShareLink.update.mock.calls[0][0].data.failedAttempts).toBe(0);
    });

    it('denies a revoked link without checking the code', async () => {
      const { prisma, tx } = buildPrisma({ link: buildLink({ revokedAt: new Date() }) });
      const { bus } = mockEventBus();
      const handler = new RecordShipmentShareAccessCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(RECORD_SHIPMENT_SHARE_ACCESS, {
          shareLinkId: 'link-1',
          accessCode: KNOWN_CODE,
          email: 'receiving@example.com',
        })
      );

      expect((result.data as any).reason).toBe('denied_revoked');
      expect(tx.shipmentShareLink.update).not.toHaveBeenCalled();
      expect(tx.shipmentShareAccess.create.mock.calls[0][0].data.outcome).toBe('denied_revoked');
    });

    it('denies an expired link', async () => {
      const { prisma } = buildPrisma({ link: buildLink({ expiresAt: PAST }) });
      const { bus } = mockEventBus();
      const handler = new RecordShipmentShareAccessCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(RECORD_SHIPMENT_SHARE_ACCESS, {
          shareLinkId: 'link-1',
          accessCode: KNOWN_CODE,
          email: 'receiving@example.com',
        })
      );

      expect((result.data as any).reason).toBe('denied_expired');
    });

    it('denies while the link is locked out, even with the right code', async () => {
      const lockedUntil = new Date(Date.now() + 5 * 60_000);
      const { prisma } = buildPrisma({ link: buildLink({ lockedUntil }) });
      const { bus } = mockEventBus();
      const handler = new RecordShipmentShareAccessCommandHandler(prisma, bus, service);

      const result = await handler.execute(
        createTestCommand(RECORD_SHIPMENT_SHARE_ACCESS, {
          shareLinkId: 'link-1',
          accessCode: KNOWN_CODE,
          email: 'receiving@example.com',
        })
      );

      expect((result.data as any).reason).toBe('denied_locked');
    });
  });
});
