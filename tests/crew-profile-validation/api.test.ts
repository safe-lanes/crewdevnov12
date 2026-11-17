// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  stored: {} as any, address: {} as any, family: {} as any, nok: {} as any,
  crew: {} as any, profile: {} as any, writes: [] as string[],
}));
vi.mock("../../server/v2/crew-pool/services", () => ({
  crewMembersService: state.crew, crewProfileService: state.profile,
}));
vi.mock("../../server/v2/crew-pool/services/crewMembersService", () => ({ crewMembersService: state.crew }));
vi.mock("../../server/v2/db", () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{name:"INDIA"}] }) }) }) }),
}));
import { crewMembersController } from "../../server/v2/crew-pool/controllers/crewMembersController";
import { crewPersonalController } from "../../server/v2/crew-pool/controllers/crewPersonalController";
import { crewFamilyController } from "../../server/v2/crew-pool/controllers/crewFamilyController";

async function request(handler: any, body: any) {
  const result: any = { code: 200, body: null };
  const res: any = {
    status(code: number) { result.code=code;return this; },
    json(body: any) { result.body=body;return this; },
  };
  await handler({params:{crewUuid:"crew"},body},res);
  return result;
}
beforeEach(() => {
  state.stored={crewUuid:"crew",empNo:"EMP-001",firstName:"Crew",dob:"1990-01-01",recruitmentDate:"2026-01-01"};
  state.address={countryOfResidenceUuid:"INDIA",email:"valid@example.com",mobile:"+91 9876543210"};
  state.family={maritalStatus:"Married",spouseFirstName:"First",spouseFamilyName:"Last",spouseDob:"1990-01-01"};
  state.nok={email:"valid@example.com"};
  state.writes=[];
  Object.assign(state.crew,{
    getByUuid:async()=>({...state.stored}),
    create:async(data:any)=>{state.writes.push("create");return state.stored={...data,crewUuid:"created"};},
    createWithRelatedData:async(data:any)=>{state.writes.push("related");return state.stored={...data.crew,crewUuid:"created"};},
    update:async(_:string,data:any)=>{state.writes.push("update");return state.stored={...state.stored,...data};},
    updateWithProtection:async(_:string,data:any)=>{state.writes.push("protected");return state.stored={...state.stored,...data};},
  });
  Object.assign(state.profile,{
    getAddress:async()=>({...state.address}),
    upsertAddress:async(_:string,data:any)=>{state.writes.push("address");return state.address={...state.address,...data};},
    getFamilyInfo:async()=>({familyInfo:{...state.family},children:[],nextOfKin:state.nok}),
    upsertFamilyInfo:async(_:string,data:any)=>{state.writes.push("family");return state.family={...state.family,...data};},
    getNextOfKin:async()=>({...state.nok}),
    upsertNextOfKin:async(_:string,data:any)=>{state.writes.push("nok");return state.nok={...state.nok,...data};},
    upsertPersonalDetails:async()=>{state.writes.push("personal");return {};},
  });
});
describe("Direct Crew Pool controller write boundaries", () => {
  it.each([crewMembersController.update,crewMembersController.updateWithProtection])(
    "rejects changed future and malformed recruitment dates before writing",async handler=>{
      for(const recruitmentDate of ["2099-01-01","2026-02-30","not a date"]){
        const result=await request(handler,{recruitmentDate});
        expect(result.code).toBe(400);
        expect(result.body.details[0].path).toEqual(["recruitmentDate"]);
      }
      expect(state.writes).toEqual([]);
      expect(state.stored.recruitmentDate).toBe("2026-01-01");
    });
  it.each([crewMembersController.create,crewMembersController.createWithRelatedData])(
    "rejects future recruitment on both direct creation endpoints",async handler=>{
      const crew={firstName:"Crew",recruitmentDate:"2099-01-01"};
      expect((await request(handler,handler===crewMembersController.create?crew:{crew})).code).toBe(400);
      expect(state.writes).toEqual([]);
    });
  it("permits unrelated edits with unchanged legacy future recruitment, then corrected dates",async()=>{
    state.stored.recruitmentDate="2099-01-01";
    expect((await request(crewMembersController.update,{familyName:"Changed",recruitmentDate:"2099-01-01"})).code).toBe(200);
    expect((await request(crewMembersController.update,{recruitmentDate:"2026-01-01"})).code).toBe(200);
    expect(state.stored.recruitmentDate).toBe("2026-01-01");
  });
  it.each([crewMembersController.update,crewMembersController.updateWithProtection,crewPersonalController.upsertPersonalDetails])
    ("rejects underage DOB before any write", async handler => {
      const res=await request(handler,{dob:"2020-01-01"});
      expect(res.code).toBe(400);expect(res.body.details[0].path).toEqual(["dob"]);
      expect(state.writes).toEqual([]);expect(state.stored.dob).toBe("1990-01-01");
    });
  it("rejects underage creation, then permits corrected creation", async()=>{
    expect((await request(crewMembersController.create,{firstName:"Crew",dob:"2020-01-01",recruitmentDate:"2026-01-01"})).code).toBe(400);
    expect(state.writes).toEqual([]);
    expect((await request(crewMembersController.create,{firstName:"Crew",dob:"1990-01-01",recruitmentDate:"2026-01-01"})).code).toBe(201);
  });
  it("saves corrected DOB and rejects changed blank required fields",async()=>{
    expect((await request(crewMembersController.update,{dob:"1991-01-01"})).code).toBe(200);
    expect(state.stored.dob).toBe("1991-01-01");
    expect((await request(crewMembersController.update,{firstName:" "})).code).toBe(400);
    expect((await request(crewMembersController.update,{recruitmentDate:null})).code).toBe(400);
  });
  it("does not block unrelated legacy edits or impose new optional requirements",async()=>{
    state.stored.dob="2020-01-01";
    expect((await request(crewMembersController.update,{familyName:"Changed",dob:"2020-01-01"})).code).toBe(200);
    expect((await request(crewMembersController.update,{dob:null})).code).toBe(200);
    state.family.spouseFirstName="";
    expect((await request(crewFamilyController.upsertFamilyInfo,{fatherName:"Changed"})).code).toBe(200);
    state.address.email="legacy-invalid";
    expect((await request(crewPersonalController.upsertAddress,{nearestAirport:"Changed"})).code).toBe(200);
  });
  it("rejects bad address email and mobile with effective country context",async()=>{
    expect((await request(crewPersonalController.upsertAddress,{email:"bad"})).code).toBe(400);
    expect((await request(crewPersonalController.upsertAddress,{mobile:"+91 123"})).code).toBe(400);
    expect(state.writes).toEqual([]);
    expect((await request(crewPersonalController.upsertAddress,{mobile:"+91 9876543210",email:"new@example.com"})).code).toBe(200);
    expect(state.address.email).toBe("new@example.com");
  });
  it("resolves UUID residence before applying the same mobile rule",async()=>{
    state.address.countryOfResidenceUuid="11111111-1111-4111-8111-111111111111";
    expect((await request(crewPersonalController.upsertAddress,{mobile:"+91 123"})).code).toBe(400);
    expect(state.writes).toEqual([]);
  });
  it("treats a repeated country label and stored UUID as the same context on legacy edits",async()=>{
    state.address.countryOfResidenceUuid="11111111-1111-4111-8111-111111111111";
    state.address.mobile="+91 123";
    expect((await request(crewPersonalController.upsertAddress,{
      countryOfResidenceUuid:"INDIA", mobile:"+91 123",nearestAirport:"Changed",
    })).code).toBe(200);
  });
  it("validates changed residence against the stored mobile",async()=>{
    state.address.countryOfResidenceUuid="unknown";state.address.mobile="+91 123";
    expect((await request(crewPersonalController.upsertAddress,{countryOfResidenceUuid:"INDIA"})).code).toBe(400);
  });
  it("checks Married dependencies and spouseDob mapping before saving family",async()=>{
    expect((await request(crewFamilyController.upsertFamilyInfo,{spouseFirstName:""})).code).toBe(400);
    expect((await request(crewFamilyController.upsertFamilyInfo,{spouseDob:"2099-01-01"})).code).toBe(400);
    state.family={maritalStatus:"Single"};
    expect((await request(crewFamilyController.upsertFamilyInfo,{maritalStatus:"Married"})).code).toBe(400);
    expect(state.writes).toEqual([]);
    expect((await request(crewFamilyController.upsertFamilyInfo,{maritalStatus:"Married",spouseFirstName:"First",spouseFamilyName:"Last"})).code).toBe(200);
  });
  it("rejects invalid NOK email without persisting",async()=>{
    expect((await request(crewFamilyController.upsertNextOfKin,{email:"bad"})).code).toBe(400);
    expect(state.nok.email).toBe("valid@example.com");expect(state.writes).toEqual([]);
  });
});
