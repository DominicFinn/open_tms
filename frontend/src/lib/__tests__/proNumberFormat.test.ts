import { describeProFormat, checkProFormat } from '../proNumberFormat';

describe('describeProFormat', () => {
  it('returns null when the carrier has no format hints', () => {
    expect(describeProFormat({ name: 'Acme Freight' })).toBeNull();
  });

  it('describes prefix, length range, and numeric-only together', () => {
    expect(
      describeProFormat({
        name: 'Old Dominion Freight Line',
        proNumberPrefix: 'OD-',
        proNumberMinLength: 7,
        proNumberMaxLength: 10,
        proNumberNumericOnly: true,
      }),
    ).toBe('Old Dominion Freight Line PRO numbers start with "OD-" and run 7-10 characters and contain digits only.');
  });

  it('falls back to "up to" when only a max length is set', () => {
    expect(describeProFormat({ name: 'Acme Freight', proNumberMaxLength: 9 })).toBe(
      'Acme Freight PRO numbers run up to 9 characters.',
    );
  });

  it('falls back to "at least" when only a min length is set', () => {
    expect(describeProFormat({ name: 'Acme Freight', proNumberMinLength: 7 })).toBe(
      'Acme Freight PRO numbers run at least 7 characters.',
    );
  });
});

describe('checkProFormat', () => {
  const carrier = { name: 'Saia LTL Freight', proNumberMinLength: 7, proNumberMaxLength: 10, proNumberNumericOnly: true };

  it('returns null for an empty PRO number (nothing to check yet)', () => {
    expect(checkProFormat('', carrier)).toBeNull();
  });

  it('returns null when the PRO number fits the format', () => {
    expect(checkProFormat('1234567890', carrier)).toBeNull();
  });

  it('warns when too long', () => {
    expect(checkProFormat('12345678901', carrier)).toMatch(/usual 10 characters/);
  });

  it('warns when too short', () => {
    expect(checkProFormat('123', carrier)).toMatch(/usual 7 characters/);
  });

  it('warns on non-digits for a numeric-only carrier', () => {
    expect(checkProFormat('ABC1234', carrier)).toMatch(/digits only/);
  });

  it('never blocks — a wrong/stale hint still returns a warning string, not a thrown error', () => {
    expect(() => checkProFormat('anything', { name: 'X', proNumberMaxLength: -1 })).not.toThrow();
  });
});
