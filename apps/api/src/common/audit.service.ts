import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from './prisma.service.js';

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

const json = (value: unknown) => (value === undefined ? undefined : (value as Prisma.InputJsonValue));

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** ส่ง tx มาด้วยเมื่อต้องบันทึกพร้อมการเปลี่ยนแปลง (สำเร็จหรือล้มเหลวพร้อมกัน) */
  async log(entry: AuditEntry, tx?: Tx) {
    const db = tx ?? this.prisma;
    await db.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: json(entry.before),
        after: json(entry.after),
        ip: entry.ip ?? '',
      },
    });
  }
}
