import { writeFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { getDb } from "../server/v2/db";
import { retainFixtureReferences } from "../tests/helpers/fixture-retention";

async function main() {
  const db=getDb();
  const assignments=(await db.execute(sql`SELECT a.assign_uuid FROM crew_assignments a
    JOIN crew_members_v2 c USING(crew_uuid) WHERE c.emp_no LIKE 'CF391-%'`)).rows.map((r:any)=>r.assign_uuid);
  const tables=(await db.execute(sql`SELECT table_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name LIKE 'frm_%' AND column_name='subject_ref'`)).rows;
  const links=(await db.execute(sql`SELECT child.relname AS child,parent.relname AS parent,
    ca.attname AS child_col,pa.attname AS parent_col FROM pg_constraint con
    JOIN pg_class child ON child.oid=con.conrelid JOIN pg_class parent ON parent.oid=con.confrelid
    JOIN pg_namespace ns ON ns.oid=child.relnamespace
    JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=con.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=con.confkey[1]
    WHERE con.contype='f' AND ns.nspname=current_schema() AND child.relname LIKE 'frm_%'
      AND cardinality(con.conkey)=1`)).rows;
  const queue:Array<{table:string;rows:any[]}>=[], seen=new Set<string>(), graph:any[]=[];
  const read=async(table:string,column:string,ids:string[])=>{
    if(!ids.length)return;
    const key=`${table}:${column}:${ids.sort().join(",")}`;if(seen.has(key))return;seen.add(key);
    const rows=(await db.execute(sql`SELECT * FROM ${sql.identifier(table)}
      WHERE ${sql.identifier(column)}::text IN (${sql.join(ids.map(id=>sql`${id}`),sql`,`)})`)).rows;
    graph.push(...rows);queue.push({table,rows});
  };
  for(const t of tables)await read(t.table_name,"subject_ref",assignments);
  while(queue.length){
    const item=queue.shift()!;
    for(const link of links.filter((l:any)=>l.parent===item.table)){
      await read(link.child,link.child_col,[...new Set(item.rows.map(r=>String(r[link.parent_col])).filter(v=>v!=="null"&&v!=="undefined"))]);
    }
    // Signature attachments are owned by a one-way pointer, not a child FK.
    for(const link of links.filter((l:any)=>l.child===item.table&&/attachment|asset/.test(l.parent))){
      await read(link.parent,link.parent_col,[...new Set(item.rows.map(r=>String(r[link.child_col])).filter(v=>v!=="null"&&v!=="undefined"))]);
    }
  }
  retainFixtureReferences("Retained checklist and outstanding-report fixture descendants",graph);
  const audit=(await db.execute(sql`SELECT * FROM adm_access_control_audit
    WHERE event='checklist_override' AND details->>'assignmentUuid' IN (${sql.join(assignments.map((id:string)=>sql`${id}`),sql`,`)})
    ORDER BY recorded_at`)).rows;
  retainFixtureReferences("Retained checklist override audit references",audit);
  const result={registeredRows:graph.length,overrideAudit:audit};
  await writeFile(".local/verification/company-forms-checklist/fixture-and-audit.json",JSON.stringify(result,null,2));
  console.log(JSON.stringify({registeredRows:graph.length,overrideRecords:audit.length}));
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
