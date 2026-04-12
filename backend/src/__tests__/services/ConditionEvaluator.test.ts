import { evaluateConditions, RuleCondition, EvaluationContext } from '../../services/automation/ConditionEvaluator';

const baseEvent: EvaluationContext = {
  event: {
    type: 'shipment.exception',
    entityType: 'shipment',
    entityId: 'ship-1',
    timestamp: '2026-04-12T14:30:00Z',
    payload: {
      shipmentReference: 'SH-00042',
      exceptionType: 'eta_critical_delay',
      delayMinutes: 65,
      description: 'Shipment is 65 minutes late',
    },
  },
  context: {
    shipment: {
      status: 'in_transit',
      customerName: 'Acme Corp',
    },
    openIssues: [
      { id: 'issue-1', title: 'Existing delay issue' },
    ],
    slaStatus: [
      { ruleType: 'eta_delivery', status: 'warning' },
    ],
  },
};

describe('ConditionEvaluator', () => {
  describe('equals operator', () => {
    it('matches exact string value', () => {
      const conditions: RuleCondition[] = [
        { field: 'event.type', operator: 'equals', value: 'shipment.exception' },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
    });

    it('fails on non-matching value', () => {
      const conditions: RuleCondition[] = [
        { field: 'event.type', operator: 'equals', value: 'sla.breached' },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(false);
    });
  });

  describe('notEquals operator', () => {
    it('matches when values differ', () => {
      const conditions: RuleCondition[] = [
        { field: 'payload.exceptionType', operator: 'notEquals', value: 'temperature_excursion' },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
    });
  });

  describe('greaterThan operator', () => {
    it('matches numeric comparison', () => {
      const conditions: RuleCondition[] = [
        { field: 'payload.delayMinutes', operator: 'greaterThan', value: 60 },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
    });

    it('fails when value is not greater', () => {
      const conditions: RuleCondition[] = [
        { field: 'payload.delayMinutes', operator: 'greaterThan', value: 100 },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(false);
    });
  });

  describe('lessThan operator', () => {
    it('matches when value is less', () => {
      const conditions: RuleCondition[] = [
        { field: 'payload.delayMinutes', operator: 'lessThan', value: 100 },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
    });
  });

  describe('contains operator', () => {
    it('matches substring in string', () => {
      const conditions: RuleCondition[] = [
        { field: 'payload.description', operator: 'contains', value: '65 minutes' },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
    });

    it('is case-insensitive', () => {
      const conditions: RuleCondition[] = [
        { field: 'payload.description', operator: 'contains', value: 'SHIPMENT' },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
    });
  });

  describe('in operator', () => {
    it('matches value in array', () => {
      const conditions: RuleCondition[] = [
        { field: 'payload.exceptionType', operator: 'in', value: ['eta_critical_delay', 'temperature_excursion'] },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
    });

    it('fails when value not in array', () => {
      const conditions: RuleCondition[] = [
        { field: 'payload.exceptionType', operator: 'in', value: ['temperature_excursion', 'damage'] },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(false);
    });
  });

  describe('exists / notExists operators', () => {
    it('matches existing field', () => {
      const conditions: RuleCondition[] = [
        { field: 'payload.delayMinutes', operator: 'exists' },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
    });

    it('matches non-existing field', () => {
      const conditions: RuleCondition[] = [
        { field: 'payload.nonExistentField', operator: 'notExists' },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
    });
  });

  describe('nested field paths', () => {
    it('resolves context.shipment.status', () => {
      const conditions: RuleCondition[] = [
        { field: 'context.shipment.status', operator: 'equals', value: 'in_transit' },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
    });

    it('resolves array .length', () => {
      const conditions: RuleCondition[] = [
        { field: 'context.openIssues.length', operator: 'greaterThan', value: 0 },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
    });
  });

  describe('AND logic (multiple conditions)', () => {
    it('matches when ALL conditions are true', () => {
      const conditions: RuleCondition[] = [
        { field: 'event.type', operator: 'equals', value: 'shipment.exception' },
        { field: 'payload.exceptionType', operator: 'equals', value: 'eta_critical_delay' },
        { field: 'payload.delayMinutes', operator: 'greaterThan', value: 60 },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(true);
      expect(result.details).toHaveLength(3);
      expect(result.details.every((d) => d.matched)).toBe(true);
    });

    it('fails when ANY condition is false', () => {
      const conditions: RuleCondition[] = [
        { field: 'event.type', operator: 'equals', value: 'shipment.exception' },
        { field: 'payload.delayMinutes', operator: 'greaterThan', value: 100 },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.matched).toBe(false);
      expect(result.details[0].matched).toBe(true);
      expect(result.details[1].matched).toBe(false);
    });
  });

  describe('empty conditions', () => {
    it('returns false for empty conditions array', () => {
      const result = evaluateConditions([], baseEvent);
      expect(result.matched).toBe(false);
    });
  });

  describe('evaluation result details', () => {
    it('includes actual values in details', () => {
      const conditions: RuleCondition[] = [
        { field: 'payload.delayMinutes', operator: 'greaterThan', value: 60 },
      ];
      const result = evaluateConditions(conditions, baseEvent);
      expect(result.details[0].actual).toBe(65);
      expect(result.details[0].expected).toBe(60);
    });
  });
});
