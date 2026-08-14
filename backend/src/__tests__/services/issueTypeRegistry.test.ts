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
  computeSignalScore,
  isNoise,
  noiseReasonFor,
  slaDeadlineFor,
  NOISE_THRESHOLD,
  CORROBORATION_BOOST,
  MAX_SIGNAL_SCORE,
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

describe('issueTypeRegistry — triage signal scoring', () => {
  it('gives every type a base confidence within 0-100', () => {
    for (const t of allIssueTypes()) {
      expect(t.baseConfidence).toBeGreaterThanOrEqual(0);
      expect(t.baseConfidence).toBeLessThanOrEqual(100);
    }
  });

  it('scores a single signal at the type base confidence', () => {
    const t = getIssueType('shipment_cutoff_risk')!;
    expect(computeSignalScore(t, 1)).toBe(t.baseConfidence);
  });

  it('boosts the score by CORROBORATION_BOOST for each extra signal', () => {
    const t = getIssueType('shipment_temperature')!; // baseConfidence 30
    expect(computeSignalScore(t, 1)).toBe(30);
    expect(computeSignalScore(t, 2)).toBe(30 + CORROBORATION_BOOST);
    expect(computeSignalScore(t, 4)).toBe(30 + 3 * CORROBORATION_BOOST);
  });

  it('caps the score at MAX_SIGNAL_SCORE no matter how many signals arrive', () => {
    const t = getIssueType('shipment_cutoff_risk')!;
    expect(computeSignalScore(t, 100)).toBe(MAX_SIGNAL_SCORE);
  });

  it('treats a zero or negative signal count as a single signal', () => {
    const t = getIssueType('shipment_cutoff_risk')!;
    expect(computeSignalScore(t, 0)).toBe(t.baseConfidence);
    expect(computeSignalScore(t, -5)).toBe(t.baseConfidence);
  });

  it('flags a low-scoring unlatched issue as noise', () => {
    const t = getIssueType('shipment_eta_delay')!; // unlatched
    expect(isNoise(t, NOISE_THRESHOLD - 1)).toBe(true);
    expect(isNoise(t, NOISE_THRESHOLD)).toBe(true);
    expect(isNoise(t, NOISE_THRESHOLD + 1)).toBe(false);
  });

  it('NEVER marks a latched safety type as noise, however low the score', () => {
    // This is the whole point of the latched flag: a temperature excursion or a
    // possible tamper has already happened. Suppressing it because one sensor
    // reading looked marginal is the exact failure this system prevents.
    for (const key of ['shipment_temperature', 'shipment_tamper_light', 'shipment_misship'] as const) {
      const t = getIssueType(key)!;
      expect(t.latched).toBe(true);
      expect(isNoise(t, 0)).toBe(false);
      expect(isNoise(t, 1)).toBe(false);
    }
  });

  it('derives an SLA deadline from the type slaMinutes', () => {
    const t = getIssueType('shipment_temperature')!; // slaMinutes 60
    const from = new Date('2026-08-14T10:00:00.000Z');
    expect(slaDeadlineFor(t, from)!.toISOString()).toBe('2026-08-14T11:00:00.000Z');
  });

  it('returns no SLA deadline for a type without slaMinutes', () => {
    const t = { ...getIssueType('shipment_eta_delay')!, slaMinutes: undefined };
    expect(slaDeadlineFor(t, new Date())).toBeNull();
  });

  it('explains why an issue was suppressed', () => {
    const t = getIssueType('shipment_eta_delay')!;
    const reason = noiseReasonFor(t, 30, 1);
    expect(reason).toContain(t.name);
    expect(reason).toContain('30/100');
    expect(reason).toContain('1 signal');
  });
});
