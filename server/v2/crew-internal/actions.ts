import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { authorize, eligibleAssignees, InternalError } from "./access";
import { readEntry } from "./read";
import { ensureMutable, parseInput, recordEvent } from "./write";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
  const parsed=new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
});
const fields={body:z.string().trim().min(1),assigneeUuid:z.string().min(1),dueDate:date};
const createSchema=z.object(fields).strict();
const editSchema=z.object({...fields,revision:z.number().int().positive()}).strict();
const transitionSchema=z.object({revision:z.number().int().positive(),closingNote:z.string().trim().optional()}).strict();
async function assignee(tx: any,uuid: string) {
  const users=await eligibleAssignees(tx);
  const selected=users.find((u:any)=>u.uuid===uuid);
  if(!selected) throw new InternalError(400,"Choose an office user who has permission to view Internal Actions.");
  return selected;
}
export async function createAction(req: Request) {
  const {db,actor}=await authorize(req,"actions","cancreate");
  const input=parseInput(createSchema,req.body);
  return db.transaction(async(tx: any)=>{
    const assigned=await assignee(tx,input.assigneeUuid);
    const row=(await tx.execute(sql`INSERT INTO crew_internal_actions
      (entry_uuid,crew_uuid,body,author,assignee,due_date)
      VALUES(${randomUUID()},${req.params.crewUuid},${input.body},${JSON.stringify(actor)}::jsonb,
      ${JSON.stringify(assigned)}::jsonb,${input.dueDate}::date) RETURNING *,due_date::text AS due_date`)).rows[0];
    await recordEvent(tx,"actions",row,"created",actor);
    return row;
  });
}
export async function editAction(req: Request) {
  const {db,actor}=await authorize(req,"actions","canedit");
  const input=parseInput(editSchema,req.body);
  return db.transaction(async(tx: any)=>{
    const old=await readEntry(tx,"actions",req.params.crewUuid,req.params.entryUuid,true);
    ensureMutable(old,input.revision);
    const assigned=input.assigneeUuid===old.assignee.uuid
      ? (await assignee(tx,input.assigneeUuid),old.assignee) : await assignee(tx,input.assigneeUuid);
    const row=(await tx.execute(sql`UPDATE crew_internal_actions SET
      body=${input.body},assignee=${JSON.stringify(assigned)}::jsonb,due_date=${input.dueDate}::date,
      revision=revision+1,edited=true WHERE entry_uuid=${old.entry_uuid}
      AND crew_uuid=${req.params.crewUuid} AND revision=${input.revision} RETURNING *,due_date::text AS due_date`)).rows[0];
    await recordEvent(tx,"actions",row,old.assignee.uuid===assigned.uuid?"edited":"reassigned",actor);
    return row;
  });
}
export async function transitionAction(req: Request,complete: boolean) {
  // View + personal relationship, deliberately NOT Edit.
  const {db,actor}=await authorize(req,"actions");
  const input=parseInput(transitionSchema,req.body);
  return db.transaction(async(tx: any)=>{
    const old=await readEntry(tx,"actions",req.params.crewUuid,req.params.entryUuid,true);
    ensureMutable(old,input.revision);
    if(old.author.uuid!==actor.uuid && old.assignee.uuid!==actor.uuid)
      throw new InternalError(403,"Only the person who raised this action or its assignee may complete or reopen it.");
    if(old.status===(complete?"Completed":"Open"))
      throw new InternalError(409,"This action's status has changed. Refresh it before continuing.");
    const row=(await tx.execute(sql`UPDATE crew_internal_actions SET status=${complete?"Completed":"Open"},
      completed_by=${complete?JSON.stringify(actor):null}::jsonb,
      completed_at=${complete?sql`clock_timestamp()`:sql`NULL`},closing_note=${input.closingNote||null},
      revision=revision+1 WHERE entry_uuid=${old.entry_uuid} AND crew_uuid=${req.params.crewUuid}
      AND revision=${input.revision} RETURNING *,due_date::text AS due_date`)).rows[0];
    await recordEvent(tx,"actions",row,complete?"completed":"reopened",actor);
    return row;
  });
}
