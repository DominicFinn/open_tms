/**
 * TemplateResolver — resolves {{field.path}} templates against event data.
 *
 * Uses the same field path format as the ConditionEvaluator.
 * Supports: {{event.type}}, {{payload.shipmentReference}}, {{context.shipment.customerName}}, etc.
 */

export function resolveTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    const trimmed = path.trim();
    const value = resolveFieldPath(data, trimmed);
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

export function resolveFields(
  fields: Record<string, string>,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      resolved[key] = resolveTemplate(value, data);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

function resolveFieldPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (part === 'length' && Array.isArray(current)) return current.length;
    if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}
