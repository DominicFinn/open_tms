import { PrismaClient, CustomFieldVersion, CustomFieldDefinition } from '@prisma/client';

const VALID_ENTITY_TYPES = ['shipment', 'order', 'carrier', 'customer', 'location'];
const VALID_FIELD_TYPES = ['text', 'decimal', 'integer', 'date', 'boolean', 'list', 'multi_list'];

export interface FieldDefinitionInput {
  fieldKey: string;
  label: string;
  description?: string;
  fieldType: string;
  required?: boolean;
  defaultValue?: string;
  config?: Record<string, any>;
  displayOrder?: number;
}

export interface ICustomFieldService {
  getActiveVersion(entityType: string): Promise<(CustomFieldVersion & { fields: CustomFieldDefinition[] }) | null>;
  getVersion(versionId: string): Promise<(CustomFieldVersion & { fields: CustomFieldDefinition[] }) | null>;
  listVersions(entityType: string): Promise<CustomFieldVersion[]>;
  createVersion(
    entityType: string,
    fields: FieldDefinitionInput[],
    description?: string,
    performedBy?: string,
  ): Promise<CustomFieldVersion & { fields: CustomFieldDefinition[] }>;
  validateValues(
    versionId: string,
    values: Record<string, any>,
  ): Promise<{ valid: boolean; errors: string[] }>;
}

export class CustomFieldService implements ICustomFieldService {
  constructor(private prisma: PrismaClient) {}

