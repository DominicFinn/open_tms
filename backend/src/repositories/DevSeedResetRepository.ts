/**
 * Dev-only cascading reset for the seed route (#251).
 *
 * The seed route wipes and recreates Customer/Carrier/Location/Shipment/Order
 * unconditionally. A hand-maintained list of every table that FK-references
 * one of those five roots goes stale every time the schema grows a new
 * dependent table — that's exactly what caused the original bug
 * (`Load_shipmentId_fkey` violation): the list only covered 6 tables while
 * dozens more across tms/finance/quality/wms reference the same roots.
 *
 * This walks the dependency graph from Prisma's own schema metadata (DMMF)
 * at runtime, so a newly added table is picked up automatically with no list
 * to maintain. It never truncates a whole table — TRUNCATE ... CASCADE
 * empties every row in a dependent table regardless of whether that row
 * actually references the deleted data (verified while building this: it
 * wiped the entire `User` table via the nullable `User.customerId` link,
 * which would have deleted every internal user's login, not just
 * customer-portal accounts). Instead, for each dependent model it deletes
 * only the rows whose FK value is among the ids being removed at the model
 * it points to, computed bottom-up from the five roots.
 *
 * Two kinds of dependency are followed:
 *  1. Real Prisma relations (an actual FK constraint at the DB level).
 *  2. "Soft" references: a plain `<root>Id` scalar column with no `@relation`
 *     — e.g. `DeviceEvent.shipmentId`. These don't throw on delete (nothing
 *     enforces them), so leaving them out doesn't 500 the reset — it just
 *     leaves orphaned rows pointing at ids that no longer exist. Confirmed
 *     while investigating #251: a reset left 23 `GeneratedDocument` rows
 *     pointing at deleted shipments, with their stored PDFs now unreferenced
 *     from anywhere. `SOFT_REF_EXCLUDED_MODELS` below is the explicit,
 *     documented list of models where that's deliberate, not an oversight —
 *     everything else gets the same treatment as a real relation.
 */

import { Prisma, PrismaClient } from '@prisma/client';

interface FkEdge {
  /** Scalar column on the dependent model holding the FK value. */
  field: string;
  /** Model the FK points at. */
  targetModel: string;
}

export interface IDevSeedResetRepository {
  resetSeedTables(): Promise<void>;
}

const ROOT_MODELS = ['Customer', 'Carrier', 'Location', 'Shipment', 'Order'];

/**
 * Models with a soft `<root>Id` reference that must NOT be swept up by the
 * generic soft-reference discovery below, each for a specific reason:
 *
 * - `EdiTransactionLog`: the canonical ledger table in this codebase (see
 *   the database rule) — append-only, and a stale reference in an audit
 *   trail is expected, the same way a log line can mention a deleted user.
 * - `ImmutableTemperatureLog`: tamper-evident regulatory record (SHA-256
 *   integrity hashes) — mutating or deleting rows here to "tidy up" would
 *   defeat the entire point of the table.
 * - Every WMS model (`PutawayRule`, `WaveOrder`, `PickTask`, `PickLine`,
 *   `PackTask`, `CartonCatalogue`, `StagingAssignment`, `LoadPlan`,
 *   `LoadPlanLine`, `CycleCount`, `ReplenishmentRule`,
 *   `WmsFulfilmentOrder`): the module-boundaries rule mandates that no FK
 *   ever crosses the tms/wms line — "references there are soft string ids"
 *   is the architecture, not a gap. A tms-owned seed route reaching across
 *   that boundary to clean up wms rows would violate the same rule this
 *   reset otherwise respects.
 */
const SOFT_REF_EXCLUDED_MODELS = new Set([
  'EdiTransactionLog',
  'ImmutableTemperatureLog',
  'PutawayRule',
  'WaveOrder',
  'PickTask',
  'PickLine',
  'PackTask',
  'CartonCatalogue',
  'StagingAssignment',
  'LoadPlan',
  'LoadPlanLine',
  'CycleCount',
  'ReplenishmentRule',
  'WmsFulfilmentOrder',
]);

export class DevSeedResetRepository implements IDevSeedResetRepository {
  constructor(private prisma: PrismaClient) {}

