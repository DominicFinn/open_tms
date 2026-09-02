export interface CustomsLineItemPricing {
  quantity: number;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
}

/** Declared value in cents: prefers the line total, falls back to unit price * quantity. */
export function declaredValueCentsFor(li: CustomsLineItemPricing): number | null {
  return li.totalPriceCents ?? (li.unitPriceCents != null ? li.unitPriceCents * li.quantity : null);
}

export interface CustomsLineItemInput extends CustomsLineItemPricing {
  hsCode: string | null;
  countryOfOrigin: string | null;
}

export interface CustomsLineItemOutput {
  hsCode: string | undefined;
  countryOfOrigin: string | undefined;
  declaredValue: string | undefined;
}

/** Maps an order line item onto the customs-form fields, leaving a field undefined (blank fill-in line in the template) when the data isn't set. */
export function mapCustomsLineItem<T extends CustomsLineItemInput>(li: T): Omit<T, keyof CustomsLineItemOutput> & CustomsLineItemOutput {
  const cents = declaredValueCentsFor(li);
  return {
    ...li,
    hsCode: li.hsCode || undefined,
    countryOfOrigin: li.countryOfOrigin || undefined,
    declaredValue: cents != null ? (cents / 100).toFixed(2) : undefined,
  };
}

export function totalDeclaredValueFor(lineItems: CustomsLineItemPricing[]): string | undefined {
  const totalCents = lineItems.reduce((sum, li) => sum + (declaredValueCentsFor(li) ?? 0), 0);
  return totalCents > 0 ? (totalCents / 100).toFixed(2) : undefined;
}
