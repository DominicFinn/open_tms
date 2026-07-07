import {
  ISSUE_TYPES,
  getIssueType,
  allIssueTypes,
  issueTypesForTriggerEvent,
  issueTypesForRecoveryEvent,
  allTriggerEvents,
  allRecoveryEvents,
  maxPriority,
  priorityRank,
} from '../../services/issues/issueTypeRegistry.js';

describe('issueTypeRegistry', () => {
  it('every type key matches its map key and carries the required config', () => {
    for (const [key, def] of Object.entries(ISSUE_TYPES)) {
      expect(def.key).toBe(key);
      expect(def.name).toBeTruthy();
      expect(def.category).toBeTruthy();
      expect(['low', 'medium', 'high', 'critical']).toContain(def.defaultPriority);
      expect(def.raise.thresholdCount).toBeGreaterThanOrEqual(1);
      expect(def.raise.windowMinutes).toBeGreaterThan(0);
      expect(Array.isArray(def.triggerEvents)).toBe(true);
      expect(def.triggerEvents.length).toBeGreaterThan(0);
    }
  });

  it('latched types declare no recovery events; unlatched types declare at least one', () => {
    for (const def of allIssueTypes()) {
      if (def.latched) {
        expect(def.recoveryEvents).toHaveLength(0);
      } else {
        expect(def.recoveryEvents.length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves a type by key', () => {
    expect(getIssueType('shipment_cutoff_risk')?.name).toBe('Cutoff at risk');
    expect(getIssueType('nope')).toBeUndefined();
  });

  it('maps a trigger event to its type(s)', () => {
    expect(issueTypesForTriggerEvent('shipment.cutoff_at_risk').map(t => t.key)).toEqual([
      'shipment_cutoff_risk',
    ]);
    // the three cargo events all map to the single mis-ship type
    for (const e of ['cargo.misdrop_detected', 'cargo.missing_at_stop', 'cargo.left_on_vehicle']) {
      expect(issueTypesForTriggerEvent(e).map(t => t.key)).toEqual(['shipment_misship']);
    }
    expect(issueTypesForTriggerEvent('unrelated.event')).toHaveLength(0);
  });

  it('maps a recovery event to its type', () => {
    expect(issueTypesForRecoveryEvent('tracking.eta_recovered').map(t => t.key)).toEqual([
      'shipment_eta_delay',
    ]);
    expect(issueTypesForRecoveryEvent('shipment.cutoff_cleared').map(t => t.key)).toEqual([
      'shipment_cutoff_risk',
    ]);
  });

  it('exposes the distinct trigger and recovery event sets for subscriptions', () => {
    expect(allTriggerEvents()).toEqual(
      expect.arrayContaining([
        'shipment.cutoff_at_risk',
        'tracking.eta_updated',
        'cargo.misdrop_detected',
        'cold_chain.excursion_detected',
        'shipment.tamper_light',
      ]),
    );
    expect(allRecoveryEvents()).toEqual(
      expect.arrayContaining(['shipment.cutoff_cleared', 'tracking.eta_recovered']),
    );
    // no duplicates
    expect(new Set(allTriggerEvents()).size).toBe(allTriggerEvents().length);
  });

  it('ranks and compares priorities', () => {
    expect(priorityRank('critical')).toBeGreaterThan(priorityRank('high'));
    expect(priorityRank('unknown')).toBe(0);
    expect(maxPriority('low', 'high')).toBe('high');
    expect(maxPriority('critical', 'medium')).toBe('critical');
  });
});
