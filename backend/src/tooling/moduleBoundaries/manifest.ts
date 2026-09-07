/**
 * The module map and dependency DAG from ADR 0002 (modular monolith, build-time product
 * composition). Nothing has physically moved into `modules/` yet, so the map is expressed as
 * ordered path patterns over the current tree. When a file does move, its pattern moves with it
 * and the rest of this file is unchanged.
 */

export const MODULES = ['core', 'finance', 'inventory', 'quality', 'tms', 'wms'] as const;

export type ModuleName = (typeof MODULES)[number];

/**
 * Who may import whom. Straight from ADR 0002: core depends on nothing, inventory sits above
 * core, wms and tms both sit above inventory, and tms and wms never see each other. finance is in
 * core's tier rather than inside tms, because a standalone FinnWMS bills through the same
 * charge/invoice pipeline.
 */
export const ALLOWED_DEPENDENCIES: Record<ModuleName, readonly ModuleName[]> = {
  core: ['core'],
  finance: ['core', 'finance'],
  inventory: ['core', 'inventory'],
  quality: ['core', 'quality'],
  tms: ['core', 'finance', 'inventory', 'tms'],
  wms: ['core', 'finance', 'inventory', 'wms'],
};

/**
 * Paths the DAG deliberately doesn't govern. Tests assert across modules on purpose, and seed,
 * backfill and maintenance scripts are composition-root code that runs against the full product.
 * Everything else must be classified.
 */
export const EXEMPT_PATTERNS: readonly RegExp[] = [
  /^__tests__\//,
  /^scripts\//,
  // Composition roots. Wiring every module together is their whole job; Phase 1 chunks 3 and 4
  // split them into per-module registration files, at which point these entries come off.
  /^index(-demo)?\.ts$/,
  /^worker\.ts$/,
  /^bootstrap\//,
  /^di\/(registry|index)\.ts$/,
  /^commands\/index\.ts$/,
  /^events\/(registerHandlers|index)\.ts$/,
  /^events\/projections\/index\.ts$/,
];

export interface PathRule {
  /** Matched against the path relative to `backend/src`, with forward slashes. */
  readonly pattern: RegExp;
  readonly module: ModuleName;
  /** Why this sits where it does, when the answer isn't obvious from the name. */
  readonly note?: string;
}

/**
 * First match wins, so the specific rules come before the directory sweeps. A file matching
 * nothing is reported as unclassified and fails the check: the map must stay complete, otherwise
 * the boundary quietly stops covering new code.
 */
