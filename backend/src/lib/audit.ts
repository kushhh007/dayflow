import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface AuditEntry {
  actorId: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
}

export async function writeAudit(db: DbClient, entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await db.auditLog.createMany({
    data: entries.map((entry) => ({
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      field: entry.field,
      oldValue: entry.oldValue == null ? null : String(entry.oldValue),
      newValue: entry.newValue == null ? null : String(entry.newValue)
    }))
  });
}
