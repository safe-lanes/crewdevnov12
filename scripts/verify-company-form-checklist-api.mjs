import fs from "node:fs/promises";
import pg from "pg";
const dir = ".local/verification/company-forms-checklist";
const fixture = JSON.parse(await fs.readFile(`${dir}/fixture.json`, "utf8"));
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = `https://${process.env.REPLIT_DEV_DOMAIN}/api/v2`;
const report = { checks: [], operations: [] };
const assert = (value, message) => { if (!value) throw Error(message); report.checks.push(message); };
const actor = (await db.query(`SELECT u.id,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
const encode = x => Buffer.from(JSON.stringify(x)).toString("base64url");
const token = (a, vessels) => `${encode({alg:"none",typ:"JWT"})}.${encode({
  id:a.id,roleId:a.ruid ?? a.roleId,userType:a.user_type ?? a.userType,domain:"test",vessels})}.devsig`;
async function api(method, path, body, user = actor, vessels) {
  const response = await fetch(`${base}${path}`, {method,headers:{"Content-Type":"application/json",
    Authorization:`Bearer ${token(user,vessels)}`},body:body === undefined ? undefined : JSON.stringify(body)});
  const data = await response.json();
  report.operations.push({method,path,status:response.status});
  return {status:response.status,data};
}
const permissions = `/admin/access-control/roles/${actor.ruid}/action-permissions`;
try {
  if (process.argv.includes("--restore")) {
    const original = JSON.parse(await fs.readFile(`${dir}/original-grants.json`, "utf8"));
    const restored = await api("PUT",permissions,{grants:original});
    assert(restored.status===200,"Original office grants restored through audited server API");
  } else {
    const original = await api("GET",permissions);
    assert(original.status===200,"Trusted recovery/management actor can read grants");
    if (!await fs.access(`${dir}/original-grants.json`).then(()=>true,()=>false))
      await fs.writeFile(`${dir}/original-grants.json`,JSON.stringify(original.data.grants));
    assert((await api("PUT",permissions,{grants:{...original.data.grants,override_checklist:true}})).status===200,
      "Explicit checklist override granted through audited server API");
    const shipGrants = Object.fromEntries(Object.keys(original.data.grants).map(k=>[k,k==="view"]));
    assert((await api("PUT",`/admin/access-control/roles/${fixture.ship.roleId}/action-permissions`,{grants:shipGrants})).status===200,
      "Synthetic vessel viewer granted Company Forms View only");
    const c = fixture.cases;
    for (const kind of ["required","mixed"]) {
      const r = await api("PATCH",`/vessel/planning/${c[kind].plan}`,{
        deploymentChecklistCompleted:true,checklistOverride:{reason:"TEST ONLY: attempt must be refused"}});
      assert(r.status===409 && !r.data.canOverride && /must be completed/i.test(r.data.message),
        `${kind}: explicit override refused for known incomplete mandatory form`);
    }
    const optional = await api("PATCH",`/vessel/planning/${c.optional.plan}`,{deploymentChecklistCompleted:true});
    assert(optional.status===200,"Optional OUTSTANDING requirement does not block checklist Yes");
    const unknown = await api("PATCH",`/vessel/planning/${c.unresolved.plan}`,{deploymentChecklistCompleted:true});
    assert(unknown.status===409 && unknown.data.canOverride && /first company service/i.test(unknown.data.message),
      "UNRESOLVED names missing first-service fact and is eligible only with explicit grant");
    const blank = await api("PATCH",`/vessel/planning/${c.unresolved.plan}`,{
      deploymentChecklistCompleted:true,checklistOverride:{reason:" "}});
    assert(blank.status===409,"Blank override reason refused");
    for (const kind of ["failed","pending"]) {
      const r = await api("PATCH",`/vessel/planning/${c[kind].plan}`,{deploymentChecklistCompleted:true});
      assert(r.status===409 && r.data.canOverride,`${kind}: recorded check blocks ordinary Yes`);
    }
    const forged = await api("PATCH",`/vessel/planning/${c.unresolved.plan}`,{
      deploymentChecklistCompleted:true,actorId:9000001,checklistOverride:{reason:"TEST ONLY"}});
    assert(forged.status===409 && forged.data.error==="company_forms_checklist_blocked","Browser-supplied audit identity refused");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      let denied=false;
      try { await client.query("UPDATE vessel_planning_v2 SET deployment_checklist_completed=true WHERE plan_uuid=$1",[c.required.plan]); }
      catch(error) { denied=error.code==="23514"; }
      await client.query("ROLLBACK");
      assert(denied,"Raw SQL Yes without trusted transaction marker refused");
    } finally { client.release(); }
    const office = await api("GET",`/company-form-submissions/outstanding?seafarer=${fixture.prefix}&pageSize=500`);
    assert(office.status===200 && office.data.rows.some(r=>r.assignmentState==="Signed off"),
      "Outstanding report includes signed-off fixture");
    assert(["Rules check failed","Rules check pending"].every(status=>office.data.rows.some(r=>r.status===status)),
      "Failed and pending checks have their own report rows");
    const scoped = await api("GET",`/company-form-submissions/outstanding?seafarer=${fixture.prefix}`,undefined,fixture.ship,[c.required.vessel]);
    assert(scoped.status===200 && scoped.data.total===1 && scoped.data.rows.every(r=>r.vessel===c.optional.vesselName),
      "Trusted vessel scope controls rows and totals; forged JWT vessel claims ignored");
    const foreign = await api("GET",`/company-form-submissions/outstanding?vessel=${encodeURIComponent(c.required.vesselName)}`,undefined,fixture.ship);
    assert(foreign.status===200 && foreign.data.total===0,"Off-vessel filter cannot widen report scope");
  }
  await fs.writeFile(`${dir}/${process.argv.includes("--restore")?"restore":"api"}.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.checks.length}));
} finally { await db.end(); }
