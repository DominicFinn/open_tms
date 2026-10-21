/**
 * A unit the warehouse handles, expressed without reference to the system that created it (#357).
 *
 * WMS consumes this; TMS implements it over TrackableUnit. Like IFulfilmentDemandSource, it lives
 * in core because both sides need the type and tms may not import wms. It is read by the
 * HandlingUnitProjection, never from inside a command, so it never becomes a call made while a
 * warehouse transaction is open.
 */

export interface HandlingUnitSourceLine {
  /** Id of the line in the source system. Opaque to WMS. */
  readonly sourceLineId: string;
  readonly sku: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly weight: number | null;
  readonly hazmat: boolean;
  readonly temperature: string | null;
}

export interface HandlingUnitSnapshot {
  readonly orgId: string;
  /** tms_trackable_unit */
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceOrderId: string | null;
  readonly identifier: string;
  readonly unitType: string;
  readonly customTypeName: string | null;
  readonly barcode: string | null;
  readonly lines: readonly HandlingUnitSourceLine[];
}

export interface IHandlingUnitSource {
  /** The snapshot for one source unit, or null when it no longer exists or is out of scope. */
  getSnapshot(orgId: string, sourceId: string): Promise<HandlingUnitSnapshot | null>;

  /** The source units of one order, so a change to the order's lines can re-project them. */
  listSourceIdsForOrder(orgId: string, orderId: string): Promise<string[]>;

  /** Every source unit that should have a handling unit. Used by the backfill. */
  listSourceIds(): Promise<Array<{ orgId: string; sourceId: string }>>;
}
