import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { ICustomFieldService } from '../services/CustomFieldService.js';

const VALID_ENTITY_TYPES = ['shipment', 'order', 'carrier', 'customer', 'location'];
const VALID_FIELD_TYPES = ['text', 'decimal', 'integer', 'date', 'boolean', 'list', 'multi_list'];

const fieldDefinitionSchema = z.object({
  fieldKey: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Must be lowercase alphanumeric with underscores'),
  label: z.string().min(1),
  description: z.string().optional(),
  fieldType: z.enum(['text', 'decimal', 'integer', 'date', 'boolean', 'list', 'multi_list']),
  required: z.boolean().optional(),
  defaultValue: z.string().optional(),
  config: z.record(z.any()).optional(),
  displayOrder: z.number().int().optional(),
});

const createVersionSchema = z.object({
  entityType: z.enum(['shipment', 'order', 'carrier', 'customer', 'location']),
  description: z.string().optional(),
  fields: z.array(fieldDefinitionSchema).min(1),
});

const validateValuesSchema = z.object({
  versionId: z.string().uuid(),
  values: z.record(z.any()),
});

const fieldDefObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    fieldKey: { type: 'string' },
    label: { type: 'string' },
    description: { type: 'string', nullable: true },
    fieldType: { type: 'string', enum: VALID_FIELD_TYPES },
    required: { type: 'boolean' },
    defaultValue: { type: 'string', nullable: true },
    config: { type: 'object', nullable: true },
    displayOrder: { type: 'integer' },
  },
} as const;

const versionObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    entityType: { type: 'string', enum: VALID_ENTITY_TYPES },
    version: { type: 'integer' },
    description: { type: 'string', nullable: true },
    active: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    fields: { type: 'array', items: fieldDefObject },
  },
} as const;

const errorResponse = {
  type: 'object',
  properties: {
    data: { type: 'object', nullable: true },
    error: { type: 'string' },
  },
} as const;

