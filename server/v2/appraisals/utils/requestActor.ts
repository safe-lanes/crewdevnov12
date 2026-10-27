import type { Request } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { masterUsers } from "../../../../shared/schema";

export interface AppraisalActor {
  /** Saved in submitted_by and stage1/2/3_submitted_by. */
  name: string;
  /** master_users.user_uuid, saved in created_by_uuid / updated_by_uuid. */
  userUuid: string;
}

// The user who sends an appraisal write (APD-31). It comes from the login
// (the token's user id, looked up in master_users), never from the request
// body, which the browser controls. Null when the user cannot be identified.
export async function resolveAppraisalActor(req: Request): Promise<AppraisalActor | null> {
  const id = Number(req.user?.id);
  if (!Number.isInteger(id)) return null;

  const [user] = await getDb()
    .select({
      userUuid: masterUsers.userUuid,
      fullname: masterUsers.fullname,
      displayName: masterUsers.displayName,
      firstname: masterUsers.firstname,
      lastname: masterUsers.lastname,
    })
    .from(masterUsers)
    .where(eq(masterUsers.id, id))
    .limit(1);
  if (!user?.userUuid) return null;

  // The same name rule as company forms' section submit.
  const name = (user.fullname ?? user.displayName ??
    `${user.firstname ?? ""} ${user.lastname ?? ""}`).trim();
  if (!name) return null;

  return { name, userUuid: user.userUuid };
}
