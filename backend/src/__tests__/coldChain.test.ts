/**
 * Cold Chain Command Handler & Service Tests
 */

import { CreateColdChainProfileCommandHandler, CREATE_COLD_CHAIN_PROFILE } from '../commands/coldChain/CreateColdChainProfileCommand';
import { UpdateColdChainProfileCommandHandler, UPDATE_COLD_CHAIN_PROFILE } from '../commands/coldChain/UpdateColdChainProfileCommand';
import { AcknowledgeExcursionCommandHandler, ACKNOWLEDGE_EXCURSION } from '../commands/coldChain/AcknowledgeExcursionCommand';
import { ResolveExcursionCommandHandler, RESOLVE_EXCURSION } from '../commands/coldChain/ResolveExcursionCommand';
import { SetDispositionCommandHandler, SET_DISPOSITION } from '../commands/coldChain/SetDispositionCommand';
import { RecordCalibrationCommandHandler, RECORD_CALIBRATION } from '../commands/coldChain/RecordCalibrationCommand';
import { CreateCAPACommandHandler, CREATE_CAPA } from '../commands/capa/CreateCAPACommand';
import { UpdateCAPACommandHandler, UPDATE_CAPA } from '../commands/capa/UpdateCAPACommand';
import { ColdChainService } from '../services/ColdChainService';
import { EVENT_TYPES } from '../events/eventTypes';
import { mockEventBus, createTestCommand } from './helpers/testUtils';

// ── Mock Prisma ────────────────────────────────────────────────
const mockPrisma: any = {
  $transaction: jest.fn(async (fn: any) => fn(mockPrisma)),
  coldChainProfile: {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  coldChainExcursion: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  shipment: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  device: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'dev-1', name: 'Test Device' }),
  },
  deviceCalibration: {
    create: jest.fn(),
  },
  cAPAReport: {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  immutableTemperatureLog: {
    create: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  domainEventLog: {
    create: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  organization: {
    findFirst: jest.fn().mockResolvedValue({ id: 'org-1' }),
  },
  orderShipments: [],
};

// ── Tests ──────────────────────────────────────────────────────

describe('CreateColdChainProfileCommandHandler', () => {
  let handler: CreateColdChainProfileCommandHandler;
  let eventBus: ReturnType<typeof mockEventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = mockEventBus();
    handler = new CreateColdChainProfileCommandHandler(mockPrisma as any, eventBus.bus);
  });

  it('creates a profile and emits COLD_CHAIN_PROFILE_CREATED', async () => {
    const payload = {
      name: 'Frozen Goods',
      minTemperature: -25,
      maxTemperature: -18,
      alertMinTemperature: -23,
      alertMaxTemperature: -20,
    };
    mockPrisma.coldChainProfile.create.mockResolvedValue({
      id: 'profile-1', name: 'Frozen Goods',
      minTemperature: -25, maxTemperature: -18,
      alertMinTemperature: -23, alertMaxTemperature: -20,
    });

    const result = await handler.execute(createTestCommand(CREATE_COLD_CHAIN_PROFILE, payload));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'profile-1', name: 'Frozen Goods' });
    expect(eventBus.persisted).toHaveLength(1);
    expect(eventBus.persisted[0].type).toBe(EVENT_TYPES.COLD_CHAIN_PROFILE_CREATED);
  });
});

describe('UpdateColdChainProfileCommandHandler', () => {
  let handler: UpdateColdChainProfileCommandHandler;
  let eventBus: ReturnType<typeof mockEventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = mockEventBus();
    handler = new UpdateColdChainProfileCommandHandler(mockPrisma as any, eventBus.bus);
  });

  it('updates profile and emits COLD_CHAIN_PROFILE_UPDATED', async () => {
    mockPrisma.coldChainProfile.findUniqueOrThrow.mockResolvedValue({
      id: 'profile-1', name: 'Old Name', active: true,
    });
    mockPrisma.coldChainProfile.update.mockResolvedValue({
      id: 'profile-1', name: 'New Name', active: true,
    });

    const result = await handler.execute(createTestCommand(UPDATE_COLD_CHAIN_PROFILE, {
      id: 'profile-1', data: { name: 'New Name' },
    }));

    expect(result.success).toBe(true);
    expect(eventBus.persisted[0].type).toBe(EVENT_TYPES.COLD_CHAIN_PROFILE_UPDATED);
  });

  it('emits DEACTIVATED when active changes to false', async () => {
    mockPrisma.coldChainProfile.findUniqueOrThrow.mockResolvedValue({
      id: 'profile-1', name: 'Test', active: true,
    });
    mockPrisma.coldChainProfile.update.mockResolvedValue({
      id: 'profile-1', name: 'Test', active: false,
    });

    const result = await handler.execute(createTestCommand(UPDATE_COLD_CHAIN_PROFILE, {
      id: 'profile-1', data: { active: false },
    }));

    expect(result.success).toBe(true);
    expect(eventBus.persisted[0].type).toBe(EVENT_TYPES.COLD_CHAIN_PROFILE_DEACTIVATED);
  });
});