export async function customFieldRoutes(server: FastifyInstance) {
  const customFieldService = container.resolve<ICustomFieldService>(TOKENS.ICustomFieldService);

  // GET /api/v1/custom-fields/:entityType — get active version with field definitions
  server.get('/api/v1/custom-fields/:entityType', {
    schema: {
      description: 'Get the active custom field version for an entity type. Returns the field definitions that should be rendered on create/edit forms.',
      tags: ['Custom Fields'],
      params: {
        type: 'object',
        properties: {
          entityType: { type: 'string', enum: VALID_ENTITY_TYPES },
        },
      },
      response: {
        200: { type: 'object', properties: { data: { ...versionObject, nullable: true }, error: { type: 'object', nullable: true } } },
      },
    },
  }, async (req) => {
    const { entityType } = req.params as { entityType: string };
    const version = await customFieldService.getActiveVersion(entityType);
    return { data: version, error: null };
  });

  // GET /api/v1/custom-fields/:entityType/versions — list all versions for audit/history
  server.get('/api/v1/custom-fields/:entityType/versions', {
    schema: {
      description: 'List all custom field versions for an entity type, ordered newest first. Useful for audit trail and viewing historical field definitions.',
      tags: ['Custom Fields'],
      params: {
        type: 'object',
        properties: {
          entityType: { type: 'string', enum: VALID_ENTITY_TYPES },
        },
      },
      response: {
        200: { type: 'object', properties: { data: { type: 'array', items: versionObject }, error: { type: 'object', nullable: true } } },
      },
    },
  }, async (req) => {
    const { entityType } = req.params as { entityType: string };
    const versions = await customFieldService.listVersions(entityType);
    return { data: versions, error: null };
  });

  // GET /api/v1/custom-fields/versions/:id — get a specific version (for viewing old records)
  server.get('/api/v1/custom-fields/versions/:id', {
    schema: {
      description: 'Get a specific custom field version by ID, including its field definitions. Used to render custom fields for records saved against an older version.',
      tags: ['Custom Fields'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { type: 'object', properties: { data: { ...versionObject, nullable: true }, error: { type: 'object', nullable: true } } },
        404: errorResponse,
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = await customFieldService.getVersion(id);
    if (!version) {
      reply.code(404);
      return { data: null, error: 'Version not found' };
    }
    return { data: version, error: null };
  });

  // POST /api/v1/custom-fields/versions — create a new version (publishes immediately)
  server.post('/api/v1/custom-fields/versions', {
    schema: {
      description: 'Create a new custom field version for an entity type. The previous active version is automatically deactivated. Existing entity records remain linked to their original version. All changes are recorded in the audit trail.',
      tags: ['Custom Fields'],
      body: {
        type: 'object',
        required: ['entityType', 'fields'],
        properties: {
          entityType: { type: 'string', enum: VALID_ENTITY_TYPES, description: 'Entity type to define fields for' },
          description: { type: 'string', description: 'Description of changes (e.g., "Added invoice number field")' },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              required: ['fieldKey', 'label', 'fieldType'],
              properties: {
                fieldKey: { type: 'string', description: 'Machine-readable key (lowercase, underscores). Stable across versions.' },
                label: { type: 'string', description: 'Display label' },
                description: { type: 'string', description: 'Help text' },
                fieldType: { type: 'string', enum: VALID_FIELD_TYPES },
                required: { type: 'boolean', default: false },
                defaultValue: { type: 'string', description: 'Default value (as string)' },
                config: {
                  type: 'object',
                  description: 'Type-specific config: text {minLength, maxLength, formatMask, pattern}, decimal/integer {minValue, maxValue, decimalPlaces}, list/multi_list {options: ["a","b"]}, date {minDate, maxDate}',
                },
                displayOrder: { type: 'integer' },
              },
            },
          },
        },
      },
      response: {
        201: { type: 'object', properties: { data: versionObject, error: { type: 'object', nullable: true } } },
        400: errorResponse,
      },
    },
  }, async (req, reply) => {
    const parsed = createVersionSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    try {
      const version = await customFieldService.createVersion(
        parsed.data.entityType,
        parsed.data.fields,
        parsed.data.description,
      );
      reply.code(201);
      return { data: version, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // POST /api/v1/custom-fields/validate — validate values against a version
  server.post('/api/v1/custom-fields/validate', {
    schema: {
      description: 'Validate custom field values against a specific version. Returns validation errors if any fields fail their constraints.',
      tags: ['Custom Fields'],
      body: {
        type: 'object',
        required: ['versionId', 'values'],
        properties: {
          versionId: { type: 'string', format: 'uuid' },
          values: { type: 'object', description: 'Custom field values keyed by fieldKey' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                valid: { type: 'boolean' },
                errors: { type: 'array', items: { type: 'string' } },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (req, reply) => {
    const parsed = validateValuesSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    const result = await customFieldService.validateValues(parsed.data.versionId, parsed.data.values);
    return { data: result, error: null };
  });

  // GET /api/v1/custom-fields/audit?entityType=X — get audit history
  server.get('/api/v1/custom-fields/audit', {
    schema: {
      description: 'Get the audit trail of custom field changes. Optionally filter by entity type.',
      tags: ['Custom Fields'],
      querystring: {
        type: 'object',
        properties: {
          entityType: { type: 'string', enum: VALID_ENTITY_TYPES },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  entityType: { type: 'string' },
                  action: { type: 'string' },
                  versionId: { type: 'string', nullable: true },
                  previousVersionId: { type: 'string', nullable: true },
                  changes: { type: 'object', nullable: true },
                  performedBy: { type: 'string', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (req) => {
    const { entityType } = req.query as { entityType?: string };
    const where = entityType ? { entityType } : {};
    const audits = await container.resolve<any>(TOKENS.PrismaClient).customFieldAudit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { data: audits, error: null };
  });
}
