/**
 * The demand a warehouse has been asked to fulfil, expressed without reference to whatever
 * created it.
 *
 * WMS consumes this; TMS implements it over its own Order tables. The interface lives in core
 * rather than in either module because both sides need the type and tms may not import wms.
 * See .claude/rules/module-boundaries.md.
 *
 * A standalone FinnWMS registers a different implementation, or writes the read model directly
 * from a 940, an API call or a manifest. Nothing in WMS knows the difference.
 */

export interface FulfilmentDemandLine {
  /** Id of the line in the source system. Opaque to WMS. */
  readonly sourceLineId: string;
  readonly sku: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly unitOfMeasure: string;
  readonly weight: number | null;
  readonly hazmat: boolean;
  readonly temperature: string | null;
}

export interface FulfilmentDemandSnapshot {
  readonly orgId: string;
  /** tms_order | edi_940 | api | manifest */
  readonly sourceType: string;
  readonly sourceId: string;
  readonly orderNumber: string;
  readonly poNumber: string | null;
  /** Carried through verbatim: wave template rules match on it. */
  readonly status: string;
  readonly customerId: string | null;
  readonly customerName: string | null;
  readonly originLocationId: string | null;
  readonly serviceLevel: string | null;
  readonly temperatureControl: string | null;
  readonly hazmat: boolean;
  readonly requestedPickupDate: Date | null;
  readonly requestedDeliveryDate: Date | null;
  readonly sourceCreatedAt: Date;
  readonly lines: readonly FulfilmentDemandLine[];
}

export interface IFulfilmentDemandSource {
  /** The snapshot for one source id, or null when it no longer exists or is out of scope. */
  getSnapshot(orgId: string, sourceId: string): Promise<FulfilmentDemandSnapshot | null>;

  /**
   * Every source id that should have a read-model row. Used by the backfill, so it returns ids
   * rather than snapshots: the caller fetches them one at a time and keeps memory flat.
   */
  listSourceIds(): Promise<Array<{ orgId: string; sourceId: string }>>;
}
