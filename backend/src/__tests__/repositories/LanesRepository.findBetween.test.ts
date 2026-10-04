import { LanesRepository } from '../../repositories/LanesRepository';

describe('LanesRepository.findBetween (#328)', () => {
  it('finds active lanes between two locations in the org, with stop location ids in order', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'lane-1', name: 'GB → DEN', serviceLevel: 'LTL', stops: [{ locationId: 'hub' }, { locationId: 'roch' }] },
    ]);
    const repo = new LanesRepository({ lane: { findMany } } as any);

    const lanes = await repo.findBetween('org-1', 'origin', 'dest');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { orgId: 'org-1', originId: 'origin', destinationId: 'dest', archived: false },
    }));
    expect(lanes).toEqual([{ id: 'lane-1', name: 'GB → DEN', serviceLevel: 'LTL', stopLocationIds: ['hub', 'roch'] }]);
  });
});
