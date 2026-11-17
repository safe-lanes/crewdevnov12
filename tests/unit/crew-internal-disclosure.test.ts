import { describe,it,expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
function files(root:string):string[]{
  return fs.readdirSync(root,{withFileTypes:true}).flatMap(f=>{
    const p=path.join(root,f.name);
    return f.isDirectory()?files(p):/\.[jt]sx?$/.test(p)?[p]:[];
  });
}
describe("Part H disclosure boundary",()=>{
  it("does not reference confidential storage in any general reader, Report, form, attachment, account or alert",()=>{
    const roots=["server/v2/crew-pool","server/v2/reports","server/v2/vessel","server/v2/rotation",
      "server/v2/company-forms","server/v2/briefings","server/v2/debriefings","server/v2/accounts",
      "server/v2/alerts","server/v2/assistant","server/v2/shared"];
    const checked=roots.filter(fs.existsSync).flatMap(files);
    const leaks=checked.filter(file=>/\bcrew_internal_(?:comments|actions)\b|from\s+["'][^"']*crew-internal/.test(fs.readFileSync(file,"utf8")));
    expect(checked.length).toBeGreaterThan(100);
    expect(leaks).toEqual([]);
  });
  it("keeps Part H out of every PDF generator and crew grid export mapping",()=>{
    const generators=files("client/src/lib").filter(f=>/PDF|CrewList/.test(f));
    generators.push("client/src/modules/crew-pool/CrewPoolModule_v2.tsx");
    for(const file of generators){
      expect(fs.readFileSync(file,"utf8"),file).not.toMatch(/crew-internal|crew_internal_|CrewInternalRecords/);
    }
    const pdf=fs.readFileSync("client/src/lib/generateCrewInfoPDF.ts","utf8");
    expect(pdf).not.toMatch(/drawPart[GH]/);
  });
  it("excludes confidential endpoint bodies from both development and production logging",()=>{
    for(const file of ["server/index.ts","server/production.ts"])
      expect(fs.readFileSync(file,"utf8")).toContain('if (!path.startsWith("/api/v2/crew-internal")) capturedJsonResponse = bodyJson;');
    for(const file of files("server/v2/crew-internal"))
      expect(fs.readFileSync(file,"utf8"),file).not.toMatch(/console\.(?:log|error|warn)/);
  });
});
