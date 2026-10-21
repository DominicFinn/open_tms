/**
 * Signals from outside the warehouse that its operations dashboard shows (#359): open issues,
 * shipments at cutoff risk or dispatched, and returns in progress.
 *
 * WMS consumes this; the full product implements it over issues, shipments and RMAs. A standalone
 * FinnWMS, with no shipments or returns, would register an implementation that reports what it
 * has and zero for the rest.
 */

export interface OperationsSignals {
  readonly openIssues: number;
  readonly criticalIssues: number;
  readonly cutoffCritical: number;
  readonly cutoffWarning: number;
  readonly pendingRmas: number;
}

export interface IOperationsSignals {
  current(orgId: string): Promise<OperationsSignals>;
  shipmentsDispatchedSince(orgId: string, since: Date): Promise<number>;
  /** Hours from order creation to dispatch, averaged over shipments dispatched since. */
  orderToShip(orgId: string, since: Date): Promise<{ averageHours: number | null; samples: number }>;
}
