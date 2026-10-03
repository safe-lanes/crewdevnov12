import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { appCrewErpCommands, appCrewErpCommandAudits, appCrewPendingChanges } from "../../../shared/v2/crew-app/schema";
import { canonicalHash } from "../crew-app/erp-commands/canonical";
import { commandPolicy } from "../crew-app/erp-commands/commandPolicy";
import { getCommandHandler, validateApprovedPayload } from "../crew-app/erp-commands/handlerRegistry";

const reviewable = ["manual_reconciliation_required","reconciliation_required","dead_letter"];
const reasonPattern = /^[\p{L}\p{N} .,;:_()\/-]{10,500}$/u;
function validateReason(reason: string) { if (!reasonPattern.test(reason)) throw Object.assign(new Error("A safe reason of 10-500 characters is required"),{status:400}); }

async function commandAndPending(commandUuid: string) {
  const [row] = await getDb().select({ command: appCrewErpCommands, pending: appCrewPendingChanges })
    .from(appCrewErpCommands).innerJoin(appCrewPendingChanges,eq(appCrewPendingChanges.pendingUuid,appCrewErpCommands.pendingUuid))
    .where(eq(appCrewErpCommands.commandUuid,commandUuid)).limit(1);
  if(!row||!reviewable.includes(row.command.status)) throw Object.assign(new Error("Reviewable command not found"),{status:404});
  return row;
}
async function auditedTransition(command:any,to:string,operatorUuid:string,decision:string,reason:string,correlationId:string,values:any={}) {
  validateReason(reason);
  return getDb().transaction(async(tx:any)=>{
    const [updated]=await tx.update(appCrewErpCommands).set({...values,status:to,updatedAt:new Date(),leaseOwner:null,leaseExpiresAt:null})
      .where(and(eq(appCrewErpCommands.commandUuid,command.commandUuid),eq(appCrewErpCommands.status,command.status))).returning();
    if(!updated) throw Object.assign(new Error("Command changed concurrently"),{status:409});
    await tx.insert(appCrewErpCommandAudits).values({auditUuid:randomUUID(),commandUuid:command.commandUuid,operatorUuid,previousStatus:command.status,newStatus:to,decision,reason,correlationId});
    return updated;
  });
}

export const erpCommandOperationsService = {
  async list() { return getDb().select({commandUuid:appCrewErpCommands.commandUuid,pendingUuid:appCrewErpCommands.pendingUuid,operationUuid:appCrewErpCommands.operationUuid,commandType:appCrewErpCommands.commandType,status:appCrewErpCommands.status,attemptCount:appCrewErpCommands.attemptCount,errorCode:appCrewErpCommands.errorCode,createdAt:appCrewErpCommands.createdAt,updatedAt:appCrewErpCommands.updatedAt}).from(appCrewErpCommands).where(inArray(appCrewErpCommands.status,reviewable)).orderBy(desc(appCrewErpCommands.updatedAt)).limit(200); },
  async readBack(commandUuid:string) { const {command,pending}=await commandAndPending(commandUuid);const handler=getCommandHandler(command.commandType);if(!handler)return {outcome:"unsupported",status:command.status,reasonCode:command.errorCode};const payload=validateApprovedPayload(command.commandType,JSON.parse(pending.payload||"{}"));const outcome=await handler.reconcile(pending,payload);return {outcome,status:command.status,reasonCode:command.errorCode,authoritativeResultHash:outcome==="matches"?canonicalHash(await handler.loadAuthoritativeState(pending)):null}; },
  async resolve(commandUuid:string,operatorUuid:string,reason:string,correlationId:string) { const {command,pending}=await commandAndPending(commandUuid);const handler=getCommandHandler(command.commandType);if(!handler)throw Object.assign(new Error("Unsafe command cannot be resolved automatically"),{status:409});const payload=validateApprovedPayload(command.commandType,JSON.parse(pending.payload||"{}"));if((await handler.reconcile(pending,payload))!=="matches")throw Object.assign(new Error("Authoritative state does not prove completion"),{status:409});return auditedTransition(command,"applied",operatorUuid,"AUTHORITATIVE_MATCH_RESOLUTION",reason,correlationId,{reconciledAt:new Date(),authoritativeRecordUuid:pending.targetUuid??pending.crewUuid,authoritativeResultHash:canonicalHash(await handler.loadAuthoritativeState(pending)),appliedAt:new Date()}); },
  async requeue(commandUuid:string,operatorUuid:string,reason:string,correlationId:string) { const {command,pending}=await commandAndPending(commandUuid);if(command.status!=="reconciliation_required"||!commandPolicy(command.commandType).automated)throw Object.assign(new Error("Command is not eligible for safe requeue"),{status:409});const handler=getCommandHandler(command.commandType)!;const payload=validateApprovedPayload(command.commandType,JSON.parse(pending.payload||"{}"));if((await handler.reconcile(pending,payload))!=="missing")throw Object.assign(new Error("Authoritative absence is not proven"),{status:409});return auditedTransition(command,"retryable",operatorUuid,"SAFE_REQUEUE_AFTER_ABSENCE",reason,correlationId,{nextAttemptAt:new Date(),errorCode:"MANUAL_SAFE_REQUEUE"}); },
  async close(commandUuid:string,operatorUuid:string,reason:string,correlationId:string) { const {command}=await commandAndPending(commandUuid);return auditedTransition(command,"dead_letter",operatorUuid,"PERMANENTLY_CLOSED",reason,correlationId,{errorCode:"OPERATOR_CLOSED"}); },
};
