import { describe,expect,it } from "vitest";
import { getErpWorkerConfig } from "../../server/config/productionConfig";
import { mapMobileOperationStatus } from "../../server/v2/crew-app/crew-information/pendingChangesRepository";
import { getErpMetricsSnapshot,incrementErpMetric,resetErpMetricsForTests,setErpQueueGauges } from "../../server/v2/crew-app/erp-commands/metrics";
import { emitCrewSecurityEvent,registerCrewSecurityEventSink,resetCrewSecurityMonitoringForTests } from "../../server/v2/crew-app/monitoring/securityEvents";
import { readFileSync } from "node:fs";

describe("ERP worker operational controls",()=>{
  it("fails closed for missing or invalid production worker configuration",()=>{
    expect(()=>getErpWorkerConfig({NODE_ENV:"production"} as any)).toThrow(/ERP_COMMAND_WORKER_ENABLED/);
    expect(()=>getErpWorkerConfig({NODE_ENV:"production",ERP_COMMAND_WORKER_ENABLED:"true",ERP_COMMAND_WORKER_POLL_INTERVAL_MS:"1",ERP_COMMAND_WORKER_BATCH_SIZE:"10",ERP_COMMAND_WORKER_CONCURRENCY:"2",ERP_COMMAND_LEASE_SECONDS:"60",ERP_COMMAND_MAX_ATTEMPTS:"5"} as any)).toThrow(/POLL_INTERVAL/);
  });
  it("uses conservative bounded non-production defaults",()=>expect(getErpWorkerConfig({NODE_ENV:"test"} as any)).toEqual({enabled:false,pollIntervalMs:5000,batchSize:10,concurrency:2,leaseSeconds:60,maxAttempts:5}));
  it.each([["pending",null,"UNDER_REVIEW"],["approved","queued","PROCESSING"],["approved","verifying","PROCESSING"],["approved","applied","COMPLETED"],["approved","dead_letter","NEEDS_OFFICE_REVIEW"],["rejected",null,"REJECTED"]])("maps %s/%s safely",(pending,command,expected)=>expect(mapMobileOperationStatus(pending,command as any)).toBe(expected));
  it("keeps metric labels bounded and exposes queue gauges",()=>{resetErpMetricsForTests();incrementErpMetric("erp_command_applied_total",{commandType:"UPDATE_DOCUMENTS",result:"APPLIED",reasonCode:"MATCHED",crewUuid:"forbidden"} as any);setErpQueueGauges({queueDepth:2,oldestAge:30,activeLeases:1});const value=JSON.stringify(getErpMetricsSnapshot());expect(value).toContain("UPDATE_DOCUMENTS");expect(value).not.toContain("forbidden");expect(value).toContain('"erp_command_queue_depth":2');});
  it("emits safe command events without payload data",()=>{resetCrewSecurityMonitoringForTests();let seen:any;const stop=registerCrewSecurityEventSink(e=>{seen=e});emitCrewSecurityEvent({event:"command_applied",tenantId:"tenant",correlationId:"operation",resourceType:"erp_command",result:"success",reasonCode:"MATCHED",commandType:"UPDATE_DOCUMENTS",attemptCount:1} as any);stop();expect(seen).toMatchObject({commandType:"UPDATE_DOCUMENTS",attemptCount:1});expect(JSON.stringify(seen)).not.toMatch(/payload|crewUuid/);});
  it("protects operations with dedicated office RBAC and has no automatic grants",()=>{const routes=readFileSync("server/v2/crew-app-review/routes.ts","utf8");const migration=readFileSync("migrations/0222_mobile_erp_command_operations.sql","utf8");expect(routes).toContain('requirePermission("ERP Command Operations"');expect(migration).not.toMatch(/INSERT INTO adm_roleaccess_ac/i);});
  it("forbids generic mutation retry for unsafe commands",()=>{const service=readFileSync("server/v2/crew-app-review/erpCommandOperationsService.ts","utf8");expect(service).toContain('!commandPolicy(command.commandType).automated');expect(service).toContain('!=="missing"');expect(service).not.toContain("handler.execute");});
});