describe('AcknowledgeExcursionCommandHandler', () => {
  let handler: AcknowledgeExcursionCommandHandler;
  let eventBus: ReturnType<typeof mockEventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = mockEventBus();
    handler = new AcknowledgeExcursionCommandHandler(mockPrisma as any, eventBus.bus);
  });

  it('acknowledges excursion and emits event', async () => {
    mockPrisma.coldChainExcursion.findUniqueOrThrow.mockResolvedValue({
      id: 'exc-1', status: 'active', shipmentId: 'ship-1',
    });
    mockPrisma.coldChainExcursion.update.mockResolvedValue({ id: 'exc-1', status: 'acknowledged' });

    const result = await handler.execute(createTestCommand(ACKNOWLEDGE_EXCURSION, {
      id: 'exc-1', notes: 'Noted',
    }));

    expect(result.success).toBe(true);
    expect(eventBus.persisted[0].type).toBe(EVENT_TYPES.COLD_CHAIN_EXCURSION_ACKNOWLEDGED);
  });
});

describe('ResolveExcursionCommandHandler', () => {
  let handler: ResolveExcursionCommandHandler;
  let eventBus: ReturnType<typeof mockEventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = mockEventBus();
    handler = new ResolveExcursionCommandHandler(mockPrisma as any, eventBus.bus);
  });

  it('resolves excursion with disposition and emits event', async () => {
    mockPrisma.coldChainExcursion.findUniqueOrThrow.mockResolvedValue({
      id: 'exc-1', status: 'acknowledged', shipmentId: 'ship-1',
    });
    mockPrisma.coldChainExcursion.update.mockResolvedValue({ id: 'exc-1', status: 'resolved' });

    const result = await handler.execute(createTestCommand(RESOLVE_EXCURSION, {
      id: 'exc-1', dispositionDecision: 'released', notes: 'Product within tolerance',
    }));

    expect(result.success).toBe(true);
    expect(eventBus.persisted[0].type).toBe(EVENT_TYPES.COLD_CHAIN_EXCURSION_RESOLVED);
    expect(eventBus.persisted[0].payload).toHaveProperty('dispositionDecision', 'released');
  });
});

describe('SetDispositionCommandHandler', () => {
  let handler: SetDispositionCommandHandler;
  let eventBus: ReturnType<typeof mockEventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = mockEventBus();
    handler = new SetDispositionCommandHandler(mockPrisma as any, eventBus.bus);
  });

  it('sets disposition on shipment and emits event', async () => {
    mockPrisma.shipment.findUniqueOrThrow.mockResolvedValue({
      coldChainDisposition: 'monitoring', reference: 'SH-001',
    });
    mockPrisma.shipment.update.mockResolvedValue({ id: 'ship-1' });

    const result = await handler.execute(createTestCommand(SET_DISPOSITION, {
      shipmentId: 'ship-1', disposition: 'released', notes: 'All clear',
    }));

    expect(result.success).toBe(true);
    expect(eventBus.persisted[0].type).toBe(EVENT_TYPES.COLD_CHAIN_DISPOSITION_CHANGED);
    expect(eventBus.persisted[0].payload).toHaveProperty('previousDisposition', 'monitoring');
    expect(eventBus.persisted[0].payload).toHaveProperty('newDisposition', 'released');
  });
});

describe('RecordCalibrationCommandHandler', () => {
  let handler: RecordCalibrationCommandHandler;
  let eventBus: ReturnType<typeof mockEventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = mockEventBus();
    handler = new RecordCalibrationCommandHandler(mockPrisma as any, eventBus.bus);
  });

  it('creates calibration record and emits event', async () => {
    mockPrisma.deviceCalibration.create.mockResolvedValue({
      id: 'cal-1', deviceId: 'dev-1', certificateNumber: 'CERT-001',
    });

    const result = await handler.execute(createTestCommand(RECORD_CALIBRATION, {
      deviceId: 'dev-1',
      calibratedAt: '2026-01-01T00:00:00Z',
      calibratedBy: 'Calibration Lab',
      certificateNumber: 'CERT-001',
      expiresAt: '2027-01-01T00:00:00Z',
      accuracy: 0.5,
    }));

    expect(result.success).toBe(true);
    expect(eventBus.persisted[0].type).toBe(EVENT_TYPES.DEVICE_CALIBRATION_RECORDED);
  });
});

