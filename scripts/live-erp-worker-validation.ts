import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { tenantConnectionManager } from "../server/utils/tenantConnectionManager";
import { pendingChangesRepository } from "../server/v2/crew-app/crew-information/pendingChangesRepository";
import { erpCommandRepository } from "../server/v2/crew-app/erp-commands/commandRepository";
import { canonicalHash } from "../server/v2/crew-app/erp-commands/canonical";
import { processLeasedCommand, processNextForCurrentTenant } from "../server/v2/crew-app/erp-commands/worker";

const masterUrl = process.env.MASTER_DATABASE_URL;
if (!masterUrl) throw new Error("MASTER_DATABASE_URL is required");
if (process.env.ALLOW_ERP_CONCURRENCY_TEST !== "true") throw new Error("ALLOW_ERP_CONCURRENCY_TEST=true is required");
if (process.env.NODE_ENV === "production") throw new Error("Live ERP validation refuses NODE_ENV=production");
if (process.env.CI === "true" && !process.env.CI_TEST_DATABASE_PREFIX) throw new Error("CI_TEST_DATABASE_PREFIX is required in CI");

const RUN = `codex-erp-live-${randomUUID()}`;
const safe = (value: string) => `${value.slice(0, 4)}***`;
const poolOptions = (connectionString: string) => ({
  connectionString, max: 25, connectionTimeoutMillis: 10_000,
  ssl: connectionString.includes("sslmode=require") || connectionString.includes("ssl=true") ? { rejectUnauthorized: false } : false,
});
type Tenant = { tuid: string; domain: string; pool: Pool; db: ReturnType<typeof drizzle> };
const evidence: Record<string, unknown> = {};

function tenantUrl(tuid: string) { const url = new URL(masterUrl!); url.pathname = `/${tuid}`; return url.toString(); }
async function inTenant<T>(tenant: Tenant, callback: () => Promise<T>): Promise<T> {
  return tenantConnectionManager.tenantStorage.run({ db: tenant.db, tenantId: tenant.tuid, domain: tenant.domain }, callback);
}
async function insertPending(tenant: Tenant, crewUuid: string, payload: object, action = "update", section = "particulars", targetUuid: string | null = null) {
  const pendingUuid = randomUUID(), operationUuid = randomUUID();
  await tenant.pool.query(`insert into app_crew_pending_changes
    (pending_uuid,operation_uuid,domain,crew_uuid,section,action,target_uuid,payload,staged_attachments,status,is_deleted,is_sync,created_by_uuid,updated_by_uuid)
    values($1,$2,$3,$4,$5,$6,$7,$8,'[]','pending',false,false,$4,$4)`,
    [pendingUuid, operationUuid, tenant.domain, crewUuid, section, action, targetUuid, JSON.stringify(payload)]);
  return { pendingUuid, operationUuid };
}
async function insertCommand(tenant: Tenant, pendingUuid: string, operationUuid: string, crewUuid: string, commandType: string, payload: object, status = "queued") {
  const commandUuid = randomUUID();
  await tenant.pool.query(`insert into app_crew_erp_commands
    (command_uuid,pending_uuid,operation_uuid,domain,crew_uuid,command_type,status,approved_payload_hash)
    values($1,$2,$3,$4,$5,$6,$7,$8)`, [commandUuid,pendingUuid,operationUuid,tenant.domain,crewUuid,commandType,status,canonicalHash(payload)]);
  return commandUuid;
}
async function cleanup(tenant: Tenant) {
  await tenant.pool.query(`delete from app_crew_erp_commands where crew_uuid like $1`, [`${RUN}%`]);
  await tenant.pool.query(`delete from app_crew_pending_reviews where pending_uuid in (select pending_uuid from app_crew_pending_changes where crew_uuid like $1)`, [`${RUN}%`]);
  await tenant.pool.query(`delete from app_crew_pending_changes where crew_uuid like $1`, [`${RUN}%`]);
  await tenant.pool.query(`delete from crew_members_v2 where crew_uuid like $1`, [`${RUN}%`]);
}

