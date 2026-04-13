/**
 * Database File Storage Provider
 *
 * Stores file content directly in EdiTransactionLog.fileContent column.
 * This is the simplest approach - zero extra infrastructure.
 *
 * For higher volumes, swap this out for an S3 or filesystem adapter.
 */
import { PrismaClient } from '@prisma/client';
import { IFileStorageProvider } from './IFileStorageProvider.js';

export class DatabaseFileStorage implements IFileStorageProvider {
  constructor(private prisma: PrismaClient) {}

  async store(fileId: string, content: string): Promise<string> {
    await this.prisma.ediTransactionLog.update({
      where: { id: fileId },
      data: { fileContent: content }
    });
    return fileId;
  }

  async retrieve(storageKey: string): Promise<string> {
    const log = await this.prisma.ediTransactionLog.findUnique({
      where: { id: storageKey },
      select: { fileContent: true }
    });
    if (!log || !log.fileContent) {
      throw new Error(`EDI transaction log not found: ${storageKey}`);
    }
    return log.fileContent;
  }

  async delete(storageKey: string): Promise<void> {
    await this.prisma.ediTransactionLog.update({
      where: { id: storageKey },
      data: { fileContent: '' }
    });
  }

  async exists(storageKey: string): Promise<boolean> {
    const log = await this.prisma.ediTransactionLog.findUnique({
      where: { id: storageKey },
      select: { id: true }
    });
    return !!log;
  }
}
