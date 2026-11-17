import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { authorize, historyFor, InternalError, tableFor, type Resource } from "./access";
import { present, readEntry } from "./read";

const bodyText = z.string().trim().min(1);
const revision = z.number().int().positive();
const commentCreate = z.object({ body:bodyText }).strict();
const commentEdit = z.object({ body:bodyText,revision }).strict();
const removeInput = z.object({ reason:bodyText,revision }).strict();
export function parseInput<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new InternalError(400,"Please complete the required fields and try again. Identity and history fields are set by the server.");
  return parsed.data;
}
export async function recordEvent(tx: any,resource: Resource,row: any,event: string,actor: any) {
  await tx.execute(sql`INSERT INTO ${historyFor(resource)}
    (event_uuid,entry_uuid,crew_uuid,revision,event,actor,snapshot)
    VALUES(${randomUUID()},${row.entry_uuid},${row.crew_uuid},${row.revision},${event},
      ${JSON.stringify(actor)}::jsonb,${JSON.stringify(row)}::jsonb)`);
}
export async function createComment(req: Request) {
  const {db,actor}=await authorize(req,"comments","cancreate");
  const input = parseInput(commentCreate,req.body);
  return db.transaction(async(tx: any)=>{
    const rows = (await tx.execute(sql`INSERT INTO crew_internal_comments(entry_uuid,crew_uuid,body,author)
      VALUES(${randomUUID()},${req.params.crewUuid},${input.body},${JSON.stringify(actor)}::jsonb) RETURNING *`)).rows;
    await recordEvent(tx,"comments",rows[0],"created",actor);
    return rows[0];
  });
}
export async function editComment(req: Request) {
  const {db,actor}=await authorize(req,"comments","canedit");
  const input=parseInput(commentEdit,req.body);
  return db.transaction(async(tx: any)=>{
    const old=await readEntry(tx,"comments",req.params.crewUuid,req.params.entryUuid,true);
    ensureMutable(old,input.revision);
    if(old.author.uuid!==actor.uuid) throw new InternalError(403,"Only the person who wrote this comment may edit it.");
    const row=(await tx.execute(sql`UPDATE crew_internal_comments SET body=${input.body},edited=true,revision=revision+1
      WHERE entry_uuid=${old.entry_uuid} AND crew_uuid=${req.params.crewUuid} AND revision=${input.revision} RETURNING *`)).rows[0];
    await recordEvent(tx,"comments",row,"edited",actor);
    return row;
  });
}
export function ensureMutable(row: any,expected: number) {
  if(row.removed_at) throw new InternalError(409,"This entry has been removed and cannot be changed.");
  if(row.revision!==expected) throw new InternalError(409,"Someone changed this entry. Refresh it before saving your changes.");
}
export async function removeEntry(req: Request,resource: Resource) {
  const {db,actor,permissions}=await authorize(req,resource,"candelete");
  const input=parseInput(removeInput,req.body);
  return db.transaction(async(tx: any)=>{
    const old=await readEntry(tx,resource,req.params.crewUuid,req.params.entryUuid,true);
    ensureMutable(old,input.revision);
    const row=(await tx.execute(sql`UPDATE ${tableFor(resource)}
      SET removed_by=${JSON.stringify(actor)}::jsonb,removed_at=clock_timestamp(),removal_reason=${input.reason},revision=revision+1
      WHERE entry_uuid=${old.entry_uuid} AND crew_uuid=${req.params.crewUuid} AND revision=${input.revision} RETURNING *`)).rows[0];
    await recordEvent(tx,resource,row,"removed",actor);
    return present(row,permissions.candelete);
  });
}
