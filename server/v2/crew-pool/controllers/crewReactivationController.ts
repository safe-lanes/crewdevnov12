import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db';
import { masterUsers } from '../../../../shared/schema';
import { crewMembersV2, crewReactivations } from '../../../../shared/v2/crew-pool/schema';
import { accessControlService } from '../../admin/services/accessControlService';
import { crewMembersService } from '../services/crewMembersService';

class ReactivationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function requireAccess(req: Request, edit: boolean) {
  const userId = Number(req.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new ReactivationError(401, 'Sign in before continuing.');
  }
  const [user] = await getDb().select().from(masterUsers)
    .where(eq(masterUsers.id, userId)).limit(1);
  if (!user) throw new ReactivationError(401, 'Signed-in user was not found.');
  const { permissions } = await accessControlService.getMyPermissions(undefined, user.role || undefined);
  const permission = permissions.find(p => p.menuName?.trim().toLowerCase() === 'terminated');
  if (!permission?.canview || (edit && !permission.canedit)) {
    throw new ReactivationError(403, 'You do not have permission for this action.');
  }
  return {
    userId: String(user.id),
    userUuid: user.userUuid || String(user.id),
    name: user.fullname?.trim() || user.displayName?.trim()
      || [user.firstname, user.lastname].filter(Boolean).join(' ').trim()
      || 'User ' + user.id,
  };
}

function respondError(res: Response, error: unknown) {
  if (error instanceof ReactivationError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error('Crew reactivation request failed:', error);
  return res.status(500).json({ error: 'Unable to complete the reactivation request.' });
}

export const crewReactivationController = {
  async list(req: Request, res: Response) {
    try {
      await requireAccess(req, false);
      return res.json({ data: await crewMembersService.getTerminated(true) });
    } catch (error) { return respondError(res, error); }
  },

  async reactivate(req: Request, res: Response) {
    try {
      const actor = await requireAccess(req, true);
      const parsed = z.object({
        isActive: z.boolean(),
        reason: z.string().trim().optional().default(''),
      }).strict().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Choose Active or Inactive and enter a valid optional reason.' });
      }
      const crewUuid = req.params.crewUuid;
      const result = await getDb().transaction(async (tx: any) => {
        const [crew] = await tx.select().from(crewMembersV2)
          .where(eq(crewMembersV2.crewUuid, crewUuid)).for('update');
        if (!crew || crew.isDeleted || crew.archivedAt) {
          throw new ReactivationError(404, 'Crew member was not found or is archived.');
        }
        if (!crew.status?.startsWith('Terminated')) {
          throw new ReactivationError(409, 'This crew is no longer terminated. Refresh the list.');
        }
        const now = new Date();
        const status = parsed.data.isActive ? 'On Leave' : 'Inactive';
        const [updated] = await tx.update(crewMembersV2).set({
          status,
          isActive: parsed.data.isActive,
          notForHire: false,
          updatedAt: now,
          updatedByUuid: actor.userUuid,
        }).where(eq(crewMembersV2.crewUuid, crewUuid)).returning();
        await tx.insert(crewReactivations).values({
          reactivationUuid: randomUUID(),
          crewUuid,
          reactivationDate: now,
          reactivatedByUserId: actor.userId,
          reactivatedByName: actor.name,
          targetStatus: status,
          reason: parsed.data.reason || null,
          createdByUuid: actor.userUuid,
          updatedByUuid: actor.userUuid,
        });
        return updated;
      });
      return res.status(201).json({ crew: result });
    } catch (error) { return respondError(res, error); }
  },
};
