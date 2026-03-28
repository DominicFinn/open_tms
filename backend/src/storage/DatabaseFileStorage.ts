/**
 * Database File Storage Provider
 *
 * Stores file content directly in the EdiFile.fileContent column.
 * This is the simplest approach — zero extra infrastructure.
 * The storage key is just the EdiFile ID.
 *
 * For higher volumes, swap this out for an S3 or filesystem adapter.
 */
import { PrismaClient } from '@prisma/client';
import { IFileStorageProvider } from './IFileStorageProvider.js';

export class DatabaseFileStorage implements IFileStorageProvider {
  constructor(private prisma: PrismaClient) {}

  async store(fileId: string, content: string): Promise<string> {
    // Content is written directly when the EdiFile record is created,
    // so this is a no-op update to confirm storage.
    await this.prisma.ediFile.update({
      where: { id: fileId },
      data: { fileContent: content }
    });
    return fileId; // storage key = record ID
  }

  async retrieve(storageKey: string): Promise<string> {
    const file = await this.prisma.ediFile.findUnique({
      where: { id: storageKey },
      select: { fileContent: true }
    });
    if (!file) {
      throw new Error(`EDI file not found: ${storageKey}`);
    }
    return file.fileContent;
  }

  async delete(storageKey: string): Promise<void> {
    // For database storage, clearing content but keeping metadata
    await this.prisma.ediFile.update({
      where: { id: storageKey },
      data: { fileContent: '' }
    });
  }

  async exists(storageKey: string): Promise<boolean> {
    const file = await this.prisma.ediFile.findUnique({
      where: { id: storageKey },
      select: { id: true }
    });
    return !!file;
  }
}
