import { PrismaClient } from '@prisma/client';
import type { IOpenIssueLookup } from '../../ports/openIssueLookup.js';

/** Core's answer: the open issue of a type raised against a source entity, if there is one (#359). */
export class OpenIssueLookup implements IOpenIssueLookup {
  constructor(private prisma: PrismaClient) {}

  async findOpenIssueId(orgId: string, issueType: string, sourceEntityType: string, sourceEntityId: string): Promise<string | null> {
    const open = await this.prisma.issue.findFirst({
      where: { orgId, issueType, sourceEntityType, sourceEntityId, status: { notIn: ['resolved', 'closed'] } },
      select: { id: true },
    });
    return open?.id ?? null;
  }
}
