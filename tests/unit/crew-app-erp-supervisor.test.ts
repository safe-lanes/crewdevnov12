import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({process:vi.fn(),stats:vi.fn()}));
vi.mock("../../server/v2/crew-app/erp-commands/worker",()=>({processNextForCurrentTenant:mocks.process}));
vi.mock("../../server/v2/crew-app/erp-commands/commandRepository",()=>({erpCommandRepository:{queueStats:mocks.stats}}));
vi.mock("../../server/v2/crew-app/tenantContext",()=>({runInCrewAppTenant:async(_d:string,cb:any)=>cb()}));
vi.mock("../../server/utils/tenantConnectionManager",()=>({tenantConnectionManager:{isMultiTenantEnabled:false}}));
vi.mock("../../server/v2/crew-app/monitoring/securityEvents",()=>({emitCrewSecurityEvent:vi.fn()}));
import { ErpCommandWorkerSupervisor } from "../../server/v2/crew-app/erp-commands/supervisor";
const config={enabled:true,pollIntervalMs:1000,batchSize:3,concurrency:2,leaseSeconds:60,maxAttempts:5};
describe("ERP worker supervisor",()=>{
 beforeEach(()=>{vi.clearAllMocks();process.env.CREW_APP_SINGLE_TENANT_DOMAIN="test.invalid";mocks.stats.mockResolvedValue({queue_depth:0,active_leases:0,oldest_queued_age_seconds:0});});
 it("bounds one poll by batch size",async()=>{mocks.process.mockResolvedValue({status:"applied"});const s=new ErpCommandWorkerSupervisor();s.start({...config,enabled:false});expect(await s.pollOnce()).toBe(3);expect(mocks.process).toHaveBeenCalledTimes(3);await s.stop();});
 it("stops claiming and drains active work",async()=>{let release:any;mocks.process.mockImplementation(()=>new Promise(resolve=>{release=resolve}));const s=new ErpCommandWorkerSupervisor();s.start({...config,enabled:false,batchSize:1,concurrency:1});const poll=s.pollOnce();await vi.waitFor(()=>expect(mocks.process).toHaveBeenCalledTimes(1));const stopping=s.stop();expect(s.getHealth().stopping).toBe(true);release({status:"applied"});await Promise.all([poll,stopping]);const calls=mocks.process.mock.calls.length;expect(await s.pollOnce()).toBe(0);expect(mocks.process).toHaveBeenCalledTimes(calls);});
});
