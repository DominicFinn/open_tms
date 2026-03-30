/**
 * Database Binary Storage Provider (Fallback)
 *
 * Stores binary content in a dedicated BinaryStore table.
 * Used when S3 is not configured — works out of the box with just PostgreSQL.
 *
 * Not recommended for production with large files; use S3 instead.
 */
import { PrismaClient } from '@prisma/client';
import { IBinaryStorageProvider } from './IBinaryStorageProvider.js';

export class DatabaseBinaryStorage implements IBinaryStorageProvider {
  constructor(private prisma: PrismaClient) {}

  async store(key: string, content: Buffer): Promise<string> {
    await this.prisma.binaryStore.upsert({
      where: { key },
      create: { key, content, size: content.length },
      update: { content, size: content.length },
    });
    return key;
  }

  async retrieve(key: string): Promise<Buffer> {
    const record = await this.prisma.binaryStore.findUnique({
      where: { key },
      select: { content: true },
    });
    if (!record) {
      throw new Error(`Binary content not found: ${key}`);
    }
    return record.content;
  }

  async delete(key: string): Promise<void> {
    await this.prisma.binaryStore.deleteMany({ where: { key } });
  }

  async exists(key: string): Promise<boolean> {
    const record = await this.prisma.binaryStore.findUnique({
      where: { key },
      select: { key: true },
    });
    return !!record;
  }
}
