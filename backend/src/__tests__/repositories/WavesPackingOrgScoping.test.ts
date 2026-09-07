/**
 * #220, second batch: waves, picking, packing, staging, replenishment rules and wave templates.
 * Same failure as putaway and receiving had — a client-supplied locationId was the only filter,
 * and detail fetches went by bare id. These pin the org filter onto every query.
 */

import { WaveRepository } from '../../repositories/WaveRepository';
import { PackingRepository } from '../../repositories/PackingRepository';
import { ReplenishmentRuleRepository } from '../../repositories/ReplenishmentRuleRepository';
import { WaveTemplateRepository } from '../../repositories/WaveTemplateRepository';

function buildPrisma() {
  const model = () => ({ findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) });
  return {
    wave: model(), pickTask: model(), packTask: model(),
    stagingAssignment: model(), replenishmentRule: model(), waveTemplate: model(),
  } as any;
}

describe('WaveRepository org scoping', () => {
  it('filters the wave list by org as well as location', async () => {
    const prisma = buildPrisma();
    await new WaveRepository(prisma).findWavesByLocation('org-1', 'loc-1', 'released');

    expect(prisma.wave.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', locationId: 'loc-1', status: 'released' } })
    );
  });

  it('caps the wave list rather than returning an unbounded result', async () => {
    const prisma = buildPrisma();
    await new WaveRepository(prisma).findWavesByLocation('org-1', 'loc-1');

    expect(prisma.wave.findMany.mock.calls[0][0].take).toBe(500);
  });

  it('looks a wave up by id and org', async () => {
    const prisma = buildPrisma();
    await new WaveRepository(prisma).findWaveById('org-1', 'wave-1');

    expect(prisma.wave.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'wave-1', orgId: 'org-1' } })
    );
  });

  it('keeps the org filter alongside the waveId pick task filter', async () => {
    const prisma = buildPrisma();
    await new WaveRepository(prisma).findPickTasksByLocation('org-1', 'loc-1', { waveId: 'wave-1', status: 'assigned' });

    expect(prisma.pickTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', locationId: 'loc-1', status: 'assigned', waveId: 'wave-1' } })
    );
  });

  it('looks a pick task up by id and org', async () => {
    const prisma = buildPrisma();
    await new WaveRepository(prisma).findPickTaskById('org-1', 'task-1');

    expect(prisma.pickTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-1', orgId: 'org-1' } })
    );
  });
});

describe('PackingRepository org scoping', () => {
  it('filters pack tasks by org as well as location', async () => {
    const prisma = buildPrisma();
    await new PackingRepository(prisma).findPackTasksByLocation('org-1', 'loc-1', 'pending');

    expect(prisma.packTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', locationId: 'loc-1', status: 'pending' } })
    );
  });

  it('looks a pack task up by id and org', async () => {
    const prisma = buildPrisma();
    await new PackingRepository(prisma).findPackTaskById('org-1', 'task-1');

    expect(prisma.packTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-1', orgId: 'org-1' } })
    );
  });

  it('filters staging assignments by org as well as location', async () => {
    const prisma = buildPrisma();
    await new PackingRepository(prisma).findStagingAssignmentsByLocation('org-1', 'loc-1');

    expect(prisma.stagingAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', locationId: 'loc-1' } })
    );
  });
});

describe('ReplenishmentRuleRepository org scoping', () => {
  it('filters rules by org as well as location', async () => {
    const prisma = buildPrisma();
    await new ReplenishmentRuleRepository(prisma).findByLocation('org-1', 'loc-1');

    expect(prisma.replenishmentRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', locationId: 'loc-1' }, take: 500 })
    );
  });

  it('looks a rule up by id and org', async () => {
    const prisma = buildPrisma();
    await new ReplenishmentRuleRepository(prisma).findById('org-1', 'rule-1');

    expect(prisma.replenishmentRule.findFirst).toHaveBeenCalledWith({ where: { id: 'rule-1', orgId: 'org-1' } });
  });
});

describe('WaveTemplateRepository org scoping', () => {
  it('filters templates by org as well as location', async () => {
    const prisma = buildPrisma();
    await new WaveTemplateRepository(prisma).findByLocation('org-1', 'loc-1');

    expect(prisma.waveTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', locationId: 'loc-1' } })
    );
  });

  it('looks a template up by id and org', async () => {
    const prisma = buildPrisma();
    await new WaveTemplateRepository(prisma).findById('org-1', 'tpl-1');

    expect(prisma.waveTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tpl-1', orgId: 'org-1' } })
    );
  });
});