  async resetSeedTables(): Promise<void> {
    const models = Prisma.dmmf.datamodel.models;

    // Real Prisma relation FKs, keyed by "Model.field", so soft-reference
    // discovery below can skip a field that's already covered this way.
    const relationFkFields = new Set<string>();
    for (const model of models) {
      for (const field of model.fields) {
        if (field.kind === 'object' && field.relationFromFields?.length) {
          relationFkFields.add(`${model.name}.${field.relationFromFields[0]}`);
        }
      }
    }

    // Every model's outgoing dependency edges (this model -> the model it
    // references) — real relation FKs plus soft `<root>Id` references not
    // already covered by one and not on the exclusion list above.
    const outgoing = new Map<string, FkEdge[]>();
    const idFieldOf = new Map<string, string>();
    for (const model of models) {
      const edges: FkEdge[] = [];
      for (const field of model.fields) {
        if (field.kind === 'object' && field.relationFromFields?.length) {
          edges.push({ field: field.relationFromFields[0], targetModel: field.type });
          continue;
        }
        if (field.kind !== 'scalar' || field.type !== 'String') continue;
        if (SOFT_REF_EXCLUDED_MODELS.has(model.name)) continue;
        if (relationFkFields.has(`${model.name}.${field.name}`)) continue;
        for (const root of ROOT_MODELS) {
          const expectedField = root.charAt(0).toLowerCase() + root.slice(1) + 'Id';
          if (field.name === expectedField) {
            edges.push({ field: field.name, targetModel: root });
          }
        }
      }
      outgoing.set(model.name, edges);
      const idField = model.fields.find((f) => f.isId);
      if (idField) idFieldOf.set(model.name, idField.name);
    }

    // Reverse-reachability from the roots: every model that transitively has
    // an FK edge landing on a root is in scope for the reset.
    const inScope = new Set<string>(ROOT_MODELS);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [model, edges] of outgoing) {
        if (inScope.has(model)) continue;
        if (edges.some((e) => inScope.has(e.targetModel))) {
          inScope.add(model);
          changed = true;
        }
      }
      for (const model of inScope) {
        if (!idFieldOf.has(model)) {
          throw new Error(`DevSeedResetRepository: model ${model} has no single scalar id field — composite keys aren't supported by this reset`);
        }
      }
    }

    // Forward topological order (a model's edge targets come before it) —
    // used to compute id sets bottom-up-safe, since a dependent's matching
    // ids are derived from its target's id set.
    const forwardOrder: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (name: string) => {
      if (visited.has(name) || !inScope.has(name) || visiting.has(name)) return;
      visiting.add(name);
      for (const edge of outgoing.get(name) ?? []) {
        if (inScope.has(edge.targetModel)) visit(edge.targetModel);
      }
      visiting.delete(name);
      visited.add(name);
      forwardOrder.push(name);
    };
    for (const name of inScope) visit(name);

    // Phase A: compute, for every in-scope model, the ids that will be
    // removed — roots unconditionally (this route's existing "wipe
    // everything" contract), dependents by matching their FK against the
    // id set already computed for whatever they point at. Forward order
    // guarantees a model's targets are computed before the model itself.
    const idsToDelete = new Map<string, string[]>();
    for (const name of forwardOrder) {
      const delegate = this.delegateFor(name);
      const idField = idFieldOf.get(name)!;

      if (ROOT_MODELS.includes(name)) {
        const rows: Array<Record<string, string>> = await delegate.findMany({ select: { [idField]: true } });
        idsToDelete.set(name, rows.map((r) => r[idField]));
        continue;
      }

      const edges = (outgoing.get(name) ?? []).filter((e) => inScope.has(e.targetModel));
      if (edges.length === 0) continue; // nothing here points at anything in scope

      const where = {
        OR: edges.map((e) => ({ [e.field]: { in: idsToDelete.get(e.targetModel) ?? [] } })),
      };
      const rows: Array<Record<string, string>> = await delegate.findMany({ where, select: { [idField]: true } });
      idsToDelete.set(name, rows.map((r) => r[idField]));
    }

    // Phase B: delete in the reverse order — dependents before whatever
    // they depend on, so no FK constraint is ever violated.
    for (const name of [...forwardOrder].reverse()) {
      const ids = idsToDelete.get(name);
      if (!ids || ids.length === 0) continue;
      const delegate = this.delegateFor(name);
      const idField = idFieldOf.get(name)!;
      await delegate.deleteMany({ where: { [idField]: { in: ids } } });
    }
  }

  private delegateFor(modelName: string): any {
    const key = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const delegate = (this.prisma as any)[key];
    if (!delegate) throw new Error(`DevSeedResetRepository: no Prisma delegate for model ${modelName}`);
    return delegate;
  }
}
