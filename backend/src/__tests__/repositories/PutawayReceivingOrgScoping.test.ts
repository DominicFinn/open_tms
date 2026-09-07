/**
 * #220: putaway and receiving reads used to filter on a client-supplied locationId and nothing
 * else, so any authenticated caller could read another tenant's warehouse data. These tests pin
 * the org filter onto every query; if one is dropped, they fail.
 */

import { PutawayRepository } from '../../repositories/PutawayRepository';
import { ReceivingRepository } from '../../repositories/ReceivingRepository';

function buildPrisma() {
  return {
    putawayTask: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    putawayRule: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    receivingAppointment: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    receivingTask: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    receivingLine: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

describe('PutawayRepository org scoping', () => {
  it('filters the task list by org as well as location', async () => {
    const prisma = buildPrisma();
    await new PutawayRepository(prisma).findTasks('org-1', { locationId: 'loc-1' }, 'pending');

    expect(prisma.putawayTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', locationId: 'loc-1', status: 'pending' } })
    );
  });

  it('looks a task up by id and org, never by id alone', async () => {
    const prisma = buildPrisma();
    await new PutawayRepository(prisma).findTaskById('org-1', 'task-1');

    expect(prisma.putawayTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-1', orgId: 'org-1' } })
    );
    expect(prisma.putawayTask.findUnique).toBeUndefined();
  });

  it('filters rules by org as well as location', async () => {
    const prisma = buildPrisma();
    await new PutawayRepository(prisma).findRules('org-1', { locationId: 'loc-1' });

    expect(prisma.putawayRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', locationId: 'loc-1' } })
    );
  });

  it('looks a rule up by id and org', async () => {
    const prisma = buildPrisma();
    await new PutawayRepository(prisma).findRuleById('org-1', 'rule-1');

    expect(prisma.putawayRule.findFirst).toHaveBeenCalledWith({ where: { id: 'rule-1', orgId: 'org-1' } });
  });
});

describe('ReceivingRepository org scoping', () => {
  it('filters appointments by org as well as location', async () => {
    const prisma = buildPrisma();
    await new ReceivingRepository(prisma).findAppointments('org-1', { locationId: 'loc-1' });

    const where = prisma.receivingAppointment.findMany.mock.calls[0][0].where;
    expect(where.orgId).toBe('org-1');
    expect(where.locationId).toBe('loc-1');
  });

  it('keeps the org filter alongside a date window', async () => {
    const prisma = buildPrisma();
    await new ReceivingRepository(prisma).findAppointments('org-1', { locationId: 'loc-1' }, new Date('2026-09-07'));

    const where = prisma.receivingAppointment.findMany.mock.calls[0][0].where;
    expect(where.orgId).toBe('org-1');
    expect(where.scheduledAt).toBeDefined();
  });

  it('looks an appointment up by id and org', async () => {
    const prisma = buildPrisma();
    await new ReceivingRepository(prisma).findAppointmentById('org-1', 'appt-1');

    expect(prisma.receivingAppointment.findFirst).toHaveBeenCalledWith({ where: { id: 'appt-1', orgId: 'org-1' } });
  });

  it('filters receiving tasks by org as well as location', async () => {
    const prisma = buildPrisma();
    await new ReceivingRepository(prisma).findTasks('org-1', { locationId: 'loc-1' }, 'pending');

    const where = prisma.receivingTask.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ orgId: 'org-1', locationId: 'loc-1', status: 'pending' });
  });

  it('looks a receiving task up by id and org', async () => {
    const prisma = buildPrisma();
    await new ReceivingRepository(prisma).findTaskById('org-1', 'task-1');

    expect(prisma.receivingTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-1', orgId: 'org-1' } })
    );
  });

  it('exposes no write method, so there is no unscoped create or update to reach for', () => {
    const repo = new ReceivingRepository(buildPrisma()) as any;

    expect(repo.createAppointment).toBeUndefined();
    expect(repo.updateAppointmentStatus).toBeUndefined();
    expect(repo.createTask).toBeUndefined();
    expect(repo.updateTaskStatus).toBeUndefined();
    expect(repo.updateLine).toBeUndefined();
  });
});
