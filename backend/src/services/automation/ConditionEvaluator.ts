/**
 * ConditionEvaluator — evaluates automation rule conditions against event data.
 *
 * Conditions use the unified format shared between agent decisions and
 * automation rules: { field, operator, value }.
 *
 * Supports nested field paths (e.g., "payload.delayMinutes") and a range
 * of operators for string, number, array, and existence checks.
 */

export interface RuleCondition {
  field: string;
  operator: string;
  value?: unknown;
}

export interface EvaluationContext {
  event: {
    type: string;
    entityType: string;
    entityId: string;
    timestamp: string;
    payload: Record<string, unknown>;
  };
  context?: Record<string, unknown>;
}

export interface EvaluationResult {
  matched: boolean;
  details: Array<{
    field: string;
    operator: string;
    expected: unknown;
    actual: unknown;
    matched: boolean;
  }>;
}

/**
 * Resolves a dotted field path against a data object.
 * e.g., "payload.delayMinutes" against { payload: { delayMinutes: 65 } } -> 65
 * e.g., "context.openIssues.length" -> array length
 */
function resolveFieldPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    if (part === 'length' && Array.isArray(current)) {
      return current.length;
    }

    if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Evaluates a single condition against the data.
 */
function evaluateCondition(condition: RuleCondition, data: Record<string, unknown>): boolean {
  const actual = resolveFieldPath(data, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case 'equals':
      return actual === expected || String(actual) === String(expected);

    case 'notEquals':
      return actual !== expected && String(actual) !== String(expected);

    case 'contains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.toLowerCase().includes(expected.toLowerCase());
      }
      if (Array.isArray(actual)) {
        return actual.includes(expected);
      }
      return false;

    case 'in':
      if (Array.isArray(expected)) {
        return expected.includes(actual) || expected.map(String).includes(String(actual));
      }
      return false;

    case 'greaterThan':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;

    case 'lessThan':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;

    case 'greaterThanOrEqual':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;

    case 'lessThanOrEqual':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;

    case 'exists':
      return actual !== null && actual !== undefined;

    case 'notExists':
      return actual === null || actual === undefined;

    default:
      console.warn(`[ConditionEvaluator] Unknown operator: ${condition.operator}`);
      return false;
  }
}

/**
 * Evaluates all conditions against event data (AND logic).
 * Returns detailed results for each condition plus overall match.
 */
export function evaluateConditions(
  conditions: RuleCondition[],
  eventData: EvaluationContext,
): EvaluationResult {
  // Build flat data object for field resolution
  const data: Record<string, unknown> = {
    event: {
      type: eventData.event.type,
      entityType: eventData.event.entityType,
      entityId: eventData.event.entityId,
      timestamp: eventData.event.timestamp,
    },
    payload: eventData.event.payload,
    ...(eventData.context ? { context: eventData.context } : {}),
  };

  const details = conditions.map((condition) => {
    const actual = resolveFieldPath(data, condition.field);
    const matched = evaluateCondition(condition, data);

    return {
      field: condition.field,
      operator: condition.operator,
      expected: condition.value,
      actual,
      matched,
    };
  });

  return {
    matched: details.length > 0 && details.every((d) => d.matched),
    details,
  };
}
