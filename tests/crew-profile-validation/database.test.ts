// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../../shared/v2/crew-pool/schema";
import { masterCountries, masterNationalities, masterLanguages, masterVesselTypes, masterVessels } from "../../shared/schema";

const state=vi.hoisted(()=>({db:null as any}));
vi.mock("../../server/v2/db",()=>({getDb:()=>state.db}));
import { crewMembersController } from "../../server/v2/crew-pool/controllers/crewMembersController";
import { crewPersonalController } from "../../server/v2/crew-pool/controllers/crewPersonalController";
import { crewFamilyController } from "../../server/v2/crew-pool/controllers/crewFamilyController";

const tables=[...Object.values(schema).filter((t):t is PgTable=>is(t,PgTable)),
  masterCountries,masterNationalities,masterLanguages,masterVesselTypes,masterVessels];
const quote=(name:string)=>`"${name.replaceAll('"','""')}"`;
let pool:Pool,directory:string;
const countryUuid="11111111-1111-4111-8111-111111111111";
beforeAll(async()=>{
  // Disposable, isolated PostgreSQL. Never connects to application databases.
  directory=mkdtempSync(join(tmpdir(),"crew-profile-validation-"));
  execFileSync("initdb",["-D",join(directory,"data"),"-U","profile_test","-A","trust","--no-locale"],{stdio:"pipe"});
  execFileSync("pg_ctl",["-D",join(directory,"data"),"-l",join(directory,"postgres.log"),"-o",`-k ${directory} -p 55445 -c listen_addresses=''`,"-w","start"],{stdio:"pipe"});
  pool=new Pool({host:directory,port:55445,user:"profile_test",database:"postgres"});
  state.db=drizzle(pool);
  for(const table of tables){
    const config=getTableConfig(table);
    const columns=config.columns.map((c:any)=>{
      let sql=`${quote(c.name)} ${c.getSQLType()}`;
      if(c.primary)sql+=" PRIMARY KEY";else if(c.isUnique)sql+=" UNIQUE";
      if(c.notNull)sql+=" NOT NULL";
      if(c.default!==undefined&&!/serial/i.test(c.getSQLType())){
        if(typeof c.default==="string")sql+=` DEFAULT '${c.default.replaceAll("'","''")}'`;
        else if(["boolean","number"].includes(typeof c.default))sql+=` DEFAULT ${c.default}`;
        else if(c.dataType==="date")sql+=" DEFAULT now()";
      }
      return sql;
    });
    await pool.query(`CREATE TABLE ${quote(config.name)} (${columns.join(",")})`);
  }
},60000);
afterAll(async()=>{
  if(pool)await pool.end();
  if(directory){try{execFileSync("pg_ctl",["-D",join(directory,"data"),"-m","immediate","-w","stop"],{stdio:"pipe"});}
    finally{rmSync(directory,{recursive:true,force:true});}}
});
beforeEach(async()=>{
  await pool.query(`TRUNCATE ${tables.map(t=>quote(getTableConfig(t).name)).join(",")} RESTART IDENTITY`);
  await state.db.insert(masterCountries).values({countryUuid,countryName:"INDIA"});
  await state.db.insert(schema.crewMembersV2).values({crewUuid:"crew",empNo:"TEST-1",firstName:"Fixture",dob:"1990-01-01",recruitmentDate:"2026-01-01"});
});
async function request(handler:any,body:any){
  const result:any={code:200,body:null};
  const response:any={status(code:number){result.code=code;return this;},json(body:any){result.body=body;return this;}};
  await handler({params:{crewUuid:"crew"},body},response);return result;
}
async function storedCrew(){return(await state.db.select().from(schema.crewMembersV2).where(eq(schema.crewMembersV2.crewUuid,"crew")))[0];}
describe("Actual controller/service/repository persistence on isolated PostgreSQL",()=>{
  it("never persists rejected recruitment dates and saves a corrected date",async()=>{
    const before=(await storedCrew()).recruitmentDate;
    for(const recruitmentDate of ["2099-01-01","2026-02-30"]){
      expect((await request(crewMembersController.update,{recruitmentDate})).code).toBe(400);
      expect((await storedCrew()).recruitmentDate).toBe(before);
    }
    expect((await request(crewMembersController.create,{empNo:"TEST-2",firstName:"Fixture",recruitmentDate:"2099-01-01"})).code).toBe(400);
    expect(await state.db.select().from(schema.crewMembersV2)).toHaveLength(1);
    expect((await request(crewMembersController.update,{recruitmentDate:"2026-01-02"})).code).toBe(200);
    expect((await storedCrew()).recruitmentDate).toBe("2026-01-02");
  });
  it("never persists rejected DOB and persists corrected DOB on reopen",async()=>{
    expect((await request(crewMembersController.update,{dob:"2020-01-01"})).code).toBe(400);
    expect((await storedCrew()).dob).toBe("1990-01-01");
    expect((await request(crewMembersController.update,{dob:"1991-01-01"})).code).toBe(200);
    expect((await storedCrew()).dob).toBe("1991-01-01");
  });
  it("rejects invalid new crew without creating any row",async()=>{
    expect((await request(crewMembersController.create,{empNo:"TEST-2",firstName:"Fixture",dob:"2020-01-01",recruitmentDate:"2026-01-01"})).code).toBe(400);
    expect(await state.db.select().from(schema.crewMembersV2)).toHaveLength(1);
    expect((await request(crewMembersController.create,{empNo:"TEST-2",firstName:"Fixture",dob:"1991-01-01",recruitmentDate:"2026-01-01"})).code).toBe(201);
    expect(await state.db.select().from(schema.crewMembersV2)).toHaveLength(2);
  });
  it("retains address on bad email/mobile, supports correct changes and optional blanks",async()=>{
    const handler=crewPersonalController.upsertAddress;
    expect((await request(handler,{countryOfResidenceUuid:countryUuid,email:"good@example.com",mobile:"+91 9876543210"})).code).toBe(200);
    expect((await request(handler,{email:"bad"})).code).toBe(400);
    expect((await request(handler,{mobile:"+91 123"})).code).toBe(400);
    const [stored]=await state.db.select().from(schema.crewAddresses);
    expect(stored.email).toBe("good@example.com");expect(stored.mobile).toBe("+91 9876543210");
    expect((await request(handler,{email:"",mobile:""})).code).toBe(200);
  });
  it("does not persist invalid family/NOK data and accepts corrected values",async()=>{
    expect((await request(crewFamilyController.upsertFamilyInfo,{maritalStatus:"Married",spouseFirstName:"",spouseFamilyName:""})).code).toBe(400);
    expect(await state.db.select().from(schema.crewFamilyInfo)).toHaveLength(0);
    expect((await request(crewFamilyController.upsertFamilyInfo,{maritalStatus:"Married",spouseFirstName:"First",spouseFamilyName:"Last",spouseDob:"1990-01-01"})).code).toBe(200);
    expect((await request(crewFamilyController.upsertFamilyInfo,{spouseDob:"2099-01-01"})).code).toBe(400);
    expect((await request(crewFamilyController.upsertNextOfKin,{email:"bad"})).code).toBe(400);
    expect(await state.db.select().from(schema.crewNextOfKin)).toHaveLength(0);
    expect((await request(crewFamilyController.upsertNextOfKin,{email:"good@example.com"})).code).toBe(200);
  });
});
