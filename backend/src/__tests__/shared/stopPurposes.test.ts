import { laneStopOtherPurpose, stopTypeLabel, isOtherStopPurpose } from '@open-tms/shared';

describe('stop purposes (#345)', () => {
  it('turns pass-through lane stops into other stops and leaves the rest as drops', () => {
    expect(laneStopOtherPurpose('fuel')).toBe('fuel');
    expect(laneStopOtherPurpose('cross_dock')).toBe('cross_dock');
    expect(laneStopOtherPurpose('other')).toBe('other');
    expect(laneStopOtherPurpose('dropoff')).toBeNull();
    expect(laneStopOtherPurpose('pickup')).toBeNull();
    expect(laneStopOtherPurpose(null)).toBeNull();
  });

  it('names an other stop by its own name, then its purpose', () => {
    expect(stopTypeLabel({ stopType: 'other', purpose: 'customs', label: 'Laredo crossing' })).toBe('Laredo crossing');
    expect(stopTypeLabel({ stopType: 'other', purpose: 'cross_dock', label: '  ' })).toBe('Cross-dock');
    expect(stopTypeLabel({ stopType: 'other', purpose: 'nonsense' })).toBe('Stop');
    expect(stopTypeLabel({ stopType: 'pickup' })).toBe('Pickup');
    expect(stopTypeLabel({ stopType: 'delivery' })).toBe('Drop');
  });

  it('only accepts the known purposes', () => {
    expect(isOtherStopPurpose('rest')).toBe(true);
    expect(isOtherStopPurpose('dropoff')).toBe(false);
  });
});
