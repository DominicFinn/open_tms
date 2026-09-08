/**
 * Phase 2a batch 5a (#231): WMS list reads narrow by facility or by location, never by neither,
 * and always alongside orgId.
 *
 * Also covers WarehouseZoneRepository, which #220's tenancy sweep missed entirely: every read on
 * it was unscoped, so one tenant could list or fetch another's zones, aisles and bins.
 */

import { scopedWhere, warehouseScopeFrom } from '../../repositories/warehouseScope';
import { PutawayRepository } from '../../repositories/PutawayRepository';
import { WaveRepository } from '../../repositories/WaveRepository';
import { WarehouseZoneRepository } from '../../repositories/WarehouseZoneRepository';

function prismaWith(model: string, methods: string[] = ['findMany', 'findFirst']) {
  const m: any = {};
  for (const method of methods) m[method] = jest.fn().mockResolvedValue([]);
  return { [model]: m } as any;
}

describe('warehouseScope', () => {
  it('always carries orgId alongside the warehouse filter', () => {
    expect(scopedWhere('org-1', { facilityId: 'fac-1' })).toEqual({ orgId: 'org-1', facilityId: 'fac-1' });
    expect(scopedWhere('org-1', { locationId: 'loc-1' })).toEqual({ orgId: 'org-1', locationId: 'loc-1' });
  });

  it('prefers facilityId when the querystring carries one', () => {
    expect(warehouseScopeFrom({ facilityId: 'fac-1' })).toEqual({ facilityId: 'fac-1' });
    expect(warehouseScopeFrom({ locationId: 'loc-1' })).toEqual({ locationId: 'loc-1' });
  });
});

describe('WMS list reads accept either scope', () => {
  it('filters putaway tasks by facility when given one', async () => {
    const prisma = prismaWith('putawayTask');
    await new PutawayRepository(prisma).findTasks('org-1', { facilityId: 'fac-1' }, 'pending');

    expect(prisma.putawayTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', facilityId: 'fac-1', status: 'pending' } })
    );
  });

  it('still filters putaway tasks by location for callers that have not migrated', async () => {
    const prisma = prismaWith('putawayTask');
    await new PutawayRepository(prisma).findTasks('org-1', { locationId: 'loc-1' });

    expect(prisma.putawayTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', locationId: 'loc-1' } })
    );
  });

  it('filters waves by facility', async () => {
    const prisma = prismaWith('wave');
    await new WaveRepository(prisma).findWaves('org-1', { facilityId: 'fac-1' });

    expect(prisma.wave.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', facilityId: 'fac-1' } })
    );
  });
});

describe('WarehouseZoneRepository org scoping (#220 miss)', () => {
  it('scopes the zone list by org as well as warehouse', async () => {
    const prisma = prismaWith('warehouseZone');
    await new WarehouseZoneRepository(prisma).findZones('org-1', { facilityId: 'fac-1' });

    expect(prisma.warehouseZone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', facilityId: 'fac-1' } })
    );
  });

  it('scopes the bin list by org as well as warehouse', async () => {
    const prisma = prismaWith('warehouseBin');
    await new WarehouseZoneRepository(prisma).findBins('org-1', { locationId: 'loc-1' });

    expect(prisma.warehouseBin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', locationId: 'loc-1' } })
    );
  });

  it('fetches a zone by id and org, so a cross-tenant guess misses', async () => {
    const prisma = prismaWith('warehouseZone', ['findFirst']);
    await new WarehouseZoneRepository(prisma).findZoneById('org-1', 'zone-other');

    expect(prisma.warehouseZone.findFirst).toHaveBeenCalledWith({ where: { id: 'zone-other', orgId: 'org-1' } });
  });

  it('fetches a bin by id and org', async () => {
    const prisma = prismaWith('warehouseBin', ['findFirst']);
    await new WarehouseZoneRepository(prisma).findBinById('org-1', 'bin-other');

    expect(prisma.warehouseBin.findFirst).toHaveBeenCalledWith({ where: { id: 'bin-other', orgId: 'org-1' } });
  });

  it('scopes aisles through their zone, since WarehouseAisle carries no orgId', async () => {
    const prisma = prismaWith('warehouseAisle');
    await new WarehouseZoneRepository(prisma).findAislesByZone('org-1', 'zone-1');

    expect(prisma.warehouseAisle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { zoneId: 'zone-1', zone: { orgId: 'org-1' } } })
    );
  });

  it('scopes bins by zone', async () => {
    const prisma = prismaWith('warehouseBin');
    await new WarehouseZoneRepository(prisma).findBinsByZone('org-1', 'zone-1');

    expect(prisma.warehouseBin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { zoneId: 'zone-1', orgId: 'org-1' } })
    );
  });

  it('scopes a bin label lookup, which the compound unique does not cover', async () => {
    const prisma = prismaWith('warehouseBin', ['findFirst']);
    await new WarehouseZoneRepository(prisma).findBinByLabel('org-1', 'loc-1', 'BULK-A-01');

    expect(prisma.warehouseBin.findFirst).toHaveBeenCalledWith({
      where: { locationId: 'loc-1', label: 'BULK-A-01', orgId: 'org-1' },
    });
  });
});
