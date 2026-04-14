/**
 * Seeds system roles into the database.
 * Idempotent: only creates roles that don't already exist,
 * and updates permissions on existing system roles.
 */

import { PrismaClient } from '@prisma/client';
import { SYSTEM_ROLES } from './permissions.js';

export async function seedSystemRoles(prisma: PrismaClient): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const roleDef of SYSTEM_ROLES) {
    const existing = await prisma.role.findUnique({
      where: { name: roleDef.name },
    });

    if (!existing) {
      await prisma.role.create({
        data: {
          name: roleDef.name,
          description: roleDef.description,
          permissions: roleDef.permissions,
          isSystem: roleDef.isSystem,
        },
      });
      created++;
    } else if (existing.isSystem) {
      // Update permissions on system roles to keep them in sync
      await prisma.role.update({
        where: { id: existing.id },
        data: {
          description: roleDef.description,
          permissions: roleDef.permissions,
        },
      });
      updated++;
    }
  }

  return { created, updated };
}
