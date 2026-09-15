/**
 * #285: four WMS models never got a facilityId, and #248 pointed their routes at it anyway.
 *
 * Nothing caught it. The repositories take a `WarehouseScope`, which is structurally valid whatever
 * model it is spread into; Prisma only rejects an unknown column at runtime; and the unit tests
 * mock Prisma, so they never see the real shape either. It took starting the server.
 *
 * This reads the schema and asserts the column exists on every model a scoped read can reach, which
 * is the cheapest place to catch the next one.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SCHEMA = join(__dirname, '../../../prisma/schema/wms.prisma');

function modelsWith(field: string): Set<string> {
  const src = readFileSync(SCHEMA, 'utf8');
  const found = new Set<string>();
  for (const block of src.split(/^model /m).slice(1)) {
    const name = block.split(/\s/)[0];
    const body = block.slice(0, block.indexOf('\n}'));
    if (new RegExp(`^\\s*${field}\\s`, 'm').test(body)) found.add(name);
  }
  return found;
}

describe('WMS models a facility-scoped read can reach (#285)', () => {
  const withLocation = modelsWith('locationId');
  const withFacility = modelsWith('facilityId');

  it('finds the models, so this is not asserting over an empty set', () => {
    expect(withLocation.size).toBeGreaterThanOrEqual(14);
  });

  it('every model carrying locationId also carries facilityId', () => {
    const missing = [...withLocation].filter((m) => !withFacility.has(m)).sort();
    expect(missing).toEqual([]);
  });

  it('no WMS model holds a foreign key to Location', () => {
    const src = readFileSync(SCHEMA, 'utf8');
    expect(src).not.toMatch(/location\s+Location\??\s+@relation/);
  });
});