  async getActiveVersion(entityType: string) {
    return this.prisma.customFieldVersion.findFirst({
      where: { entityType, active: true },
      include: { fields: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async getVersion(versionId: string) {
    return this.prisma.customFieldVersion.findUnique({
      where: { id: versionId },
      include: { fields: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async listVersions(entityType: string) {
    return this.prisma.customFieldVersion.findMany({
      where: { entityType },
      orderBy: { version: 'desc' },
    });
  }

  async createVersion(
    entityType: string,
    fields: FieldDefinitionInput[],
    description?: string,
    performedBy?: string,
  ) {
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      throw new Error(`Invalid entityType: ${entityType}. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
    }

    // Validate field types
    for (const field of fields) {
      if (!VALID_FIELD_TYPES.includes(field.fieldType)) {
        throw new Error(`Invalid fieldType "${field.fieldType}" for field "${field.fieldKey}". Must be one of: ${VALID_FIELD_TYPES.join(', ')}`);
      }
      if (!field.fieldKey.match(/^[a-z][a-z0-9_]*$/)) {
        throw new Error(`Invalid fieldKey "${field.fieldKey}". Must be lowercase alphanumeric with underscores, starting with a letter.`);
      }
    }

    // Check for duplicate fieldKeys
    const keys = fields.map(f => f.fieldKey);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dupes.length > 0) {
      throw new Error(`Duplicate fieldKeys: ${[...new Set(dupes)].join(', ')}`);
    }

    // Get previous active version for audit
    const previousVersion = await this.prisma.customFieldVersion.findFirst({
      where: { entityType, active: true },
      include: { fields: true },
    });

    // Determine next version number
    const maxVersion = await this.prisma.customFieldVersion.aggregate({
      where: { entityType },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    // Create new version and deactivate old ones in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Deactivate all previous versions for this entity type
      await tx.customFieldVersion.updateMany({
        where: { entityType, active: true },
        data: { active: false },
      });

      // Create new version with fields
      const version = await tx.customFieldVersion.create({
        data: {
          entityType,
          version: nextVersion,
          description,
          createdBy: performedBy,
          active: true,
          fields: {
            create: fields.map((f, i) => ({
              fieldKey: f.fieldKey,
              label: f.label,
              description: f.description,
              fieldType: f.fieldType,
              required: f.required ?? false,
              defaultValue: f.defaultValue,
              config: f.config ?? undefined,
              displayOrder: f.displayOrder ?? i,
            })),
          },
        },
        include: { fields: { orderBy: { displayOrder: 'asc' } } },
      });

      // Create audit record
      const changes = this.diffVersions(previousVersion, version, fields);
      await tx.customFieldAudit.create({
        data: {
          entityType,
          action: previousVersion ? 'version_created' : 'version_created',
          versionId: version.id,
          previousVersionId: previousVersion?.id,
          changes,
          performedBy,
        },
      });

      return version;
    });

    return result;
  }

  async validateValues(
    versionId: string,
    values: Record<string, any>,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const version = await this.getVersion(versionId);
    if (!version) {
      return { valid: false, errors: ['Custom field version not found'] };
    }

    const errors: string[] = [];

    for (const field of version.fields) {
      const value = values[field.fieldKey];
      const config = (field.config as Record<string, any>) || {};

      // Required check
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field.label} is required`);
        continue;
      }

      // Skip validation for empty optional fields
      if (value === undefined || value === null || value === '') continue;

      switch (field.fieldType) {
        case 'text': {
          if (typeof value !== 'string') {
            errors.push(`${field.label} must be text`);
            break;
          }
          if (config.minLength && value.length < config.minLength) {
            errors.push(`${field.label} must be at least ${config.minLength} characters`);
          }
          if (config.maxLength && value.length > config.maxLength) {
            errors.push(`${field.label} must be at most ${config.maxLength} characters`);
          }
          if (config.pattern) {
            try {
              if (!new RegExp(config.pattern).test(value)) {
                errors.push(`${field.label} does not match required format`);
              }
            } catch {
              // Invalid regex in config — skip pattern check
            }
          }
          break;
        }
        case 'decimal': {
          const num = Number(value);
          if (isNaN(num)) {
            errors.push(`${field.label} must be a number`);
            break;
          }
          if (config.minValue !== undefined && num < config.minValue) {
            errors.push(`${field.label} must be at least ${config.minValue}`);
          }
          if (config.maxValue !== undefined && num > config.maxValue) {
            errors.push(`${field.label} must be at most ${config.maxValue}`);
          }
          break;
        }
        case 'integer': {
          const int = Number(value);
          if (!Number.isInteger(int)) {
            errors.push(`${field.label} must be a whole number`);
            break;
          }
          if (config.minValue !== undefined && int < config.minValue) {
            errors.push(`${field.label} must be at least ${config.minValue}`);
          }
          if (config.maxValue !== undefined && int > config.maxValue) {
            errors.push(`${field.label} must be at most ${config.maxValue}`);
          }
          break;
        }
        case 'date': {
          const d = new Date(value);
          if (isNaN(d.getTime())) {
            errors.push(`${field.label} must be a valid date`);
          }
          break;
        }
        case 'boolean': {
          if (typeof value !== 'boolean') {
            errors.push(`${field.label} must be true or false`);
          }
          break;
        }
        case 'list': {
          const options: string[] = config.options || [];
          if (!options.includes(value)) {
            errors.push(`${field.label} must be one of: ${options.join(', ')}`);
          }
          break;
        }
        case 'multi_list': {
          if (!Array.isArray(value)) {
            errors.push(`${field.label} must be an array`);
            break;
          }
          const opts: string[] = config.options || [];
          const invalid = value.filter((v: any) => !opts.includes(v));
          if (invalid.length > 0) {
            errors.push(`${field.label} contains invalid options: ${invalid.join(', ')}`);
          }
          break;
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private diffVersions(
    previous: (CustomFieldVersion & { fields: CustomFieldDefinition[] }) | null,
    _current: CustomFieldVersion,
    newFields: FieldDefinitionInput[],
  ): Record<string, any> {
    if (!previous) {
      return { action: 'initial_version', fields_added: newFields.map(f => f.fieldKey) };
    }

    const oldKeys = new Set(previous.fields.map(f => f.fieldKey));
    const newKeys = new Set(newFields.map(f => f.fieldKey));

    return {
      fields_added: newFields.filter(f => !oldKeys.has(f.fieldKey)).map(f => f.fieldKey),
      fields_removed: previous.fields.filter(f => !newKeys.has(f.fieldKey)).map(f => f.fieldKey),
      fields_modified: newFields
        .filter(f => oldKeys.has(f.fieldKey))
        .filter(f => {
          const old = previous.fields.find(o => o.fieldKey === f.fieldKey);
          return old && (old.label !== f.label || old.fieldType !== f.fieldType || old.required !== (f.required ?? false));
        })
        .map(f => f.fieldKey),
    };
  }
}
