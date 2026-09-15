export interface ProFormatCarrier {
  name: string;
  proNumberPrefix?: string | null;
  proNumberMinLength?: number | null;
  proNumberMaxLength?: number | null;
  proNumberNumericOnly?: boolean | null;
}

// Describes the carrier's known PRO number shape for helper text under the field.
export function describeProFormat(carrier: ProFormatCarrier): string | null {
  const parts: string[] = [];
  if (carrier.proNumberPrefix) parts.push(`start with "${carrier.proNumberPrefix}"`);
  if (carrier.proNumberMinLength && carrier.proNumberMaxLength) {
    parts.push(`run ${carrier.proNumberMinLength}-${carrier.proNumberMaxLength} characters`);
  } else if (carrier.proNumberMaxLength) {
    parts.push(`run up to ${carrier.proNumberMaxLength} characters`);
  } else if (carrier.proNumberMinLength) {
    parts.push(`run at least ${carrier.proNumberMinLength} characters`);
  }
  if (carrier.proNumberNumericOnly) parts.push('contain digits only');
  if (parts.length === 0) return null;
  return `${carrier.name} PRO numbers ${parts.join(' and ')}.`;
}

// Non-blocking check — a stale/wrong hint must never prevent a real PRO number
// from being saved, so this only ever produces a warning, never an error.
export function checkProFormat(proNumber: string, carrier: ProFormatCarrier): string | null {
  if (!proNumber) return null;
  if (carrier.proNumberMaxLength && proNumber.length > carrier.proNumberMaxLength) {
    return `Longer than ${carrier.name}'s usual ${carrier.proNumberMaxLength} characters — double-check it.`;
  }
  if (carrier.proNumberMinLength && proNumber.length < carrier.proNumberMinLength) {
    return `Shorter than ${carrier.name}'s usual ${carrier.proNumberMinLength} characters — double-check it.`;
  }
  if (carrier.proNumberNumericOnly && !/^\d+$/.test(proNumber)) {
    return `${carrier.name} PRO numbers are usually digits only — double-check it.`;
  }
  return null;
}