export const PATH_RULES: readonly PathRule[] = [
  // --- infrastructure and composition root ---
  { pattern: /^index(-demo)?\.ts$/, module: 'core' },
  { pattern: /^worker\.ts$/, module: 'core' },
  // Per-module DI and route registration. These are checked, not exempt: each one may only see
  // its own module. Only the composition roots, di/registry.ts and index.ts, see them all.
  { pattern: /^(di|routes)\/modules\/core\.ts$/, module: 'core' },
  { pattern: /^(di|routes)\/modules\/finance\.ts$/, module: 'finance' },
  { pattern: /^(di|routes)\/modules\/inventory\.ts$/, module: 'inventory' },
  { pattern: /^(di|routes)\/modules\/quality\.ts$/, module: 'quality' },
  { pattern: /^(di|routes)\/modules\/tms\.ts$/, module: 'tms' },
  { pattern: /^(di|routes)\/modules\/wms\.ts$/, module: 'wms' },
  { pattern: /^(bootstrap|di|plugins|middleware|auth|security|queue|storage|tooling)\//, module: 'core' },
  // Ports: interfaces one module calls and another implements. They live in core because the
  // implementing side often may not import the calling side. See module-boundaries.md.
  { pattern: /^ports\//, module: 'core' },

  // --- event and command infrastructure (the buses, not the handlers) ---
  { pattern: /^events\/(DomainEvent|IEventBus|IEventHandler|PgBossEventBus|createEvent|eventTypes|registerHandlers|index)\.ts$/, module: 'core' },
  { pattern: /^commands\/(BaseCommandHandler|CommandBus|types|index)\.ts$/, module: 'core' },

  // --- auth is core: every product authenticates the same way ---
  { pattern: /^services\/(auth\/|AuthService|CustomerAuthService)/, module: 'core', note: 'carrier auth is tms: a standalone FinnWMS has no carrier portal' },

  // --- overrides that would otherwise fall into a core sweep below ---
  { pattern: /^routes\/customer(Portal|Api|Developer|RmaApi)/, module: 'tms', note: 'the portal serves orders and shipments; the Customer entity itself is core' },
  { pattern: /^services\/(templates|skills|orderLineItem|llm)\//, module: 'tms' },
  { pattern: /^(routes|commands|services|repositories)\/.*packagingType/i, module: 'tms', note: 'the packaging catalogue feeds rating and palletisation; CartonCatalogue is the wms box master' },
  { pattern: /^services\/palletization\//, module: 'tms', note: 'palletising an order for shipping, not warehouse put-to-pallet' },
  { pattern: /^(routes|commands|services|events\/handlers)\/.*agent/i, module: 'tms', note: 'the triage agent is TMS AI work; the triage centre it writes into is core' },
  { pattern: /^(routes|services|repositories|workers)\/.*document/i, module: 'tms', note: 'document generation exists to produce BOLs, labels and customs paperwork; generic attachments stay core' },
  { pattern: /^commands\/queries\//, module: 'finance', note: 'billing queries raised against an invoice' },
  { pattern: /(?:^|\/)rma[\/.]|Rma[A-Z.]/, module: 'tms', note: 'an RMA is a customer returns authorisation raised over EDI 180 or the portal; the warehouse side of a return is wms' },
  { pattern: /^(services|routes)\/returnLabel/i, module: 'tms' },

  // --- core domain: tenancy, identity, and the cross-cutting surfaces both products need ---
  { pattern: /^(routes|commands|services|repositories|events\/handlers)\/.*(organization|internalUser|role|permission|apiKey|theme|customField|globalSearch|metrics|queueMonitoring|notification|email|comment|attachment|seed)/i, module: 'core' },
  { pattern: /^(routes|commands|services|repositories|events\/(projections|handlers))\/.*(issue|triage)/i, module: 'core', note: 'the issue engine is core; modules contribute issue types through the registry (#133)' },
  { pattern: /^(routes|commands|services|repositories|events\/(projections|handlers))\/.*customer/i, module: 'core', note: 'customers are the 3PL client too, so a standalone FinnWMS needs them' },
  { pattern: /^(routes|commands|services|repositories|events\/(projections|handlers))\/.*location/i, module: 'core', note: 'Location is conflated (TMS node + WMS facility root); Phase 2 moves the warehouse half onto Facility in wms' },
  { pattern: /^(routes|services|events\/handlers)\/.*webhook/i, module: 'core' },
  { pattern: /^events\/handlers\/AuditHandler\.ts$/, module: 'core' },

  // --- finance ---
  { pattern: /^(routes|commands|services|repositories|workers|events\/(projections|handlers))\/.*(invoic|charge|commission|financial|payment|billing|margin|freightAudit|creditCheck)/i, module: 'finance' },

  // --- inventory ---
  { pattern: /^(routes|commands|services|repositories)\/.*(inventory|productUom|unitConversion)/i, module: 'inventory' },

  // --- quality ---
  { pattern: /^(routes|commands|services|repositories|events\/(projections|handlers))\/.*(capa|sopChecklist|quality)/i, module: 'quality' },

  // --- wms ---
  { pattern: /^(routes|commands|services|repositories|workers|events\/(projections|handlers))\/.*(warehouse|facilit|wave|pick|pack|putaway|receiving|cycleCount|replenishment|wms|loadPlan|carton|staging)/i, module: 'wms', note: 'Facility is the wms root introduced in Phase 2a; Location stays core' },

  // --- tms: everything else in the domain directories ---
  { pattern: /^(routes|commands|services|repositories|workers|integrations|events\/(projections|handlers))\//, module: 'tms' },
];
