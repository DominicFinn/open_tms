import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface ModelField {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
  readonly list: boolean;
}

export interface Model {
  readonly name: string;
  readonly fields: ReadonlyMap<string, ModelField>;
}

const MODEL_BLOCK = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

export function parseModels(source: string): Model[] {
  const models: Model[] = [];
  for (const match of source.matchAll(MODEL_BLOCK)) {
    const fields = new Map<string, ModelField>();
    for (const raw of match[2].split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
      const [name, type] = line.split(/\s+/);
      if (!name || !type) continue;
      fields.set(name, {
        name,
        type: type.replace(/[?[\]]/g, ''),
        optional: type.endsWith('?'),
        list: type.endsWith('[]'),
      });
    }
    models.push({ name: match[1], fields });
  }
  return models;
}

export async function loadModels(schemaDir: string): Promise<Model[]> {
  const files = (await readdir(schemaDir)).filter((file) => file.endsWith('.prisma')).sort();
  const sources = await Promise.all(files.map((file) => readFile(path.join(schemaDir, file), 'utf8')));
  return sources.flatMap(parseModels);
}

/** The model's own org column, if it has one. `organizationId` is the older spelling. */
export function orgColumn(model: Model): ModelField | undefined {
  return model.fields.get('orgId') ?? model.fields.get('organizationId');
}