const master = new Pool(poolOptions(masterUrl));
const tenants: Tenant[] = [];
try {
  const tenantRows = (await master.query("select tuid,domain from tenants where is_active=true and is_deleted=false order by tuid limit 2")).rows;
  if (tenantRows.length !== 2) throw new Error("Exactly two active non-production tenants are required");
  if (process.env.CI_TEST_DATABASE_PREFIX && tenantRows.some(row=>!row.tuid.startsWith(process.env.CI_TEST_DATABASE_PREFIX!))) throw new Error("Tenant database does not match CI_TEST_DATABASE_PREFIX");
  for (const row of tenantRows) {
    const pool = new Pool(poolOptions(tenantUrl(row.tuid)));
    tenants.push({ ...row, pool, db: drizzle(pool) });
  }
  const [a,b] = tenants;
  for (const t of tenants) {
    await cleanup(t);
    await t.pool.query(`delete from app_crew_erp_commands where crew_uuid='codex-test-migration-pre0221'`);
    await t.pool.query(`delete from app_crew_pending_reviews where pending_uuid in (select pending_uuid from app_crew_pending_changes where crew_uuid='codex-test-migration-pre0221')`);
    await t.pool.query(`delete from app_crew_pending_changes where crew_uuid='codex-test-migration-pre0221'`);
  }

  const crewA = `${RUN}-crew-a`, crewB = `${RUN}-crew-b`;
  await a.pool.query(`insert into crew_members_v2(crew_uuid,emp_no,first_name,family_name,is_active,is_deleted,is_sync) values($1,$2,'TEST_A','TEST_TENANT_A_BEFORE',true,false,false)`, [crewA, `${RUN}-A`]);
  await b.pool.query(`insert into crew_members_v2(crew_uuid,emp_no,first_name,family_name,is_active,is_deleted,is_sync) values($1,$2,'TEST_B','TEST_TENANT_B_BEFORE',true,false,false)`, [crewB, `${RUN}-B`]);
  evidence.seed = { tenantA: { tenant: safe(a.tuid), crew: safe(crewA), familyName: "TEST_TENANT_A_BEFORE" }, tenantB: { tenant: safe(b.tuid), crew: safe(crewB), familyName: "TEST_TENANT_B_BEFORE" } };

  // 20 concurrent approvals through the real repository transaction.
  const approvedTarget = { familyName: "TEST_TENANT_A_APPROVED" };
  const approval = await insertPending(a, crewA, approvedTarget);
  const outcomes = await inTenant(a, () => Promise.all(Array.from({length:20}, async (_,i) => {
    try { await pendingChangesRepository.approveAndEnqueue(approval.pendingUuid,{uuid:`${RUN}-reviewer-${i}`,name:"Synthetic reviewer"}); return "approved"; }
    catch (error:any) { return `rejected:${error.status ?? "error"}`; }
  })));
  const approvalCounts = (await a.pool.query(`select
    (select count(*)::int from app_crew_pending_changes where pending_uuid=$1 and status='approved') pending_transition,
    (select count(*)::int from app_crew_pending_reviews where pending_uuid=$1) reviews,
    (select count(*)::int from app_crew_erp_commands where pending_uuid=$1) commands,
    (select count(distinct operation_uuid)::int from app_crew_erp_commands where pending_uuid=$1) operation_ids`, [approval.pendingUuid])).rows[0];
  evidence.concurrentApproval = { winners: outcomes.filter(x=>x==="approved").length, conflicts: outcomes.filter(x=>x.startsWith("rejected:")).length, ...approvalCounts };
  if (approvalCounts.pending_transition!==1||approvalCounts.reviews!==1||approvalCounts.commands!==1) throw new Error("20-approval invariant failed");

  // End-to-end actual worker execution and authoritative read-back.
  const beforeA = (await a.pool.query("select family_name,updated_at from crew_members_v2 where crew_uuid=$1",[crewA])).rows[0];
  const processedA:any = await inTenant(a, () => processNextForCurrentTenant(`${RUN}-worker-e2e`));
  const afterA = (await a.pool.query("select family_name,updated_at from crew_members_v2 where crew_uuid=$1",[crewA])).rows[0];
  const commandA = (await a.pool.query("select command_uuid,status,attempt_count,reconciled_at,authoritative_record_uuid from app_crew_erp_commands where pending_uuid=$1",[approval.pendingUuid])).rows[0];
  evidence.endToEnd = { pendingUuid: approval.pendingUuid, operationUuid: approval.operationUuid, commandUuid: commandA.command_uuid, crewUuid: crewA, before: beforeA.family_name, approved: approvedTarget.familyName, after: afterA.family_name, status: commandA.status, attemptCount: commandA.attempt_count, reconciled: Boolean(commandA.reconciled_at), processorStatus: processedA?.status };
  if(afterA.family_name!==approvedTarget.familyName||commandA.status!=="applied") throw new Error("End-to-end authoritative update failed");

  // Applied replay prevention.
  const replay = await inTenant(a, () => erpCommandRepository.leaseNext(`${RUN}-replay`));
  const afterReplay = (await a.pool.query("select family_name,updated_at from crew_members_v2 where crew_uuid=$1",[crewA])).rows[0];
  evidence.appliedReplay = { leasedAgain: replay?.commandUuid===commandA.command_uuid, authoritativeTimestampUnchanged: String(afterReplay.updated_at)===String(afterA.updated_at) };

  // Exactly one of two workers can lease a single command.
  const leasePending = await insertPending(a, crewA, {familyName:"LEASE_ONLY"});
  await a.pool.query("update app_crew_pending_changes set status='approved' where pending_uuid=$1",[leasePending.pendingUuid]);
  const leaseCommand = await insertCommand(a,leasePending.pendingUuid,leasePending.operationUuid,crewA,"UPDATE_CREW_PARTICULARS",{familyName:"LEASE_ONLY"});
  const leases = await inTenant(a, () => Promise.all([erpCommandRepository.leaseNext(`${RUN}-worker-1`,5),erpCommandRepository.leaseNext(`${RUN}-worker-2`,5)]));
  const leaseRow=(await a.pool.query("select lease_owner,attempt_count,status from app_crew_erp_commands where command_uuid=$1",[leaseCommand])).rows[0];
  evidence.twoWorkerLease={commandUuid:leaseCommand,claimers:leases.filter(Boolean).map(x=>x!.leaseOwner),winner:leaseRow.lease_owner,attemptCount:leaseRow.attempt_count,status:leaseRow.status};
  if(leases.filter(Boolean).length!==1) throw new Error("Two workers leased one command");

  // Crash before mutation: expire leased command, then another worker executes it.
  await a.pool.query("update app_crew_erp_commands set lease_expires_at=now()-interval '1 second' where command_uuid=$1",[leaseCommand]);
  const recovered:any=await inTenant(a,()=>processNextForCurrentTenant(`${RUN}-worker-recovery`));
  const recoveryState=(await a.pool.query("select status,attempt_count from app_crew_erp_commands where command_uuid=$1",[leaseCommand])).rows[0];
  evidence.crashBefore={recoveredStatus:recovered?.status,finalStatus:recoveryState.status,attemptCount:recoveryState.attempt_count};

  // Two workers may claim two different eligible commands concurrently.
  const parallelIds=[];
  for(const value of ["PARALLEL_ONE","PARALLEL_TWO"]){const p=await insertPending(a,crewA,{familyName:value});await a.pool.query("update app_crew_pending_changes set status='approved' where pending_uuid=$1",[p.pendingUuid]);parallelIds.push(await insertCommand(a,p.pendingUuid,p.operationUuid,crewA,"UPDATE_CREW_PARTICULARS",{familyName:value}));}
  const parallelLeases=await inTenant(a,()=>Promise.all([erpCommandRepository.leaseNext(`${RUN}-parallel-1`,30),erpCommandRepository.leaseNext(`${RUN}-parallel-2`,30)]));
  evidence.parallelLeases={claimCount:parallelLeases.filter(Boolean).length,distinctCommands:new Set(parallelLeases.filter(Boolean).map(x=>x!.commandUuid)).size,commandIds:parallelLeases.filter(Boolean).map(x=>x!.commandUuid)};
  if(parallelLeases.filter(Boolean).length!==2||new Set(parallelLeases.map(x=>x?.commandUuid)).size!==2) throw new Error("Concurrent workers did not claim distinct commands");

  // Crash after mutation: commit authoritative update, leave command APPLYING expired, restart into verification.
  const crashTarget={familyName:"TEST_CRASH_AFTER_COMMIT"};
  const crashPending=await insertPending(a,crewA,crashTarget); await a.pool.query("update app_crew_pending_changes set status='approved' where pending_uuid=$1",[crashPending.pendingUuid]);
  const crashCommand=await insertCommand(a,crashPending.pendingUuid,crashPending.operationUuid,crewA,"UPDATE_CREW_PARTICULARS",crashTarget,"applying");
  await a.pool.query("update crew_members_v2 set family_name=$2,updated_at=now() where crew_uuid=$1",[crewA,crashTarget.familyName]);
  const postMutationTime=(await a.pool.query("select updated_at from crew_members_v2 where crew_uuid=$1",[crewA])).rows[0].updated_at;
  await a.pool.query("update app_crew_erp_commands set lease_owner=$2,lease_expires_at=now()-interval '1 second',attempt_count=1 where command_uuid=$1",[crashCommand,`${RUN}-dead-worker`]);
  const crashResult:any=await inTenant(a,()=>processNextForCurrentTenant(`${RUN}-restart-worker`));
  const crashFinal=(await a.pool.query("select status,reconciled_at from app_crew_erp_commands where command_uuid=$1",[crashCommand])).rows[0];
  const postRecovery=(await a.pool.query("select family_name,updated_at from crew_members_v2 where crew_uuid=$1",[crewA])).rows[0];
  evidence.crashAfter={finalStatus:crashFinal.status,reconciled:Boolean(crashFinal.reconciled_at),authoritativeValue:postRecovery.family_name,mutationTimestampUnchanged:String(postRecovery.updated_at)===String(postMutationTime),processorStatus:crashResult?.status};

  // Concurrent physical tenant isolation.
  const targetA={familyName:"TENANT_A_ISOLATED"},targetB={familyName:"TENANT_B_ISOLATED"};
  const pa=await insertPending(a,crewA,targetA),pb=await insertPending(b,crewB,targetB);
  await Promise.all([a.pool.query("update app_crew_pending_changes set status='approved' where pending_uuid=$1",[pa.pendingUuid]),b.pool.query("update app_crew_pending_changes set status='approved' where pending_uuid=$1",[pb.pendingUuid])]);
  await insertCommand(a,pa.pendingUuid,pa.operationUuid,crewA,"UPDATE_CREW_PARTICULARS",targetA); await insertCommand(b,pb.pendingUuid,pb.operationUuid,crewB,"UPDATE_CREW_PARTICULARS",targetB);
  await Promise.all([inTenant(a,()=>processNextForCurrentTenant(`${RUN}-tenant-a-worker`)),inTenant(b,()=>processNextForCurrentTenant(`${RUN}-tenant-b-worker`))]);
  const [va,vb,crossA,crossB]=await Promise.all([a.pool.query("select family_name from crew_members_v2 where crew_uuid=$1",[crewA]),b.pool.query("select family_name from crew_members_v2 where crew_uuid=$1",[crewB]),a.pool.query("select count(*)::int n from crew_members_v2 where crew_uuid=$1",[crewB]),b.pool.query("select count(*)::int n from crew_members_v2 where crew_uuid=$1",[crewA])]);
  evidence.tenantIsolation={tenantAValue:va.rows[0].family_name,tenantBValue:vb.rows[0].family_name,crossTenantAHasCrewB:crossA.rows[0].n,crossTenantBHasCrewA:crossB.rows[0].n};

  // A Tenant-A command cannot select Tenant B's physical database by target UUID.
  const negative=await insertPending(a,crewB,{familyName:"MUST_NOT_CROSS_TENANT"});await a.pool.query("update app_crew_pending_changes set status='approved' where pending_uuid=$1",[negative.pendingUuid]);const negativeCommand=await insertCommand(a,negative.pendingUuid,negative.operationUuid,crewB,"UPDATE_CREW_PARTICULARS",{familyName:"MUST_NOT_CROSS_TENANT"});await inTenant(a,()=>processNextForCurrentTenant(`${RUN}-negative-worker`));const negativeState=(await a.pool.query("select status,error_code from app_crew_erp_commands where command_uuid=$1",[negativeCommand])).rows[0];const tenantBUnchanged=(await b.pool.query("select family_name from crew_members_v2 where crew_uuid=$1",[crewB])).rows[0].family_name;evidence.negativeTenantManipulation={commandStatus:negativeState.status,errorCode:negativeState.error_code,tenantBValue:tenantBUnchanged};

  // Live blocked commands.
  const blockedSpecs=[
    ["documents","create","CREATE_DOCUMENTS"],["training","create","CREATE_TRAINING"],
    ["documents","delete","DELETE_DOCUMENTS"],["vessel-types","update","SYNC_VESSEL_TYPES"],
    ["unknown","update","UNKNOWN"],
  ];
  const blocked=[];
  for(const [section,action,type] of blockedSpecs){const p=await insertPending(a,crewA,{},action,section,action==="delete"?randomUUID():null);await a.pool.query("update app_crew_pending_changes set status='approved' where pending_uuid=$1",[p.pendingUuid]);const id=await insertCommand(a,p.pendingUuid,p.operationUuid,crewA,type,{});await inTenant(a,()=>processNextForCurrentTenant(`${RUN}-blocked-worker`));const row=(await a.pool.query("select status,error_code from app_crew_erp_commands where command_uuid=$1",[id])).rows[0];blocked.push({type,...row});}
  evidence.blocked=blocked;

  const schemaEvidence=[];
  for(const t of tenants){const columns=(await t.pool.query("select column_name from information_schema.columns where table_name='app_crew_erp_commands' and column_name in ('command_type','approved_payload_hash','lease_owner','lease_expires_at','last_attempt_at','next_attempt_at','authoritative_record_uuid','authoritative_result_hash','reconciled_at') order by column_name")).rows.map(x=>x.column_name);const indexes=(await t.pool.query("select indexname from pg_indexes where tablename='app_crew_erp_commands' and indexname like 'app_crew_erp_commands_%' order by indexname")).rows.map(x=>x.indexname);const constraints=(await t.pool.query("select pg_get_constraintdef(oid) definition from pg_constraint where conrelid='app_crew_erp_commands'::regclass and contype='c' order by conname")).rows.map(x=>x.definition);const migration=(await t.pool.query("select count(*)::int n from schema_migrations where filename='0221_mobile_erp_command_worker.sql'")).rows[0].n;schemaEvidence.push({tenant:safe(t.tuid),migration,columns,indexes,constraints});}
  evidence.schema=schemaEvidence;
  console.log(JSON.stringify(evidence,null,2));
} finally {
  for(const tenant of tenants){try{await cleanup(tenant);const remaining=(await tenant.pool.query(`select (select count(*) from app_crew_pending_changes where crew_uuid like $1)+(select count(*) from app_crew_erp_commands where crew_uuid like $1)+(select count(*) from crew_members_v2 where crew_uuid like $1) n`,[`${RUN}%`])).rows[0].n;console.log(JSON.stringify({cleanupTenant:safe(tenant.tuid),remaining:Number(remaining)}));}finally{await tenant.pool.end();}}
  await master.end();
}
