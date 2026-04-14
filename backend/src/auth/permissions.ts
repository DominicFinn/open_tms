/**
 * Permission constants for the Open TMS RBAC system.
 *
 * Format: "resource:action"
 * Wildcards: "*" (all permissions), "resource:*" (all actions on resource)
 *
 * These constants are used in:
 * - Role definitions (permissions JSON array)
 * - requirePermission() middleware on routes
 * - Frontend role-based UI rendering
 */

// ── Core Resource Permissions ──────────────────────────────────────────

export const PERMISSIONS = {
  // Shipments
  SHIPMENTS_READ: 'shipments:read',
  SHIPMENTS_WRITE: 'shipments:write',
  SHIPMENTS_DELETE: 'shipments:delete',

  // Orders
  ORDERS_READ: 'orders:read',
  ORDERS_WRITE: 'orders:write',
  ORDERS_DELETE: 'orders:delete',

  // Carriers
  CARRIERS_READ: 'carriers:read',
  CARRIERS_WRITE: 'carriers:write',

  // Customers
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',

  // Locations
  LOCATIONS_READ: 'locations:read',
  LOCATIONS_WRITE: 'locations:write',

  // Lanes
  LANES_READ: 'lanes:read',
  LANES_WRITE: 'lanes:write',

  // Devices / IoT
  DEVICES_READ: 'devices:read',
  DEVICES_WRITE: 'devices:write',

  // Issues
  ISSUES_READ: 'issues:read',
  ISSUES_WRITE: 'issues:write',

  // Documents
  DOCUMENTS_READ: 'documents:read',
  DOCUMENTS_GENERATE: 'documents:generate',

  // Financial
  QUOTES_READ: 'quotes:read',
  QUOTES_WRITE: 'quotes:write',
  QUOTES_ACCEPT: 'quotes:accept',
  CHARGES_READ: 'charges:read',
  CHARGES_WRITE: 'charges:write',
  INVOICES_READ: 'invoices:read',
  INVOICES_WRITE: 'invoices:write',
  CARRIER_INVOICES_READ: 'carrier_invoices:read',
  CARRIER_INVOICES_WRITE: 'carrier_invoices:write',
  FINANCIAL_REPORTS: 'financial_reports:read',

  // Tendering
  TENDERS_READ: 'tenders:read',
  TENDERS_WRITE: 'tenders:write',

  // Brokerage
  LOADBOARD_READ: 'loadboard:read',
  LOADBOARD_ASSIGN: 'loadboard:assign',
  MARGIN_VIEW: 'margin:view',
  CREDIT_CHECK: 'credit:check',
  RATE_CONFIRMATION: 'rate_confirmation:generate',

  // EDI / Integrations
  EDI_READ: 'edi:read',
  EDI_WRITE: 'edi:write',
  INTEGRATIONS_READ: 'integrations:read',
  INTEGRATIONS_WRITE: 'integrations:write',

  // AI / Automation
  AGENT_DECISIONS_READ: 'agent_decisions:read',
  AGENT_DECISIONS_WRITE: 'agent_decisions:write',
  AUTOMATION_RULES_READ: 'automation_rules:read',
  AUTOMATION_RULES_WRITE: 'automation_rules:write',

  // Admin
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',

  // Wildcard
  ALL: '*',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ── System Role Definitions ────────────────────────────────────────────

export interface RoleDefinition {
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

/**
 * System role definitions. Seeded on first startup.
 * These roles cover the standard TMS personas across all organization types.
 */
export const SYSTEM_ROLES: RoleDefinition[] = [
  {
    name: 'admin',
    description: 'Full system access. Can manage users, roles, settings, and all operational data.',
    permissions: ['*'],
    isSystem: true,
  },
  {
    name: 'dispatcher',
    description: 'Operational user. Can manage shipments, orders, carriers, and tendering. Cannot change settings or manage users.',
    permissions: [
      'shipments:*', 'orders:*', 'carriers:read', 'customers:read',
      'locations:read', 'lanes:read', 'devices:read',
      'issues:*', 'documents:*', 'tenders:*',
      'quotes:read', 'charges:read', 'invoices:read',
      'loadboard:*', 'margin:view', 'credit:check', 'rate_confirmation:generate',
    ],
    isSystem: true,
  },
  {
    name: 'broker_admin',
    description: 'Brokerage administrator. Full access to brokerage operations, financial data, carrier management, and settings.',
    permissions: [
      'shipments:*', 'orders:*', 'carriers:*', 'customers:*',
      'locations:*', 'lanes:*', 'devices:read',
      'issues:*', 'documents:*', 'tenders:*',
      'quotes:*', 'charges:*', 'invoices:*', 'carrier_invoices:*',
      'financial_reports:read',
      'loadboard:*', 'margin:view', 'credit:check', 'rate_confirmation:generate',
      'edi:*', 'integrations:*',
      'agent_decisions:*', 'automation_rules:*',
      'settings:*', 'users:*', 'roles:read',
    ],
    isSystem: true,
  },
  {
    name: 'broker_agent',
    description: 'Brokerage agent/sales rep. Can quote customers, manage loads on the load board, assign carriers, and view margins. Cannot manage users or settings.',
    permissions: [
      'shipments:read', 'shipments:write', 'orders:read', 'orders:write',
      'carriers:read', 'customers:read',
      'locations:read', 'lanes:read',
      'issues:read', 'issues:write',
      'documents:read', 'documents:generate',
      'tenders:read', 'tenders:write',
      'quotes:*', 'charges:read',
      'invoices:read',
      'loadboard:*', 'margin:view', 'credit:check', 'rate_confirmation:generate',
    ],
    isSystem: true,
  },
  {
    name: 'warehouse',
    description: 'Warehouse operator. Can view and manage shipments at their assigned location.',
    permissions: [
      'shipments:read', 'shipments:write',
      'orders:read',
      'devices:read', 'devices:write',
      'documents:read',
    ],
    isSystem: true,
  },
  {
    name: 'readonly',
    description: 'Read-only access. Can view all operational data but cannot make changes.',
    permissions: [
      'shipments:read', 'orders:read', 'carriers:read', 'customers:read',
      'locations:read', 'lanes:read', 'devices:read',
      'issues:read', 'documents:read',
      'quotes:read', 'charges:read', 'invoices:read', 'carrier_invoices:read',
      'financial_reports:read',
      'loadboard:read', 'margin:view',
      'tenders:read',
      'agent_decisions:read', 'automation_rules:read',
    ],
    isSystem: true,
  },
  {
    name: 'finance',
    description: 'Financial operations. Full access to quotes, invoices, charges, carrier invoices, and financial reports.',
    permissions: [
      'shipments:read', 'orders:read', 'carriers:read', 'customers:read',
      'quotes:*', 'charges:*', 'invoices:*', 'carrier_invoices:*',
      'financial_reports:read',
      'margin:view', 'credit:check',
      'documents:read', 'documents:generate',
    ],
    isSystem: true,
  },
];