describe('CreateCAPACommandHandler', () => {
  let handler: CreateCAPACommandHandler;
  let eventBus: ReturnType<typeof mockEventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = mockEventBus();
    handler = new CreateCAPACommandHandler(mockPrisma as any, eventBus.bus);
  });

  it('creates CAPA with auto-generated report number and emits event', async () => {
    mockPrisma.cAPAReport.count.mockResolvedValue(2);
    mockPrisma.cAPAReport.create.mockResolvedValue({
      id: 'capa-1', reportNumber: 'CAPA-20260410-003', title: 'Temperature Issue',
    });

    const result = await handler.execute(createTestCommand(CREATE_CAPA, {
      issueId: 'issue-1',
      title: 'Temperature Issue',
      description: 'Temperature exceeded limits',
    }));

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('reportNumber');
    expect(eventBus.persisted[0].type).toBe(EVENT_TYPES.CAPA_CREATED);
  });
});

describe('UpdateCAPACommandHandler', () => {
  let handler: UpdateCAPACommandHandler;
  let eventBus: ReturnType<typeof mockEventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = mockEventBus();
    handler = new UpdateCAPACommandHandler(mockPrisma as any, eventBus.bus);
  });

  it('emits CAPA_STATUS_CHANGED when status changes', async () => {
    mockPrisma.cAPAReport.findUniqueOrThrow.mockResolvedValue({
      id: 'capa-1', title: 'Test', status: 'draft', reportNumber: 'CAPA-001',
    });
    mockPrisma.cAPAReport.update.mockResolvedValue({
      id: 'capa-1', title: 'Test', status: 'investigation', reportNumber: 'CAPA-001',
    });

    const result = await handler.execute(createTestCommand(UPDATE_CAPA, {
      id: 'capa-1', data: { status: 'investigation' },
    }));

    expect(result.success).toBe(true);
    expect(eventBus.persisted[0].type).toBe(EVENT_TYPES.CAPA_STATUS_CHANGED);
  });

  it('emits CAPA_UPDATED for non-status changes', async () => {
    mockPrisma.cAPAReport.findUniqueOrThrow.mockResolvedValue({
      id: 'capa-1', title: 'Test', status: 'investigation', reportNumber: 'CAPA-001',
    });
    mockPrisma.cAPAReport.update.mockResolvedValue({
      id: 'capa-1', title: 'Updated', status: 'investigation', reportNumber: 'CAPA-001',
    });

    const result = await handler.execute(createTestCommand(UPDATE_CAPA, {
      id: 'capa-1', data: { rootCause: 'Equipment failure' },
    }));

    expect(result.success).toBe(true);
    expect(eventBus.persisted[0].type).toBe(EVENT_TYPES.CAPA_UPDATED);
  });
});

describe('ColdChainService', () => {
  describe('generateIntegrityHash', () => {
    it('produces consistent SHA-256 hashes', () => {
      const service = new ColdChainService({} as any);
      const params = {
        shipmentId: 'ship-1',
        deviceId: 'dev-1',
        temperature: 5.1234,
        recordedAt: new Date('2026-04-10T12:00:00Z'),
        profileMinTemp: 2,
        profileMaxTemp: 8,
      };

      const hash1 = service.generateIntegrityHash(params);
      const hash2 = service.generateIntegrityHash(params);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('produces different hashes for different temperatures', () => {
      const service = new ColdChainService({} as any);
      const base = {
        shipmentId: 'ship-1',
        deviceId: 'dev-1',
        recordedAt: new Date('2026-04-10T12:00:00Z'),
        profileMinTemp: 2,
        profileMaxTemp: 8,
      };

      const hash1 = service.generateIntegrityHash({ ...base, temperature: 5.0 });
      const hash2 = service.generateIntegrityHash({ ...base, temperature: 5.1 });

      expect(hash1).not.toBe(hash2);
    });

    it('handles missing optional fields', () => {
      const service = new ColdChainService({} as any);
      const hash = service.generateIntegrityHash({
        temperature: 5.0,
        recordedAt: new Date('2026-04-10T12:00:00Z'),
      });

      expect(hash).toHaveLength(64);
    });
  });
});
