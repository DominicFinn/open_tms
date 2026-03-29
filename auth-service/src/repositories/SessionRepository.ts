import { PrismaClient, Session } from '@prisma/client';
import { createHash } from 'crypto';

export interface ISessionRepository {
  create(userId: string, token: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<Session>;
  findByToken(token: string): Promise<Session | null>;
  deleteByToken(token: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
  deleteExpired(): Promise<number>;
  listForUser(userId: string): Promise<Session[]>;
}

export class SessionRepository implements ISessionRepository {
  constructor(private prisma: PrismaClient) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(userId: string, token: string, expiresAt: Date, userAgent?: string, ipAddress?: string) {
    return this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt,
        userAgent,
        ipAddress,
      },
    });
  }

  async findByToken(token: string) {
    return this.prisma.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
  }

  async deleteByToken(token: string) {
    await this.prisma.session.delete({
      where: { tokenHash: this.hashToken(token) },
    }).catch(() => {}); // Ignore if already deleted
  }

  async deleteAllForUser(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
  }

  async deleteExpired() {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  async listForUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
