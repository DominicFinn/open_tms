/**
 * Read-only questions TMS and core ask the warehouse (#359).
 *
 * WMS implements them over its own tables; callers resolve them from the container, so they never
 * read a warehouse table themselves. Ports are for reads made outside a transaction (routes,
 * services, cron, event handlers). A command never calls one: what a command needs from another
 * module comes from a local projection or from the event that triggered it.
 */

/** How much warehouse work is still open for a shipment and its orders. */
export interface FulfilmentProgress {
  readonly pendingPickTasks: number;
  readonly pendingPackTasks: number;
  readonly openLoadPlans: number;
}

export interface IFulfilmentProgress {
  forShipment(orgId: string, shipmentId: string, orderIds: readonly string[]): Promise<FulfilmentProgress>;
}

/** A pack task and its recent audits, for the triage agent. */
export interface PackTaskContext {
  readonly id: string;
  readonly orderId: string | null;
  readonly status: string;
  readonly packLines: ReadonlyArray<{ sku: string; expectedQuantity: number; packedQuantity: number }>;
  readonly recentAudits: ReadonlyArray<{ verdict: string; weightVariancePercent: unknown; createdAt: Date }>;
}

export interface IPackTaskContext {
  get(orgId: string, packTaskId: string): Promise<PackTaskContext | null>;
}

/** A carton the warehouse stocks, as the container recommender needs it. */
export interface CartonSpec {
  readonly id: string;
  readonly name: string;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly maxWeightGrams: number;
  readonly unitCostCents: number | null;
  readonly temperatureZone: string;
  readonly insulated: boolean;
  readonly insulationHours: number | null;
  readonly tamperEvident: boolean;
  readonly valueClass: string;
  readonly hazmatRated: boolean;
  readonly hazmatClasses: readonly string[];
  readonly materialType: string;
  readonly active: boolean;
}

export interface ICartonCatalogue {
  /** Active cartons in the org, optionally only those at one Location. */
  listActive(orgId: string, locationId?: string): Promise<CartonSpec[]>;
}
